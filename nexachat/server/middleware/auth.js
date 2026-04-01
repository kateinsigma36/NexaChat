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
  
  // Если токена нет
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
    
    // Добавляем пользователя в request
    req.user = user;
    next();
    
  } catch (error) {
    console.error('Ошибка аутентификации:', error);
    return res.status(401).json({
      success: false,
      message: 'Ошибка аутентификации'
    });
  }
});

/**
 * Middleware для опциональной аутентификации
 * Если токен есть - проверяем его, если нет - продолжаем без пользователя
 */
export const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      
      if (decoded) {
        const user = await User.findById(decoded.userId).select('-password -refreshToken');
        if (user) {
          req.user = user;
        }
      }
    } catch (error) {
      // Игнорируем ошибки, так как аутентификация опциональна
    }
  }
  
  next();
});

/**
 * Middleware для проверки роли администратора
 * Должен использоваться после protect
 */
export const requireAdmin = asyncHandler(async (req, res, next) => {
  // Здесь можно добавить проверку на администратора
  // Например, проверка email или специального поля в модели User
  
  // Пока что просто пропускаем (заглушка для будущего функционала)
  next();
});

/**
 * Middleware для проверки, что пользователь является участником чата
 * @param {string} chatIdParam - Название параметра с ID чата (req.params или req.body)
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
    
    // Импортируем Chat динамически для избежания циклических зависимостей
    const Chat = (await import('../models/Chat.js')).default;
    
    const chat = await Chat.findById(chatId);
    
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Чат не найден'
      });
    }
    
    // Проверяем, является ли пользователь участником
    if (!chat.isParticipant(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'У вас нет доступа к этому чату'
      });
    }
    
    // Добавляем чат в request для дальнейшего использования
    req.chat = chat;
    next();
  });
};

/**
 * Middleware для проверки, что пользователь не заблокирован
 */
export const isNotBlocked = asyncHandler(async (req, res, next) => {
  const userId = req.params.userId || req.body.userId;
  
  if (!userId) {
    return next();
  }
  
  const user = await User.findById(userId);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Пользователь не найден'
    });
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
