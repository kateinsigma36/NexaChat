/**
 * AuthContext - контекст аутентификации
 * Управление состоянием пользователя, вход/выход
 */

import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socketClient';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth должен использоваться внутри AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Проверка авторизации при загрузке
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await authAPI.getMe();
      if (response.data.success) {
        setUser(response.data.user);
        setIsAuthenticated(true);
        connectSocket(token);
      }
    } catch (error) {
      console.error('Ошибка проверки авторизации:', error);
      localStorage.removeItem('accessToken');
    } finally {
      setLoading(false);
    }
  };

  // Регистрация
  const register = async (userData) => {
    try {
      const response = await authAPI.register(userData);
      
      if (response.data.success) {
        const { accessToken, user } = response.data;
        localStorage.setItem('accessToken', accessToken);
        setUser(user);
        setIsAuthenticated(true);
        connectSocket(accessToken);
        return { success: true };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Ошибка регистрации'
      };
    }
  };

  // Вход
  const login = async (credentials) => {
    try {
      const response = await authAPI.login(credentials);
      
      if (response.data.success) {
        const { accessToken, user } = response.data;
        localStorage.setItem('accessToken', accessToken);
        setUser(user);
        setIsAuthenticated(true);
        connectSocket(accessToken);
        return { success: true };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Ошибка входа'
      };
    }
  };

  // Выход
  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Ошибка выхода:', error);
    } finally {
      localStorage.removeItem('accessToken');
      setUser(null);
      setIsAuthenticated(false);
      disconnectSocket();
    }
  };

  // Обновление профиля
  const updateProfile = async (userData) => {
    try {
      const response = await authAPI.updateProfile(userData);
      
      if (response.data.success) {
        setUser(response.data.user);
        return { success: true };
      }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Ошибка обновления профиля'
      };
    }
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    register,
    login,
    logout,
    updateProfile,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
