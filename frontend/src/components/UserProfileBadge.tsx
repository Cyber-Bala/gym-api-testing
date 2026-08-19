import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn, LogOut, Shield, ChevronDown, Laptop, AlertTriangle } from 'lucide-react';
import { LoginModal } from './LoginModal';

export const UserProfileBadge: React.FC = () => {
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
      <div className="h-9 w-28 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-xl" />
    );
  }

  if (!user) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rec-purple hover:bg-rec-purple-600 text-white font-medium text-xs shadow-md shadow-rec-purple/20 transition-all active:scale-95"
        >
          <LogIn className="w-4 h-4 text-rec-gold" />
          <span>Sign In</span>
        </button>
        <LoginModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  const getRoleBadge = () => {
    switch (user.role) {
      case 'super_admin':
        return { label: 'Super Admin', color: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/40' };
      case 'admin':
        return { label: 'Gym Admin', color: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/40' };
      case 'trainer':
        return { label: 'Trainer', color: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40' };
      case 'staff':
        return { label: 'Staff', color: 'bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border-indigo-500/40' };
      case 'authorized_person':
        return { label: 'VIP Guest', color: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/40' };
      case 'student':
      default:
        return user.studentDetails?.residency === 'hosteller'
          ? { label: 'Hosteller', color: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40' }
          : { label: 'Day Scholar', color: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/40' };
    }
  };

  const badge = getRoleBadge();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2.5 p-1.5 pr-3 rounded-2xl bg-gray-100 dark:bg-[#18181B] hover:bg-gray-200 dark:hover:bg-[#222226] border border-gray-200 dark:border-gray-800 transition-all text-left"
      >
        <div className="w-8 h-8 rounded-xl bg-rec-purple dark:bg-rec-purple-700 text-rec-gold font-bold text-xs flex items-center justify-center border border-rec-gold/30">
          {user.name.charAt(0)}
        </div>
        <div className="hidden sm:block">
          <p className="text-xs font-bold text-gray-900 dark:text-white leading-tight truncate max-w-[130px]">
            {user.name}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 capitalize">
            {badge.label}
          </p>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </button>

      {/* Dropdown Menu */}
      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-[#18181B] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl p-4 space-y-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* User Details */}
          <div className="space-y-1.5 pb-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${badge.color}`}>
                {badge.label}
              </span>
              {user.isProtectedSuperAdmin && (
                <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Protected
                </span>
              )}
            </div>
            <h4 className="font-bold text-sm text-gray-900 dark:text-white">{user.name}</h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">{user.email}</p>

            {user.studentDetails && (
              <div className="pt-2 text-[11px] text-gray-600 dark:text-gray-300 space-y-0.5">
                <p>Roll No: <span className="font-semibold">{user.studentDetails.rollNumber}</span></p>
                <p>Dept: <span className="font-semibold">{user.studentDetails.department}</span></p>
                <p>Residency: <span className="font-semibold capitalize">{user.studentDetails.residency.replace('_', ' ')}</span></p>
                {user.studentDetails.isBanned && (
                  <p className="text-red-500 font-semibold flex items-center gap-1 mt-1">
                    <AlertTriangle className="w-3 h-3" /> Active Violation Ban
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-1">
            <button
              onClick={() => {
                setDropdownOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <LogOut className="w-4 h-4 text-gray-400" />
              <span>Sign Out</span>
            </button>

            <button
              onClick={() => {
                setDropdownOpen(false);
                logoutAll();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            >
              <Laptop className="w-4 h-4" />
              <span>Sign Out All Devices</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
