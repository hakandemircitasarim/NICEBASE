/** @type {import('tailwindcss').Config} */
const root = __dirname.replace(/\\/g, '/')

module.exports = {
  content: [
    `${root}/index.html`,
    `${root}/src/**/*.{js,ts,jsx,tsx}`,
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FF6B35',
          dark: '#E55A2B',
          light: '#FF8C5A', // Light mode için
          darker: '#D1491F', // Dark mode için
        },
        success: {
          DEFAULT: '#10B981',
          dark: '#059669',
        },
        warning: {
          DEFAULT: '#F59E0B',
          dark: '#D97706',
        },
        danger: {
          DEFAULT: '#EF4444',
          dark: '#DC2626',
        },
        info: {
          DEFAULT: '#3B82F6',
          dark: '#2563EB',
        },
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}

