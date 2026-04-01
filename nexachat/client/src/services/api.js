/**
 * API клиент для NexaChat
 * Axios instance с интерцепторами для токенов
 */

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Создаем axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Для отправки cookies
});

// Интерцептор запроса - добавляем access token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Интерцептор ответа - обрабатываем истечение токена
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Если ошибка 401 и это не повторный запрос
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Пытаемся refreshнуть токен
        const response = await axios.post(
          `${API_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const { accessToken } = response.data;
        localStorage.setItem('accessToken', accessToken);

        // Повторяем оригинальный запрос с новым токеном
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh не удался - logout
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// API методы
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  refresh: () => api.post('/auth/refresh'),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

export const chatAPI = {
  getAll: () => api.get('/chats'),
  getById: (id) => api.get(`/chats/${id}`),
  create: (data) => api.post('/chats', data),
  update: (id, data) => api.put(`/chats/${id}`, data),
  delete: (id) => api.delete(`/chats/${id}`),
  getParticipants: (id) => api.get(`/chats/${id}/participants`),
};

export const messageAPI = {
  getByChatId: (chatId, params) => api.get(`/messages/${chatId}`, { params }),
  send: (data) => api.post('/messages', data),
  edit: (id, data) => api.put(`/messages/${id}`, data),
  delete: (id, params) => api.delete(`/messages/${id}`, { params }),
  addReaction: (id, data) => api.post(`/messages/${id}/reactions`, data),
  removeReaction: (id) => api.delete(`/messages/${id}/reactions`),
  markAsRead: (id) => api.post(`/messages/${id}/read`),
  forward: (id, data) => api.post(`/messages/${id}/forward`, data),
  search: (params) => api.get('/messages/search', { params }),
};

export const userAPI = {
  search: (query) => api.get('/users/search', { params: { q: query } }),
  getById: (id) => api.get(`/users/${id}`),
  getContacts: () => api.get('/users/contacts'),
  addContact: (id) => api.post(`/users/contacts/${id}`),
  removeContact: (id) => api.delete(`/users/contacts/${id}`),
};

export default api;
