/**
 * Модель файла
 * Хранит информацию о загруженных файлах
 */

import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  // Сообщение, к которому прикреплён файл
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    required: true
  },
  
  // Чат, в котором отправлен файл
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
    index: true
  },
  
  // Загрузивший пользователь
  uploader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Оригинальное имя файла
  originalName: {
    type: String,
    required: true,
    trim: true
  },
  
  // Имя файла на сервере
  filename: {
    type: String,
    required: true,
    unique: true
  },
  
  // MIME тип файла
  mimeType: {
    type: String,
    required: true
  },
  
  // Размер файла в байтах
  size: {
    type: Number,
    required: true
  },
  
  // Путь к файлу
  path: {
    type: String,
    required: true
  },
  
  // URL для скачивания
  url: {
    type: String,
    required: true
  },
  
  // Превью (для изображений и видео)
  thumbnail: {
    url: String,
    path: String,
    width: Number,
    height: Number
  },
  
  // Метаданные для разных типов файлов
  metadata: {
    // Для изображений
    width: Number,
    height: Number,
    
    // Для аудио/видео
    duration: Number,
    codec: String,
    bitrate: Number,
    
    // Для документов
    pages: Number
  },
  
  // Статус обработки
  status: {
    type: String,
    enum: ['uploading', 'processing', 'ready', 'failed'],
    default: 'uploading'
  },
  
  // Хэш файла (для проверки целостности и дубликатов)
  hash: {
    type: String,
    default: null
  },
  
  // Зашифрован ли файл
  encrypted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Индексы для оптимизации
fileSchema.index({ chatId: 1, createdAt: -1 });
fileSchema.index({ uploader: 1, createdAt: -1 });
fileSchema.index({ mimeType: 1 });

// Виртуальное поле для размера в читаемом формате
fileSchema.virtual('formattedSize').get(function() {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (this.size === 0) return '0 B';
  
  const i = Math.floor(Math.log(this.size) / Math.log(1024));
  return `${(this.size / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
});

/**
 * Определить тип файла по MIME типу
 */
fileSchema.virtual('fileType').get(function() {
  const mime = this.mimeType;
  
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('word') || mime.includes('document')) return 'document';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'spreadsheet';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'presentation';
  if (mime.includes('zip') || mime.includes('archive')) return 'archive';
  if (mime.includes('text')) return 'text';
  
  return 'file';
});

/**
 * Метод для обновления статуса обработки
 */
fileSchema.methods.updateStatus = async function(status, error = null) {
  this.status = status;
  
  if (error) {
    this.error = error;
  }
  
  await this.save();
  return this;
};

/**
 * Метод для установки метаданных изображения
 */
fileSchema.methods.setImageMetadata = async function(width, height) {
  this.metadata.width = width;
  this.metadata.height = height;
  await this.save();
  return this;
};

/**
 * Метод для установки метаданных аудио/видео
 */
fileSchema.methods.setMediaMetadata = async function(duration, codec, bitrate) {
  this.metadata.duration = duration;
  this.metadata.codec = codec;
  this.metadata.bitrate = bitrate;
  await this.save();
  return this;
};

/**
 * Метод для установки превью
 */
fileSchema.methods.setThumbnail = async function(thumbnailPath, thumbnailUrl, width, height) {
  this.thumbnail = {
    path: thumbnailPath,
    url: thumbnailUrl,
    width,
    height
  };
  await this.save();
  return this;
};

/**
 * Статический метод для поиска файлов по чату
 */
fileSchema.statics.findByChat = async function(chatId, options = {}) {
  const {
    limit = 50,
    skip = 0,
    fileType = null
  } = options;
  
  const query = { chatId };
  
  if (fileType) {
    // Фильтрация по типу файла
    const mimePatterns = {
      image: 'image/*',
      video: 'video/*',
      audio: 'audio/*',
      document: ['application/pdf', 'application/msword'],
      archive: ['application/zip', 'application/x-rar']
    };
    
    if (mimePatterns[fileType]) {
      // Упрощённая фильтрация
      query.mimeType = new RegExp(fileType, 'i');
    }
  }
  
  return await this.find(query)
    .populate('uploader', 'name avatar')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

const File = mongoose.model('File', fileSchema);

export default File;
