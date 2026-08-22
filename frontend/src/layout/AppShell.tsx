import React, { useEffect, useMemo, useState } from 'react';
import { Menu, MoreHorizontal, X, Home, CalendarCheck, DoorOpen } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { UserProfileBadge } from '../components/UserProfileBadge';
import { NotificationCenter } from '../components/NotificationCenter';
import { cn } from '../lib/cn';
import { AppView, NavItem, visibleNav, getMobilePrimary } from './nav';

interface AppShellProps {
  active: AppView;
  onNavigate: (view: AppView) => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ active, onNavigate, children }) => {
  const { user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isStudent = user?.role === 'student' || user?.personType === 'student';
  const isStaff = user?.role === 'staff' || user?.personType === 'staff';
  const hasSidebar = user ? ['admin', 'super_admin', 'trainer'].includes(user.role) : false;

  const items = useMemo(() => visibleNav(user), [user]);
  const primaryIds = useMemo(() => getMobilePrimary(user), [user]);
  const primary = primaryIds
    .map((id) => items.find((i) => i.id === id))
    .filter(Boolean) as NavItem[];
  const overflow = items.filter((i) => !primaryIds.includes(i.id));

  useEffect(() => {
    setDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [active]);

  const groups = [
    { title: 'Core Facility', ids: ['home', 'book', 'memberships', 'my_access'] as AppView[] },
    {
      title: 'Operations',
      ids: ['live_attendance', 'floor_management', 'trainer_shifts', 'biometrics'] as AppView[],
    },
    {
      title: 'Directory & People',
      ids: ['students', 'authorized_persons', 'violations', 'conflicts'] as AppView[],
    },
    { title: 'Administration & Insights', ids: ['reports', 'analytics', 'lifecycle', 'admin_management'] as AppView[] },
  ];

  const currentItem = items.find((i) => i.id === active) || items[0];

  const NavButton = ({ item, dense }: { item: NavItem; dense?: boolean }) => {
    const Icon = item.icon;
    const selected = active === item.id;
    return (
      <button
        type="button"
        onClick={() => {
          onNavigate(item.id);
          setDrawerOpen(false);
        }}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl px-3 text-left font-semibold transition-colors',
          dense ? 'h-11 text-xs' : 'h-10 text-xs',
          selected
            ? 'bg-primary text-white shadow-sm font-bold'
            : 'text-secondary hover:bg-border-subtle hover:text-text'
        )}
      >
        <Icon className={cn('h-4 w-4 shrink-0', selected ? 'text-accent' : 'text-muted')} />
        <span className="truncate">{item.label}</span>
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-background text-text flex flex-col relative">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-surface focus:p-3 focus:shadow-xl focus:border focus:border-border"
      >
        Skip to main content
      </a>

      {/* Top Header Bar */}
      <header className={cn(
        'sticky top-0 z-40 border-b border-border/60 bg-surface/95 backdrop-blur-md pt-[var(--safe-top)]',
        hasSidebar ? 'lg:hidden' : 'block shadow-sm'
      )}>

        <div className="flex h-14 items-center justify-between gap-2 px-4 sm:px-6 max-w-wide mx-auto">
          {hasSidebar ? (
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-secondary hover:bg-border-subtle hover:text-text"
              aria-label="Open full menu"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </button>
          ) : (
            <div
              className="flex items-center gap-2.5 cursor-pointer select-none"
              onClick={() => onNavigate('home')}
            >
              <img
                src="/icons/desktop-icon-256x256.png"
                alt="REC Gym Logo"
                className="h-8 w-8 rounded-lg object-contain shadow-sm shrink-0"
              />
              <div className="min-w-0">
                <p className="font-bold text-xs sm:text-sm text-text leading-tight truncate">REC College Gym</p>
                <p className="text-[10px] text-muted truncate">
                  {isStudent ? 'Student Portal' : isStaff ? 'Staff Portal' : 'Member Portal'}
                </p>
              </div>
            </div>
          )}

          {hasSidebar && (
            <div className="flex min-w-0 items-center gap-2">
              <img
                src="/icons/desktop-icon-256x256.png"
                alt="REC Gym Logo"
                className="h-8 w-8 rounded-lg object-contain shadow-sm shrink-0"
              />
              <span className="truncate text-xs font-bold text-text">
                {currentItem ? currentItem.label : 'REC Gym'}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <NotificationCenter compact />
            <ThemeToggle compact />
            <UserProfileBadge compact onNavigate={onNavigate} />
          </div>
        </div>
      </header>

      {/* Mobile Drawer Sheet (Only for roles with full sidebar) */}
      {hasSidebar && drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-overlay backdrop-blur-sm transition-opacity"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />

          <div className="fixed inset-y-0 left-0 flex w-full max-w-xs flex-col bg-surface p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <img
                  src="/icons/desktop-icon-256x256.png"
                  alt="REC Gym Logo"
                  className="h-9 w-9 rounded-xl object-contain shadow-sm"
                />
                <div>
                  <h2 className="font-bold text-sm text-text leading-tight">REC College Gym</h2>
                  <p className="text-[11px] text-muted">Operations Menu</p>
                </div>
              </div>
              <button
                type="button"
                className="rounded-lg p-1.5 text-muted hover:bg-border-subtle hover:text-text"
                onClick={() => setDrawerOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="mt-4 flex-1 space-y-6 overflow-y-auto pr-1">
              {groups.map((group) => {
                const groupItems = items.filter((i) => group.ids.includes(i.id));
                if (groupItems.length === 0) return null;
                return (
                  <div key={group.title} className="space-y-1.5">
                    <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted">
                      {group.title}
                    </p>
                    <div className="space-y-1">
                      {groupItems.map((item) => (
                        <NavButton key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main Layout Body */}
      <div className="flex flex-1">
        {/* Desktop Sidebar (Only for roles that have sidebar) */}
        {hasSidebar && (
          <aside
            className="hidden w-64 shrink-0 border-r border-border bg-surface lg:flex lg:flex-col"
            aria-label="Desktop Sidebar"
          >
            <div className="flex h-16 items-center gap-3 border-b border-border px-6">
              <img
                src="/icons/desktop-icon-256x256.png"
                alt="REC Gym Logo"
                className="h-9 w-9 rounded-xl object-contain shadow-sm"
              />
              <div className="min-w-0">
                <h2 className="font-bold text-sm text-text leading-tight truncate">REC College Gym</h2>
                <p className="text-[11px] text-muted truncate">
                  {user?.role ? user.role.replace('_', ' ').toUpperCase() : 'PORTAL'}
                </p>
              </div>
            </div>

            <nav className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
              {groups.map((group) => {
                const groupItems = items.filter((i) => group.ids.includes(i.id));
                if (groupItems.length === 0) return null;
                return (
                  <div key={group.title} className="space-y-1.5">
                    <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted">
                      {group.title}
                    </p>
                    <div className="space-y-1">
                      {groupItems.map((item) => (
                        <NavButton key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </nav>

            <div className="border-t border-border p-4 flex items-center justify-between">
              <span className="text-[10px] text-muted font-mono">REC Gym v2.4</span>
              <ThemeToggle compact />
            </div>
          </aside>
        )}

        {/* Content Viewport */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Top Bar for Desktop (Sidebar mode) */}
          {hasSidebar && (
            <header className="sticky top-0 z-30 hidden items-center justify-between border-b border-border bg-surface px-8 py-3 lg:flex shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted">Portal</span>
                <span className="text-muted">/</span>
                <span className="text-xs font-bold text-text">{currentItem ? currentItem.label : 'Home'}</span>
              </div>

              <div className="flex items-center gap-3">
                <NotificationCenter />
                <UserProfileBadge onNavigate={onNavigate} />
              </div>
            </header>
          )}

          <main
            id="main"
            className={cn(
              'mx-auto w-full max-w-wide flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8',
              (isStudent || isStaff) ? 'pb-24' : hasSidebar ? 'pb-[calc(5.5rem+var(--safe-bottom))] lg:pb-10' : 'pb-10'
            )}
          >
            {children}
          </main>
        </div>
      </div>

      {/* Floating Rounded Bottom Navigation Bar for Students and Staff */}
      {(isStudent || isStaff) && (
        <nav
          className="fixed inset-x-0 bottom-5 z-40 flex justify-center pointer-events-none px-4 animate-in fade-in slide-in-from-bottom-4 duration-200"
          aria-label="Bottom Navigation"
        >
          <div className="pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-full bg-surface-elevated/95 backdrop-blur-xl border border-border/70 shadow-2xl">

            <button
              type="button"
              onClick={() => onNavigate('home')}
              className={cn(
                'flex items-center gap-2 rounded-full px-4 sm:px-5 py-2 text-xs font-bold transition-all',
                active === 'home'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-muted hover:text-text hover:bg-border-subtle'
              )}
            >
              <Home className="w-4 h-4" />
              <span>Home</span>
            </button>

            {isStudent && (
              <button
                type="button"
                onClick={() => onNavigate('book')}
                className={cn(
                  'flex items-center gap-2 rounded-full px-4 sm:px-5 py-2 text-xs font-bold transition-all',
                  active === 'book'
                    ? 'bg-primary text-white shadow-md'
                    : 'text-muted hover:text-text hover:bg-border-subtle'
                )}
              >
                <CalendarCheck className="w-4 h-4" />
                <span>Book</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onNavigate('my_access')}
              className={cn(
                'flex items-center gap-2 rounded-full px-4 sm:px-5 py-2 text-xs font-bold transition-all',
                active === 'my_access'
                  ? 'bg-primary text-white shadow-md'
                  : 'text-muted hover:text-text hover:bg-border-subtle'
              )}
            >
              <DoorOpen className="w-4 h-4" />
              <span>Entry / Exit</span>
            </button>
          </div>
        </nav>
      )}



      {/* Mobile Bottom Navigation Bar (For trainer / admin on small screens) */}
      {hasSidebar && (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface shadow-2xl pb-[var(--safe-bottom)] lg:hidden"
          aria-label="Primary Mobile Navigation"
        >
          <div className="flex h-14 items-center justify-around px-2 max-w-md mx-auto">
            {primary.map((item) => {
              const Icon = item.icon;
              const selected = active === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    'flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors py-1',
                    selected ? 'text-primary' : 'text-muted hover:text-text'
                  )}
                >
                  <Icon className={cn('h-4 w-4', selected ? 'text-primary' : 'text-muted')} />
                  <span className="truncate max-w-[64px]">{item.shortLabel}</span>
                </button>
              );
            })}
            {overflow.length > 0 && (
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors py-1',
                  overflow.some((i) => i.id === active) ? 'text-primary' : 'text-muted hover:text-text'
                )}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span>More</span>
              </button>
            )}
          </div>
        </nav>
      )}
    </div>
  );
};
