/**
 * Главный файл сервера NexaChat
 * Точка входа приложения
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

// Конфигурация
import { config } from './config/env.js';
import { connectDB } from './config/db.js';
import { connectRedis } from './config/redis.js';

// Маршруты
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chats.js';
import messageRoutes from './routes/messages.js';

// Middleware
import { apiLimiter } from './middleware/rateLimiter.js';
import { asyncHandler, logger } from './utils/helpers.js';

// Socket.IO сервис
import { initializeSocket } from './services/socketService.js';

// Получаем __dirname для ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Создаем Express приложение
const app = express();
const httpServer = createServer(app);

// Настраиваем Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: config.clientUrl,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// ============================================
// MIDDLEWARE
// ============================================

// Безопасность заголовков
app.use(helmet({
  contentSecurityPolicy: false, // Отключаем для разработки
  crossOriginEmbedderPolicy: false
}));

// CORS
app.use(cors({
  origin: config.clientUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Сжатие ответов
app.use(compression());

// Логгирование
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Парсинг JSON
app.use(express.json({ limit: '10mb' }));

// Парсинг URL-encoded данных
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting для всего API
app.use('/api', apiLimiter);

// ============================================
// МАРШРУТЫ API
// ============================================

app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);

// Приветственный роут
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'NexaChat API v1.0',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/api/health', asyncHandler(async (req, res) => {
  const dbStatus = await import('./config/db.js').then(m => m.getDBStatus());
  const redisStatus = await import('./config/redis.js').then(m => m.getRedisStatus());
  
  res.json({
    success: true,
    status: 'ok',
    services: {
      mongodb: dbStatus,
      redis: redisStatus
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
}));

// ============================================
// ОБРАБОТКА ОШИБОК
// ============================================

// 404 Not Found
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: 'Маршрут не найден',
    path: req.path
  });
});

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error('Ошибка сервера:', err);
  
  // MongoDB ошибки
  if (err.name === 'MongoServerError') {
    return res.status(500).json({
      success: false,
      message: 'Ошибка базы данных',
      error: config.nodeEnv === 'development' ? err.message : undefined
    });
  }
  
  // Mongoose валидация
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: 'Ошибка валидации',
      errors
    });
  }
  
  // JWT ошибки
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Неверный токен'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Токен истёк'
    });
  }
  
  // По умолчанию
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Внутренняя ошибка сервера',
    ...(config.nodeEnv === 'development' && { stack: err.stack })
  });
});

// ============================================
// WEBSOCKET (Socket.IO)
// ============================================

// Инициализация Socket.IO сервиса
initializeSocket(io);

// Экспортируем io для использования в других модулях
export { io };

// ============================================
// ЗАПУСК СЕРВЕРА
// ============================================

async function startServer() {
  try {
    // Подключение к базам данных
    await connectDB();
    await connectRedis();
    
    // Инициализация Socket.IO
    initializeSocket(io);
    
    // Запуск сервера
    httpServer.listen(config.port, () => {
      logger.success(`
╔════════════════════════════════════════════════╗
║                                                ║
║   🚀 NexaChat Server запущен!                  ║
║                                                ║
║   Порт: ${config.port}                            
║   Режим: ${config.nodeEnv}                          
║   Время: ${new Date().toLocaleTimeString()}            
║                                                ║
╚════════════════════════════════════════════════╝
      `);
    });
    
  } catch (error) {
    logger.error(`Ошибка запуска сервера: ${error.message}`);
    process.exit(1);
  }
}

// Обработка сигналов завершения
process.on('SIGTERM', () => {
  logger.info('📩 SIGTERM получен. Закрытие сервера...');
  httpServer.close(() => {
    logger.info('✅ Сервер закрыт');
    process.exit(0);
  });
});

// Запускаем сервер
startServer();

export default app;
