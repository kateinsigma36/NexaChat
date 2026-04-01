/**
 * Страница настроек
 */
import { useTheme } from '../contexts/ThemeContext';

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="h-full p-6 overflow-y-auto">
      <h1 className="text-2xl font-bold text-text-main dark:text-text-dark mb-6">
        Настройки
      </h1>

      <div className="space-y-4 max-w-2xl">
        {/* Тема */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-border-color">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-text-main dark:text-text-dark mb-1">
                Тёмная тема
              </h3>
              <p className="text-sm text-text-muted dark:text-text-darkMuted">
                Переключить светлую/тёмную тему
              </p>
            </div>
            <button
              onClick={toggleTheme}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                theme === 'dark' ? 'bg-primary' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                  theme === 'dark' ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Заглушки для других настроек */}
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-border-color opacity-50">
          <h3 className="font-semibold text-text-main dark:text-text-dark mb-1">
            Уведомления
          </h3>
          <p className="text-sm text-text-muted dark:text-text-darkMuted">
            В разработке
          </p>
        </div>

        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-border-color opacity-50">
          <h3 className="font-semibold text-text-main dark:text-text-dark mb-1">
            Конфиденциальность
          </h3>
          <p className="text-sm text-text-muted dark:text-text-darkMuted">
            В разработке
          </p>
        </div>
      </div>
    </div>
  );
}
