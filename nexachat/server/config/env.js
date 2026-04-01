/**
 * Конфигурация переменных окружения
 * Валидация и загрузка всех необходимых переменных
 */

import dotenv from 'dotenv';
import Joi from 'joi';

// Загружаем .env файл
dotenv.config();

// Схема валидации для переменных окружения
const envSchema = Joi.object({
  PORT: Joi.number().default(5000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  
  // MongoDB
  MONGODB_URI: Joi.string().required(),
  
  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  
  // JWT
  JWT_ACCESS_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  
  // Email
  SMTP_HOST: Joi.string().default('smtp.gmail.com'),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().email().allow('').default(''),
  SMTP_PASS: Joi.string().allow('').default(''),
  EMAIL_FROM: Joi.string().default('NexaChat <noreply@nexachat.com>'),
  
  // Frontend
  CLIENT_URL: Joi.string().default('http://localhost:5173'),
  
  // Файлы
  MAX_FILE_SIZE: Joi.number().default(104857600),
  UPLOAD_PATH: Joi.string().default('./uploads'),
  
  // TURN сервер
  TURN_HOST: Joi.string().allow('').default(''),
  TURN_USERNAME: Joi.string().allow('').default('nexachat'),
  TURN_PASSWORD: Joi.string().allow('').default(''),
  
  // Firebase
  FCM_SERVER_KEY: Joi.string().allow('').default('')
});

// Валидация переменных
const { value: env, error } = envSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
  console.error(`❌ Ошибка конфигурации: ${error.message}`);
  process.exit(1);
}

// Экспортируем конфигурацию
export const config = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  
  mongodb: {
    uri: env.MONGODB_URI
  },
  
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined
  },
  
  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN
  },
  
  email: {
    smtpHost: env.SMTP_HOST,
    smtpPort: env.SMTP_PORT,
    smtpUser: env.SMTP_USER,
    smtpPass: env.SMTP_PASS,
    from: env.EMAIL_FROM
  },
  
  clientUrl: env.CLIENT_URL,
  
  upload: {
    maxSize: env.MAX_FILE_SIZE,
    path: env.UPLOAD_PATH
  },
  
  turn: {
    host: env.TURN_HOST,
    username: env.TURN_USERNAME,
    password: env.TURN_PASSWORD
  },
  
  fcm: {
    serverKey: env.FCM_SERVER_KEY
  }
};

console.log('✅ Конфигурация загружена успешно');
