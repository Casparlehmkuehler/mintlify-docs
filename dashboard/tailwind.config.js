/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#121212',        // charcoal black background
          card: '#1a1a1a',      // slightly lighter for cards
          text: '#E0E0E0',      // light gray primary text
          'text-secondary': '#B0B0B0',  // medium gray secondary text
          border: '#444444',    // dark gray borders/dividers
          accent: '#888888',    // soft gray accent
        }
      }
    },
  },
  plugins: [],
}