/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      animation: {
        'slide-in-left': 'slide-in-left 0.2s ease-out',
      },
      keyframes: {
        'slide-in-left': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
      colors: {
        primary: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#C1292E',
          600: '#B21F24',
          700: '#991b1f',
          800: '#7f1d1d',
          900: '#661a1a',
          950: '#450a0a',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
