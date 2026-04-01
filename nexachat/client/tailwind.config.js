/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Включаем класс-based темную тему
  theme: {
    extend: {
      colors: {
        // Светлая тема (по умолчанию)
        primary: {
          DEFAULT: '#6C5CE7',
          light: '#A29BFE',
          dark: '#5849BE',
        },
        secondary: {
          DEFAULT: '#F0F2F5',
          dark: '#161B22',
        },
        chat: {
          bg: '#E8ECF1',
          dark: '#1C2333',
        },
        text: {
          main: '#1A1A2E',
          muted: '#636E72',
          dark: '#E6EDF3',
          darkMuted: '#8B949E',
        },
        success: '#00B894',
        danger: '#FF6B6B',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        'pill': '9999px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
