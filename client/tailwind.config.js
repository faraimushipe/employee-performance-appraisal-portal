/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fef7e6',
          100: '#fdecc7',
          200: '#fbd78a',
          300: '#f8c14d',
          400: '#f5ab10',
          500: '#d4a017', // Gold
          600: '#b8860b',
          700: '#9c6b0a',
          800: '#805008',
          900: '#643506',
        },
        secondary: {
          50: '#fdf2f8',
          100: '#fce7f3',
          200: '#f9d1e7',
          300: '#f4a6d1',
          400: '#ed6bb8',
          500: '#d63384', // Maroon
          600: '#b02a6b',
          700: '#8a1f52',
          800: '#641439',
          900: '#3e0d23',
        },
        gold: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        maroon: {
          50: '#fdf2f8',
          100: '#fce7f3',
          200: '#f9d1e7',
          300: '#f4a6d1',
          400: '#ed6bb8',
          500: '#d63384',
          600: '#b02a6b',
          700: '#8a1f52',
          800: '#641439',
          900: '#3e0d23',
        }
      }
    },
  },
  plugins: [],
}
