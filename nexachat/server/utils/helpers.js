/**
 * Вспомогательные функции и утилиты
 */

import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Получить текущий __dirname в ES modules
 */
export const getDirname = () => {
  return path.dirname(fileURLToPath(import.meta.url));
};

/**
 * Генерация уникального имени файла
 * @param {string} originalName - Оригинальное имя файла
 * @returns {string} Уникальное имя файла
 */
export const generateFilename = (originalName) => {
  const ext = path.extname(originalName);
  const uniqueId = uuidv4();
  return `${uniqueId}${ext}`;
};

/**
 * Форматирование размера файла в человекочитаемый формат
 * @param {number} bytes - Размер в байтах
 * @returns {string} Форматированный размер
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

/**
 * Задержка выполнения (sleep)
 * @param {number} ms - Миллисекунды
 * @returns {Promise<void>}
 */
export const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Очистка объекта от undefined значений
 * @param {Object} obj - Объект для очистки
 * @returns {Object} Очищенный объект
 */
export const cleanObject = (obj) => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  );
};

/**
 * Пагинация массива
 * @param {Array} array - Массив для пагинации
 * @param {number} page - Номер страницы (1-based)
 * @param {number} limit - Количество элементов на странице
 * @returns {Object} Объект с данными и мета-информацией
 */
export const paginateArray = (array, page = 1, limit = 20) => {
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  
  return {
    data: array.slice(startIndex, endIndex),
    pagination: {
      page,
      limit,
      total: array.length,
      totalPages: Math.ceil(array.length / limit),
      hasNext: endIndex < array.length,
      hasPrev: page > 1
    }
  };
};

/**
 * Debounce функция
 * @param {Function} func - Функция для вызова
 * @param {number} wait - Время ожидания в мс
 * @returns {Function} Debounced функция
 */
export const debounce = (func, wait) => {
  let timeout;
  
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle функция
 * @param {Function} func - Функция для вызова
 * @param {number} limit - Лимит в мс
 * @returns {Function} Throttled функция
 */
export const throttle = (func, limit) => {
  let inThrottle;
  
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Проверка, является ли строка valid MongoDB ObjectId
 * @param {string} id - ID для проверки
 * @returns {boolean}
 */
export const isValidObjectId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Санитизация строки от XSS атак (базовая)
 * @param {string} str - Строка для санитизации
 * @returns {string} sanitized строка
 */
export const sanitizeString = (str) => {
  if (!str || typeof str !== 'string') return str;
  
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

/**
 * Форматирование даты в относительный формат ("5 мин. назад")
 * @param {Date|string} date - Дата для форматирования
 * @returns {string} Относительная дата
 */
export const formatRelativeDate = (date) => {
  const now = new Date();
  const then = new Date(date);
  const diff = now - then;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  
  if (seconds < 60) return 'только что';
  if (minutes < 60) return `${minutes} мин. назад`;
  if (hours < 24) return `${hours} ч. назад`;
  if (days < 7) return `${days} дн. назад`;
  if (weeks < 4) return `${weeks} нед. назад`;
  
  return then.toLocaleDateString('ru-RU');
};

/**
 * Группировка сообщений по дате
 * @param {Array} messages - Массив сообщений
 * @returns {Array} Сгруппированные сообщения
 */
export const groupMessagesByDate = (messages) => {
  const groups = {};
  
  messages.forEach(message => {
    const date = new Date(message.createdAt).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: message.createdAt.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
    
    if (!groups[date]) {
      groups[date] = [];
    }
    
    groups[date].push(message);
  });
  
  // Преобразуем в массив объектов
  return Object.entries(groups).map(([date, msgs]) => ({
    date,
    messages: msgs
  }));
};

/**
 * Обработка ошибок async/await в Express
 * @param {Function} fn - Async функция
 * @returns {Function} Express middleware
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Логгер для консоли с цветами
 */
export const logger = {
  info: (message) => console.log(`\x1b[36m[INFO]\x1b[0m ${message}`),
  success: (message) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${message}`),
  warning: (message) => console.log(`\x1b[33m[WARNING]\x1b[0m ${message}`),
  error: (message) => console.error(`\x1b[31m[ERROR]\x1b[0m ${message}`),
  debug: (message) => console.debug(`\x1b[35m[DEBUG]\x1b[0m ${message}`)
};
