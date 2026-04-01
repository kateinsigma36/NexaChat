import { useChat } from '../../contexts/ChatContext';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

/**
 * Компонент списка чатов
 */
export default function ChatList({ chats }) {
  const { activeChat, setActiveChat } = useChat();

  if (!chats || chats.length === 0) {
    return null;
  }

  return (
    <div className="divide-y divide-border-color">
      {chats.map((chat) => {
        const isActive = activeChat?._id === chat._id;
        const lastMessage = chat.lastMessage;
        const isUnread = lastMessage?.sender?._id !== 'currentUserId'; // Заглушка для проверки непрочитанных

        return (
          <button
            key={chat._id}
            onClick={() => setActiveChat(chat)}
            className={`w-full p-4 flex items-start gap-3 hover:bg-secondary dark:hover:bg-gray-700 transition-colors ${
              isActive ? 'bg-secondary dark:bg-gray-700' : ''
            }`}
          >
            {/* Аватар */}
            <div className="flex-shrink-0 relative">
              {chat.avatar ? (
                <img
                  src={chat.avatar}
                  alt={chat.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white font-bold">
                  {chat.name?.charAt(0)?.toUpperCase() || 'C'}
                </div>
              )}
              
              {/* Индикатор онлайн */}
              {chat.isOnline && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-success border-2 border-white dark:border-gray-800 rounded-full"></span>
              )}
            </div>

            {/* Контент */}
            <div className="flex-1 min-w-0 text-left">
              {/* Заголовок */}
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-text-main dark:text-text-dark truncate">
                  {chat.name || 'Чат'}
                </h3>
                {lastMessage?.createdAt && (
                  <span className="text-xs text-text-muted dark:text-text-darkMuted flex-shrink-0">
                    {formatDistanceToNow(new Date(lastMessage.createdAt), {
                      addSuffix: true,
                      locale: ru,
                    })}
                  </span>
                )}
              </div>

              {/* Последнее сообщение */}
              <p className={`text-sm truncate ${
                isUnread 
                  ? 'font-semibold text-text-main dark:text-text-dark' 
                  : 'text-text-muted dark:text-text-darkMuted'
              }`}>
                {lastMessage?.type === 'image' && '📷 Фото'}
                {lastMessage?.type === 'video' && '🎥 Видео'}
                {lastMessage?.type === 'file' && '📎 Файл'}
                {lastMessage?.type === 'voice' && '🎤 Голосовое'}
                {lastMessage?.type === 'text' && lastMessage.content}
              </p>
            </div>

            {/* Бейдж непрочитанных */}
            {chat.unreadCount > 0 && (
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">
                {chat.unreadCount}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
