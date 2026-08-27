import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/cn';
import { IconButton } from './Button';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
  interactive?: boolean;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  padded = true,
  interactive = false,
  onClick,
}) => (
  <section
    onClick={onClick}
    className={cn(
      'rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-all duration-300',
      padded && 'p-6',
      interactive && 'cursor-pointer hover:shadow-xl hover:-translate-y-1',
      className
    )}
  >
    {children}
  </section>
);

interface BadgeProps {
  children: React.ReactNode;
  tone?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'accent';
  className?: string;
}

const badgeTone: Record<NonNullable<BadgeProps['tone']>, string> = {
  neutral: 'border-transparent bg-surface-elevated text-secondary',
  primary: 'border-transparent bg-primary text-primary-foreground',
  success: 'border-transparent bg-success-muted text-success',
  warning: 'border-transparent bg-warning-muted text-warning',
  danger: 'border-transparent bg-danger text-white',
  accent: 'border-primary/50 bg-background text-primary',
};

export const Badge: React.FC<BadgeProps> = ({ children, tone = 'neutral', className }) => (
  <span
    className={cn(
      'inline-flex items-center justify-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0',
      badgeTone[tone],
      className
    )}
  >
    {children}
  </span>
);

export const Avatar: React.FC<{ name: string; className?: string }> = ({ name, className }) => (
  <div
    className={cn(
      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground',
      className
    )}
    aria-hidden
  >
    {name.charAt(0).toUpperCase()}
  </div>
);

interface AlertProps {
  tone?: 'success' | 'warning' | 'danger' | 'info';
  children: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

const alertTone = {
  success: 'border-success/30 bg-success-muted text-success',
  warning: 'border-warning/40 bg-warning-muted text-warning',
  danger: 'border-danger/30 bg-danger-muted text-danger',
  info: 'border-primary/20 bg-primary/5 text-text',
};

export const Alert: React.FC<AlertProps> = ({ tone = 'info', children, onDismiss, className }) => (
  <div
    className={cn('flex items-start gap-3 rounded-md border px-4 py-3 text-sm shadow-xs', alertTone[tone], className)}
    role="status"
  >
    <div className="min-w-0 flex-1">{children}</div>
    {onDismiss && (
      <button type="button" onClick={onDismiss} className="shrink-0 opacity-70 hover:opacity-100" aria-label="Dismiss">
        <X className="h-4 w-4" />
      </button>
    )}
  </div>
);

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, className }) => (
  <div className={cn('flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-12 text-center shadow-sm', className)}>
    {icon && <div className="mb-1 text-muted-foreground">{icon}</div>}
    <p className="text-2xl font-semibold text-card-foreground">{title}</p>
    {description && <p className="max-w-sm text-sm text-muted-foreground leading-relaxed">{description}</p>}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('animate-pulse rounded-md bg-surface-elevated', className)} />
);

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions, badge }) => (
  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="page-title">{title}</h1>
        {badge}
      </div>
      {description && <p className="max-w-2xl text-lg text-muted-foreground">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

interface StatProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const Stat: React.FC<StatProps> = ({ label, value, hint, icon, className }) => (
  <div className={cn('rounded-xl border border-border bg-card p-4 sm:p-5 shadow-lg', className)}>
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">{label}</p>
      {icon && <div className="text-primary">{icon}</div>}
    </div>
    <p className="mt-2 text-2xl font-semibold tracking-tight text-card-foreground">{value}</p>
    {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
  </div>
);

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ open, title, onClose, children, footer, wide }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button type="button" className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div
        className={cn(
          'relative z-10 flex max-h-[92vh] w-full flex-col rounded-t-xl border border-border bg-card shadow-lg sm:rounded-xl',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
          <h2 id="modal-title" className="text-lg font-semibold text-card-foreground">
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose} variant="ghost" className="h-8 w-8">
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
};

interface TabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  items: { id: T; label: string; icon?: React.ReactNode }[];
  className?: string;
}

export function Tabs<T extends string>({ value, onChange, items, className }: TabsProps<T>) {
  return (
    <div className={cn('flex gap-1.5 overflow-x-auto pb-1', className)} role="tablist">
      {items.map((item) => {
        const isSelected = value === item.id;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onChange(item.id)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors',
              isSelected
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'border border-input bg-background text-secondary hover:bg-surface-elevated hover:text-text'
            )}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export const ProgressBar: React.FC<{ value: number; tone?: 'success' | 'warning' | 'danger' }> = ({
  value,
  tone,
}) => {
  const color =
    tone === 'danger' || value >= 90
      ? 'bg-danger'
      : tone === 'warning' || value >= 75
        ? 'bg-warning'
        : 'bg-success';
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
      <div className={cn('h-full rounded-full transition-all duration-300', color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
};
