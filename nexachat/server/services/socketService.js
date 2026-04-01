/**
 * Socket.IO сервис для real-time коммуникации
 * Обрабатывает подключения пользователей, сообщения, статусы онлайн, индикаторы набора
 */

import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Message from '../models/Message.js';
import Chat from '../models/Chat.js';
import { logger } from '../utils/helpers.js';
import { config } from '../config/env.js';

// Хранилище активных подключений: userId -> socketId
const onlineUsers = new Map();

// Хранилище комнат чатов: chatId -> Set(socketIds)
const chatRooms = new Map();

/**
 * Инициализация Socket.IO
 */
export function initializeSocket(io) {
  // Middleware для аутентификации при подключении
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Токен не предоставлен'));
      }

      const decoded = jwt.verify(token, config.jwt.accessSecret);
      socket.userId = decoded.userId;
      socket.user = await User.findById(decoded.userId).select('-password');
      
      if (!socket.user) {
        return next(new Error('Пользователь не найден'));
      }

      next();
    } catch (error) {
      logger.error('Ошибка аутентификации WebSocket:', error.message);
      next(new Error('Неверный токен'));
    }
  });

  io.on('connection', async (socket) => {
    logger.info(`🔌 Пользователь подключился: ${socket.user.name} (${socket.userId})`);

    // Добавляем пользователя в онлайн
    onlineUsers.set(socket.userId, socket.id);
    
    // Обновляем статус пользователя в БД
    await User.findByIdAndUpdate(socket.userId, { isOnline: true });

    // Сообщаем всем о новом онлайн пользователе
    io.emit('user:online', { userId: socket.userId, timestamp: new Date() });

    // === Обработка присоединения к комнатам чатов ===
    socket.on('chat:join', async ({ chatId }) => {
      try {
        const chat = await Chat.findOne({ _id: chatId, participants: socket.userId });
        
        if (!chat) {
          socket.emit('error', { message: 'У вас нет доступа к этому чату' });
          return;
        }

        socket.join(`chat:${chatId}`);
        
        if (!chatRooms.has(chatId)) {
          chatRooms.set(chatId, new Set());
        }
        chatRooms.get(chatId).add(socket.id);

        logger.debug(`Пользователь ${socket.userId} присоединился к чату ${chatId}`);
      } catch (error) {
        logger.error('Ошибка присоединения к чату:', error);
      }
    });

    socket.on('chat:leave', ({ chatId }) => {
      socket.leave(`chat:${chatId}`);
      
      if (chatRooms.has(chatId)) {
        chatRooms.get(chatId).delete(socket.id);
      }
      
      logger.debug(`Пользователь ${socket.userId} покинул чат ${chatId}`);
    });

    // === Обработка сообщений ===
    socket.on('message:new', async (data) => {
      try {
        const { chatId, content, type = 'text', replyTo } = data;

        const chat = await Chat.findOne({ _id: chatId, participants: socket.userId });
        if (!chat) {
          socket.emit('error', { message: 'У вас нет доступа к этому чату' });
          return;
        }

        const message = new Message({
          chatId,
          sender: socket.userId,
          type,
          content
        });

        if (replyTo) message.replyTo = replyTo;
        
        await message.save();

        // Обновляем lastMessage в чате
        await Chat.findByIdAndUpdate(chatId, {
          lastMessage: {
            text: type === 'text' ? content : `[${type}]`,
            sender: socket.userId,
            timestamp: new Date()
          }
        });

        const populatedMessage = await Message.findById(message._id)
          .populate('sender', 'name avatar email');

        // Отправляем сообщение всем участникам чата
        io.to(`chat:${chatId}`).emit('message:new', populatedMessage);

        logger.info(`Сообщение отправлено в чат ${chatId}`);
      } catch (error) {
        logger.error('Ошибка отправки сообщения:', error);
        socket.emit('error', { message: 'Ошибка отправки сообщения' });
      }
    });

    // === Индикатор набора текста ===
    socket.on('typing:start', ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit('typing:start', {
        userId: socket.userId,
        userName: socket.user.name,
        chatId
      });
    });

    socket.on('typing:stop', ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit('typing:stop', {
        userId: socket.userId,
        chatId
      });
    });

    // === Статусы прочтения ===
    socket.on('message:read', async ({ chatId, messageId }) => {
      try {
        await Message.findByIdAndUpdate(messageId, {
          $addToSet: {
            readBy: { user: socket.userId, readAt: new Date() }
          }
        });

        socket.to(`chat:${chatId}`).emit('message:read', {
          messageId,
          userId: socket.userId,
          chatId
        });
      } catch (error) {
        logger.error('Ошибка обновления статуса прочтения:', error);
      }
    });

    // === Реакции на сообщения ===
    socket.on('message:reaction', async ({ messageId, emoji }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        const chat = await Chat.findOne({ _id: message.chatId, participants: socket.userId });
        if (!chat) return;

        const existingIndex = message.reactions.findIndex(
          r => r.user.toString() === socket.userId.toString() && r.emoji === emoji
        );

        if (existingIndex >= 0) {
          message.reactions.splice(existingIndex, 1);
        } else {
          message.reactions = message.reactions.filter(r => r.user.toString() !== socket.userId.toString());
          message.reactions.push({ user: socket.userId, emoji });
        }

        await message.save();

        const updatedMessage = await Message.findById(messageId)
          .populate('reactions.user', 'name avatar');

        io.to(`chat:${message.chatId}`).emit('message:reaction', {
          messageId,
          reactions: updatedMessage.reactions
        });
      } catch (error) {
        logger.error('Ошибка добавления реакции:', error);
      }
    });

    // === WebRTC сигнализация для звонков ===
    socket.on('call:initiate', ({ targetUserId, type, chatId }) => {
      const targetSocketId = onlineUsers.get(targetUserId);
      
      if (!targetSocketId) {
        socket.emit('call:error', { message: 'Пользователь не в сети' });
        return;
      }

      io.to(targetSocketId).emit('call:incoming', {
        fromUserId: socket.userId,
        fromUserName: socket.user.name,
        fromUserAvatar: socket.user.avatar,
        type,
        chatId,
        timestamp: new Date()
      });

      logger.info(`Звонок инициирован: ${socket.userId} -> ${targetUserId}`);
    });

    socket.on('call:accept', ({ targetUserId, callId }) => {
      const targetSocketId = onlineUsers.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call:accepted', { callId, acceptedBy: socket.userId });
      }
    });

    socket.on('call:reject', ({ targetUserId, callId }) => {
      const targetSocketId = onlineUsers.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call:rejected', { callId, rejectedBy: socket.userId });
      }
    });

    socket.on('call:end', ({ targetUserId, callId }) => {
      const targetSocketId = onlineUsers.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call:ended', { callId, endedBy: socket.userId });
      }
    });

    socket.on('webrtc_offer', ({ targetUserId, offer }) => {
      const targetSocketId = onlineUsers.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc_offer', {
          fromUserId: socket.userId,
          offer
        });
      }
    });

    socket.on('webrtc_answer', ({ targetUserId, answer }) => {
      const targetSocketId = onlineUsers.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc_answer', {
          fromUserId: socket.userId,
          answer
        });
      }
    });

    socket.on('webrtc_ice_candidate', ({ targetUserId, candidate }) => {
      const targetSocketId = onlineUsers.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('webrtc_ice_candidate', {
          fromUserId: socket.userId,
          candidate
        });
      }
    });

    // === Обработка отключения ===
    socket.on('disconnect', async () => {
      logger.info(`🔌 Пользователь отключился: ${socket.user?.name || socket.userId}`);

      onlineUsers.delete(socket.userId);

      // Проверяем, есть ли другие подключения этого пользователя
      const stillOnline = Array.from(onlineUsers.values()).some(id => 
        id !== socket.id && onlineUsers.get(socket.userId) === id
      );

      if (!stillOnline) {
        await User.findByIdAndUpdate(socket.userId, { isOnline: false });
        io.emit('user:offline', { userId: socket.userId, timestamp: new Date() });
      }

      // Удаляем из комнат чатов
      chatRooms.forEach((sockets, chatId) => {
        if (sockets.has(socket.id)) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            chatRooms.delete(chatId);
          }
        }
      });
    });

    // === Обработка ошибок ===
    socket.on('error', (error) => {
      logger.error('WebSocket ошибка:', error);
    });
  });

  logger.info('✅ Socket.IO инициализирован');
}

// Утилиты
export function getOnlineUsers() {
  return Array.from(onlineUsers.keys());
}

export function isUserOnline(userId) {
  return onlineUsers.has(userId);
}

export { onlineUsers, chatRooms };
