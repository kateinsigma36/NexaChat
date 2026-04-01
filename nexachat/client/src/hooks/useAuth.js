import { useState, useEffect } from 'react';
import api from '../services/api';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Проверка авторизации при загрузке
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await api.get('/api/auth/me');
      setUser(response.data.user);
      setIsAuthenticated(true);
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  // Регистрация
  const register = async (userData) => {
    try {
      const response = await api.post('/api/auth/register', userData);
      const { user, tokens } = response.data;
      
      // Сохраняем токены
      localStorage.setItem('accessToken', tokens.access);
      
      setUser(user);
      setIsAuthenticated(true);
      
      return { success: true, user };
    } catch (error) {
      const message = error.response?.data?.message || 'Ошибка регистрации';
      return { success: false, error: message };
    }
  };

  // Вход
  const login = async (credentials) => {
    try {
      const response = await api.post('/api/auth/login', credentials);
      const { user, tokens } = response.data;
      
      // Сохраняем токены
      localStorage.setItem('accessToken', tokens.access);
      
      setUser(user);
      setIsAuthenticated(true);
      
      return { success: true, user };
    } catch (error) {
      const message = error.response?.data?.message || 'Ошибка входа';
      return { success: false, error: message };
    }
  };

  // Выход
  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (error) {
      console.error('Ошибка выхода:', error);
    } finally {
      // Очищаем данные в любом случае
      localStorage.removeItem('accessToken');
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  // Обновление профиля
  const updateProfile = async (profileData) => {
    try {
      const response = await api.put('/api/auth/profile', profileData);
      const updatedUser = response.data.user;
      setUser(updatedUser);
      return { success: true, user: updatedUser };
    } catch (error) {
      const message = error.response?.data?.message || 'Ошибка обновления профиля';
      return { success: false, error: message };
    }
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    register,
    login,
    logout,
    updateProfile,
    checkAuth,
  };

  return value;
}
