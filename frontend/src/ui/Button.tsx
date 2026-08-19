import React from 'react';
import { cn } from '../lib/cn';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent' | 'success';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-white hover:bg-primary-hover shadow-sm disabled:opacity-50 font-semibold',
  secondary:
    'bg-border-subtle text-text border border-border hover:bg-border/60 disabled:opacity-50',
  outline:
    'bg-transparent text-text border border-border hover:bg-border-subtle disabled:opacity-50',
  ghost:
    'bg-transparent text-secondary hover:bg-primary-muted hover:text-text disabled:opacity-50',
  danger:
    'bg-danger text-white hover:opacity-90 shadow-sm disabled:opacity-50',
  accent:
    'bg-accent text-slate-950 font-bold hover:bg-accent-hover shadow-sm disabled:opacity-50',
  success:
    'bg-success text-white hover:opacity-90 shadow-sm disabled:opacity-50',
};

const sizes: Record<ButtonSize, string> = {
  xs: 'h-8 px-2.5 text-xs rounded-lg',
  sm: 'h-9 px-3 text-xs rounded-xl font-medium',
  md: 'h-10 px-4 text-xs font-semibold rounded-xl sm:text-sm',
  lg: 'h-11 px-5 text-sm font-bold rounded-xl',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}) => (
  <button
    type={type}
    disabled={disabled || loading}
    className={cn(
      'inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary/30',
      variants[variant],
      sizes[size],
      className
    )}
    {...props}
  >
    {loading && <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />}
    {children}
  </button>
);

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'danger';
}

export const IconButton: React.FC<IconButtonProps> = ({
  label,
  size = 'md',
  variant = 'default',
  className,
  children,
  ...props
}) => {
  const sizeClasses = {
    sm: 'h-8 w-8 rounded-lg',
    md: 'h-9 w-9 sm:h-10 sm:w-10 rounded-xl',
    lg: 'h-11 w-11 rounded-xl',
  };

  const variantClasses = {
    default: 'border border-border bg-surface text-secondary hover:bg-border-subtle hover:text-text',
    ghost: 'bg-transparent text-secondary hover:bg-border-subtle hover:text-text border-0',
    danger: 'border border-danger/30 bg-danger-muted text-danger hover:bg-danger/20',
  };

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 shrink-0',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

