/**
 * Валидаторы для проверки входных данных
 */

import Joi from 'joi';

/**
 * Схема валидации для регистрации
 */
export const registerSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.email': 'Некорректный email адрес',
      'any.required': 'Email обязателен'
    }),
  
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-zA-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.min': 'Пароль должен содержать минимум 8 символов',
      'string.pattern.base': 'Пароль должен содержать буквы и цифры',
      'any.required': 'Пароль обязателен'
    }),
  
  name: Joi.string()
    .min(2)
    .max(50)
    .trim()
    .required()
    .messages({
      'string.min': 'Имя должно содержать минимум 2 символа',
      'string.max': 'Имя не может превышать 50 символов',
      'any.required': 'Имя обязательно'
    })
});

/**
 * Схема валидации для входа
 */
export const loginSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.email': 'Некорректный email адрес',
      'any.required': 'Email обязателен'
    }),
  
  password: Joi.string()
    .required()
    .messages({
      'any.required': 'Пароль обязателен'
    })
});

/**
 * Схема валидации для обновления профиля
 */
export const updateProfileSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(50)
    .trim()
    .optional(),
  
  status: Joi.string()
    .max(140)
    .trim()
    .allow('')
    .optional(),
  
  bio: Joi.string()
    .max(500)
    .trim()
    .allow('')
    .optional()
});

/**
 * Схема валидации для создания сообщения
 */
export const messageValidation = Joi.object({
  chatId: Joi.string()
    .hex()
    .length(24)
    .required()
    .messages({
      'string.hex': 'Некорректный ID чата',
      'string.length': 'Некорректная длина ID чата',
      'any.required': 'ID чата обязателен'
    }),
  
  content: Joi.string()
    .max(10000)
    .allow('')
    .optional(),
  
  type: Joi.string()
    .valid('text', 'image', 'video', 'audio', 'file', 'voice', 'system')
    .default('text'),
  
  replyTo: Joi.string()
    .hex()
    .length(24)
    .allow(null)
    .optional(),
  
  attachments: Joi.array()
    .items(Joi.object({
      url: Joi.string().uri().required(),
      filename: Joi.string().optional(),
      mimeType: Joi.string().optional(),
      size: Joi.number().optional()
    }))
    .optional()
});

/**
 * Схема валидации для создания чата
 */
export const chatValidation = Joi.object({
  type: Joi.string()
    .valid('private', 'group')
    .default('private'),
  
  participants: Joi.array()
    .items(Joi.string().hex().length(24))
    .min(1)
    .required()
});

/**
 * Схема валидации для создания группы
 */
export const createGroupValidation = Joi.object({
  type: Joi.string()
    .valid('group')
    .required(),
  
  participants: Joi.array()
    .items(Joi.string().hex().length(24))
    .min(1)
    .max(255)
    .required(),
  
  groupName: Joi.string()
    .min(2)
    .max(100)
    .trim()
    .required()
    .messages({
      'string.min': 'Название группы должно содержать минимум 2 символа',
      'string.max': 'Название группы не может превышать 100 символов',
      'any.required': 'Название группы обязательно'
    }),
  
  groupAvatar: Joi.string()
    .uri()
    .allow(null, '')
    .optional()
});

/**
 * Схема валидации для загрузки файлов
 */
export const fileUploadSchema = Joi.object({
  chatId: Joi.string()
    .hex()
    .length(24)
    .required(),
  
  messageId: Joi.string()
    .hex()
    .length(24)
    .optional()
    .allow(null)
});

/**
 * Схема валидации для восстановления пароля
 */
export const forgotPasswordSchema = Joi.object({
  email: Joi.string()
    .email({ tlds: { allow: false } })
    .required()
    .messages({
      'string.email': 'Некорректный email адрес',
      'any.required': 'Email обязателен'
    })
});

/**
 * Схема валидации для сброса пароля
 */
export const resetPasswordSchema = Joi.object({
  token: Joi.string()
    .required()
    .messages({
      'any.required': 'Токен обязателен'
    }),
  
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-zA-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.min': 'Пароль должен содержать минимум 8 символов',
      'string.pattern.base': 'Пароль должен содержать буквы и цифры',
      'any.required': 'Пароль обязателен'
    })
});

/**
 * Middleware для валидации запроса
 * @param {Joi.ObjectSchema} schema - Схема Joi
 * @returns {Function} Express middleware
 */
export function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Возвращать все ошибки, а не только первую
      stripUnknown: true // Удалять неизвестные поля
    });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        success: false,
        message: 'Ошибка валидации',
        errors
      });
    }
    
    // Заменяем req.body на валидированные данные
    req.body = value;
    next();
  };
}
