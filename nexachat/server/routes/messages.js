import express from 'express';
import Message from '../models/Message.js';
import Chat from '../models/Chat.js';
import auth from '../middleware/auth.js';
import { messageValidation } from '../utils/validators.js';
import { logger } from '../utils/helpers.js';

const router = express.Router();

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
      messages: messages.reverse() // Переворачиваем для хронологического порядка
    });

  } catch (error) {
    logger.error('Ошибка получения сообщений:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при получении сообщений',
      error: error.message
    });
  }
});

/**
 * POST /api/messages - Отправить сообщение
 */
router.post('/', auth, async (req, res) => {
  try {
    const { error } = messageValidation.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации',
        errors: error.details.map(d => d.message)
      });
    }

    const { chatId, content, type = 'text', replyTo, fileIds } = req.body;
    const senderId = req.user._id;

    // Проверяем доступ к чату
    const chat = await Chat.findOne({
      _id: chatId,
      participants: senderId
    });

    if (!chat) {
      return res.status(404).json({ success: false, error: 'Чат не найден' });
    }

    // Если это ответ на сообщение, проверяем его существование
    if (replyTo) {
      const parentMessage = await Message.findOne({ _id: replyTo, chatId });
      if (!parentMessage) {
        return res.status(404).json({ success: false, error: 'Сообщение, на которое вы отвечаете, не найдено' });
      }
    }

    // Создаём сообщение
    const messageData = {
      chatId,
      sender: senderId,
      type,
      content
    };

    if (replyTo) messageData.replyTo = replyTo;
    if (fileIds && fileIds.length > 0) messageData.files = fileIds;

    const message = new Message(messageData);
    await message.save();

    // Обновляем lastMessage в чате
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: {
        text: type === 'text' ? content : `[${type}]`,
        sender: senderId,
        timestamp: new Date()
      }
    });

    // Заполняем данные об отправителе
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name avatar email')
      .populate('replyTo')
      .populate('files');

    logger.info(`Сообщение создано: ${message._id} в чате ${chatId}`);

    // TODO: Отправить через WebSocket
    // io.to(chatId).emit('message:new', populatedMessage);

    res.status(201).json({
      success: true,
      message: 'Сообщение отправлено',
      data: populatedMessage
    });

  } catch (error) {
    logger.error('Ошибка отправки сообщения:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при отправке сообщения',
      error: error.message
    });
  }
});

/**
 * PUT /api/messages/:id - Редактировать сообщение
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Содержимое сообщения не может быть пустым'
      });
    }

    const message = await Message.findOne({
      _id: req.params.id,
      sender: req.user._id,
      deletedForAll: false
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Сообщение не найдено или вы не можете его редактировать'
      });
    }

    // Можно редактировать только в течение 24 часов
    const hoursSinceCreation = (Date.now() - message.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation > 24) {
      return res.status(403).json({
        success: false,
        message: 'Редактирование возможно только в течение 24 часов'
      });
    }

    message.content = content;
    message.editedAt = new Date();
    await message.save();

    const updatedMessage = await Message.findById(message._id)
      .populate('sender', 'name avatar email');

    logger.info(`Сообщение отредактировано: ${message._id}`);

    // TODO: Отправить через WebSocket
    // io.to(message.chatId).emit('message:updated', updatedMessage);

    res.json({
      success: true,
      message: 'Сообщение обновлено',
      data: updatedMessage
    });

  } catch (error) {
    logger.error('Ошибка редактирования сообщения:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при редактировании сообщения',
      error: error.message
    });
  }
});

/**
 * DELETE /api/messages/:id - Удалить сообщение
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const { forAll = false } = req.query;
    const userId = req.user._id;

    const message = await Message.findOne({
      _id: req.params.id,
      chatId: { $in: (await Chat.find({ participants: userId }).distinct('_id')) }
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Сообщение не найдено'
      });
    }

    if (forAll) {
      // Удалить для всех (только автор может)
      if (message.sender.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Только автор может удалить сообщение для всех'
        });
      }

      message.deletedForAll = true;
      message.content = '[Сообщение удалено]';
      await message.save();

      logger.info(`Сообщение удалено для всех: ${message._id}`);

      // TODO: Отправить через WebSocket
      // io.to(message.chatId).emit('message:deleted', { messageId: message._id, forAll: true });

    } else {
      // Удалить только для себя
      if (!message.deletedFor.includes(userId)) {
        message.deletedFor.push(userId);
        await message.save();
      }

      logger.info(`Сообщение удалено для пользователя: ${message._id}, user: ${userId}`);

      // TODO: Отправить через WebSocket
      // io.to(message.chatId).emit('message:deleted', { messageId: message._id, userId });
    }

    res.json({
      success: true,
      message: forAll ? 'Сообщение удалено для всех' : 'Сообщение удалено'
    });

  } catch (error) {
    logger.error('Ошибка удаления сообщения:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при удалении сообщения',
      error: error.message
    });
  }
});

/**
 * POST /api/messages/:id/reactions - Добавить реакцию
 */
router.post('/:id/reactions', auth, async (req, res) => {
  try {
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({
        success: false,
        message: 'Эмодзи реакции обязателен'
      });
    }

    const message = await Message.findOne({
      _id: req.params.id,
      chatId: { $in: (await Chat.find({ participants: req.user._id }).distinct('_id')) }
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Сообщение не найдено'
      });
    }

    // Проверяем, есть ли уже такая реакция от этого пользователя
    const existingReactionIndex = message.reactions.findIndex(
      r => r.user.toString() === req.user._id.toString() && r.emoji === emoji
    );

    if (existingReactionIndex >= 0) {
      // Удаляем реакцию (toggle)
      message.reactions.splice(existingReactionIndex, 1);
    } else {
      // Удаляем другие реакции этого пользователя и добавляем новую
      message.reactions = message.reactions.filter(r => r.user.toString() !== req.user._id.toString());
      message.reactions.push({ user: req.user._id, emoji });
    }

    await message.save();

    const updatedMessage = await Message.findById(message._id)
      .populate('reactions.user', 'name avatar');

    logger.info(`Реакция обновлена: ${message._id}, emoji: ${emoji}`);

    // TODO: Отправить через WebSocket
    // io.to(message.chatId).emit('message:reaction', { messageId: message._id, reactions: updatedMessage.reactions });

    res.json({
      success: true,
      message: 'Реакция обновлена',
      data: updatedMessage.reactions
    });

  } catch (error) {
    logger.error('Ошибка добавления реакции:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при добавлении реакции',
      error: error.message
    });
  }
});

/**
 * PUT /api/messages/:id/read - Отметить сообщение как прочитанное
 */
router.put('/:id/read', auth, async (req, res) => {
  try {
    const message = await Message.findOne({
      _id: req.params.id,
      chatId: { $in: (await Chat.find({ participants: req.user._id }).distinct('_id')) }
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Сообщение не найдено'
      });
    }

    // Проверяем, не прочитано ли уже
    const alreadyRead = message.readBy.some(r => r.user.toString() === req.user._id.toString());
    if (!alreadyRead) {
      message.readBy.push({ user: req.user._id, readAt: new Date() });
      await message.save();

      logger.info(`Сообщение отмечено как прочитанное: ${message._id}`);

      // TODO: Отправить через WebSocket
      // io.to(message.chatId).emit('message:read', { 
      //   messageId: message._id, 
      //   userId: req.user._id,
      //   readAt: new Date()
      // });
    }

    res.json({
      success: true,
      message: 'Статус прочтения обновлён'
    });

  } catch (error) {
    logger.error('Ошибка обновления статуса прочтения:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при обновлении статуса',
      error: error.message
    });
  }
});

export default router;
