import { useState, useEffect } from 'react';
import { useChat } from '../contexts/ChatContext';
import { useSocket } from '../contexts/SocketContext';
import ChatList from '../components/Chat/ChatList';

/**
 * Страница списка чатов
 */
export default function ChatsPage() {
  const { chats, loadChats, loading } = useChat();
  const { socket, isConnected } = useSocket();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadChats();
  }, []);

  // Обработка входящих сообщений через сокет
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (message) => {
      console.log('📩 Новое сообщение:', message);
      // Логика обновления списка чатов будет в ChatContext
    };

    socket.on('newMessage', handleNewMessage);

    return () => {
      socket.off('newMessage', handleNewMessage);
    };
  }, [socket]);

  const filteredChats = chats.filter(chat => {
    const query = searchQuery.toLowerCase();
    return chat.name?.toLowerCase().includes(query) ||
           chat.lastMessage?.content?.toLowerCase().includes(query);
  });

  return (
    <div className="h-full flex flex-col">
      {/* Заголовок */}
      <div className="p-4 border-b border-border-color bg-white dark:bg-gray-800">
        <h1 className="text-2xl font-bold text-text-main dark:text-text-dark mb-3">
          Чаты
        </h1>
        
        {/* Поиск */}
        <input
          type="text"
          placeholder="Поиск чатов..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 rounded-xl bg-secondary dark:bg-gray-700 border-none focus:ring-2 focus:ring-primary text-text-main dark:text-text-dark placeholder-gray-400"
        />
      </div>

      {/* Список чатов */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          // Skeleton загрузка
          <div className="p-4 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredChats.length === 0 ? (
          // Пустое состояние
          <div className="flex flex-col items-center justify-center h-full text-center p-8">
            <div className="w-20 h-20 rounded-full bg-secondary dark:bg-gray-700 flex items-center justify-center mb-4">
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-text-main dark:text-text-dark mb-2">
              Нет чатов
            </h3>
            <p className="text-text-muted dark:text-text-darkMuted">
              Начните новый чат с другом
            </p>
          </div>
        ) : (
          <ChatList chats={filteredChats} />
        )}
      </div>

      {/* Кнопка нового чата (плавающая) */}
      <button className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-primary to-primary-light text-white shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-200 flex items-center justify-center">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
