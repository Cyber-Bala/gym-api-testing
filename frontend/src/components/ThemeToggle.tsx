import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../lib/cn';

interface ThemeToggleProps {
  compact?: boolean;
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ compact = false, className }) => {
  const { preference, setPreference, resolved } = useTheme();

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => setPreference(resolved === 'dark' ? 'light' : 'dark')}
        aria-label="Toggle theme"
        title={`Current: ${preference} mode. Click to toggle.`}
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-secondary hover:bg-border-subtle hover:text-text transition-colors',
          className
        )}
      >
        {resolved === 'dark' ? <Sun className="h-4 w-4 text-accent" /> : <Moon className="h-4 w-4 text-primary" />}
      </button>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-xl border border-border bg-border-subtle p-1 text-xs',
        className
      )}
      role="radiogroup"
      aria-label="Color theme selection"
    >
      <button
        type="button"
        role="radio"
        aria-checked={preference === 'light'}
        onClick={() => setPreference('light')}
        title="Light theme"
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors',
          preference === 'light'
            ? 'bg-surface text-primary shadow-sm font-semibold'
            : 'text-secondary hover:text-text'
        )}
      >
        <Sun className="h-3.5 w-3.5" />
        <span>Light</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={preference === 'dark'}
        onClick={() => setPreference('dark')}
        title="Dark theme"
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors',
          preference === 'dark'
            ? 'bg-surface text-primary shadow-sm font-semibold'
            : 'text-secondary hover:text-text'
        )}
      >
        <Moon className="h-3.5 w-3.5" />
        <span>Dark</span>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={preference === 'system'}
        onClick={() => setPreference('system')}
        title="System preference"
        className={cn(
          'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors',
          preference === 'system'
            ? 'bg-surface text-primary shadow-sm font-semibold'
            : 'text-secondary hover:text-text'
        )}
      >
        <Monitor className="h-3.5 w-3.5" />
        <span>Auto</span>
      </button>
    </div>
  );
};

