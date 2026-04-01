/**
 * Rate limiting middleware с использованием Redis
 * Ограничивает количество запросов для защиты от брутфорса и DDoS
 */

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { getRedisClient } from '../config/redis.js';
import { config } from '../config/env.js';

/**
 * Создание rate limiter с Redis store
 * @param {Object} options - Опции для rate limiter
 * @returns {Function} Express middleware
 */
function createRateLimiter(options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 минут по умолчанию
    max = 100, // Максимум 100 запросов за окно
    message = 'Слишком много запросов, попробуйте позже',
    standardHeaders = true,
    legacyHeaders = false
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message
    },
    standardHeaders,
    legacyHeaders,
    
    // Используем Redis store если доступен
    store: new RedisStore({
      sendCommand: async (...args) => {
        const client = getRedisClient();
        if (!client) return;
        
        try {
          // Для Redis v4 используем sendCommand
          return await client.sendCommand(args);
        } catch (error) {
          console.error('Ошибка Redis в rate limiter:', error);
          return null;
        }
      }
    }),
    
    // Ключ для идентификации клиента
    keyGenerator: (req) => {
      // Приоритет: IP адрес из-за прокси > обычный IP
      return req.ip || 
             req.headers['x-forwarded-for']?.split(',')[0] || 
             req.connection?.remoteAddress || 
             'unknown';
    },
    
    // Пропускать некоторые запросы
    skip: (req) => {
      // Можно добавить исключения для определённых роутов
      return false;
    },
    
    // Обработчик после применения лимита
    handler: (req, res, next, options) => {
      res.status(429).json(options.message);
    }
  });
}

/**
 * Строгий лимитер для аутентификации (брутфорс защита)
 * 5 попыток за 15 минут
 */
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // 5 попыток
  message: 'Слишком много неудачных попыток входа. Попробуйте через 15 минут.'
});

/**
 * Лимитер для регистрации
 * 3 регистрации за час с одного IP
 */
export const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 3, // 3 попытки
  message: 'Слишком много регистраций. Попробуйте позже.'
});

/**
 * Лимитер для восстановления пароля
 * 3 запроса за час
 */
export const forgotPasswordLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 час
  max: 3, // 3 попытки
  message: 'Слишком много запросов на восстановление пароля.'
});

/**
 * Лимитер для загрузки файлов
 * 20 файлов за 10 минут
 */
export const uploadLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000, // 10 минут
  max: 20, // 20 загрузок
  message: 'Слишком много загрузок файлов. Попробуйте позже.'
});

/**
 * Лимитер для API в целом
 * 100 запросов за 15 минут
 */
export const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // 100 запросов
  message: 'Слишком много запросов к API.'
});

/**
 * Лимитер для WebSocket соединений
 * 10 соединений за минуту
 */
export const wsLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 минута
  max: 10, // 10 соединений
  message: 'Слишком много WebSocket соединений.'
});

/**
 * Лимитер для звонков
 * 5 звонков за 5 минут
 */
export const callLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 минут
  max: 5, // 5 звонков
  message: 'Слишком много звонков. Попробуйте позже.'
});

/**
 * Лимитер для сообщений (anti-spam)
 * 30 сообщений в минуту
 */
export const messageLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 минута
  max: 30, // 30 сообщений
  message: 'Слишком много сообщений. Пожалуйста, не спамьте.'
});

export default createRateLimiter;
