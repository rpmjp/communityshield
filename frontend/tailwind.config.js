/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          // Deep forest-teal — civic, growth, prevention
          50:  "#EAF2EF",
          100: "#CFE0D9",
          200: "#A4C3B6",
          300: "#76A593",
          400: "#4F8772",
          500: "#2D5F4F",
          600: "#244D40",
          700: "#1B3B31",
          800: "#132A23",
          900: "#0A1814",
          DEFAULT: "#2D5F4F",
        },
        accent: {
          // Warm amber — community, warmth, action
          50:  "#FBF1E3",
          100: "#F6DFBE",
          200: "#F0C68A",
          300: "#EAAC55",
          400: "#E8A04C",
          500: "#D58A2F",
          600: "#A86C23",
          700: "#7B4F19",
          800: "#4E3210",
          900: "#211505",
          DEFAULT: "#E8A04C",
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
