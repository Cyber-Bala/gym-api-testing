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
    'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50 font-medium',
  secondary:
    'bg-surface-elevated text-text shadow-xs hover:bg-surface-elevated/80 disabled:opacity-50 font-medium',
  outline:
    'bg-surface-elevated text-text shadow-xs hover:bg-surface-elevated/80 disabled:opacity-50 font-medium',
  ghost:
    'bg-transparent text-secondary hover:bg-surface-elevated hover:text-text disabled:opacity-50',
  danger:
    'bg-danger text-white shadow-xs hover:bg-danger/90 disabled:opacity-50 font-medium',
  accent:
    'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50 font-medium',
  success:
    'bg-success text-white shadow-xs hover:bg-success/90 disabled:opacity-50 font-medium',
};

const sizes: Record<ButtonSize, string> = {
  xs: 'h-8 px-2.5 text-xs rounded-md',
  sm: 'h-8 px-3 text-xs rounded-md gap-1.5',
  md: 'h-9 px-4 text-sm rounded-md',
  lg: 'h-10 px-6 text-sm rounded-md',
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
      'inline-flex items-center justify-center gap-2 whitespace-nowrap transition-[color,box-shadow] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
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
    sm: 'h-8 w-8 rounded-md',
    md: 'h-9 w-9 rounded-md',
    lg: 'h-10 w-10 rounded-md',
  };

  const variantClasses = {
    default: 'bg-surface-elevated text-secondary hover:bg-surface-elevated/80 hover:text-text shadow-xs',
    ghost: 'bg-transparent text-secondary hover:bg-surface-elevated hover:text-text border-0',
    danger: 'bg-danger-muted text-danger hover:bg-danger/20 shadow-xs',
  };

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center transition-colors outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:opacity-50 shrink-0',
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
