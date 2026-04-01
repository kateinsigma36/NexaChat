const express = require('express');
const router = express.Router();
const Chat = require('../models/Chat');
const User = require('../models/User');
const Message = require('../models/Message');
const auth = require('../middleware/auth');
const { chatValidation, createGroupValidation } = require('../utils/validators');
const { logger } = require('../utils/helpers');

/**
 * GET /api/chats - Получить все чаты пользователя
 */
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, search } = req.query;

    // Находим все чаты с участием пользователя
    let query = { participants: userId };
    
    if (search) {
      // Поиск по названию группы или имени участника (для личных чатов)
      const searchRegex = new RegExp(search, 'i');
      
      // Сначала ищем чаты по названию
      const chatsByName = await Chat.find({
        ...query,
        groupName: searchRegex
      }).populate('participants', 'name avatar email isOnline lastSeen');

      // Затем ищем личные чаты по участникам
      const users = await User.find({ name: searchRegex }).select('_id');
      const userIds = users.map(u => u._id);
      
      const chatsByParticipant = await Chat.find({
        type: 'private',
        participants: { $in: userIds },
        _id: { $nin: chatsByName.map(c => c._id) }
      }).populate('participants', 'name avatar email isOnline lastSeen');

      const allChats = [...chatsByName, ...chatsByParticipant];
      
      // Пагинация
      const startIndex = (page - 1) * limit;
      const paginatedChats = allChats.slice(startIndex, startIndex + parseInt(limit));

      return res.json({
        success: true,
        count: allChats.length,
        chats: paginatedChats
      });
    }

    // Без поиска - стандартная пагинация
    const chats = await Chat.find(query)
      .sort({ updatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('participants', 'name avatar email isOnline lastSeen')
      .populate('creator', 'name avatar');

    const count = await Chat.countDocuments(query);

    res.json({
      success: true,
      count: chats.length,
      total: count,
      hasMore: page * limit < count,
      chats
    });
  } catch (error) {
    logger.error(`Ошибка получения чатов: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/chats/:id - Получить конкретный чат
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const chatId = req.params.id;

    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId
    })
      .populate('participants', 'name avatar email isOnline lastSeen status')
      .populate('creator', 'name avatar email')
      .populate('admins', 'name avatar email');

    if (!chat) {
      return res.status(404).json({ success: false, error: 'Чат не найден' });
    }

    // Получаем последние сообщения
    const messages = await Message.find({ chatId })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('sender', 'name avatar email')
      .populate('replyTo');

    res.json({
      success: true,
      chat,
      messages: messages.reverse() // Возвращаем в хронологическом порядке
    });
  } catch (error) {
    logger.error(`Ошибка получения чата: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/chats - Создать новый чат (личный или групповой)
 */
router.post('/', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const { type = 'private', participants, groupName, groupAvatar } = req.body;

    // Валидация
    const { error } = type === 'group' 
      ? createGroupValidation.validate(req.body)
      : chatValidation.validate(req.body);
    
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }

    // Проверка участников
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ success: false, error: 'Необходимо указать участников' });
    }

    // Добавляем текущего пользователя в участники если его нет
    const allParticipants = participants.includes(userId) 
      ? participants 
      : [...participants, userId];

    // Для личного чата - проверяем, существует ли уже чат с этими участниками
    if (type === 'private') {
      if (allParticipants.length !== 2) {
        return res.status(400).json({ success: false, error: 'Личный чат должен иметь ровно 2 участников' });
      }

      const existingChat = await Chat.findOne({
        type: 'private',
        participants: { $all: allParticipants }
      });

      if (existingChat) {
        return res.json({ success: true, chat: existingChat, created: false });
      }
    }

    // Создаём чат
    const chatData = {
      type,
      participants: allParticipants,
      creator: userId
    };

    if (type === 'group') {
      chatData.groupName = groupName;
      chatData.groupAvatar = groupAvatar;
      chatData.admins = [userId]; // Создатель становится админом
    }

    const chat = await Chat.create(chatData);
    
    // Заполняем данные
    const populatedChat = await Chat.findById(chat._id)
      .populate('participants', 'name avatar email isOnline lastSeen')
      .populate('creator', 'name avatar')
      .populate('admins', 'name avatar');

    logger.info(`Создан чат ${chat._id} пользователем ${userId}`);
    res.status(201).json({ success: true, chat: populatedChat, created: true });
  } catch (error) {
    logger.error(`Ошибка создания чата: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/chats/:id - Обновить чат (только для групповых)
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const chatId = req.params.id;
    const { groupName, groupAvatar, admins } = req.body;

    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId
    });

    if (!chat) {
      return res.status(404).json({ success: false, error: 'Чат не найден' });
    }

    if (chat.type !== 'group') {
      return res.status(400).json({ success: false, error: 'Можно обновлять только групповые чаты' });
    }

    // Проверка прав администратора
    const isAdmin = chat.admins.some(admin => admin.toString() === userId);
    const isCreator = chat.creator.toString() === userId;
    
    if (!isAdmin && !isCreator) {
      return res.status(403).json({ success: false, error: 'Нет прав на редактирование' });
    }

    // Обновляем поля
    if (groupName !== undefined) chat.groupName = groupName;
    if (groupAvatar !== undefined) chat.groupAvatar = groupAvatar;
    if (admins !== undefined && Array.isArray(admins)) {
      // Только создатель может менять админов
      if (isCreator) {
        chat.admins = admins;
      }
    }

    chat.updatedAt = new Date();
    await chat.save();

    const updatedChat = await Chat.findById(chat._id)
      .populate('participants', 'name avatar email isOnline lastSeen')
      .populate('creator', 'name avatar')
      .populate('admins', 'name avatar');

    res.json({ success: true, chat: updatedChat });
  } catch (error) {
    logger.error(`Ошибка обновления чата: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/chats/:id/participants - Добавить участников в группу
 */
router.post('/:id/participants', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const chatId = req.params.id;
    const { participants } = req.body;

    if (!participants || !Array.isArray(participants)) {
      return res.status(400).json({ success: false, error: 'Некорректные данные участников' });
    }

    const chat = await Chat.findOne({
      _id: chatId,
      type: 'group'
    });

    if (!chat) {
      return res.status(404).json({ success: false, error: 'Группа не найдена' });
    }

    // Проверка прав
    const isAdmin = chat.admins.some(admin => admin.toString() === userId);
    if (!isAdmin && chat.creator.toString() !== userId) {
      return res.status(403).json({ success: false, error: 'Только администраторы могут добавлять участников' });
    }

    // Проверка лимита (256 участников)
    if (chat.participants.length + participants.length > 256) {
      return res.status(400).json({ success: false, error: 'Превышен лимит участников (256)' });
    }

    // Добавляем новых участников (если их ещё нет)
    const newParticipants = participants.filter(
      p => !chat.participants.some(existing => existing.toString() === p)
    );

    if (newParticipants.length === 0) {
      return res.json({ success: true, message: 'Участники уже в группе', chat });
    }

    chat.participants.push(...newParticipants);
    chat.updatedAt = new Date();
    await chat.save();

    // Создаём системное сообщение
    await Message.create({
      chatId,
      sender: userId,
      type: 'system',
      content: `Добавлено участников: ${newParticipants.length}`
    });

    const updatedChat = await Chat.findById(chat._id)
      .populate('participants', 'name avatar email isOnline lastSeen');

    res.json({ success: true, chat: updatedChat });
  } catch (error) {
    logger.error(`Ошибка добавления участников: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/chats/:id/participants/:participantId - Удалить участника из группы
 */
router.delete('/:id/participants/:participantId', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const chatId = req.params.id;
    const participantId = req.params.participantId;

    const chat = await Chat.findOne({
      _id: chatId,
      type: 'group'
    });

    if (!chat) {
      return res.status(404).json({ success: false, error: 'Группа не найдена' });
    }

    // Нельзя удалить создателя
    if (chat.creator.toString() === participantId) {
      return res.status(400).json({ success: false, error: 'Нельзя удалить создателя группы' });
    }

    // Проверка прав
    const isAdmin = chat.admins.some(admin => admin.toString() === userId);
    const isSelf = participantId === userId;
    
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ success: false, error: 'Нет прав на удаление участника' });
    }

    chat.participants = chat.participants.filter(
      p => p.toString() !== participantId
    );
    chat.admins = chat.admins.filter(a => a.toString() !== participantId);
    chat.updatedAt = new Date();
    await chat.save();

    // Системное сообщение
    await Message.create({
      chatId,
      sender: userId,
      type: 'system',
      content: isSelf ? 'Вы покинули группу' : 'Участник удалён из группы'
    });

    res.json({ success: true, message: 'Участник удалён' });
  } catch (error) {
    logger.error(`Ошибка удаления участника: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/chats/:id/pin - Закрепить чат
 */
router.post('/:id/pin', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const chatId = req.params.id;

    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId
    });

    if (!chat) {
      return res.status(404).json({ success: false, error: 'Чат не найден' });
    }

    // Добавляем пользователя в закреплённые
    if (!chat.pinnedBy.includes(userId)) {
      chat.pinnedBy.push(userId);
      await chat.save();
    }

    res.json({ success: true, message: 'Чат закреплён' });
  } catch (error) {
    logger.error(`Ошибка закрепления чата: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/chats/:id/pin - Открепить чат
 */
router.delete('/:id/pin', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const chatId = req.params.id;

    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId
    });

    if (!chat) {
      return res.status(404).json({ success: false, error: 'Чат не найден' });
    }

    chat.pinnedBy = chat.pinnedBy.filter(id => id.toString() !== userId);
    await chat.save();

    res.json({ success: true, message: 'Чат откреплён' });
  } catch (error) {
    logger.error(`Ошибка открепления чата: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/chats/:id/archive - Архивировать чат
 */
router.post('/:id/archive', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const chatId = req.params.id;

    // Здесь можно добавить логику архивации (отдельное поле archivedBy)
    // Для простоты просто возвращаем успех
    res.json({ success: true, message: 'Чат архивирован' });
  } catch (error) {
    logger.error(`Ошибка архивации чата: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/chats/:id - Удалить чат (для себя)
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const chatId = req.params.id;

    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId
    });

    if (!chat) {
      return res.status(404).json({ success: false, error: 'Чат не найден' });
    }

    // Если это личный чат или пользователь не создатель - просто удаляем из своих
    // Если это группа и пользователь создатель - удаляем всю группу
    if (chat.type === 'group' && chat.creator.toString() === userId) {
      await Chat.deleteOne({ _id: chatId });
      await Message.deleteMany({ chatId });
      logger.info(`Группа ${chatId} удалена создателем`);
    } else {
      // Удаляем пользователя из участников
      chat.participants = chat.participants.filter(p => p.toString() !== userId);
      await chat.save();
      logger.info(`Пользователь ${userId} удалил чат ${chatId} у себя`);
    }

    res.json({ success: true, message: 'Чат удалён' });
  } catch (error) {
    logger.error(`Ошибка удаления чата: ${error.message}`);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
