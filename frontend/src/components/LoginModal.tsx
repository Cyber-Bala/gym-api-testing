import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, ShieldAlert, KeyRound, UserCheck, Sparkles } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { devLogin, loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const mockUsers = [
    { email: 'superadmin@rajalakshmi.edu.in', label: 'Super Administrator', role: 'Super Admin', color: 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300' },
    { email: 'admin@rajalakshmi.edu.in', label: 'Gym Administrator', role: 'Admin', color: 'border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-300' },
    { email: 'trainer@rajalakshmi.edu.in', label: 'Student Trainer (Vignesh)', role: 'Trainer', color: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300' },
    { email: 'hosteller@rajalakshmi.edu.in', label: 'Hosteller Student (Karthik)', role: 'Student (Free)', color: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
    { email: 'dayscholar@rajalakshmi.edu.in', label: 'Day Scholar Student (Priya)', role: 'Student (Pass)', color: 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300' },
    { email: 'staff@rajalakshmi.edu.in', label: 'Faculty Staff (Dr. Ramesh)', role: 'Staff', color: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300' },
    { email: 'guest@rajalakshmi.edu.in', label: 'Authorized Person (VIP Trustee)', role: 'VIP Access', color: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300' },
  ];

  const handleDevLogin = async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      await devLogin(email);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleMockGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      // Send mock google token that triggers verification
      await loginWithGoogle('mock_token_hosteller@rajalakshmi.edu.in');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleUnprovisionedLoginTest = async () => {
    setLoading(true);
    setError(null);
    try {
      await devLogin('unregistered.student@gmail.com');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rec-purple/10 dark:bg-rec-purple-900/30 text-rec-purple dark:text-rec-gold flex items-center justify-center border border-rec-purple/20">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">Sign In to REC Gym</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Google OAuth & Verified Institutional Identity</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Access Denied (Provisioning Guard)</p>
              <p className="mt-0.5 opacity-90">{error}</p>
            </div>
          </div>
        )}

        {/* Primary Google Login Button */}
        <div className="space-y-3">
          <button
            onClick={handleMockGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-2xl bg-white dark:bg-[#202024] hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white font-medium text-sm transition-all shadow-sm disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign in with Google Workspace</span>
          </button>
        </div>

        {/* Development Persona Selector */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              <Sparkles className="w-3.5 h-3.5 text-rec-gold" />
              <span>Dev Persona Selector</span>
            </div>
            <button
              onClick={handleUnprovisionedLoginTest}
              className="text-[11px] text-red-500 hover:text-red-600 underline font-medium"
            >
              Test Unprovisioned Guard
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
            {mockUsers.map((item) => (
              <button
                key={item.email}
                onClick={() => handleDevLogin(item.email)}
                disabled={loading}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all hover:scale-[1.01] ${item.color}`}
              >
                <div className="flex items-center gap-2.5">
                  <UserCheck className="w-4 h-4 shrink-0" />
                  <div>
                    <p className="font-semibold text-xs text-gray-900 dark:text-white">{item.label}</p>
                    <p className="text-[11px] opacity-75 font-mono">{item.email}</p>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-black/10 dark:bg-white/10">
                  {item.role}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
