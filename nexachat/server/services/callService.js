/**
 * Сервис управления звонками (WebRTC сигнализация)
 * Обрабатывает инициацию, принятие, отклонение и завершение звонков
 */

const Call = require('../models/Call');
const Chat = require('../models/Chat');
const { logger } = require('../utils/helpers');

// Хранилище активных звонков: callId -> callData
const activeCalls = new Map();

/**
 * Инициация звонка
 * @param {Socket} socket - сокет звонящего
 * @param {Object} data - данные звонка
 * @param {Server} io - Socket.IO сервер
 */
const handleCallInitiate = (socket, data, io) => {
  try {
    const { targetUserId, chatId, type = 'audio', offer } = data;
    const callerId = socket.userId;
    const callerName = socket.user.name;

    // Проверка доступа к чату
    Chat.findById(chatId).then(chat => {
      if (!chat || !chat.participants.some(p => p.toString() === targetUserId)) {
        socket.emit('call_error', { error: 'Невозможно позвонить этому пользователю' });
        return;
      }

      // Генерируем ID звонка
      const callId = `call_${Date.now()}_${callerId}`;

      // Сохраняем информацию о звонке
      const callData = {
        callId,
        chatId,
        callerId,
        callerName,
        targetUserId,
        type,
        offer, // SDP offer от WebRTC
        status: 'initiated',
        startTime: new Date()
      };

      activeCalls.set(callId, callData);

      // Отправляем запрос на звонок получателю
      io.to(`user:${targetUserId}`).emit('incoming_call', {
        callId,
        from: {
          userId: callerId,
          name: callerName,
          avatar: socket.user.avatar
        },
        chatId,
        type,
        timestamp: new Date()
      });

      logger.info(`📞 Звонок ${type} инициирован от ${callerName} к пользователю ${targetUserId}`);
      
      // Подтверждение звонящему
      socket.emit('call_initiated', { callId, status: 'ringing' });
    }).catch(err => {
      logger.error(`Ошибка инициации звонка: ${err.message}`);
      socket.emit('call_error', { error: 'Ошибка инициации звонка' });
    });
  } catch (error) {
    logger.error(`Ошибка в handleCallInitiate: ${error.message}`);
    socket.emit('call_error', { error: 'Внутренняя ошибка сервера' });
  }
};

/**
 * Принятие звонка
 * @param {Socket} socket - сокет принимающего
 * @param {Object} data - данные звонка
 * @param {Server} io - Socket.IO сервер
 */
const handleCallAccept = (socket, data, io) => {
  try {
    const { callId, answer } = data; // answer - SDP answer от WebRTC
    const calleeId = socket.userId;

    const call = activeCalls.get(callId);
    if (!call) {
      socket.emit('call_error', { error: 'Звонок не найден' });
      return;
    }

    if (call.targetUserId !== calleeId) {
      socket.emit('call_error', { error: 'Вы не являетесь получателем звонка' });
      return;
    }

    // Обновляем статус звонка
    call.status = 'accepted';
    call.answer = answer;
    activeCalls.set(callId, call);

    // Сохраняем запись о звонке в БД
    Call.create({
      chatId: call.chatId,
      caller: call.callerId,
      callee: calleeId,
      type: call.type,
      status: 'answered',
      startedAt: new Date()
    }).catch(err => logger.error(`Ошибка сохранения звонка в БД: ${err.message}`));

    // Уведомляем звонящего о принятии
    io.to(`user:${call.callerId}`).emit('call_accepted', {
      callId,
      answer, // Передаем SDP answer для установки соединения
      from: {
        userId: calleeId,
        name: socket.user.name
      }
    });

    logger.info(`✅ Звонок ${callId} принят`);
  } catch (error) {
    logger.error(`Ошибка в handleCallAccept: ${error.message}`);
    socket.emit('call_error', { error: 'Внутренняя ошибка сервера' });
  }
};

/**
 * Отклонение звонка
 * @param {Socket} socket - сокет принимающего
 * @param {Object} data - данные звонка
 * @param {Server} io - Socket.IO сервер
 */
const handleCallReject = (socket, data, io) => {
  try {
    const { callId, reason } = data;
    const calleeId = socket.userId;

    const call = activeCalls.get(callId);
    if (!call) {
      return;
    }

    if (call.targetUserId !== calleeId) {
      return;
    }

    // Удаляем из активных
    activeCalls.delete(callId);

    // Сохраняем запись о пропущенном звонке
    Call.create({
      chatId: call.chatId,
      caller: call.callerId,
      callee: calleeId,
      type: call.type,
      status: 'declined',
      startedAt: new Date(),
      endedAt: new Date()
    }).catch(err => logger.error(`Ошибка сохранения звонка в БД: ${err.message}`));

    // Уведомляем звонящего об отклонении
    io.to(`user:${call.callerId}`).emit('call_rejected', {
      callId,
      reason: reason || 'Пользователь отклонил звонок'
    });

    logger.info(`❌ Звонок ${callId} отклонён`);
  } catch (error) {
    logger.error(`Ошибка в handleCallReject: ${error.message}`);
  }
};

/**
 * Завершение звонка
 * @param {Socket} socket - сокет завершающего
 * @param {Object} data - данные звонка
 * @param {Server} io - Socket.IO сервер
 */
const handleCallEnd = (socket, data, io) => {
  try {
    const { callId, duration } = data;
    const userId = socket.userId;

    const call = activeCalls.get(callId);
    if (!call) {
      return;
    }

    // Проверяем, что завершает один из участников
    if (call.callerId !== userId && call.targetUserId !== userId) {
      return;
    }

    // Удаляем из активных
    activeCalls.delete(callId);

    // Обновляем запись в БД
    Call.findOneAndUpdate(
      { 
        caller: call.callerId,
        callee: call.targetUserId,
        status: 'answered'
      },
      {
        status: 'completed',
        endedAt: new Date(),
        duration: duration || 0
      }
    ).catch(err => logger.error(`Ошибка обновления звонка в БД: ${err.message}`));

    // Уведомляем второго участника
    const otherUserId = call.callerId === userId ? call.targetUserId : call.callerId;
    io.to(`user:${otherUserId}`).emit('call_ended', {
      callId,
      duration,
      by: userId
    });

    logger.info(`📞 Звонок ${callId} завершён, длительность: ${duration}s`);
  } catch (error) {
    logger.error(`Ошибка в handleCallEnd: ${error.message}`);
  }
};

/**
 * Обработка WebRTC offer (SDP)
 * @param {Socket} socket - сокет отправителя
 * @param {Object} data - данные offer
 * @param {Server} io - Socket.IO сервер
 */
const handleWebRTCOffer = (socket, data, io) => {
  try {
    const { targetUserId, offer, callId } = data;

    // Пересылаем offer другому пользователю
    io.to(`user:${targetUserId}`).emit('webrtc_offer', {
      callId,
      from: socket.userId,
      offer
    });

    logger.debug(`🔄 WebRTC offer передан от ${socket.userId} к ${targetUserId}`);
  } catch (error) {
    logger.error(`Ошибка в handleWebRTCOffer: ${error.message}`);
  }
};

/**
 * Обработка WebRTC answer (SDP)
 * @param {Socket} socket - сокет отправителя
 * @param {Object} data - данные answer
 * @param {Server} io - Socket.IO сервер
 */
const handleWebRTCAnswer = (socket, data, io) => {
  try {
    const { targetUserId, answer, callId } = data;

    // Пересылаем answer другому пользователю
    io.to(`user:${targetUserId}`).emit('webrtc_answer', {
      callId,
      from: socket.userId,
      answer
    });

    logger.debug(`🔄 WebRTC answer передан от ${socket.userId} к ${targetUserId}`);
  } catch (error) {
    logger.error(`Ошибка в handleWebRTCAnswer: ${error.message}`);
  }
};

/**
 * Обработка WebRTC ICE кандидата
 * @param {Socket} socket - сокет отправителя
 * @param {Object} data - данные ICE кандидата
 * @param {Server} io - Socket.IO сервер
 */
const handleWebRTCIceCandidate = (socket, data, io) => {
  try {
    const { targetUserId, candidate, callId } = data;

    // Пересылаем ICE кандидата другому пользователю
    io.to(`user:${targetUserId}`).emit('webrtc_ice_candidate', {
      callId,
      from: socket.userId,
      candidate
    });

    logger.debug(`🔄 WebRTC ICE candidate передан`);
  } catch (error) {
    logger.error(`Ошибка в handleWebRTCIceCandidate: ${error.message}`);
  }
};

/**
 * Получить статистику активных звонков
 */
const getActiveCallsStats = () => {
  return {
    total: activeCalls.size,
    calls: Array.from(activeCalls.values()).map(c => ({
      callId: c.callId,
      type: c.type,
      status: c.status,
      duration: Math.floor((Date.now() - c.startTime.getTime()) / 1000)
    }))
  };
};

module.exports = {
  handleCallInitiate,
  handleCallAccept,
  handleCallReject,
  handleCallEnd,
  handleWebRTCOffer,
  handleWebRTCAnswer,
  handleWebRTCIceCandidate,
  getActiveCallsStats,
  activeCalls
};
