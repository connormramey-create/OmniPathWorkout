/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          400: '#ffd700',
          500: '#d4af37',
        },
        dark: {
          800: '#151d2a',
          900: '#0b0f17',
        }
      }
    },
  },
  plugins: [],
}
