import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (!isOpen) return;

    const scriptId = 'google-gsi-script';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const initGsi = () => {
      const g = (window as unknown as { google?: { accounts?: { id?: { initialize: (cfg: unknown) => void; renderButton: (el: HTMLElement, opts: unknown) => void; prompt: () => void } } } }).google;
      if (g?.accounts?.id) {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '9029127515-jnnre2q9gn4vqfnqgffc6r09e9jpoq37.apps.googleusercontent.com';
        g.accounts.id.initialize({
          client_id: clientId,
          callback: async (response: { credential: string }) => {
            setLoading(true);
            setError(null);
            try {
              await loginWithGoogle(response.credential);
              onClose();
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              setError(msg);
            } finally {
              setLoading(false);
            }
          },
        });

        const btnContainer = document.getElementById('google-signin-btn-container');
        if (btnContainer) {
          btnContainer.innerHTML = '';
          g.accounts.id.renderButton(btnContainer, {
            theme: 'outline',
            size: 'large',
            width: '380',
            text: 'signin_with',
            shape: 'pill',
          });
        }
      }
    };

    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGsi;
      document.head.appendChild(script);
    } else {
      initGsi();
    }
  }, [isOpen]);

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

        {/* Primary Google Login Button Container */}
        <div className="space-y-3">
          <div id="google-signin-btn-container" className="flex justify-center min-h-[44px]"></div>

          <button
            onClick={handleMockGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-2xl bg-gray-50 dark:bg-[#202024] hover:bg-gray-100 dark:hover:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-medium text-xs transition-all shadow-sm disabled:opacity-50"
          >
            <span>Or Quick Mock Sign-In (Karthik Raja - Hosteller)</span>
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
