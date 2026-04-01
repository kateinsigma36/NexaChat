import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const ChatContext = createContext();

export function ChatProvider({ children }) {
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});

  // Загрузка списка чатов
  const loadChats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/chats');
      setChats(response.data.chats || []);
    } catch (error) {
      console.error('Ошибка загрузки чатов:', error);
    } finally {
      setLoading(false);
    }
  };

  // Загрузка сообщений чата
  const loadMessages = async (chatId, page = 1, limit = 20) => {
    try {
      setLoading(true);
      const response = await api.get(`/api/messages/${chatId}`, {
        params: { page, limit },
      });
      
      const newMessages = response.data.messages || [];
      
      if (page === 1) {
        setMessages(newMessages);
      } else {
        // Добавляем старые сообщения при пагинации
        setMessages(prev => [...newMessages, ...prev]);
      }
      
      return newMessages;
    } catch (error) {
      console.error('Ошибка загрузки сообщений:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Отправка сообщения
  const sendMessage = async (chatId, content, type = 'text', replyTo = null) => {
    try {
      const response = await api.post('/api/messages', {
        chatId,
        content,
        type,
        replyTo,
      });
      
      const newMessage = response.data.message;
      
      // Оптимистично добавляем сообщение в список
      setMessages(prev => [...prev, newMessage]);
      
      // Обновляем последнее сообщение в списке чатов
      setChats(prev => prev.map(chat => 
        chat._id === chatId 
          ? { ...chat, lastMessage: newMessage }
          : chat
      ).sort((a, b) => new Date(b.lastMessage?.createdAt) - new Date(a.lastMessage?.createdAt)));
      
      return newMessage;
    } catch (error) {
      console.error('Ошибка отправки сообщения:', error);
      throw error;
    }
  };

  // Удаление сообщения
  const deleteMessage = async (messageId, forAll = false) => {
    try {
      await api.delete(`/api/messages/${messageId}`, {
        data: { forAll },
      });
      
      // Удаляем из списка
      setMessages(prev => prev.filter(msg => msg._id !== messageId));
    } catch (error) {
      console.error('Ошибка удаления сообщения:', error);
      throw error;
    }
  };

  // Редактирование сообщения
  const editMessage = async (messageId, content) => {
    try {
      const response = await api.put(`/api/messages/${messageId}`, { content });
      const updatedMessage = response.data.message;
      
      // Обновляем в списке
      setMessages(prev => prev.map(msg => 
        msg._id === messageId ? updatedMessage : msg
      ));
      
      return updatedMessage;
    } catch (error) {
      console.error('Ошибка редактирования сообщения:', error);
      throw error;
    }
  };

  // Индикатор набора текста
  const startTyping = (chatId) => {
    setTypingUsers(prev => ({
      ...prev,
      [chatId]: true,
    }));
  };

  const stopTyping = (chatId) => {
    setTypingUsers(prev => ({
      ...prev,
      [chatId]: false,
    }));
  };

  // Создание чата
  const createChat = async (participantIds, isGroup = false, groupName = null) => {
    try {
      const response = await api.post('/api/chats', {
        participants: participantIds,
        isGroup,
        name: groupName,
      });
      
      const newChat = response.data.chat;
      setChats(prev => [newChat, ...prev]);
      return newChat;
    } catch (error) {
      console.error('Ошибка создания чата:', error);
      throw error;
    }
  };

  const value = {
    chats,
    activeChat,
    messages,
    loading,
    typingUsers,
    loadChats,
    loadMessages,
    sendMessage,
    deleteMessage,
    editMessage,
    startTyping,
    stopTyping,
    setActiveChat,
    createChat,
    setChats,
    setMessages,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  
  if (!context) {
    throw new Error('useChat должен использоваться внутри ChatProvider');
  }
  
  return context;
}
