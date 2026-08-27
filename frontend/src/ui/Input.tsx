import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '../lib/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id || props.name;
    return (
      <label className="block space-y-2 text-left">
        {label && (
          <span className="text-sm font-medium text-text">
            {label}
            {props.required && <span className="text-danger"> *</span>}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'flex h-9 w-full min-w-0 rounded-md bg-surface-elevated px-3 py-1 text-base transition-[color,box-shadow] outline-none md:text-sm',
            'placeholder:text-muted-foreground file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium',
            'focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-danger focus-visible:border-danger focus-visible:ring-danger/20',
            className
          )}
          {...props}
        />
        {hint && !error && <span className="block text-xs text-muted-foreground">{hint}</span>}
        {error && <span className="block text-sm text-danger mt-1">{error}</span>}
      </label>
    );
  }
);
Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea: React.FC<TextareaProps> = ({ label, error, hint, className, ...props }) => (
  <label className="block space-y-2 text-left">
    {label && (
      <span className="text-sm font-medium text-text">
        {label}
        {props.required && <span className="text-danger"> *</span>}
      </span>
    )}
    <textarea
      className={cn(
        'flex min-h-[80px] w-full rounded-md bg-surface-elevated px-3 py-2 text-base transition-[color,box-shadow] outline-none md:text-sm',
        'placeholder:text-muted-foreground focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        error && 'border-danger focus-visible:border-danger focus-visible:ring-danger/20',
        className
      )}
      {...props}
    />
    {hint && !error && <span className="block text-xs text-muted-foreground">{hint}</span>}
    {error && <span className="block text-sm text-danger mt-1">{error}</span>}
  </label>
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Select: React.FC<SelectProps> = ({ label, error, hint, className, children, ...props }) => (
  <label className="block space-y-2 text-left">
    {label && <span className="text-sm font-medium text-text">{label}</span>}
    <select
      className={cn(
        'flex h-9 w-full rounded-md bg-surface-elevated px-3 py-1 text-base outline-none md:text-sm',
        'focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        error && 'border-danger',
        className
      )}
      {...props}
    >
      {children}
    </select>
    {hint && !error && <span className="block text-xs text-muted-foreground">{hint}</span>}
    {error && <span className="block text-sm text-danger mt-1">{error}</span>}
  </label>
);

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const SearchInput: React.FC<SearchInputProps> = ({ className, ...props }) => (
  <div className="relative w-full">
    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    <input
      type="search"
      className={cn(
        'flex h-9 w-full rounded-md bg-surface-elevated pl-9 pr-3 py-1 text-base outline-none md:text-sm',
        'placeholder:text-muted-foreground focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        className
      )}
      {...props}
    />
  </div>
);
