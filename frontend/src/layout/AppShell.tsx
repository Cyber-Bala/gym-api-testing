import React, { useEffect, useMemo, useState } from 'react';
import { Menu, MoreHorizontal, X } from 'lucide-react';
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

  // Students and Staff have simplified direct single-purpose portals without sidebars
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
    <div className="min-h-screen bg-background text-text flex flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-surface focus:p-3 focus:shadow-xl focus:border focus:border-border"
      >
        Skip to main content
      </a>

      {/* Mobile Top Header */}
      <header className={cn(
        'sticky top-0 z-40 border-b border-border bg-surface pt-[var(--safe-top)]',
        hasSidebar ? 'lg:hidden' : 'block'
      )}>
        <div className="flex h-14 items-center justify-between gap-2 px-4 max-w-wide mx-auto">
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
            <div className="flex items-center gap-2.5">
              <img
                src="/icons/desktop-icon-256x256.png"
                alt="REC Gym Logo"
                className="h-8 w-8 rounded-lg object-contain shadow-sm shrink-0"
              />
              <div className="min-w-0">
                <p className="font-bold text-xs text-text leading-tight truncate">REC College Gym</p>
                <p className="text-[10px] text-muted truncate">
                  {user?.role === 'student' ? 'Student Portal' : user?.role === 'staff' ? 'Staff Portal' : 'Member Portal'}
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
            <UserProfileBadge compact />
          </div>
        </div>
      </header>

      {/* Mobile Drawer Sheet (Only for roles with sidebar) */}
      {hasSidebar && drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden animate-in fade-in duration-150">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--color-overlay)] backdrop-blur-sm"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative flex h-full w-[min(20rem,86vw)] flex-col border-r border-border bg-surface pt-[var(--safe-top)] shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="flex items-center gap-2.5">
                <img
                  src="/icons/desktop-icon-256x256.png"
                  alt="REC Gym Logo"
                  className="h-8 w-8 rounded-lg object-contain shadow-sm shrink-0"
                />
                <div>
                  <p className="font-bold text-xs text-text">REC College Gym</p>
                  <p className="text-[10px] text-muted">Rajalakshmi</p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-border-subtle"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
              {groups.map((group) => {
                const groupItems = items.filter((i) => group.ids.includes(i.id));
                if (!groupItems.length) return null;
                return (
                  <div key={group.title} className="space-y-1">
                    <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                      {group.title}
                    </p>
                    {groupItems.map((item) => (
                      <NavButton key={item.id} item={item} dense />
                    ))}
                  </div>
                );
              })}
            </nav>

            <div className="border-t border-border p-4">
              <ThemeToggle className="w-full justify-center" />
            </div>
          </aside>
        </div>
      )}

      {/* Main Desktop Grid */}
      <div className={cn(
        'flex-1',
        hasSidebar ? 'lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]' : 'flex flex-col'
      )}>
        {/* Desktop Sidebar Navigation (Only for admin, super_admin, trainer) */}
        {hasSidebar && (
          <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-surface pt-[var(--safe-top)] lg:flex">
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <img
                src="/icons/desktop-icon-256x256.png"
                alt="REC Gym Logo"
                className="h-9 w-9 rounded-xl object-contain shadow-sm shrink-0"
              />
              <div className="min-w-0">
                <p className="truncate font-bold text-sm text-text leading-tight">REC College Gym</p>
                <p className="truncate text-[11px] text-muted">Rajalakshmi Engineering</p>
              </div>
            </div>

            <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
              {groups.map((group) => {
                const groupItems = items.filter((i) => group.ids.includes(i.id));
                if (!groupItems.length) return null;
                return (
                  <div key={group.title} className="space-y-1">
                    <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                      {group.title}
                    </p>
                    {groupItems.map((item) => (
                      <NavButton key={item.id} item={item} />
                    ))}
                  </div>
                );
              })}
            </nav>

            <div className="border-t border-border p-4">
              <ThemeToggle className="w-full justify-center" />
            </div>
          </aside>
        )}

        {/* Desktop Main Content Area */}
        <div className="flex min-h-screen min-w-0 flex-col flex-1">
          {/* Desktop Top Header Bar (Only when sidebar exists; full-width mode uses top header above) */}
          {hasSidebar && (
            <header className="sticky top-0 z-30 hidden items-center justify-between border-b border-border bg-surface px-8 py-3 lg:flex shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted">Portal</span>
                <span className="text-muted">/</span>
                <span className="text-xs font-bold text-text">{currentItem ? currentItem.label : 'Home'}</span>
              </div>

              <div className="flex items-center gap-3">
                <NotificationCenter />
                <UserProfileBadge />
              </div>
            </header>
          )}

          <main
            id="main"
            className={cn(
              'mx-auto w-full max-w-wide flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8',
              hasSidebar ? 'pb-[calc(5.5rem+var(--safe-bottom))] lg:pb-10' : 'pb-10'
            )}
          >
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar (Only for roles with sidebar navigation) */}
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
