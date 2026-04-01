import { useState, useEffect, useCallback } from 'react';

export function useSocket() {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // Хук должен использоваться внутри SocketProvider
  // Это базовая реализация для использования вне контекста
  const connect = useCallback(() => {
    // Логика подключения вынесена в socketClient
    console.warn('useSocket должен использоваться через SocketContext');
  }, []);

  const disconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
    }
  }, [socket]);

  const emit = useCallback((event, data) => {
    if (socket && isConnected) {
      socket.emit(event, data);
    }
  }, [socket, isConnected]);

  const on = useCallback((event, callback) => {
    if (socket) {
      socket.on(event, callback);
      return () => socket.off(event, callback);
    }
  }, [socket]);

  return {
    socket,
    isConnected,
    connect,
    disconnect,
    emit,
    on,
  };
}
