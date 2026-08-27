import React, { useEffect, useMemo, useState } from 'react';
import { Menu, MoreHorizontal, X, Home, CalendarCheck, DoorOpen } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { UserProfileBadge } from '../components/UserProfileBadge';
import { NotificationCenter } from '../components/NotificationCenter';
import { RecLogo } from '../components/RecLogo';
import { AppFooter } from '../components/AppFooter';
import { cn } from '../lib/cn';
import { AppView, NavItem, visibleNav, getMobilePrimary } from './nav';
import { Button } from '../ui/Button';

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

  const NavButton = ({ item }: { item: NavItem }) => {
    const Icon = item.icon;
    const selected = active === item.id;
    return (
      <Button
        type="button"
        variant={selected ? 'secondary' : 'ghost'}
        className="w-full justify-start h-9"
        onClick={() => {
          onNavigate(item.id);
          setDrawerOpen(false);
        }}
      >
        <Icon className="h-5 w-5" />
        <span className="ml-2">{item.label}</span>
      </Button>
    );
  };

  return (
    <div className="min-h-screen bg-background text-text flex flex-col relative">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-card focus:p-3 focus:shadow-lg focus:border focus:border-border"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-40 w-full border-b bg-background">
        <div className="md:px-10 px-2 flex h-16 items-center justify-between py-4">
          <div className="flex items-center gap-2 min-w-0">
            {hasSidebar && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 lg:hidden"
                aria-label="Open menu"
                onClick={() => setDrawerOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <button
              type="button"
              className="flex items-center gap-2 min-w-0"
              onClick={() => onNavigate('home')}
            >
              <RecLogo alt="REC Gym Logo" className="h-8 w-32" />
              <span className="text-xl font-bold truncate">REC Gym</span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            <NotificationCenter compact />
            <ThemeToggle compact />
            <UserProfileBadge compact onNavigate={onNavigate} />
          </div>
        </div>
      </header>

      {hasSidebar && drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />

          <div className="fixed inset-y-0 left-0 z-50 w-72 border-r bg-background">
            <div className="flex h-16 items-center justify-between border-b px-4">
              <div className="flex items-center gap-2 min-w-0">
                <RecLogo alt="REC Gym Logo" className="h-8 w-24" />
                <span className="text-xl font-bold truncate">REC Gym</span>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDrawerOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <nav className="h-[calc(100vh-64px)] overflow-y-auto px-3 py-4">
              <div className="space-y-4">
                {groups.map((group) => {
                  const groupItems = items.filter((i) => group.ids.includes(i.id));
                  if (groupItems.length === 0) return null;
                  return (
                    <div key={group.title} className="space-y-1">
                      <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {group.title}
                      </p>
                      {groupItems.map((item) => (
                        <NavButton key={item.id} item={item} />
                      ))}
                    </div>
                  );
                })}
              </div>
            </nav>
          </div>
        </div>
      )}

      <div className="flex flex-1">
        {hasSidebar && (
          <aside
            className="hidden w-72 shrink-0 border-r bg-background lg:flex lg:flex-col"
            aria-label="Desktop Sidebar"
          >
            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <div className="space-y-4">
                {groups.map((group) => {
                  const groupItems = items.filter((i) => group.ids.includes(i.id));
                  if (groupItems.length === 0) return null;
                  return (
                    <div key={group.title} className="space-y-1">
                      <p className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {group.title}
                      </p>
                      {groupItems.map((item) => (
                        <NavButton key={item.id} item={item} />
                      ))}
                    </div>
                  );
                })}
              </div>
            </nav>
          </aside>
        )}

        <div className="flex flex-1 flex-col min-w-0">
          <main
            id="main"
            className={cn(
              'container mx-auto w-full flex-1 px-4 py-8 md:px-10',
              (isStudent || isStaff) ? 'pb-24' : hasSidebar ? 'pb-[calc(5.5rem+var(--safe-bottom))] lg:pb-8' : 'pb-8'
            )}
          >
            {children}
          </main>
          <AppFooter />
        </div>
      </div>

      {(isStudent || isStaff) && (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[var(--safe-bottom)]"
          aria-label="Bottom Navigation"
        >
          <div className="flex h-14 items-center justify-around px-2 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors py-1',
                active === 'home' ? 'text-primary' : 'text-muted-foreground hover:text-text'
              )}
            >
              <Home className="h-5 w-5" />
              <span>Home</span>
            </button>

            {isStudent && (
              <button
                type="button"
                onClick={() => onNavigate('book')}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors py-1',
                  active === 'book' ? 'text-primary' : 'text-muted-foreground hover:text-text'
                )}
              >
                <CalendarCheck className="h-5 w-5" />
                <span>Book</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onNavigate('my_access')}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors py-1',
                active === 'my_access' ? 'text-primary' : 'text-muted-foreground hover:text-text'
              )}
            >
              <DoorOpen className="h-5 w-5" />
              <span>Entry / Exit</span>
            </button>
          </div>
        </nav>
      )}

      {hasSidebar && (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[var(--safe-bottom)] lg:hidden"
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
                    'flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors py-1',
                    selected ? 'text-primary' : 'text-muted-foreground hover:text-text'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="truncate max-w-[64px]">{item.shortLabel}</span>
                </button>
              );
            })}
            {overflow.length > 0 && (
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className={cn(
                  'flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors py-1',
                  overflow.some((i) => i.id === active) ? 'text-primary' : 'text-muted-foreground hover:text-text'
                )}
              >
                <MoreHorizontal className="h-5 w-5" />
                <span>More</span>
              </button>
            )}
          </div>
        </nav>
      )}
    </div>
  );
};
