/**
 * Middleware для загрузки файлов с использованием Multer
 * Обработка multipart/form-data
 */

import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { config } from '../config/env.js';
import { asyncHandler } from '../utils/helpers.js';

// Создаём директорию для загрузок если не существует
const uploadDir = path.resolve(config.upload.path);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Конфигурация хранилища
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Создаём подпапки по типам файлов
    let subDir = 'misc';
    
    if (file.mimetype.startsWith('image/')) {
      subDir = 'images';
    } else if (file.mimetype.startsWith('video/')) {
      subDir = 'videos';
    } else if (file.mimetype.startsWith('audio/')) {
      subDir = 'audio';
    } else if (file.mimetype.includes('pdf')) {
      subDir = 'documents';
    }
    
    const destPath = path.join(uploadDir, subDir);
    
    if (!fs.existsSync(destPath)) {
      fs.mkdirSync(destPath, { recursive: true });
    }
    
    cb(null, destPath);
  },
  
  filename: (req, file, cb) => {
    // Генерируем уникальное имя файла
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  }
});

// Фильтр файлов
const fileFilter = (req, file, cb) => {
  // Разрешённые MIME типы
  const allowedMimes = [
    // Изображения
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    
    // Видео
    'video/mp4',
    'video/webm',
    'video/quicktime',
    
    // Аудио
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
    
    // Документы
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    
    // Архивы
    'application/zip',
    'application/x-rar-compressed',
    'application/x-7z-compressed',
    
    // Текст
    'text/plain',
    'text/csv'
  ];
  
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Неподдерживаемый тип файла: ${file.mimetype}`), false);
  }
};

// Создаем экземпляр multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxSize, // Максимальный размер из конфига
    files: 10 // Максимум 10 файлов за раз
  }
});

/**
 * Middleware для обработки ошибок загрузки
 */
export const handleUploadError = asyncHandler((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: `Файл слишком большой. Максимальный размер: ${config.upload.maxSize / (1024 * 1024)}MB`
      });
    }
    
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Слишком много файлов'
      });
    }
    
    return res.status(400).json({
      success: false,
      message: `Ошибка загрузки: ${err.message}`
    });
  }
  
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  
  next();
});

/**
 * Middleware для одиночной загрузки файла
 * @param {string} fieldName - Имя поля в form-data
 */
export const uploadSingle = (fieldName) => {
  return [
    upload.single(fieldName),
    handleUploadError
  ];
};

/**
 * Middleware для множественной загрузки файлов
 * @param {string} fieldName - Имя поля в form-data
 * @param {number} maxCount - Максимальное количество файлов
 */
export const uploadMultiple = (fieldName, maxCount = 5) => {
  return [
    upload.array(fieldName, maxCount),
    handleUploadError
  ];
};

/**
 * Middleware для загрузки разных типов файлов в разные поля
 */
export const uploadFields = (fields) => {
  return [
    upload.fields(fields),
    handleUploadError
  ];
};

/**
 * Проверка наличия загруженного файла
 */
export const requireFile = (req, res, next) => {
  if (!req.file && !req.files) {
    return res.status(400).json({
      success: false,
      message: 'Файл не загружен'
    });
  }
  
  next();
};
