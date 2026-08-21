import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, LogOut, User, CreditCard, ChevronDown, Laptop, Shield } from 'lucide-react';
import { LoginModal } from './LoginModal';
import { AppView } from '../layout/nav';
import { cn } from '../lib/cn';

interface UserProfileBadgeProps {
  compact?: boolean;
  className?: string;
  onNavigate?: (view: AppView) => void;
}

export const UserProfileBadge: React.FC<UserProfileBadgeProps> = ({
  compact = false,
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
    return (
      <div className={cn('bg-border-subtle animate-pulse rounded-xl', compact ? 'h-9 w-9' : 'h-10 w-32')} />
    );
  }

  if (!user) {
    return (
      <>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-white font-semibold shadow-sm transition-all hover:bg-primary-hover active:scale-95',
            compact ? 'h-9 px-3 text-xs' : 'h-10 px-4 text-xs sm:text-sm'
          )}
        >
          <LogIn className="w-3.5 h-3.5 text-accent" />
          <span>Sign In</span>
        </button>
        <LoginModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  const getRoleBadge = () => {
    switch (user.role) {
      case 'super_admin':
        return { label: 'Super Admin', color: 'bg-danger-muted text-danger border-danger/30' };
      case 'admin':
        return { label: 'Gym Admin', color: 'bg-primary-muted text-primary border-primary/30' };
      case 'trainer':
        return { label: 'Trainer', color: 'bg-warning-muted text-warning border-warning/30' };
      case 'staff':
        return { label: 'Staff', color: 'bg-accent-muted text-accent border-accent/30' };
      case 'authorized_person':
        return { label: 'VIP Guest', color: 'bg-accent-muted text-accent border-accent/30' };
      case 'student':
      default:
        return user.studentDetails?.residency === 'hosteller'
          ? { label: 'Hosteller', color: 'bg-success-muted text-success border-success/30' }
          : { label: 'Day Scholar', color: 'bg-border-subtle text-secondary border-border' };
    }
  };

  const badge = getRoleBadge();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className={cn(
          'flex items-center gap-2 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 transition-all text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20',
          compact ? 'p-1' : 'p-1.5 pr-3',
          className
        )}
      >
        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary text-white font-bold text-xs flex items-center justify-center shadow-sm shrink-0">
          {user.name.charAt(0).toUpperCase()}
        </div>
        {!compact && (
          <div className="hidden sm:block min-w-0">
            <p className="text-xs font-bold text-text leading-tight truncate max-w-[120px]">
              {user.name}
            </p>
            <p className="text-[10px] text-muted capitalize truncate">
              {badge.label}
            </p>
          </div>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-muted shrink-0" />
      </button>

      {/* Simplified Dropdown Menu */}
      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-surface shadow-2xl p-2.5 space-y-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 border border-border">
          {/* User Header */}
          <div className="px-2.5 py-2 rounded-xl bg-surface-elevated/70 border border-border-subtle space-y-1">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${badge.color}`}>
                {badge.label}
              </span>
              {user.isProtectedSuperAdmin && (
                <span className="text-[10px] font-semibold text-danger flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Protected
                </span>
              )}
            </div>
            <h4 className="font-bold text-xs text-text truncate">{user.name}</h4>
            <p className="text-[10px] text-muted font-mono truncate">{user.email}</p>
          </div>

          {/* Menu Items: Profile, Payments, Sign Out */}
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => {
                setDropdownOpen(false);
                if (onNavigate) onNavigate('profile');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-text hover:bg-surface-elevated transition-colors"
            >
              <User className="w-4 h-4 text-primary shrink-0" />
              <span>Profile</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDropdownOpen(false);
                if (onNavigate) onNavigate('memberships');
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-text hover:bg-surface-elevated transition-colors"
            >
              <CreditCard className="w-4 h-4 text-primary shrink-0" />
              <span>Payments</span>
            </button>

            <div className="pt-1.5 border-t border-border-subtle space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-danger hover:bg-danger-muted transition-colors"
              >
                <LogOut className="w-4 h-4 text-danger shrink-0" />
                <span>Sign Out</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false);
                  logoutAll();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-[11px] font-medium text-muted hover:text-danger hover:bg-danger-muted/30 transition-colors"
              >
                <Laptop className="w-3.5 h-3.5 shrink-0" />
                <span>Sign Out All Devices</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
