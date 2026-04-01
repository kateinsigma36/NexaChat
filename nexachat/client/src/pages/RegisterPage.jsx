import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Форма регистрации нового пользователя
 */
export default function RegisterForm() {
  const navigate = useNavigate();
  const { register } = useAuth();
  
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Валидация
    if (formData.password.length < 8) {
      setError('Пароль должен быть не менее 8 символов');
      setLoading(false);
      return;
    }

    const result = await register(formData);
    
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || 'Ошибка регистрации');
    }
    
    setLoading(false);
  };

  return (
    <div className="w-full max-w-md">
      {/* Карточка формы */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        {/* Заголовок */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center text-white font-bold text-3xl shadow-lg">
            N
          </div>
          <h1 className="text-2xl font-bold text-text-main dark:text-text-dark mb-2">
            Создать аккаунт
          </h1>
          <p className="text-text-muted dark:text-text-darkMuted">
            Присоединяйтесь к NexaChat
          </p>
        </div>

        {/* Форма */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Имя */}
          <div>
            <label className="block text-sm font-medium text-text-main dark:text-text-dark mb-2">
              Имя
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-border-color bg-secondary dark:bg-gray-700 text-text-main dark:text-text-dark focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                placeholder="Ваше имя"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-text-main dark:text-text-dark mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-border-color bg-secondary dark:bg-gray-700 text-text-main dark:text-text-dark focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                placeholder="you@example.com"
              />
            </div>
          </div>

          {/* Пароль */}
          <div>
            <label className="block text-sm font-medium text-text-main dark:text-text-dark mb-2">
              Пароль
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={8}
                className="w-full pl-10 pr-12 py-3 rounded-xl border border-border-color bg-secondary dark:bg-gray-700 text-text-main dark:text-text-dark focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                placeholder="Минимум 8 символов"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Ошибка */}
          {error && (
            <div className="p-3 rounded-xl bg-danger/10 text-danger text-sm">
              {error}
            </div>
          )}

          {/* Кнопка отправки */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-primary to-primary-light text-white font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Создание...
              </span>
            ) : (
              'Зарегистрироваться'
            )}
          </button>
        </form>

        {/* Вход */}
        <div className="mt-6 text-center">
          <p className="text-text-muted dark:text-text-darkMuted">
            Уже есть аккаунт?{' '}
            <button
              onClick={() => navigate('/login')}
              className="text-primary font-semibold hover:underline"
            >
              Войти
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
