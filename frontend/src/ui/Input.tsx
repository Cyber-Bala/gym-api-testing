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
      <label className="block space-y-1.5 text-left">
        {label && (
          <span className="text-xs font-semibold text-text">
            {label}
            {props.required && <span className="text-danger"> *</span>}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'h-10 sm:h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-xs sm:text-sm text-text placeholder:text-muted',
            'transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-border-subtle disabled:opacity-60',
            error && 'border-danger focus:border-danger focus:ring-danger/20',
            className
          )}
          {...props}
        />
        {hint && !error && <span className="block text-[11px] text-muted">{hint}</span>}
        {error && <span className="block text-[11px] font-medium text-danger">{error}</span>}
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
  <label className="block space-y-1.5 text-left">
    {label && (
      <span className="text-xs font-semibold text-text">
        {label}
        {props.required && <span className="text-danger"> *</span>}
      </span>
    )}
    <textarea
      className={cn(
        'w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-xs sm:text-sm text-text placeholder:text-muted',
        'transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-border-subtle disabled:opacity-60',
        error && 'border-danger focus:border-danger focus:ring-danger/20',
        className
      )}
      {...props}
    />
    {hint && !error && <span className="block text-[11px] text-muted">{hint}</span>}
    {error && <span className="block text-[11px] font-medium text-danger">{error}</span>}
  </label>
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Select: React.FC<SelectProps> = ({ label, error, hint, className, children, ...props }) => (
  <label className="block space-y-1.5 text-left">
    {label && <span className="text-xs font-semibold text-text">{label}</span>}
    <select
      className={cn(
        'h-10 sm:h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-xs sm:text-sm text-text',
        'transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:bg-border-subtle disabled:opacity-60',
        error && 'border-danger focus:border-danger focus:ring-danger/20',
        className
      )}
      {...props}
    >
      {children}
    </select>
    {hint && !error && <span className="block text-[11px] text-muted">{hint}</span>}
    {error && <span className="block text-[11px] font-medium text-danger">{error}</span>}
  </label>
);

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const SearchInput: React.FC<SearchInputProps> = ({ className, ...props }) => (
  <div className="relative w-full">
    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
    <input
      type="search"
      className={cn(
        'h-10 sm:h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-xs sm:text-sm text-text placeholder:text-muted',
        'transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
        className
      )}
      {...props}
    />
  </div>
);

