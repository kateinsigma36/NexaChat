/**
 * Модель пользователя
 * Хранит данные о пользователях мессенджера
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  // Основная информация
  email: {
    type: String,
    required: [true, 'Email обязателен'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Некорректный email']
  },
  
  password: {
    type: String,
    required: [true, 'Пароль обязателен'],
    minlength: [8, 'Пароль должен содержать минимум 8 символов'],
    select: false // Не возвращать пароль в запросах по умолчанию
  },
  
  name: {
    type: String,
    required: [true, 'Имя обязательно'],
    trim: true,
    minlength: [2, 'Имя должно содержать минимум 2 символа'],
    maxlength: [50, 'Имя не может превышать 50 символов']
  },
  
  // Профиль
  avatar: {
    type: String,
    default: null // URL к аватару
  },
  
  status: {
    type: String,
    default: 'Hey there! I am using NexaChat.',
    maxlength: [140, 'Статус не может превышать 140 символов']
  },
  
  bio: {
    type: String,
    default: '',
    maxlength: [500, 'Bio не может превышать 500 символов']
  },
  
  // Статус онлайн
  isOnline: {
    type: Boolean,
    default: false
  },
  
  lastSeen: {
    type: Date,
    default: Date.now
  },
  
  // Контакты
  contacts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Настройки
  settings: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    notifications: {
      messages: { type: Boolean, default: true },
      calls: { type: Boolean, default: true },
      sound: { type: Boolean, default: true }
    },
    privacy: {
      showOnlineStatus: { type: Boolean, default: true },
      showLastSeen: { type: Boolean, default: true },
      showReadReceipts: { type: Boolean, default: true }
    }
  },
  
  // Refresh token (хранится хэш)
  refreshToken: {
    type: String,
    default: null,
    select: false
  },
  
  // Блокировки
  blockedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true // Автоматически добавляет createdAt и updatedAt
});

// Индексы для оптимизации поиска
userSchema.index({ email: 1 });
userSchema.index({ name: 'text' });
userSchema.index({ 'contacts': 1 });

/**
 * Хэширование пароля перед сохранением
 */
userSchema.pre('save', async function(next) {
  // Хэшируем только если пароль был изменён
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Метод для сравнения паролей
 * @param {string} candidatePassword - Пароль для проверки
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function(candidatePassword) {
  // Получаем пароль явно, так как он excluded по умолчанию
  const user = await this.constructor.findById(this._id).select('+password');
  return await bcrypt.compare(candidatePassword, user.password);
};

/**
 * Метод для обновления refresh token
 */
userSchema.methods.updateRefreshToken = async function(token) {
  this.refreshToken = token;
  await this.save();
};

/**
 * Метод для очистки refresh token
 */
userSchema.methods.clearRefreshToken = async function() {
  this.refreshToken = null;
  await this.save();
};

/**
 * Метод для добавления контакта
 */
userSchema.methods.addContact = async function(userId) {
  if (!this.contacts.includes(userId)) {
    this.contacts.push(userId);
    await this.save();
  }
  return this;
};

/**
 * Метод для удаления контакта
 */
userSchema.methods.removeContact = async function(userId) {
  this.contacts = this.contacts.filter(id => id.toString() !== userId.toString());
  await this.save();
  return this;
};

/**
 * Метод для блокировки пользователя
 */
userSchema.methods.blockUser = async function(userId) {
  if (!this.blockedUsers.includes(userId)) {
    this.blockedUsers.push(userId);
    await this.save();
  }
  return this;
};

/**
 * Метод для разблокировки пользователя
 */
userSchema.methods.unblockUser = async function(userId) {
  this.blockedUsers = this.blockedUsers.filter(id => id.toString() !== userId.toString());
  await this.save();
  return this;
};

/**
 * Виртуальное поле для полного имени
 */
userSchema.virtual('displayName').get(function() {
  return this.name;
});

/**
 * Виртуальное поле для получения статуса "был в сети"
 */
userSchema.methods.getLastSeenString = function() {
  if (this.isOnline) {
    return 'в сети';
  }
  
  const now = Date.now();
  const lastSeen = this.lastSeen.getTime();
  const diff = now - lastSeen;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `был(а) ${minutes} мин. назад`;
  if (hours < 24) return `был(а) ${hours} ч. назад`;
  if (days < 7) return `был(а) ${days} дн. назад`;
  
  return this.lastSeen.toLocaleDateString('ru-RU');
};

const User = mongoose.model('User', userSchema);

export default User;
