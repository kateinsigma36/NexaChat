import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

/**
 * Основной layout приложения
 * Desktop: 3 колонки (sidebar + список чатов + окно чата)
 * Mobile: переключение между экранами
 */
export default function MainLayout() {
  return (
    <div className="flex h-screen bg-secondary dark:bg-secondary-dark overflow-hidden">
      {/* Боковая панель навигации */}
      <Sidebar />
      
      {/* Основная область */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Заголовок */}
        <Header />
        
        {/* Контент страниц */}
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
