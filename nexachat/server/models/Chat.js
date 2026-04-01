/**
 * Модель чата
 * Хранит личные и групповые чаты
 */

import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
  // Тип чата: private (1-на-1) или group
  type: {
    type: String,
    enum: ['private', 'group'],
    required: true,
    default: 'private'
  },
  
  // Участники чата
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    role: {
      type: String,
      enum: ['member', 'admin', 'creator'],
      default: 'member'
    }
  }],
  
  // Название (для групповых чатов)
  name: {
    type: String,
    trim: true,
    maxlength: [100, 'Название не может превышать 100 символов']
  },
  
  // Аватар чата (для групповых)
  avatar: {
    type: String,
    default: null
  },
  
  // Создатель группы
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  // Администраторы группы
  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Последнее сообщение в чате
  lastMessage: {
    text: String,
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: Date,
    type: {
      type: String,
      enum: ['text', 'image', 'video', 'audio', 'file', 'voice']
    }
  },
  
  // Закреплённые пользователи
  pinnedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    pinnedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Архивированные пользователи
  archivedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    archivedAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Настройки чата
  settings: {
    // Для групповых чатов
    allowMemberAddOthers: { type: Boolean, default: false },
    allowMemberChangeInfo: { type: Boolean, default: false },
    // mute уведомления для конкретных пользователей
    mutedBy: [{
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      mutedUntil: Date // null = навсегда
    }]
  },
  
  // Описание группы
  description: {
    type: String,
    maxlength: [500, 'Описание не может превышать 500 символов']
  }
}, {
  timestamps: true
});

// Индексы для оптимизации
chatSchema.index({ 'participants.user': 1 });
chatSchema.index({ type: 1, 'lastMessage.timestamp': -1 });
chatSchema.index({ 'pinnedBy.user': 1 });

// Виртуальное поле для получения количества участников
chatSchema.virtual('participantCount').get(function() {
  return this.participants.length;
});

/**
 * Проверить, является ли пользователь участником чата
 */
chatSchema.methods.isParticipant = function(userId) {
  return this.participants.some(p => p.user.toString() === userId.toString());
};

/**
 * Проверить, является ли пользователь администратором
 */
chatSchema.methods.isAdmin = function(userId) {
  const participant = this.participants.find(p => p.user.toString() === userId.toString());
  return participant && (participant.role === 'admin' || participant.role === 'creator');
};

/**
 * Добавить участника в чат
 */
chatSchema.methods.addParticipant = async function(userId, role = 'member') {
  if (this.isParticipant(userId)) {
    return this;
  }
  
  this.participants.push({
    user: userId,
    role: role,
    joinedAt: new Date()
  });
  
  await this.save();
  return this;
};

/**
 * Удалить участника из чата
 */
chatSchema.methods.removeParticipant = async function(userId) {
  this.participants = this.participants.filter(
    p => p.user.toString() !== userId.toString()
  );
  
  // Также удаляем из админов
  this.admins = this.admins.filter(id => id.toString() !== userId.toString());
  
  await this.save();
  return this;
};

/**
 * Обновить роль участника
 */
chatSchema.methods.updateParticipantRole = async function(userId, role) {
  const participant = this.participants.find(p => p.user.toString() === userId.toString());
  
  if (!participant) {
    throw new Error('Пользователь не является участником чата');
  }
  
  participant.role = role;
  await this.save();
  return this;
};

/**
 * Обновить последнее сообщение
 */
chatSchema.methods.updateLastMessage = async function(message) {
  this.lastMessage = {
    text: message.content,
    sender: message.sender,
    timestamp: message.createdAt || new Date(),
    type: message.type
  };
  
  await this.save();
  return this;
};

/**
 * Закрепить чат для пользователя
 */
chatSchema.methods.pinForUser = async function(userId) {
  const alreadyPinned = this.pinnedBy.find(p => p.user.toString() === userId.toString());
  
  if (!alreadyPinned) {
    this.pinnedBy.push({ user: userId, pinnedAt: new Date() });
    await this.save();
  }
  
  return this;
};

/**
 * Открепить чат для пользователя
 */
chatSchema.methods.unpinForUser = async function(userId) {
  this.pinnedBy = this.pinnedBy.filter(p => p.user.toString() !== userId.toString());
  await this.save();
  return this;
};

/**
 * Архивировать чат для пользователя
 */
chatSchema.methods.archiveForUser = async function(userId) {
  const alreadyArchived = this.archivedBy.find(p => p.user.toString() === userId.toString());
  
  if (!alreadyArchived) {
    this.archivedBy.push({ user: userId, archivedAt: new Date() });
    await this.save();
  }
  
  return this;
};

/**
 * Разархивировать чат для пользователя
 */
chatSchema.methods.unarchiveForUser = async function(userId) {
  this.archivedBy = this.archivedBy.filter(p => p.user.toString() !== userId.toString());
  await this.save();
  return this;
};

/**
 * Заглушить чат для пользователя
 */
chatSchema.methods.muteForUser = async function(userId, duration = null) {
  const existingMute = this.settings.mutedBy.find(m => m.user.toString() === userId.toString());
  
  if (existingMute) {
    existingMute.mutedUntil = duration ? new Date(Date.now() + duration) : null;
  } else {
    this.settings.mutedBy.push({
      user: userId,
      mutedUntil: duration ? new Date(Date.now() + duration) : null
    });
  }
  
  await this.save();
  return this;
};

/**
 * Включить уведомления в чате для пользователя
 */
chatSchema.methods.unmuteForUser = async function(userId) {
  this.settings.mutedBy = this.settings.mutedBy.filter(
    m => m.user.toString() !== userId.toString()
  );
  
  await this.save();
  return this;
};

/**
 * Статический метод для поиска или создания личного чата
 */
chatSchema.statics.findOrCreatePrivateChat = async function(user1Id, user2Id) {
  // Ищем чат с обоими участниками
  let chat = await this.findOne({
    type: 'private',
    $and: [
      { 'participants.user': user1Id },
      { 'participants.user': user2Id }
    ]
  }).populate('participants.user', 'name avatar isOnline lastSeen');
  
  if (!chat) {
    // Создаём новый чат
    chat = await this.create({
      type: 'private',
      participants: [
        { user: user1Id, role: 'member' },
        { user: user2Id, role: 'member' }
      ]
    });
    
    chat = await chat.populate('participants.user', 'name avatar isOnline lastSeen');
  }
  
  return chat;
};

const Chat = mongoose.model('Chat', chatSchema);

export default Chat;
