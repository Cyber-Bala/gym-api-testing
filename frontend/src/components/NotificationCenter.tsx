import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Sparkles, AlertTriangle, Info, Calendar, CreditCard, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useSSE } from '../context/SSEContext';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/cn';

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  eventType: string;
  status: string;
  createdAt: string;
  read?: boolean;
}

export const NotificationCenter: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { user } = useAuth();
  const { latestNotification } = useSSE();
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('gym_read_notifications');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await api.get<NotificationItem[]>('/api/v1/notifications');
      if (Array.isArray(data)) {
        setNotifications(data);
        const unread = data.filter((n) => !readIds.has(n.id)).length;
        setUnreadCount(unread);
      }
    } catch {
      // Background fetch catch
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  // Handle incoming real-time notifications from SSE
  useEffect(() => {
    if (latestNotification) {
      setNotifications((prev) => [latestNotification, ...prev]);
      toast.success(latestNotification.title);
    }
  }, [latestNotification]);

  useEffect(() => {
    const unread = notifications.filter((n) => !readIds.has(n.id)).length;
    setUnreadCount(unread);
  }, [readIds, notifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try {
        localStorage.setItem('gym_read_notifications', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const handleMarkAllRead = () => {
    const allIds = new Set(notifications.map((n) => n.id));
    setReadIds(allIds);
    try {
      localStorage.setItem('gym_read_notifications', JSON.stringify(Array.from(allIds)));
    } catch {}
    setUnreadCount(0);
    toast.success('All notifications marked as read');
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'booking_confirmed':
        return <Calendar className="w-4 h-4 text-primary shrink-0" />;
      case 'membership_activated':
        return <CreditCard className="w-4 h-4 text-success shrink-0" />;
      case 'violation_issued':
        return <AlertTriangle className="w-4 h-4 text-danger shrink-0" />;
      case 'unbanned':
        return <ShieldCheck className="w-4 h-4 text-success shrink-0" />;
      case 'closure':
        return <AlertTriangle className="w-4 h-4 text-warning shrink-0" />;
      default:
        return <Sparkles className="w-4 h-4 text-accent shrink-0" />;
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          'relative inline-flex items-center justify-center rounded-full text-secondary hover:bg-surface-elevated hover:text-text transition-all outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          compact ? 'h-8 w-8' : 'h-9 w-9'
        )}
        aria-label="Notifications"
        title="Notification Center"
      >
        <Bell className={cn('h-4 w-4', unreadCount > 0 ? 'text-primary' : 'text-muted')} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white shadow-sm ring-2 ring-surface animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-card shadow-[0_12px_40px_rgba(0,0,0,0.35)] p-4 space-y-3 z-50">
          <div className="flex items-center justify-between pb-2.5">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <h4 className="font-bold text-sm text-text">Notifications</h4>
              {unreadCount > 0 && (
                <span className="text-[11px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {notifications.length > 0 && unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {loading && notifications.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted">Loading alerts...</div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center space-y-1">
                <Info className="w-6 h-6 text-muted mx-auto opacity-50" />
                <p className="text-xs font-semibold text-text">No notifications</p>
                <p className="text-[11px] text-muted">You are completely up to date!</p>
              </div>
            ) : (
              notifications.map((n) => {
                const isUnread = !readIds.has(n.id);
                return (
                  <div
                    key={n.id}
                    onClick={() => handleMarkAsRead(n.id)}
                    className={cn(
                      'p-3 rounded-xl transition-all flex items-start gap-3 text-left cursor-pointer shadow-sm',
                      isUnread
                        ? 'bg-red-500/10 hover:bg-red-500/15'
                        : 'bg-surface/50 opacity-75 hover:opacity-100 hover:bg-surface'
                    )}
                  >
                    <div className="mt-0.5 relative">
                      {getEventIcon(n.eventType)}
                      {isUnread && (
                        <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 ring-2 ring-surface" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <p className={cn('text-xs leading-tight', isUnread ? 'font-bold text-text' : 'font-medium text-secondary')}>
                          {n.title}
                        </p>
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Unread" />
                        )}
                      </div>
                      <p className="text-[11px] text-secondary leading-snug break-words">{n.body}</p>
                      <p className="text-[10px] text-muted font-mono pt-1">{formatTimeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
