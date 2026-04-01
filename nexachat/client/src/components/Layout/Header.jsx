import { Bell, Search, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Заголовок приложения
 * Поиск, уведомления, профиль
 */
export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  return (
    <header className="h-16 bg-white dark:bg-gray-800 border-b border-border-color flex items-center justify-between px-4">
      {/* Левая часть - поиск */}
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Поиск..."
            className="w-full pl-10 pr-4 py-2 rounded-pill bg-secondary dark:bg-gray-700 border-none focus:ring-2 focus:ring-primary/50 text-text-main dark:text-text-dark placeholder-gray-400 transition-all"
          />
        </div>
      </div>

      {/* Правая часть - действия */}
      <div className="flex items-center gap-3">
        {/* Переключатель темы */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl hover:bg-secondary dark:hover:bg-gray-700 transition-colors"
          title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
        >
          {theme === 'dark' ? (
            <Sun size={20} className="text-yellow-500" />
          ) : (
            <Moon size={20} className="text-gray-600" />
          )}
        </button>

        {/* Уведомления */}
        <button
          className="p-2 rounded-xl hover:bg-secondary dark:hover:bg-gray-700 transition-colors relative"
          title="Уведомления"
        >
          <Bell size={20} className="text-gray-600 dark:text-gray-300" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full"></span>
        </button>

        {/* Аватар пользователя */}
        <div className="flex items-center gap-2 ml-2 pl-3 border-l border-border-color">
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.name}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white text-sm font-bold">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
          )}
          <span className="text-sm font-medium text-text-main dark:text-text-dark hidden md:block">
            {user?.name || 'Пользователь'}
          </span>
        </div>
      </div>
    </header>
  );
}
