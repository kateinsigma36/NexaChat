/**
 * Модель звонка
 * Хранит историю аудио и видеозвонков
 */

import mongoose from 'mongoose';

const callSchema = new mongoose.Schema({
  // Чат, в котором произошёл звонок
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true
  },
  
  // Инициатор звонка
  caller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Получатель звонка (для групповых - null или массив)
  callee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Тип звонка
  type: {
    type: String,
    enum: ['audio', 'video'],
    required: true
  },
  
  // Статус звонка
  status: {
    type: String,
    enum: ['initiated', 'ringing', 'answered', 'declined', 'missed', 'ended', 'failed'],
    default: 'initiated'
  },
  
  // Время начала звонка
  startedAt: {
    type: Date,
    default: Date.now
  },
  
  // Время завершения звонка
  endedAt: {
    type: Date,
    default: null
  },
  
  // Длительность в секундах
  duration: {
    type: Number,
    default: 0
  },
  
  // Участники звонка (для групповых)
  participants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    joinedAt: Date,
    leftAt: Date,
    duration: Number
  }],
  
  // Причина завершения
  endReason: {
    type: String,
    enum: ['completed', 'cancelled', 'failed', 'timeout', 'busy'],
    default: null
  }
}, {
  timestamps: true
});

// Индексы для оптимизации
callSchema.index({ chatId: 1, createdAt: -1 });
callSchema.index({ caller: 1, createdAt: -1 });
callSchema.index({ callee: 1, createdAt: -1 });

// Виртуальное поле для получения длительности в формате мм:сс
callSchema.virtual('formattedDuration').get(function() {
  if (!this.duration || this.duration <= 0) return '0:00';
  
  const minutes = Math.floor(this.duration / 60);
  const seconds = this.duration % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

/**
 * Начать звонок
 */
callSchema.methods.start = async function() {
  this.status = 'ringing';
  this.startedAt = new Date();
  await this.save();
  return this;
};

/**
 * Принять звонок
 */
callSchema.methods.accept = async function() {
  this.status = 'answered';
  await this.save();
  return this;
};

/**
 * Отклонить звонок
 */
callSchema.methods.decline = async function() {
  this.status = 'declined';
  this.endedAt = new Date();
  await this.save();
  return this;
};

/**
 * Завершить звонок
 */
callSchema.methods.end = async function(reason = 'completed') {
  this.status = 'ended';
  this.endedAt = new Date();
  this.endReason = reason;
  
  // Вычисляем длительность
  if (this.startedAt) {
    this.duration = Math.floor((this.endedAt - this.startedAt) / 1000);
  }
  
  await this.save();
  return this;
};

/**
 * Добавить участника в групповой звонок
 */
callSchema.methods.addParticipant = async function(userId) {
  const existingParticipant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );
  
  if (!existingParticipant) {
    this.participants.push({
      user: userId,
      joinedAt: new Date()
    });
    await this.save();
  }
  
  return this;
};

/**
 * Участник покинул звонок
 */
callSchema.methods.removeParticipant = async function(userId) {
  const participant = this.participants.find(
    p => p.user.toString() === userId.toString()
  );
  
  if (participant) {
    participant.leftAt = new Date();
    
    // Вычисляем длительность участия
    if (participant.joinedAt) {
      participant.duration = Math.floor((participant.leftAt - participant.joinedAt) / 1000);
    }
    
    await this.save();
  }
  
  return this;
};

/**
 * Пропущенный звонок
 */
callSchema.methods.markAsMissed = async function() {
  this.status = 'missed';
  this.endedAt = new Date();
  await this.save();
  return this;
};

const Call = mongoose.model('Call', callSchema);

export default Call;
