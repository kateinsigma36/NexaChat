/**
 * Модель сообщения
 * Хранит все сообщения в чатах
 */

import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  // Чат, к которому принадлежит сообщение
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
    index: true
  },
  
  // Отправитель
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Тип сообщения
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'file', 'voice', 'system'],
    default: 'text'
  },
  
  // Содержимое (зашифровано для text сообщений)
  content: {
    type: String,
    required: function() {
      return this.type === 'text';
    }
  },
  
  // Медиа данные
  media: {
    url: String,
    thumbnail: String,
    mimeType: String,
    size: Number,
    width: Number,
    height: Number,
    duration: Number // для аудио/видео в секундах
  },
  
  // Ответ на другое сообщение
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  
  // Реакции на сообщение
  reactions: [{
    emoji: { type: String, required: true },
    user: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User',
      required: true 
    },
    createdAt: { type: Date, default: Date.now }
  }],
  
  // Прочитано пользователями
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Доставлено пользователям
  deliveredTo: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deliveredAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Сообщение было редактировано
  editedAt: {
    type: Date,
    default: null
  },
  
  // Удалено для конкретных пользователей
  deletedFor: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deletedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Удалено для всех
  deletedForAll: {
    type: Boolean,
    default: false
  },
  
  // Пересланное сообщение
  forwardedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  
  // Упоминания пользователей
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

// Индексы для оптимизации
messageSchema.index({ chatId: 1, createdAt: -1 }); // Для пагинации
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ 'reactions.user': 1 });
messageSchema.index({ 'readBy.user': 1 });

// Виртуальное поле для получения статуса прочтения
messageSchema.virtual('isRead').get(function() {
  return this.readBy && this.readBy.length > 0;
});

/**
 * Метод для добавления реакции
 */
messageSchema.methods.addReaction = async function(userId, emoji) {
  const existingReaction = this.reactions.find(
    r => r.user.toString() === userId.toString() && r.emoji === emoji
  );
  
  if (existingReaction) {
    // Если такая реакция уже есть, удаляем её (toggle)
    this.reactions = this.reactions.filter(
      r => !(r.user.toString() === userId.toString() && r.emoji === emoji)
    );
  } else {
    // Удаляем другие реакции этого пользователя
    this.reactions = this.reactions.filter(
      r => r.user.toString() !== userId.toString()
    );
    // Добавляем новую реакцию
    this.reactions.push({ emoji, user: userId });
  }
  
  await this.save();
  return this;
};

/**
 * Метод для отметки о прочтении
 */
messageSchema.methods.markAsRead = async function(userId) {
  const alreadyRead = this.readBy.find(
    r => r.user.toString() === userId.toString()
  );
  
  if (!alreadyRead) {
    this.readBy.push({ user: userId, readAt: new Date() });
    await this.save();
  }
  
  return this;
};

/**
 * Метод для отметки о доставке
 */
messageSchema.methods.markAsDelivered = async function(userId) {
  const alreadyDelivered = this.deliveredTo.find(
    r => r.user.toString() === userId.toString()
  );
  
  if (!alreadyDelivered) {
    this.deliveredTo.push({ user: userId, deliveredAt: new Date() });
    await this.save();
  }
  
  return this;
};

/**
 * Метод для редактирования сообщения
 */
messageSchema.methods.edit = async function(newContent) {
  this.content = newContent;
  this.editedAt = new Date();
  await this.save();
  return this;
};

/**
 * Метод для мягкого удаления (для себя)
 */
messageSchema.methods.softDelete = async function(userId) {
  const alreadyDeleted = this.deletedFor.find(
    d => d.user.toString() === userId.toString()
  );
  
  if (!alreadyDeleted) {
    this.deletedFor.push({ user: userId, deletedAt: new Date() });
    await this.save();
  }
  
  return this;
};

/**
 * Метод для удаления для всех
 */
messageSchema.methods.deleteForAll = async function() {
  this.deletedForAll = true;
  this.content = 'Это сообщение было удалено';
  this.media = undefined;
  await this.save();
  return this;
};

const Message = mongoose.model('Message', messageSchema);

export default Message;
