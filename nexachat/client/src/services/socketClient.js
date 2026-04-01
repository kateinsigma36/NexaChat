/**
 * Socket.IO клиент для NexaChat
 * Real-time подключение для сообщений, статусов и звонков
 */

import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;

/**
 * Подключение к WebSocket серверу
 * @param {string} token - JWT токен для аутентификации
 */
export const connectSocket = (token) => {
  if (socket?.connected) {
    console.log('⚠️ Socket уже подключен');
    return socket;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => {
    console.log('✅ Socket.IO подключен:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket.IO отключен:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('🔥 Ошибка подключения Socket.IO:', error.message);
  });

  return socket;
};

/**
 * Отключение от WebSocket
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('🔌 Socket.IO отключен');
  }
};

/**
 * Получение текущего сокета
 */
export const getSocket = () => {
  if (!socket) {
    console.warn('⚠️ Socket еще не подключен');
  }
  return socket;
};

/**
 * Проверка подключения
 */
export const isSocketConnected = () => {
  return socket?.connected || false;
};

// Экспортируем экземпляр сокета по умолчанию
export default socket;
