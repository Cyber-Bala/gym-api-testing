import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../lib/cn';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  showToast: (type: ToastType, message: string, title?: string, duration?: number) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, title?: string, duration = 4500) => {
      const id = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const newToast: Toast = { id, type, title, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, duration);
      }
    },
    [dismissToast]
  );

  const success = useCallback((message: string, title?: string) => showToast('success', message, title), [showToast]);
  const error = useCallback((message: string, title?: string) => showToast('error', message, title), [showToast]);
  const warning = useCallback((message: string, title?: string) => showToast('warning', message, title), [showToast]);
  const info = useCallback((message: string, title?: string) => showToast('info', message, title), [showToast]);

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-success shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-danger shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-warning shrink-0" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-primary shrink-0" />;
    }
  };

  const getStyles = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'border-success/30 bg-surface text-text shadow-lg';
      case 'error':
        return 'border-danger/30 bg-surface text-text shadow-lg';
      case 'warning':
        return 'border-warning/30 bg-surface text-text shadow-lg';
      case 'info':
      default:
        return 'border-primary/30 bg-surface text-text shadow-lg';
    }
  };

  return (
    <ToastContext.Provider value={{ toasts, showToast, success, error, warning, info, dismissToast }}>
      {children}
      {/* Toast container */}
      <div
        aria-live="assertive"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border transition-all animate-in slide-in-from-bottom-2 fade-in duration-200',
              getStyles(toast.type)
            )}
          >
            <div className="mt-0.5">{getIcon(toast.type)}</div>
            <div className="flex-1 min-w-0">
              {toast.title && <p className="font-bold text-xs leading-tight mb-0.5">{toast.title}</p>}
              <p className="text-xs text-secondary leading-snug break-words">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              className="p-1 rounded-lg text-muted hover:text-text hover:bg-border-subtle shrink-0 -mr-1 -mt-1"
              aria-label="Dismiss toast"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
