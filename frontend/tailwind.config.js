/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        rec: {
          purple: {
            DEFAULT: '#4A154B',
            50: '#FBF5FB',
            100: '#F4E8F4',
            200: '#E9D0E9',
            300: '#D7AEDB',
            400: '#B874BF',
            500: '#8E3F97',
            600: '#6C2574',
            700: '#4A154B',
            800: '#3A0E3C',
            900: '#28072A',
          },
          gold: {
            DEFAULT: '#D4AF37',
            50: '#FCF9EE',
            100: '#F8F1D5',
            200: '#F0E2A6',
            300: '#E6CF71',
            400: '#D4AF37',
            500: '#B89324',
            600: '#917116',
            700: '#694F0E',
            800: '#48350A',
            900: '#2A1D05',
          },
        },
      },
    },
  },
  plugins: [],
}
