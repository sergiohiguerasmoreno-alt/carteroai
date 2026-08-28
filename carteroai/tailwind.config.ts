import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0b0f14',
          900: '#111722',
          800: '#1a2230',
          700: '#26313f',
          600: '#3a4a5c',
          500: '#5b6b7d',
          400: '#8595a6',
          300: '#b0bdc9',
          200: '#d6dee5',
          100: '#eef1f4',
          50: '#f7f9fa',
        },
        signal: {
          teal: '#0f7a6b',
          tealDark: '#0b5c51',
          amber: '#b8863b',
          rose: '#a8425b',
          blue: '#2f5f8a',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'system-ui',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif',
        ],
        serif: ['"Iowan Old Style"', '"Palatino Linotype"', 'Palatino', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(11,15,20,0.04), 0 4px 16px rgba(11,15,20,0.06)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
};

export default config;
