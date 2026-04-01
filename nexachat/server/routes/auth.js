/**
 * Маршруты аутентификации
 * Регистрация, вход, выход, refresh токена, восстановление пароля
 */

import express from 'express';
import User from '../models/User.js';
import Chat from '../models/Chat.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/generateToken.js';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, updateProfileSchema } from '../utils/validators.js';
import { validate } from '../utils/validators.js';
import { protect, optionalAuth } from '../middleware/auth.js';
import { authLimiter, registerLimiter, forgotPasswordLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../utils/helpers.js';
import { getRedisClient, setCache, deleteCache } from '../config/redis.js';

const router = express.Router();

/**
 * @route   POST /api/auth/register
 * @desc    Регистрация нового пользователя
 * @access  Public
 */
router.post('/register', 
  registerLimiter, 
  validate(registerSchema), 
  asyncHandler(async (req, res) => {
    const { email, password, name } = req.body;
    
    // Проверяем, существует ли пользователь
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Пользователь с таким email уже существует'
      });
    }
    
    // Создаём пользователя
    const user = await User.create({
      email,
      password,
      name
    });
    
    // Генерируем токены
    const accessToken = generateAccessToken({ userId: user._id, email: user.email });
    const refreshToken = generateRefreshToken({ userId: user._id, email: user.email });
    
    // Сохраняем refresh token
    await user.updateRefreshToken(refreshToken);
    
    // Создаём персональный чат для пользователя (для будущих функций)
    await Chat.create({
      type: 'private',
      participants: [{ user: user._id, role: 'creator' }]
    });
    
    res.status(201).json({
      success: true,
      message: 'Пользователь успешно зарегистрирован',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          status: user.status
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: '15m'
        }
      }
    });
  })
);

/**
 * @route   POST /api/auth/login
 * @desc    Вход пользователя
 * @access  Public
 */
router.post('/login', 
  authLimiter, 
  validate(loginSchema), 
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    
    // Ищем пользователя с паролем
    const user = await User.findOne({ email }).select('+password +refreshToken');
    
    if (!user) {
      // Задержка для защиты от перебора email
      await new Promise(resolve => setTimeout(resolve, 100));
      return res.status(401).json({
        success: false,
        message: 'Неверный email или пароль'
      });
    }
    
    // Проверяем пароль
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Неверный email или пароль'
      });
    }
    
    // Обновляем статус онлайн
    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();
    
    // Генерируем токены
    const accessToken = generateAccessToken({ userId: user._id, email: user.email });
    const refreshToken = generateRefreshToken({ userId: user._id, email: user.email });
    
    // Сохраняем новый refresh token
    await user.updateRefreshToken(refreshToken);
    
    res.json({
      success: true,
      message: 'Успешный вход',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
          status: user.status,
          isOnline: user.isOnline
        },
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: '15m'
        }
      }
    });
  })
);

/**
 * @route   POST /api/auth/logout
 * @desc    Выход пользователя
 * @access  Private
 */
router.post('/logout', 
  protect, 
  asyncHandler(async (req, res) => {
    // Очищаем refresh token в базе
    await req.user.clearRefreshToken();
    
    // Устанавливаем offline статус
    req.user.isOnline = false;
    req.user.lastSeen = new Date();
    await req.user.save();
    
    res.json({
      success: true,
      message: 'Успешный выход'
    });
  })
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Обновление access токена
 * @access  Public (требуется refresh token)
 */
router.post('/refresh', 
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token обязателен'
      });
    }
    
    // Верифицируем refresh token
    const decoded = verifyRefreshToken(refreshToken);
    
    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Неверный refresh token'
      });
    }
    
    // Находим пользователя и проверяем refresh token
    const user = await User.findById(decoded.userId).select('+refreshToken');
    
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token недействителен'
      });
    }
    
    // Генерируем новые токены
    const newAccessToken = generateAccessToken({ userId: user._id, email: user.email });
    const newRefreshToken = generateRefreshToken({ userId: user._id, email: user.email });
    
    // Сохраняем новый refresh token
    await user.updateRefreshToken(newRefreshToken);
    
    res.json({
      success: true,
      data: {
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
          expiresIn: '15m'
        }
      }
    });
  })
);

/**
 * @route   GET /api/auth/me
 * @desc    Получение текущего пользователя
 * @access  Private
 */
router.get('/me', 
  protect, 
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: {
        user: {
          id: req.user._id,
          email: req.user.email,
          name: req.user.name,
          avatar: req.user.avatar,
          status: req.user.status,
          bio: req.user.bio,
          isOnline: req.user.isOnline,
          lastSeen: req.user.lastSeen,
          settings: req.user.settings,
          createdAt: req.user.createdAt
        }
      }
    });
  })
);

/**
 * @route   PUT /api/auth/profile
 * @desc    Обновление профиля
 * @access  Private
 */
router.put('/profile', 
  protect, 
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const { name, status, bio } = req.body;
    
    // Обновляем поля
    if (name) req.user.name = name;
    if (status !== undefined) req.user.status = status;
    if (bio !== undefined) req.user.bio = bio;
    
    await req.user.save();
    
    res.json({
      success: true,
      message: 'Профиль обновлён',
      data: {
        user: {
          id: req.user._id,
          name: req.user.name,
          avatar: req.user.avatar,
          status: req.user.status,
          bio: req.user.bio
        }
      }
    });
  })
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Запрос на восстановление пароля
 * @access  Public
 */
router.post('/forgot-password', 
  forgotPasswordLimiter, 
  validate(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    
    // Всегда возвращаем успех для защиты от перебора email
    res.json({
      success: true,
      message: 'Если пользователь с таким email существует, инструкция отправлена'
    });
    
    // TODO: Отправка email с кодом восстановления
    // Здесь будет логика отправки email через nodemailer
  })
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Сброс пароля по токену
 * @access  Public
 */
router.post('/reset-password', 
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const { token, password } = req.body;
    
    // TODO: Реализация сброса пароля
    // Проверка токена, поиск пользователя, обновление пароля
    
    res.json({
      success: true,
      message: 'Пароль успешно изменён'
    });
  })
);

export default router;
