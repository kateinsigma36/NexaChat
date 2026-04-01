import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import socketClient from '../services/socketClient';

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      // Инициализируем сокет только если пользователь авторизован
      const newSocket = socketClient.connect();
      
      newSocket.on('connect', () => {
        console.log('✅ Socket connected');
        setIsConnected(true);
        
        // Аутентифицируем сокет с токеном
        newSocket.emit('authenticate', { userId: user._id });
      });

      newSocket.on('disconnect', () => {
        console.log('❌ Socket disconnected');
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setIsConnected(false);
      });

      setSocket(newSocket);

      // Очистка при размонтировании или изменении пользователя
      return () => {
        if (newSocket) {
          newSocket.disconnect();
        }
      };
    } else {
      // Если пользователь не авторизован, отключаем сокет
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
    }
  }, [isAuthenticated, user]);

  const value = {
    socket,
    isConnected,
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  
  if (!context) {
    throw new Error('useSocket должен использоваться внутри SocketProvider');
  }
  
  return context;
}
