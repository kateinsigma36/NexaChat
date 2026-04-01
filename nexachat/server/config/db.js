/**
 * Подключение к MongoDB
 * Настройка соединения с базой данных Mongoose
 */

import mongoose from 'mongoose';
import { config } from './env.js';

let isConnected = false;

/**
 * Подключение к MongoDB
 */
export async function connectDB() {
  if (isConnected) {
    console.log('✅ MongoDB уже подключена');
    return;
  }

  try {
    const conn = await mongoose.connect(config.mongodb.uri, {
      // Опции для лучшей производительности и стабильности
      maxPoolSize: 10,
      minPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    console.log(`✅ MongoDB подключена: ${conn.connection.host}`);

    // Обработчики событий
    mongoose.connection.on('error', (err) => {
      console.error('❌ Ошибка MongoDB:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB отключена');
      isConnected = false;
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('🔌 MongoDB соединение закрыто');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Ошибка подключения к MongoDB:', error.message);
    process.exit(1);
  }
}

/**
 * Получить состояние подключения
 */
export function getDBStatus() {
  return {
    connected: isConnected,
    readyState: mongoose.connection.readyState
  };
}
