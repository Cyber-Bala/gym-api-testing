/** @type {import('tailwindcss').Config} */
function withOpacity(variableName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `rgba(var(${variableName}), ${opacityValue})`;
    }
    return `rgb(var(${variableName}))`;
  };
}

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: withOpacity('--color-background'),
        surface: {
          DEFAULT: withOpacity('--color-surface'),
          elevated: withOpacity('--color-surface-elevated'),
        },
        border: {
          DEFAULT: withOpacity('--color-border'),
          subtle: withOpacity('--color-border-subtle'),
        },
        text: {
          DEFAULT: withOpacity('--color-text'),
          secondary: withOpacity('--color-text-secondary'),
          muted: withOpacity('--color-text-muted'),
        },
        primary: {
          DEFAULT: withOpacity('--color-primary'),
          hover: withOpacity('--color-primary-hover'),
          muted: withOpacity('--color-primary-muted'),
        },
        accent: {
          DEFAULT: withOpacity('--color-accent'),
          hover: withOpacity('--color-accent-hover'),
          muted: withOpacity('--color-accent-muted'),
        },
        success: {
          DEFAULT: withOpacity('--color-success'),
          muted: withOpacity('--color-success-muted'),
        },
        warning: {
          DEFAULT: withOpacity('--color-warning'),
          muted: withOpacity('--color-warning-muted'),
        },
        danger: {
          DEFAULT: withOpacity('--color-danger'),
          muted: withOpacity('--color-danger-muted'),
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
