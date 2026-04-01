/**
 * Socket.IO сервис для real-time коммуникации
 * Обрабатывает подключения пользователей, сообщения, статусы онлайн, индикаторы набора
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const { logger } = require('../utils/helpers');

// Хранилище активных подключений: userId -> socketId
const onlineUsers = new Map();

// Хранилище комнат чатов: chatId -> Set(socketIds)
const chatRooms = new Map();

/**
 * Инициализация Socket.IO
 * @param {Server} io - Socket.IO сервер
 */
const initializeSocket = (io) => {
  // Middleware для аутентификации при подключении
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error: Token not provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      // Сохраняем пользователя в объекте сокета
      socket.user = user;
      socket.userId = user._id.toString();
      
      logger.info(`🔌 Пользователь ${user.name} подключается к WebSocket`);
      next();
    } catch (error) {
      logger.error(`❌ Ошибка аутентификации WebSocket: ${error.message}`);
      next(new Error('Authentication error'));
    }
  });

  // Обработка подключений
  io.on('connection', (socket) => {
    const { userId, user } = socket;

    // === ПОДКЛЮЧЕНИЕ ПОЛЬЗОВАТЕЛЯ ===
    handleUserConnection(socket, userId, user, io);

    // === ОТКЛЮЧЕНИЕ ПОЛЬЗОВАТЕЛЯ ===
    socket.on('disconnect', () => {
      handleUserDisconnect(socket, userId, io);
    });

    // === СОБЫТИЯ ЧАТА ===
    
    // Присоединение к комнате чата
    socket.on('join_chat', (chatId) => {
      joinChatRoom(socket, chatId);
    });

    // Выход из комнаты чата
    socket.on('leave_chat', (chatId) => {
      leaveChatRoom(socket, chatId);
    });

    // Отправка сообщения
    socket.on('send_message', async (data, callback) => {
      await handleSendMessage(socket, data, callback, io);
    });

    // Статус прочтения сообщения
    socket.on('message_read', (data) => {
      handleMessageRead(socket, data, io);
    });

    // Индикатор набора текста
    socket.on('typing_start', (data) => {
      handleTypingStart(socket, data, io);
    });

    socket.on('typing_stop', (data) => {
      handleTypingStop(socket, data, io);
    });

    // Реакция на сообщение
    socket.on('add_reaction', async (data, callback) => {
      await handleAddReaction(socket, data, callback, io);
    });

    socket.on('remove_reaction', async (data, callback) => {
      await handleRemoveReaction(socket, data, callback, io);
    });

    // Редактирование сообщения
    socket.on('edit_message', async (data, callback) => {
      await handleEditMessage(socket, data, callback, io);
    });

    // Удаление сообщения
    socket.on('delete_message', async (data, callback) => {
      await handleDeleteMessage(socket, data, callback, io);
    });

    // Пересылка сообщения
    socket.on('forward_message', async (data, callback) => {
      await handleForwardMessage(socket, data, callback, io);
    });

    // === СОБЫТИЯ ЗВОНКОВ (сигнализация WebRTC) ===
    
    socket.on('call_initiate', (data) => {
      handleCallInitiate(socket, data, io);
    });

    socket.on('call_accept', (data) => {
      handleCallAccept(socket, data, io);
    });

    socket.on('call_reject', (data) => {
      handleCallReject(socket, data, io);
    });

    socket.on('call_end', (data) => {
      handleCallEnd(socket, data, io);
    });

    // WebRTC ICE кандидаты и offer/answer
    socket.on('webrtc_offer', (data) => {
      handleWebRTCOffer(socket, data, io);
    });

    socket.on('webrtc_answer', (data) => {
      handleWebRTCAnswer(socket, data, io);
    });

    socket.on('webrtc_ice_candidate', (data) => {
      handleWebRTCIceCandidate(socket, data, io);
    });
  });

  logger.info('✅ Socket.IO сервис инициализирован');
};

/**
 * Обработка подключения пользователя
 */
const handleUserConnection = (socket, userId, user, io) => {
  // Добавляем пользователя в онлайн
  onlineUsers.set(userId, socket.id);
  
  // Обновляем статус пользователя в БД
  User.findByIdAndUpdate(userId, { 
    isOnline: true,
    lastSeen: new Date()
  }).catch(err => logger.error(`Ошибка обновления статуса онлайн: ${err.message}`));

  // Присоединяемся к личной комнате пользователя (для личных уведомлений)
  socket.join(`user:${userId}`);

  // Уведомляем контакты о том, что пользователь онлайн
  broadcastOnlineStatus(userId, true, io);

  logger.info(`🟢 Пользователь ${user.name} теперь онлайн`);
};

/**
 * Обработка отключения пользователя
 */
const handleUserDisconnect = (socket, userId, io) => {
  // Удаляем из онлайн
  onlineUsers.delete(userId);
  
  // Проверяем, есть ли другие активные подключения у этого пользователя
  const userStillOnline = Array.from(onlineUsers.values()).some(
    socketId => io.sockets.sockets.get(socketId)?.userId === userId
  );

  if (!userStillOnline) {
    // Обновляем статус в БД
    User.findByIdAndUpdate(userId, { 
      isOnline: false,
      lastSeen: new Date()
    }).catch(err => logger.error(`Ошибка обновления статуса офлайн: ${err.message}`));

    // Уведомляем контакты о том, что пользователь офлайн
    broadcastOnlineStatus(userId, false, io);

    logger.info(`🔴 Пользователь отключился`);
  }

  // Выход из всех комнат чатов
  chatRooms.forEach((members, chatId) => {
    if (members.has(socket.id)) {
      members.delete(socket.id);
      if (members.size === 0) {
        chatRooms.delete(chatId);
      }
    }
  });
};

/**
 * Присоединение к комнате чата
 */
const joinChatRoom = (socket, chatId) => {
  socket.join(`chat:${chatId}`);
  
  if (!chatRooms.has(chatId)) {
    chatRooms.set(chatId, new Set());
  }
  chatRooms.get(chatId).add(socket.id);
  
  logger.info(`Пользователь ${socket.user.name} присоединился к чату ${chatId}`);
};

/**
 * Выход из комнаты чата
 */
const leaveChatRoom = (socket, chatId) => {
  socket.leave(`chat:${chatId}`);
  
  if (chatRooms.has(chatId)) {
    const members = chatRooms.get(chatId);
    members.delete(socket.id);
    if (members.size === 0) {
      chatRooms.delete(chatId);
    }
  }
  
  logger.info(`Пользователь ${socket.user.name} покинул чат ${chatId}`);
};

/**
 * Отправка сообщения
 */
const handleSendMessage = async (socket, data, callback, io) => {
  try {
    const { chatId, content, type = 'text', replyTo, attachments } = data;
    const senderId = socket.userId;

    // Валидация
    if (!chatId || !content) {
      return callback?.({ success: false, error: 'Некорректные данные сообщения' });
    }

    // Проверка доступа к чату
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return callback?.({ success: false, error: 'Чат не найден' });
    }

    const isParticipant = chat.participants.some(
      p => p.toString() === senderId
    );
    if (!isParticipant) {
      return callback?.({ success: false, error: 'Нет доступа к чату' });
    }

    // Создаём сообщение
    const messageData = {
      chatId,
      sender: senderId,
      type,
      content,
      replyTo: replyTo || null,
      attachments: attachments || []
    };

    const message = await Message.create(messageData);

    // Заполняем данные отправителя
    const populatedMessage = await Message.findById(message._id)
      .populate('sender', 'name avatar email')
      .populate('replyTo');

    // Обновляем последнее сообщение в чате
    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: {
        text: content,
        sender: senderId,
        timestamp: new Date()
      },
      updatedAt: new Date()
    });

    // Отправляем сообщение всем участникам чата
    io.to(`chat:${chatId}`).emit('new_message', populatedMessage);

    // Уведомляем получателей (если они не в сети в этом чате)
    chat.participants.forEach(participantId => {
      if (participantId.toString() !== senderId) {
        io.to(`user:${participantId}`).emit('notification', {
          type: 'new_message',
          chatId,
          message: populatedMessage,
          from: socket.user.name
        });
      }
    });

    logger.info(`📨 Сообщение отправлено в чат ${chatId}`);
    callback?.({ success: true, message: populatedMessage });
  } catch (error) {
    logger.error(`Ошибка отправки сообщения: ${error.message}`);
    callback?.({ success: false, error: error.message });
  }
};

/**
 * Обработка прочтения сообщения
 */
const handleMessageRead = async (socket, data, io) => {
  try {
    const { chatId, messageId } = data;
    const userId = socket.userId;

    // Обновляем статус прочтения
    await Message.updateOne(
      { _id: messageId },
      {
        $addToSet: {
          readBy: { user: userId, readAt: new Date() }
        }
      }
    );

    // Уведомляем отправителя о прочтении
    const message = await Message.findById(messageId);
    if (message && message.sender.toString() !== userId) {
      io.to(`user:${message.sender}`).emit('message_read_update', {
        messageId,
        chatId,
        readBy: userId,
        readAt: new Date()
      });
    }

    // Отправляем обновление всем в чате
    io.to(`chat:${chatId}`).emit('messages_read', {
      chatId,
      messageId,
      readBy: userId
    });
  } catch (error) {
    logger.error(`Ошибка обновления статуса прочтения: ${error.message}`);
  }
};

/**
 * Начало набора текста
 */
const handleTypingStart = (socket, data, io) => {
  const { chatId } = data;
  const userId = socket.userId;
  const userName = socket.user.name;

  io.to(`chat:${chatId}`).emit('user_typing', {
    chatId,
    userId,
    userName,
    isTyping: true
  });
};

/**
 * Остановка набора текста
 */
const handleTypingStop = (socket, data, io) => {
  const { chatId } = data;
  const userId = socket.userId;

  io.to(`chat:${chatId}`).emit('user_typing', {
    chatId,
    userId,
    isTyping: false
  });
};

/**
 * Добавление реакции
 */
const handleAddReaction = async (socket, data, callback, io) => {
  try {
    const { messageId, emoji } = data;
    const userId = socket.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return callback?.({ success: false, error: 'Сообщение не найдено' });
    }

    // Проверяем доступ к чату
    const chat = await Chat.findById(message.chatId);
    const isParticipant = chat.participants.some(p => p.toString() === userId);
    if (!isParticipant) {
      return callback?.({ success: false, error: 'Нет доступа' });
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

    io.to(`chat:${message.chatId}`).emit('reaction_updated', {
      messageId,
      reactions: updatedMessage.reactions
    });

    callback?.({ success: true, reactions: updatedMessage.reactions });
  } catch (error) {
    logger.error(`Ошибка добавления реакции: ${error.message}`);
    callback?.({ success: false, error: error.message });
  }
};

/**
 * Удаление реакции
 */
const handleRemoveReaction = async (socket, data, callback, io) => {
  try {
    const { messageId } = data;
    const userId = socket.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return callback?.({ success: false, error: 'Сообщение не найдено' });
    }

    message.reactions = message.reactions.filter(
      r => r.user.toString() !== userId
    );

    await message.save();

    io.to(`chat:${message.chatId}`).emit('reaction_updated', {
      messageId,
      reactions: message.reactions
    });

    callback?.({ success: true });
  } catch (error) {
    logger.error(`Ошибка удаления реакции: ${error.message}`);
    callback?.({ success: false, error: error.message });
  }
};

/**
 * Редактирование сообщения
 */
const handleEditMessage = async (socket, data, callback, io) => {
  try {
    const { messageId, content } = data;
    const userId = socket.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return callback?.({ success: false, error: 'Сообщение не найдено' });
    }

    // Проверка: только автор может редактировать
    if (message.sender.toString() !== userId) {
      return callback?.({ success: false, error: 'Только автор может редактировать' });
    }

    // Проверка времени (24 часа)
    const hoursSinceSent = (Date.now() - message.createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceSent > 24) {
      return callback?.({ success: false, error: 'Прошло более 24 часов' });
    }

    message.content = content;
    message.editedAt = new Date();
    await message.save();

    const updatedMessage = await Message.findById(messageId)
      .populate('sender', 'name avatar');

    io.to(`chat:${message.chatId}`).emit('message_edited', {
      messageId,
      content,
      editedAt: message.editedAt,
      sender: updatedMessage.sender
    });

    callback?.({ success: true, message: updatedMessage });
  } catch (error) {
    logger.error(`Ошибка редактирования сообщения: ${error.message}`);
    callback?.({ success: false, error: error.message });
  }
};

/**
 * Удаление сообщения
 */
const handleDeleteMessage = async (socket, data, callback, io) => {
  try {
    const { messageId, deleteForAll = false } = data;
    const userId = socket.userId;

    const message = await Message.findById(messageId);
    if (!message) {
      return callback?.({ success: false, error: 'Сообщение не найдено' });
    }

    if (deleteForAll) {
      // Проверка: только автор может удалить для всех
      if (message.sender.toString() !== userId) {
        return callback?.({ success: false, error: 'Только автор может удалить для всех' });
      }
      
      message.deletedForAll = true;
      message.content = '[Сообщение удалено]';
      await message.save();

      io.to(`chat:${message.chatId}`).emit('message_deleted', {
        messageId,
        deletedForAll: true
      });
    } else {
      // Удаление для себя
      message.deletedFor.push(userId);
      await message.save();

      io.to(`user:${userId}`).emit('message_deleted_for_me', {
        messageId
      });
    }

    callback?.({ success: true });
  } catch (error) {
    logger.error(`Ошибка удаления сообщения: ${error.message}`);
    callback?.({ success: false, error: error.message });
  }
};

/**
 * Пересылка сообщения
 */
const handleForwardMessage = async (socket, data, callback, io) => {
  try {
    const { messageId, targetChatId } = data;
    const userId = socket.userId;

    const originalMessage = await Message.findById(messageId);
    if (!originalMessage) {
      return callback?.({ success: false, error: 'Сообщение не найдено' });
    }

    // Проверка доступа к целевому чату
    const targetChat = await Chat.findById(targetChatId);
    if (!targetChat) {
      return callback?.({ success: false, error: 'Чат не найден' });
    }

    const isParticipant = targetChat.participants.some(p => p.toString() === userId);
    if (!isParticipant) {
      return callback?.({ success: false, error: 'Нет доступа к чату' });
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
        senderName: socket.user.name
      }
    });

    const populatedMessage = await Message.findById(forwardedMessage._id)
      .populate('sender', 'name avatar');

    // Обновляем последнее сообщение
    await Chat.findByIdAndUpdate(targetChatId, {
      lastMessage: {
        text: originalMessage.content,
        sender: userId,
        timestamp: new Date()
      },
      updatedAt: new Date()
    });

    io.to(`chat:${targetChatId}`).emit('new_message', populatedMessage);

    callback?.({ success: true, message: populatedMessage });
  } catch (error) {
    logger.error(`Ошибка пересылки сообщения: ${error.message}`);
    callback?.({ success: false, error: error.message });
  }
};

/**
 * Уведомление об изменении статуса онлайн
 */
const broadcastOnlineStatus = (userId, isOnline, io) => {
  // Находим все чаты с этим пользователем
  Chat.find({ participants: userId }).then(chats => {
    chats.forEach(chat => {
      io.to(`chat:${chat._id}`).emit('user_status_changed', {
        userId,
        isOnline,
        chatId: chat._id
      });
    });
  }).catch(err => logger.error(`Ошибка рассылки статуса: ${err.message}`));
};

// === СИГНАЛИЗАЦИЯ WEBRTC ДЛЯ ЗВОНКОВ ===

const handleCallInitiate = (socket, data, io) => {
  const { calleeId, callType, chatId } = data;
  
  io.to(`user:${calleeId}`).emit('incoming_call', {
    callerId: socket.userId,
    callerName: socket.user.name,
    callerAvatar: socket.user.avatar,
    callType,
    chatId,
    timestamp: new Date()
  });

  logger.info(`📞 Входящий звонок от ${socket.user.name} к пользователю ${calleeId}`);
};

const handleCallAccept = (socket, data, io) => {
  const { callerId, chatId } = data;
  
  io.to(`user:${callerId}`).emit('call_accepted', {
    calleeId: socket.userId,
    chatId
  });
};

const handleCallReject = (socket, data, io) => {
  const { callerId } = data;
  
  io.to(`user:${callerId}`).emit('call_rejected', {
    calleeId: socket.userId
  });
};

const handleCallEnd = (socket, data, io) => {
  const { otherUserId } = data;
  
  io.to(`user:${otherUserId}`).emit('call_ended', {
    endedBy: socket.userId
  });
};

const handleWebRTCOffer = (socket, data, io) => {
  const { targetUserId, offer } = data;
  
  io.to(`user:${targetUserId}`).emit('webrtc_offer', {
    fromUserId: socket.userId,
    offer
  });
};

const handleWebRTCAnswer = (socket, data, io) => {
  const { targetUserId, answer } = data;
  
  io.to(`user:${targetUserId}`).emit('webrtc_answer', {
    fromUserId: socket.userId,
    answer
  });
};

const handleWebRTCIceCandidate = (socket, data, io) => {
  const { targetUserId, candidate } = data;
  
  io.to(`user:${targetUserId}`).emit('webrtc_ice_candidate', {
    fromUserId: socket.userId,
    candidate
  });
};

/**
 * Получение списка онлайн пользователей
 */
const getOnlineUsers = () => {
  return Array.from(onlineUsers.keys());
};

/**
 * Проверка, онлайн ли пользователь
 */
const isUserOnline = (userId) => {
  return onlineUsers.has(userId);
};

export {
  initializeSocket,
  getOnlineUsers,
  isUserOnline,
  onlineUsers,
  chatRooms
};
