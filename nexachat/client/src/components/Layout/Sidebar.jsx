import { Link, useLocation } from 'react-router-dom';
import { MessageSquare, User, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * Боковая панель навигации
 * Desktop: постоянная панель слева
 * Mobile: скрыта, показывается в бургер-меню
 */
export default function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const navItems = [
    { path: '/', icon: MessageSquare, label: 'Чаты' },
    { path: '/profile', icon: User, label: 'Профиль' },
    { path: '/settings', icon: Settings, label: 'Настройки' },
  ];

  const handleLogout = async () => {
    await logout();
  };

  return (
    <aside className="w-20 bg-white dark:bg-gray-800 border-r border-border-color flex flex-col items-center py-4">
      {/* Логотип */}
      <div className="mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white font-bold text-xl shadow-lg">
          N
        </div>
      </div>

      {/* Навигация */}
      <nav className="flex-1 w-full px-2 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all duration-200 group ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title={item.label}
            >
              <Icon
                size={24}
                strokeWidth={isActive ? 2.5 : 1.5}
                className="transition-transform group-hover:scale-110"
              />
              <span className="text-xs mt-1 font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Переключатель темы и выход */}
      <div className="w-full px-2 space-y-2 mt-auto">
        {/* Кнопка выхода */}
        <button
          onClick={handleLogout}
          className="w-full flex flex-col items-center justify-center p-3 rounded-xl text-gray-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-all duration-200"
          title="Выйти"
        >
          <LogOut size={24} strokeWidth={1.5} />
          <span className="text-xs mt-1 font-medium">Выйти</span>
        </button>
      </div>
    </aside>
  );
}
