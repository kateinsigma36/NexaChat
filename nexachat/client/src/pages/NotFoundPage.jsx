import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

/**
 * Страница 404 - не найдено
 */
export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary dark:bg-secondary-dark p-4">
      <div className="text-center">
        {/* Иконка */}
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
          <Home className="w-12 h-12 text-primary" />
        </div>

        {/* Заголовок */}
        <h1 className="text-6xl font-bold text-text-main dark:text-text-dark mb-4">
          404
        </h1>
        
        <h2 className="text-2xl font-semibold text-text-main dark:text-text-dark mb-4">
          Страница не найдена
        </h2>
        
        <p className="text-text-muted dark:text-text-darkMuted mb-8 max-w-md">
          Извините, страница, которую вы ищете, не существует или была перемещена.
        </p>

        {/* Кнопка домой */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-light text-white font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
        >
          <Home size={20} />
          Вернуться на главную
        </Link>
      </div>
    </div>
  );
}
