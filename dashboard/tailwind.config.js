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
          bg: '#050505',               // ultra-deep black background (matte and rich)
          card: '#0C0C0C',             // slightly lifted from bg — subtle contrast
          text: '#EAEAEA',             // refined, high-clarity gray-white text
          'text-secondary': '#9E9E9E', // calm neutral gray for secondary text
          border: '#1A1A1A',           // understated border for clean separation
          accent: '#272727',           // muted cool gray accent (good for hover states)
          highlight: '#2F2F2F',        // for subtle emphasis or active states
        },
      },
    },
  },
  plugins: [],
}