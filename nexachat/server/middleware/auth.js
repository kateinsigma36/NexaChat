/**
 * Middleware для аутентификации пользователей
 * Проверяет JWT токен и добавляет пользователя в req.user
 */

import { verifyAccessToken } from '../utils/generateToken.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/helpers.js';

/**
 * Основной middleware для защиты роутов
 * Требует наличия валидного access токена
 */
export const protect = asyncHandler(async (req, res, next) => {
  let token;
  
  // Получаем токен из заголовка Authorization
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  // Если токента нет
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Доступ запрещён. Токен не предоставлен.'
    });
  }
  
  try {
    // Верифицируем токен
    const decoded = verifyAccessToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Неверный или истёкший токен'
      });
    }
    
    // Получаем пользователя из базы
    const user = await User.findById(decoded.userId).select('-password -refreshToken');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Пользователь не найден'
      });
    }
    
    // Добавляем пользователя в запрос
    req.user = user;
    next();
    
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Ошибка аутентификации',
      error: error.message
    });
  }
});

/**
 * Опциональная аутентификация
 * Если токен есть - проверяем и добавляем пользователя, если нет - продолжаем
 */
export const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  if (!token) {
    return next();
  }
  
  try {
    const decoded = verifyAccessToken(token);
    if (decoded) {
      const user = await User.findById(decoded.userId).select('-password -refreshToken');
      if (user) {
        req.user = user;
      }
    }
  } catch (error) {
    // Игнорируем ошибки для опциональной аутентификации
  }
  
  next();
});

/**
 * Проверка на администратора
 */
export const requireAdmin = asyncHandler(async (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Требуется права администратора'
    });
  }
  next();
});

/**
 * Middleware для проверки участия в чате
 */
export const isChatParticipant = (chatIdParam = 'chatId') => {
  return asyncHandler(async (req, res, next) => {
    const chatId = req.params[chatIdParam] || req.body[chatIdParam];
    
    if (!chatId) {
      return res.status(400).json({
        success: false,
        message: 'ID чата не указан'
      });
    }
    
    const Chat = (await import('../models/Chat.js')).default;
    
    const chat = await Chat.findOne({
      _id: chatId,
      participants: req.user._id
    });
    
    if (!chat) {
      return res.status(403).json({
        success: false,
        message: 'У вас нет доступа к этому чату'
      });
    }
    
    next();
  });
};

/**
 * Проверка блокировки между пользователями
 */
export const isNotBlocked = asyncHandler(async (req, res, next) => {
  const userId = req.params.userId || req.body.userId;
  
  if (!userId) {
    return next();
  }
  
  const User = (await import('../models/User.js')).default;
  const user = await User.findById(userId);
  
  if (!user) {
    return next();
  }

  // Проверяем, не заблокировал ли текущий пользователь этого пользователя
  if (user.blockedUsers.includes(req.user._id)) {
    return res.status(403).json({
      success: false,
      message: 'Вы заблокировали этого пользователя'
    });
  }

  // Проверяем, не заблокировал ли этот пользователь текущего
  if (req.user.blockedUsers.includes(user._id)) {
    return res.status(403).json({
      success: false,
      message: 'Этот пользователь заблокировал вас'
    });
  }

  next();
});

// Экспорт по умолчанию для совместимости
export default protect;
