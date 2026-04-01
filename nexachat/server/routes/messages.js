const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const auth = require('../middleware/auth');
const { messageValidation } = require('../utils/validators');
const { logger } = require('../utils/helpers');

/**
 * GET /api/messages/:chatId - Получить сообщения чата с пагинацией
 */
router.get('/:chatId', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const chatId = req.params.chatId;
    const { page = 1, limit = 50, before } = req.query;

    // Проверяем доступ к чату
    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId
    });

    if (!chat) {
      return res.status(404).json({ success: false, error: 'Чат не найден' });
    }

    // Строим запрос
    let query = { 
      chatId,
      deletedFor: { $ne: userId },
      deletedForAll: false
    };

    // Пагинация: сообщения перед указанной датой (для подгрузки при скролле вверх)
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('sender', 'name avatar email')
      .populate('replyTo')
      .populate('reactions.user', 'name avatar');

    res.json({
      success: true,
      count: messages.length,
      hasMore: messages.length === parseInt(limit),
      messages: messages.reverse() // Возвращаем в хронологическом порядке
    });
  } catch (error) {
    logger.error(`Ошибка получения сообщений: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/messages - Отправить сообщение (REST API, альтернатива WebSocket)
 */
router.post('/', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { chatId, content, type = 'text', replyTo, attachments } = req.body;

    // Валидация
    const { error } = messageValidation.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    // Проверяем доступ к чату
    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId
    });

    if (!chat) {
      return res.status(404).json({ success: false, error: 'Чат не найден' });
    }

    // Создаём сообщение
    const messageData = {
      chatId,
      sender: userId,
      type,
      content,
      replyTo: replyTo || null,
      attachments: attachments || []
    };

    const message = await Message.create(messageData);

    // Заполняем данные
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name avatar email')
      .populate('replyTo');

    // Обновляем последнее сообщение в чате
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: {
        text: content,
        sender: userId,
        timestamp: new Date()
      },
      updatedAt: new Date()
    });

    logger.info(`Сообщение отправлено в чат ${chatId} пользователем ${userId}`);
    res.status(201).json({ success: true, message: populatedMessage });
  } catch (error) {
    logger.error(`Ошибка отправки сообщения: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/messages/:id - Редактировать сообщение
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const messageId = req.params.id;
    const { content } = req.body;

    const message = await Message.findOne({
      _id: messageId,
      sender: userId
    });

    if (!message) {
      return res.status(404).json({ success: false, error: 'Сообщение не найдено' });
    }

    // Проверка времени (24 часа)
    const hoursSinceSent = (Date.now() - message.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceSent > 24) {
      return res.status(400).json({ 
        success: false, 
        error: 'Можно редактировать только в течение 24 часов' 
      });
    }

    message.content = content;
    message.editedAt = new Date();
    await message.save();

    const updatedMessage = await Message.findById(message._id)
      .populate('sender', 'name avatar email');

    res.json({ success: true, message: updatedMessage });
  } catch (error) {
    logger.error(`Ошибка редактирования сообщения: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/messages/:id - Удалить сообщение
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const messageId = req.params.id;
    const { deleteForAll = false } = req.query;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, error: 'Сообщение не найдено' });
    }

    if (deleteForAll) {
      // Только автор может удалить для всех
      if (message.sender.toString() !== userId) {
        return res.status(403).json({ 
          success: false, 
          error: 'Только автор может удалить сообщение для всех' 
        });
      }

      message.deletedForAll = true;
      message.content = '[Сообщение удалено]';
      await message.save();

      logger.info(`Сообщение ${messageId} удалено для всех`);
    } else {
      // Удаление для себя
      if (!message.deletedFor.includes(userId)) {
        message.deletedFor.push(userId);
        await message.save();
      }

      logger.info(`Сообщение ${messageId} удалено для пользователя ${userId}`);
    }

    res.json({ success: true, message: 'Сообщение удалено' });
  } catch (error) {
    logger.error(`Ошибка удаления сообщения: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/messages/:id/reactions - Добавить реакцию
 */
router.post('/:id/reactions', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const messageId = req.params.id;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({ success: false, error: 'Эмодзи обязателен' });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, error: 'Сообщение не найдено' });
    }

    // Проверяем доступ к чату
    const chat = await Chat.findById(message.chatId);
    const isParticipant = chat.participants.some(p => p.toString() === userId);
    if (!isParticipant) {
      return res.status(403).json({ success: false, error: 'Нет доступа к чату' });
    }

    // Добавляем или обновляем реакцию
    const existingReaction = message.reactions.find(r => r.user.toString() === userId);
    if (existingReaction) {
      existingReaction.emoji = emoji;
    } else {
      message.reactions.push({ user: userId, emoji });
    }

    await message.save();

    const updatedMessage = await Message.findById(messageId)
      .populate('reactions.user', 'name avatar');

    res.json({ success: true, reactions: updatedMessage.reactions });
  } catch (error) {
    logger.error(`Ошибка добавления реакции: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/messages/:id/reactions - Удалить реакцию
 */
router.delete('/:id/reactions', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const messageId = req.params.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, error: 'Сообщение не найдено' });
    }

    message.reactions = message.reactions.filter(
      r => r.user.toString() !== userId
    );

    await message.save();

    res.json({ success: true, message: 'Реакция удалена' });
  } catch (error) {
    logger.error(`Ошибка удаления реакции: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/messages/:id/read - Отметить сообщение как прочитанное
 */
router.post('/:id/read', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const messageId = req.params.id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, error: 'Сообщение не найдено' });
    }

    // Проверяем доступ к чату
    const chat = await Chat.findById(message.chatId);
    const isParticipant = chat.participants.some(p => p.toString() === userId);
    if (!isParticipant) {
      return res.status(403).json({ success: false, error: 'Нет доступа к чату' });
    }

    // Добавляем запись о прочтении
    const existingRead = message.readBy.find(r => r.user.toString() === userId);
    if (!existingRead) {
      message.readBy.push({ user: userId, readAt: new Date() });
      await message.save();
    }

    res.json({ success: true, message: 'Статус прочтения обновлён' });
  } catch (error) {
    logger.error(`Ошибка обновления статуса прочтения: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/messages/:id/forward - Переслать сообщение
 */
router.post('/:id/forward', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const messageId = req.params.id;
    const { targetChatId } = req.body;

    if (!targetChatId) {
      return res.status(400).json({ success: false, error: 'Целевой чат обязателен' });
    }

    const originalMessage = await Message.findById(messageId);
    if (!originalMessage) {
      return res.status(404).json({ success: false, error: 'Сообщение не найдено' });
    }

    // Проверяем доступ к целевому чату
    const targetChat = await Chat.findOne({
      _id: targetChatId,
      participants: userId
    });

    if (!targetChat) {
      return res.status(404).json({ success: false, error: 'Целевой чат не найден' });
    }

    // Создаём пересланное сообщение
    const forwardedMessage = await Message.create({
      chatId: targetChatId,
      sender: userId,
      type: originalMessage.type,
      content: originalMessage.content,
      attachments: originalMessage.attachments,
      forwardedFrom: {
        messageId: originalMessage._id,
        chatId: originalMessage.chatId,
        senderName: req.user.name
      }
    });

    const populatedMessage = await Message.findById(forwardedMessage._id)
      .populate('sender', 'name avatar email');

    // Обновляем последнее сообщение в чате
    await Chat.findByIdAndUpdate(targetChatId, {
      lastMessage: {
        text: originalMessage.content,
        sender: userId,
        timestamp: new Date()
      },
      updatedAt: new Date()
    });

    logger.info(`Сообщение переслано в чат ${targetChatId}`);
    res.status(201).json({ success: true, message: populatedMessage });
  } catch (error) {
    logger.error(`Ошибка пересылки сообщения: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/messages/search - Поиск по сообщениям
 */
router.get('/search', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { q, chatId, page = 1, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({ success: false, error: 'Поисковый запрос обязателен' });
    }

    // Находим чаты пользователя
    const userChats = await Chat.find({ participants: userId }).select('_id');
    const chatIds = userChats.map(c => c._id);

    // Строим запрос
    let query = {
      chatId: { $in: chatIds },
      type: 'text',
      deletedForAll: false,
      content: new RegExp(q, 'i')
    };

    if (chatId) {
      query.chatId = chatId;
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((page - 1) * limit)
      .populate('chatId', 'type groupName participants')
      .populate('sender', 'name avatar');

    const total = await Message.countDocuments(query);

    res.json({
      success: true,
      count: messages.length,
      total,
      hasMore: page * limit < total,
      messages
    });
  } catch (error) {
    logger.error(`Ошибка поиска сообщений: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
