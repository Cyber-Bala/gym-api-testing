import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User, CreditCard, Laptop, Shield } from 'lucide-react';
import { LoginModal } from './LoginModal';
import { AppView } from '../layout/nav';
import { cn } from '../lib/cn';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/primitives';

interface UserProfileBadgeProps {
  compact?: boolean;
  className?: string;
  onNavigate?: (view: AppView) => void;
}

export const UserProfileBadge: React.FC<UserProfileBadgeProps> = ({
  compact: _compact = false,
  className,
  onNavigate,
}) => {
  const { user, loading, logout, logoutAll } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return <div className={cn('bg-surface-elevated animate-pulse rounded-full h-8 w-8')} />;
  }

  if (!user) {
    return (
      <>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          Sign In
        </Button>
        <LoginModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  const getRoleBadge = () => {
    switch (user.role) {
      case 'super_admin':
        return { label: 'Super Admin', color: 'bg-danger-muted text-danger' };
      case 'admin':
        return { label: 'Gym Admin', color: 'bg-primary-muted text-primary' };
      case 'trainer':
        return { label: 'Trainer', color: 'bg-warning-muted text-warning' };
      case 'staff':
        return { label: 'Staff', color: 'bg-primary-muted text-primary' };
      case 'authorized_person':
        return { label: 'VIP Guest', color: 'bg-primary-muted text-primary' };
      case 'student':
      default:
        return user.studentDetails?.residency === 'hosteller'
          ? { label: 'Hosteller', color: 'bg-success-muted text-success' }
          : { label: 'Day Scholar', color: 'bg-surface-elevated text-secondary' };
    }
  };

  const badge = getRoleBadge();
  const initials = user.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        className={cn('relative h-8 w-8 rounded-full p-0', className)}
        onClick={() => setDropdownOpen(!dropdownOpen)}
        aria-label="Account menu"
      >
        <Avatar name={initials} className="h-8 w-8" />
      </Button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-md border border-border bg-card shadow-lg p-1 z-50">
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium leading-none text-card-foreground">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground mt-1">{user.email}</p>
            <span className={cn('inline-flex mt-2 text-[10px] uppercase font-medium tracking-wider px-2 py-0.5 rounded-md', badge.color)}>
              {badge.label}
            </span>
            {user.isProtectedSuperAdmin && (
              <span className="mt-1 text-[10px] font-medium text-danger flex items-center gap-1">
                <Shield className="w-3 h-3" /> Protected
              </span>
            )}
          </div>
          <div className="h-px bg-border my-1" />
          <button
            type="button"
            onClick={() => {
              setDropdownOpen(false);
              if (onNavigate) onNavigate('profile');
            }}
            className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-surface-elevated"
          >
            <User className="w-4 h-4" />
            Profile
          </button>
          <button
            type="button"
            onClick={() => {
              setDropdownOpen(false);
              if (onNavigate) onNavigate('memberships');
            }}
            className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-surface-elevated"
          >
            <CreditCard className="w-4 h-4" />
            Payments
          </button>
          <div className="h-px bg-border my-1" />
          <button
            type="button"
            onClick={() => {
              setDropdownOpen(false);
              logout();
            }}
            className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-surface-elevated"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
          <button
            type="button"
            onClick={() => {
              setDropdownOpen(false);
              logoutAll();
            }}
            className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-muted-foreground hover:bg-surface-elevated hover:text-danger"
          >
            <Laptop className="w-3.5 h-3.5" />
            Sign out all devices
          </button>
        </div>
      )}
    </div>
  );
};
