# NexaChat Server

Backend сервер для мессенджера NexaChat.

## 🚀 Быстрый старт

### Требования

- Node.js 20+ LTS
- MongoDB 6+
- Redis 7+

### Установка

```bash
# Установка зависимостей
npm install

# Копирование переменных окружения
cp .env.example .env

# Редактирование .env (укажите ваши настройки)

# Запуск в режиме разработки
npm run dev

# Запуск в production режиме
npm start
```

## 📁 Структура проекта

```
server/
├── config/          # Конфигурация (БД, Redis, env)
├── models/          # Mongoose модели
├── routes/          # API маршруты
├── middleware/      # Express middleware
├── services/        # Бизнес-логика
├── utils/           # Утилиты и хелперы
└── server.js        # Точка входа
```

## 🔧 API Endpoints

### Аутентификация

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Вход |
| POST | `/api/auth/logout` | Выход |
| POST | `/api/auth/refresh` | Refresh токена |
| GET | `/api/auth/me` | Текущий пользователь |
| PUT | `/api/auth/profile` | Обновление профиля |

## 📦 Технологии

- **Express.js** - Web фреймворк
- **Mongoose** - ODM для MongoDB
- **Socket.IO** - WebSocket для real-time
- **JWT** - Аутентификация
- **Redis** - Кэширование и rate limiting
- **Multer** - Загрузка файлов

## 🔐 Безопасность

- JWT access + refresh токены
- Rate limiting для защиты от брутфорса
- Helmet для безопасности заголовков
- CORS настройка
- Валидация входных данных (Joi)

## 📝 Лицензия

MIT
