import { useState, useEffect, useRef, useCallback } from 'react';

export function useChat() {
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const messagesEndRef = useRef(null);

  // Прокрутка к последнему сообщению
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Загрузка списка чатов
  const loadChats = useCallback(async () => {
    try {
      setLoading(true);
      // API вызов будет в компоненте через api client
      return chats;
    } catch (error) {
      console.error('Ошибка загрузки чатов:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [chats]);

  // Загрузка сообщений
  const loadMessages = useCallback(async (chatId, page = 1, limit = 20) => {
    try {
      setLoading(true);
      // API вызов будет в компоненте
      return messages;
    } catch (error) {
      console.error('Ошибка загрузки сообщений:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [messages]);

  // Отправка сообщения
  const sendMessage = useCallback(async (chatId, content, type = 'text') => {
    try {
      // Оптимистичное добавление
      const tempMessage = {
        _id: `temp_${Date.now()}`,
        chatId,
        content,
        type,
        createdAt: new Date().toISOString(),
        isOptimistic: true,
      };
      
      setMessages(prev => [...prev, tempMessage]);
      
      return tempMessage;
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
      throw error;
    }
  }, []);

  // Удаление сообщения
  const deleteMessage = useCallback(async (messageId) => {
    setMessages(prev => prev.filter(msg => msg._id !== messageId));
  }, []);

  // Редактирование сообщения
  const editMessage = useCallback(async (messageId, content) => {
    setMessages(prev => prev.map(msg => 
      msg._id === messageId ? { ...msg, content, editedAt: new Date().toISOString() } : msg
    ));
  }, []);

  // Индикатор набора
  const startTyping = useCallback((chatId) => {
    setTypingUsers(prev => ({ ...prev, [chatId]: true }));
  }, []);

  const stopTyping = useCallback((chatId) => {
    setTypingUsers(prev => ({ ...prev, [chatId]: false }));
  }, []);

  const value = {
    chats,
    activeChat,
    messages,
    loading,
    typingUsers,
    messagesEndRef,
    setChats,
    setActiveChat,
    setMessages,
    loadChats,
    loadMessages,
    sendMessage,
    deleteMessage,
    editMessage,
    startTyping,
    stopTyping,
    scrollToBottom,
  };

  return value;
}
