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
        background: 'var(--color-background)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          elevated: 'var(--color-surface-elevated)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          subtle: 'var(--color-border-subtle)',
        },
        text: {
          DEFAULT: 'var(--color-text)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
        },
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          muted: 'var(--color-primary-muted)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          muted: 'var(--color-accent-muted)',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          muted: 'var(--color-success-muted)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          muted: 'var(--color-warning-muted)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          muted: 'var(--color-danger-muted)',
        },
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
      maxWidth: {
        'wide': '88rem',
      },
    },
  },
  plugins: [],
}
