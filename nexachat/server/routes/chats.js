import express from 'express';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import auth from '../middleware/auth.js';
import { chatValidation, createGroupValidation } from '../utils/validators.js';
import { logger } from '../utils/helpers.js';

const router = express.Router();

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

      // Ищем чаты по имени участника
      const usersWithName = await User.find({ name: searchRegex }).select('_id');
      const userIds = usersWithName.map(u => u._id);
      
      const chatsByParticipant = await Chat.find({
        ...query,
        participants: { $in: userIds }
      }).populate('participants', 'name avatar email isOnline lastSeen');

      // Объединяем результаты и убираем дубликаты
      const chatIds = new Set([...chatsByName.map(c => c._id.toString()), ...chatsByParticipant.map(c => c._id.toString())]);
      const chats = [...chatsByName, ...chatsByParticipant].filter((chat, index, self) => 
        index === self.findIndex(c => c._id.toString() === chat._id.toString())
      );

      return res.json({
        success: true,
        count: chats.length,
        chats
      });
    }

    const chats = await Chat.find(query)
      .populate('participants', 'name avatar email isOnline lastSeen')
      .sort({ updatedAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const count = await Chat.countDocuments(query);

    res.json({
      success: true,
      count: chats.length,
      total: count,
      page: parseInt(page),
      pages: Math.ceil(count / limit),
      chats
    });

  } catch (error) {
    logger.error('Ошибка получения чатов:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при получении чатов',
      error: error.message
    });
  }
});

/**
 * POST /api/chats - Создать новый чат (личный или групповой)
 */
router.post('/', auth, async (req, res) => {
  try {
    const { error } = createGroupValidation.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации',
        errors: error.details.map(d => d.message)
      });
    }

    const { type = 'private', participants, groupName, groupAvatar } = req.body;
    const creatorId = req.user._id;

    // Проверка участников
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Необходимо указать хотя бы одного участника'
      });
    }

    // Добавляем создателя в участники если его там нет
    if (!participants.includes(creatorId.toString())) {
      participants.push(creatorId.toString());
    }

    // Проверка существования пользователей
    const users = await User.find({ _id: { $in: participants } });
    if (users.length !== participants.length) {
      return res.status(400).json({
        success: false,
        message: 'Один или несколько пользователей не найдены'
      });
    }

    // Для личного чата проверяем, не существует ли уже такой чат
    if (type === 'private' && participants.length === 2) {
      const existingChat = await Chat.findOne({
        type: 'private',
        participants: { $all: participants }
      });

      if (existingChat) {
        return res.json({
          success: true,
          message: 'Чат уже существует',
          chat: existingChat
        });
      }
    }

    // Создаём чат
    const chatData = {
      type,
      participants,
      creator: creatorId
    };

    if (type === 'group') {
      chatData.groupName = groupName || 'Групповой чат';
      chatData.groupAvatar = groupAvatar;
      chatData.admins = [creatorId];
    }

    const chat = new Chat(chatData);
    await chat.save();

    // Заполняем данные об участниках
    const populatedChat = await Chat.findById(chat._id)
      .populate('participants', 'name avatar email isOnline lastSeen');

    logger.info(`Чат создан: ${chat._id}, тип: ${type}`);

    res.status(201).json({
      success: true,
      message: 'Чат успешно создан',
      chat: populatedChat
    });

  } catch (error) {
    logger.error('Ошибка создания чата:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при создании чата',
      error: error.message
    });
  }
});

/**
 * GET /api/chats/:id - Получить конкретный чат
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      participants: req.user._id
    }).populate('participants', 'name avatar email isOnline lastSeen');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Чат не найден'
      });
    }

    res.json({
      success: true,
      chat
    });

  } catch (error) {
    logger.error('Ошибка получения чата:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при получении чата',
      error: error.message
    });
  }
});

/**
 * PUT /api/chats/:id - Обновить чат (только для групповых)
 */
router.put('/:id', auth, async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      participants: req.user._id
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Чат не найден'
      });
    }

    // Только админы могут редактировать группу
    if (chat.type === 'group' && !chat.admins.some(id => id.toString() === req.user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Только администраторы могут редактировать группу'
      });
    }

    const { groupName, groupAvatar } = req.body;

    if (groupName) chat.groupName = groupName;
    if (groupAvatar !== undefined) chat.groupAvatar = groupAvatar;

    await chat.save();

    const updatedChat = await Chat.findById(chat._id)
      .populate('participants', 'name avatar email isOnline lastSeen');

    res.json({
      success: true,
      message: 'Чат обновлён',
      chat: updatedChat
    });

  } catch (error) {
    logger.error('Ошибка обновления чата:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при обновлении чата',
      error: error.message
    });
  }
});

/**
 * DELETE /api/chats/:id - Удалить чат (для себя)
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      participants: req.user._id
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Чат не найден'
      });
    }

    // Если создатель удаляет личный чат - удаляем полностью
    if (chat.type === 'private' && chat.creator.toString() === req.user._id.toString()) {
      await Chat.findByIdAndDelete(req.params.id);
      await Message.deleteMany({ chatId: req.params.id });
      
      logger.info(`Чат удалён: ${req.params.id}`);
      
      return res.json({
        success: true,
        message: 'Чат удалён'
      });
    }

    // Для группового чата или если не создатель - просто удаляем из участников
    chat.participants = chat.participants.filter(id => id.toString() !== req.user._id.toString());
    
    if (chat.admins) {
      chat.admins = chat.admins.filter(id => id.toString() !== req.user._id.toString());
    }

    // Если участников не осталось, удаляем чат
    if (chat.participants.length === 0) {
      await Chat.findByIdAndDelete(req.params.id);
      await Message.deleteMany({ chatId: req.params.id });
    } else {
      await chat.save();
    }

    res.json({
      success: true,
      message: 'Вы покинули чат'
    });

  } catch (error) {
    logger.error('Ошибка удаления чата:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при удалении чата',
      error: error.message
    });
  }
});

/**
 * POST /api/chats/:id/participants - Добавить участников в группу
 */
router.post('/:id/participants', auth, async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      participants: req.user._id
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Чат не найден'
      });
    }

    if (chat.type !== 'group') {
      return res.status(400).json({
        success: false,
        message: 'Нельзя добавить участников в личный чат'
      });
    }

    // Только админы могут добавлять участников
    if (!chat.admins.some(id => id.toString() === req.user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Только администраторы могут добавлять участников'
      });
    }

    const { participants } = req.body;
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Необходимо указать хотя бы одного участника'
      });
    }

    // Проверка существования пользователей
    const users = await User.find({ _id: { $in: participants }, _id: { $ne: req.user._id } });
    if (users.length !== participants.length) {
      return res.status(400).json({
        success: false,
        message: 'Один или несколько пользователей не найдены'
      });
    }

    // Добавляем новых участников (без дубликатов)
    const newParticipants = participants.filter(id => 
      !chat.participants.some(p => p.toString() === id)
    );

    if (newParticipants.length === 0) {
      return res.json({
        success: true,
        message: 'Все указанные пользователи уже являются участниками',
        chat
      });
    }

    chat.participants.push(...newParticipants);
    await chat.save();

    const updatedChat = await Chat.findById(chat._id)
      .populate('participants', 'name avatar email isOnline lastSeen');

    res.json({
      success: true,
      message: `Добавлено ${newParticipants.length} участников`,
      chat: updatedChat
    });

  } catch (error) {
    logger.error('Ошибка добавления участников:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при добавлении участников',
      error: error.message
    });
  }
});

/**
 * DELETE /api/chats/:id/participants/:userId - Удалить участника из группы
 */
router.delete('/:id/participants/:userId', auth, async (req, res) => {
  try {
    const chat = await Chat.findOne({
      _id: req.params.id,
      participants: req.user._id
    });

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Чат не найден'
      });
    }

    if (chat.type !== 'group') {
      return res.status(400).json({
        success: false,
        message: 'Нельзя удалить участника из личного чата'
      });
    }

    // Только админы могут удалять участников
    if (!chat.admins.some(id => id.toString() === req.user._id.toString())) {
      return res.status(403).json({
        success: false,
        message: 'Только администраторы могут удалять участников'
      });
    }

    const userIdToRemove = req.params.userId;

    // Нельзя удалить последнего участника или себя
    if (chat.participants.length <= 1 || userIdToRemove === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Невозможно удалить участника'
      });
    }

    chat.participants = chat.participants.filter(id => id.toString() !== userIdToRemove);
    if (chat.admins) {
      chat.admins = chat.admins.filter(id => id.toString() !== userIdToRemove);
    }

    await chat.save();

    const updatedChat = await Chat.findById(chat._id)
      .populate('participants', 'name avatar email isOnline lastSeen');

    res.json({
      success: true,
      message: 'Участник удалён из группы',
      chat: updatedChat
    });

  } catch (error) {
    logger.error('Ошибка удаления участника:', error);
    res.status(500).json({
      success: false,
      message: 'Ошибка сервера при удалении участника',
      error: error.message
    });
  }
});

export default router;
