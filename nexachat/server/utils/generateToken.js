/**
 * Утилиты для генерации JWT токенов
 */

import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

/**
 * Генерация access токена
 * @param {Object} payload - Данные для токена (userId, email)
 * @returns {string} JWT token
 */
export function generateAccessToken(payload) {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.expiresIn,
    issuer: 'nexachat',
    audience: 'nexachat-user'
  });
}

/**
 * Генерация refresh токена
 * @param {Object} payload - Данные для токена
 * @returns {string} JWT token
 */
export function generateRefreshToken(payload) {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
    issuer: 'nexachat',
    audience: 'nexachat-user'
  });
}

/**
 * Верификация access токена
 * @param {string} token - JWT токен
 * @returns {Object|null} Расшифрованные данные или null
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.jwt.accessSecret, {
      issuer: 'nexachat',
      audience: 'nexachat-user'
    });
  } catch (error) {
    console.error('Ошибка верификации access токена:', error.message);
    return null;
  }
}

/**
 * Верификация refresh токена
 * @param {string} token - JWT токен
 * @returns {Object|null} Расшифрованные данные или null
 */
export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, config.jwt.refreshSecret, {
      issuer: 'nexachat',
      audience: 'nexachat-user'
    });
  } catch (error) {
    console.error('Ошибка верификации refresh токена:', error.message);
    return null;
  }
}

/**
 * Декодирование токена без верификации
 * @param {string} token - JWT токен
 * @returns {Object|null} Расшифрованные данные
 */
export function decodeToken(token) {
  try {
    return jwt.decode(token);
  } catch (error) {
    console.error('Ошибка декодирования токена:', error.message);
    return null;
  }
}

/**
 * Получить оставшееся время жизни токена
 * @param {string} token - JWT токен
 * @returns {number|null} Время в секундах или null
 */
export function getTokenExpiry(token) {
  const decoded = decodeToken(token);
  
  if (!decoded || !decoded.exp) {
    return null;
  }
  
  const now = Math.floor(Date.now() / 1000);
  const remaining = decoded.exp - now;
  
  return remaining > 0 ? remaining : 0;
}

/**
 * Проверка истёк ли токен
 * @param {string} token - JWT токен
 * @returns {boolean}
 */
export function isTokenExpired(token) {
  const expiry = getTokenExpiry(token);
  return expiry === null || expiry <= 0;
}
