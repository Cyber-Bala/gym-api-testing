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
        foreground: withOpacity('--color-text'),
        surface: {
          DEFAULT: withOpacity('--color-surface'),
          elevated: withOpacity('--color-surface-elevated'),
        },
        card: {
          DEFAULT: withOpacity('--color-surface'),
          foreground: withOpacity('--color-text'),
        },
        border: {
          DEFAULT: withOpacity('--color-border'),
          subtle: withOpacity('--color-border-subtle'),
        },
        input: withOpacity('--color-border'),
        ring: withOpacity('--color-primary'),
        text: {
          DEFAULT: withOpacity('--color-text'),
          secondary: withOpacity('--color-text-secondary'),
          muted: withOpacity('--color-text-muted'),
        },
        'muted-foreground': withOpacity('--color-text-muted'),
        secondary: withOpacity('--color-text-secondary'),
        primary: {
          DEFAULT: withOpacity('--color-primary'),
          hover: withOpacity('--color-primary-hover'),
          muted: withOpacity('--color-primary-muted'),
          foreground: withOpacity('--color-primary-foreground'),
        },
        accent: {
          DEFAULT: withOpacity('--color-accent'),
          hover: withOpacity('--color-accent-hover'),
          muted: withOpacity('--color-accent-muted'),
          foreground: withOpacity('--color-primary-foreground'),
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
        destructive: withOpacity('--color-danger'),
        rec: {
          purple: {
            DEFAULT: '#7C3AED',
            50: '#F5F3FF',
            100: '#EDE9FE',
            200: '#DDD6FE',
            300: '#C4B5FD',
            400: '#A78BFA',
            500: '#8B5CF6',
            600: '#7C3AED',
            700: '#6D28D9',
            800: '#5B21B6',
            900: '#4C1D95',
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
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      maxWidth: {
        'wide': '88rem',
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      },
    },
  },
  plugins: [],
}
