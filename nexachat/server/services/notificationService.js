/**
 * Сервис push-уведомлений через Firebase Cloud Messaging (FCM)
 * Отправляет уведомления на мобильные устройства и в браузер
 */

const admin = require('firebase-admin');
const { logger } = require('../utils/helpers');

// Инициализация Firebase Admin SDK
let firebaseApp = null;

/**
 * Инициализация Firebase Admin
 * @param {string} serviceAccount - JSON сервисного аккаунта Firebase
 */
const initializeFirebase = (serviceAccount) => {
  try {
    if (!firebaseApp) {
      const serviceAccountJson = typeof serviceAccount === 'string' 
        ? JSON.parse(serviceAccount) 
        : serviceAccount;
      
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccountJson)
      });
      
      logger.info('✅ Firebase Admin SDK инициализирован');
    }
  } catch (error) {
    logger.error(`❌ Ошибка инициализации Firebase: ${error.message}`);
  }
};

/**
 * Отправка push-уведомления одному устройству
 * @param {string} token - FCM токен устройства
 * @param {Object} notification - данные уведомления
 * @returns {Promise<Object>} результат отправки
 */
const sendPushNotification = async (token, notification) => {
  try {
    if (!admin.messaging) {
      logger.warn('Firebase не инициализирован, пропускаем отправку push');
      return { success: false, error: 'Firebase not initialized' };
    }

    const message = {
      token,
      notification: {
        title: notification.title || 'NexaChat',
        body: notification.body,
        image: notification.image
      },
      data: {
        type: notification.type || 'message',
        chatId: notification.chatId || '',
        messageId: notification.messageId || '',
        senderId: notification.senderId || '',
        senderName: notification.senderName || '',
        timestamp: Date.now().toString()
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            'content-available': 1
          }
        }
      }
    };

    const response = await admin.messaging().send(message);
    
    logger.info(`📱 Push-уведомление отправлено: ${response}`);
    
    return { success: true, messageId: response };
  } catch (error) {
    logger.error(`Ошибка отправки push-уведомления: ${error.message}`);
    
    // Проверяем на невалидный токен
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      return { success: false, error: 'Invalid token', invalidateToken: true };
    }
    
    return { success: false, error: error.message };
  }
};

/**
 * Отправка push-уведомления нескольким устройствам
 * @param {string[]} tokens - массив FCM токенов
 * @param {Object} notification - данные уведомления
 * @returns {Promise<Object>} результат отправки
 */
const sendMulticastNotification = async (tokens, notification) => {
  try {
    if (!admin.messaging) {
      logger.warn('Firebase не инициализирован, пропускаем отправку push');
      return { success: false, error: 'Firebase not initialized' };
    }

    if (tokens.length === 0) {
      return { success: false, error: 'No tokens provided' };
    }

    const message = {
      tokens,
      notification: {
        title: notification.title || 'NexaChat',
        body: notification.body,
        image: notification.image
      },
      data: {
        type: notification.type || 'message',
        chatId: notification.chatId || '',
        messageId: notification.messageId || '',
        senderId: notification.senderId || '',
        senderName: notification.senderName || '',
        timestamp: Date.now().toString()
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    
    logger.info(
      `📱 Multicast push: ${response.successCount} успешно, ${response.failureCount} ошибок`
    );
    
    // Собираем невалидные токены для удаления
    const invalidTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const error = resp.error;
        if (error?.code === 'messaging/invalid-registration-token' ||
            error?.code === 'messaging/registration-token-not-registered') {
          invalidTokens.push(tokens[idx]);
        }
      }
    });
    
    return { 
      success: true, 
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens
    };
  } catch (error) {
    logger.error(`Ошибка отправки multicast push-уведомления: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Отправка уведомления о новом сообщении
 * @param {string} token - FCM токен
 * @param {Object} data - данные сообщения
 */
const sendNewMessageNotification = async (token, data) => {
  return sendPushNotification(token, {
    title: data.senderName || 'Новое сообщение',
    body: data.preview || 'У вас новое сообщение',
    type: 'new_message',
    chatId: data.chatId,
    messageId: data.messageId,
    senderId: data.senderId,
    senderName: data.senderName
  });
};

/**
 * Отправка уведомления о звонке
 * @param {string} token - FCM токен
 * @param {Object} data - данные звонка
 */
const sendCallNotification = async (token, data) => {
  return sendPushNotification(token, {
    title: data.callerName || 'Входящий звонок',
    body: `${data.type === 'video' ? 'Видео' : 'Аудио'}звонок от ${data.callerName}`,
    type: 'incoming_call',
    callId: data.callId,
    chatId: data.chatId,
    callerId: data.callerId,
    callerName: data.callerName,
    callType: data.type
  });
};

/**
 * Отправка уведомления с действием (reaction, reply и т.д.)
 * @param {string} token - FCM токен
 * @param {Object} data - данные действия
 */
const sendActionNotification = async (token, data) => {
  return sendPushNotification(token, {
    title: data.title,
    body: data.body,
    type: data.actionType,
    chatId: data.chatId,
    messageId: data.messageId
  });
};

module.exports = {
  initializeFirebase,
  sendPushNotification,
  sendMulticastNotification,
  sendNewMessageNotification,
  sendCallNotification,
  sendActionNotification
};
