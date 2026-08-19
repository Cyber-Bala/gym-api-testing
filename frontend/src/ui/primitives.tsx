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
      'rounded-2xl bg-surface text-text shadow-sm border border-border/40 hover:shadow-md transition-all duration-200',
      padded && 'p-5 sm:p-6',
      interactive && 'cursor-pointer hover:border-primary/40 hover:bg-surface-elevated',
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
  neutral: 'bg-border-subtle text-secondary border-border',
  primary: 'bg-primary-muted text-primary border-primary/20',
  success: 'bg-success-muted text-success border-success/20',
  warning: 'bg-warning-muted text-warning border-warning/20',
  danger: 'bg-danger-muted text-danger border-danger/20',
  accent: 'bg-accent-muted text-accent border-accent/20',
};

export const Badge: React.FC<BadgeProps> = ({ children, tone = 'neutral', className }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide',
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
      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-accent border border-accent/30',
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
  warning: 'border-warning/30 bg-warning-muted text-warning',
  danger: 'border-danger/30 bg-danger-muted text-danger',
  info: 'border-primary/20 bg-primary-muted text-text',
};

export const Alert: React.FC<AlertProps> = ({ tone = 'info', children, onDismiss, className }) => (
  <div className={cn('flex items-start gap-3 rounded-xl border p-4 text-xs', alertTone[tone], className)} role="status">
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
  <div className={cn('flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-border-subtle/30 px-4 py-12 text-center', className)}>
    {icon && <div className="mb-1 text-muted">{icon}</div>}
    <p className="text-sm font-bold text-text">{title}</p>
    {description && <p className="max-w-sm text-xs text-muted leading-relaxed">{description}</p>}
    {action && <div className="mt-3">{action}</div>}
  </div>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('animate-pulse rounded-xl bg-border-subtle', className)} />
);

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions, badge }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div className="min-w-0 space-y-1">
      <div className="flex items-center gap-2.5">
        <h1 className="page-title">{title}</h1>
        {badge}
      </div>
      {description && <p className="max-w-2xl text-xs text-secondary leading-relaxed">{description}</p>}
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
  <div className={cn('rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-sm', className)}>
    <div className="flex items-center justify-between">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      {icon && <div className="text-primary">{icon}</div>}
    </div>
    <p className="mt-2 text-2xl font-black tracking-tight text-text">{value}</p>
    {hint && <p className="mt-1 text-xs text-secondary">{hint}</p>}
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
      <button type="button" className="absolute inset-0 bg-[var(--color-overlay)] backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div
        className={cn(
          'relative z-10 flex max-h-[92vh] w-full flex-col rounded-t-3xl border border-border bg-surface shadow-2xl sm:rounded-3xl',
          wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
          <h2 id="modal-title" className="text-base font-bold text-text">
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose} className="h-8 w-8 border-0">
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
              'inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors',
              isSelected
                ? 'bg-primary text-white shadow-sm'
                : 'border border-border bg-surface text-secondary hover:bg-primary-muted hover:text-text'
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
    <div className="h-2 w-full overflow-hidden rounded-full bg-border-subtle">
      <div className={cn('h-full rounded-full transition-all duration-300', color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
};

