import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Форма входа пользователя
 */
export default function LoginForm() {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
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

    const result = await login(formData);
    
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error || 'Ошибка входа');
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
            С возвращением!
          </h1>
          <p className="text-text-muted dark:text-text-darkMuted">
            Войдите в свой аккаунт NexaChat
          </p>
        </div>

        {/* Форма */}
        <form onSubmit={handleSubmit} className="space-y-4">
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
                className="w-full pl-10 pr-12 py-3 rounded-xl border border-border-color bg-secondary dark:bg-gray-700 text-text-main dark:text-text-dark focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                placeholder="Введите пароль"
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
                Вход...
              </span>
            ) : (
              'Войти'
            )}
          </button>
        </form>

        {/* Регистрация */}
        <div className="mt-6 text-center">
          <p className="text-text-muted dark:text-text-darkMuted">
            Нет аккаунта?{' '}
            <button
              onClick={() => navigate('/register')}
              className="text-primary font-semibold hover:underline"
            >
              Зарегистрироваться
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
