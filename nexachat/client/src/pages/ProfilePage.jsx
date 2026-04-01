/**
 * Страница профиля пользователя
 */
import { useAuth } from '../contexts/AuthContext';

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white text-5xl font-bold mb-6 shadow-xl">
        {user?.name?.charAt(0)?.toUpperCase() || 'U'}
      </div>
      <h2 className="text-2xl font-bold text-text-main dark:text-text-dark mb-2">
        {user?.name || 'Пользователь'}
      </h2>
      <p className="text-text-muted dark:text-text-darkMuted mb-6">
        {user?.email || 'email@example.com'}
      </p>
      <div className="p-6 bg-secondary dark:bg-gray-700 rounded-2xl max-w-md w-full">
        <p className="text-sm text-text-muted dark:text-text-darkMuted">
          Профиль в разработке
        </p>
      </div>
    </div>
  );
}
