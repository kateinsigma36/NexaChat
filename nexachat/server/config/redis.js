/**
 * Подключение к Redis
 * Используется для кэширования, сессий и rate limiting
 */

import { createClient } from 'redis';
import { config } from './env.js';

let redisClient = null;
let isConnected = false;

/**
 * Подключение к Redis
 */
export async function connectRedis() {
  if (isConnected) {
    console.log('✅ Redis уже подключен');
    return redisClient;
  }

  try {
    // Создаем клиент Redis
    redisClient = createClient({
      url: `redis://${config.redis.host}:${config.redis.port}`,
      password: config.redis.password,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('❌ Redis: превышено количество попыток переподключения');
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    });

    // Обработчики событий
    redisClient.on('error', (err) => {
      console.error('❌ Ошибка Redis:', err.message);
      isConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('🔌 Redis подключен');
      isConnected = true;
    });

    redisClient.on('end', () => {
      console.warn('⚠️  Redis отключен');
      isConnected = false;
    });

    // Подключаемся
    await redisClient.connect();

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await redisClient.quit();
      console.log('🔌 Redis соединение закрыто');
      process.exit(0);
    });

    return redisClient;

  } catch (error) {
    console.error('❌ Ошибка подключения к Redis:', error.message);
    // Продолжаем работу без Redis (опционально)
    return null;
  }
}

/**
 * Получить клиент Redis
 */
export function getRedisClient() {
  return redisClient;
}

/**
 * Проверить статус подключения
 */
export function getRedisStatus() {
  return {
    connected: isConnected,
    client: redisClient !== null
  };
}

/**
 * Установить значение в кэш с TTL
 */
export async function setCache(key, value, ttlSeconds = 3600) {
  if (!redisClient || !isConnected) return false;
  
  try {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    await redisClient.setEx(key, ttlSeconds, stringValue);
    return true;
  } catch (error) {
    console.error('Ошибка записи в Redis кэш:', error);
    return false;
  }
}

/**
 * Получить значение из кэша
 */
export async function getCache(key) {
  if (!redisClient || !isConnected) return null;
  
  try {
    const value = await redisClient.get(key);
    if (!value) return null;
    
    // Пытаемся распарсить как JSON
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch (error) {
    console.error('Ошибка чтения из Redis кэша:', error);
    return null;
  }
}

/**
 * Удалить значение из кэша
 */
export async function deleteCache(key) {
  if (!redisClient || !isConnected) return false;
  
  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error('Ошибка удаления из Redis кэша:', error);
    return false;
  }
}
