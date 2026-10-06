import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, ShieldAlert, Sparkles, UserCheck } from 'lucide-react';
import { RecLogo } from './RecLogo';

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
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
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
    { email: 'iiic@rajalakshmi.edu.in', label: 'Super Administrator (IIIC)', role: 'Super Admin', color: 'border-danger/30 bg-danger-muted text-danger' },
    { email: 'admin@rajalakshmi.edu.in', label: 'Gym Administrator', role: 'Admin', color: 'border-primary/30 bg-primary-muted text-primary' },
    { email: 'trainer@rajalakshmi.edu.in', label: 'Student Trainer (Vignesh)', role: 'Trainer', color: 'border-warning/30 bg-warning-muted text-warning' },
    { email: 'hosteller@rajalakshmi.edu.in', label: 'Hosteller Student (Karthik)', role: 'Student (Free)', color: 'border-success/30 bg-success-muted text-success' },
    { email: 'dayscholar@rajalakshmi.edu.in', label: 'Day Scholar Student (Priya)', role: 'Student (Pass)', color: 'border-border bg-border-subtle text-secondary' },
    { email: 'staff@rajalakshmi.edu.in', label: 'Faculty Staff (Dr. Ramesh)', role: 'Staff', color: 'border-accent/30 bg-accent-muted text-accent' },
    { email: 'guest@rajalakshmi.edu.in', label: 'Authorized Person (VIP Trustee)', role: 'VIP Access', color: 'border-accent/30 bg-accent-muted text-accent' },
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
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-t-xl sm:rounded-xl bg-card shadow-2xl p-6 space-y-5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-3">
            <RecLogo alt="REC Gym Logo" className="h-8 w-32" />
            <div>
              <h3 className="font-semibold text-lg text-card-foreground">Login</h3>
              <p className="text-sm text-muted-foreground">Sign in with your college Google account</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md text-muted-foreground hover:text-text hover:bg-surface-elevated transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl border border-danger/30 bg-danger-muted text-danger text-xs flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Access Denied (Provisioning Guard)</p>
              <p className="mt-0.5 opacity-90">{error}</p>
            </div>
          </div>
        )}

        {/* Primary Google Login Button Container */}
        <div className="space-y-3">
          <div id="google-signin-btn-container" className="flex justify-center min-h-[44px]"></div>

          <button
            type="button"
            onClick={handleMockGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 text-text font-medium text-xs transition-colors disabled:opacity-50"
          >
            <span>Quick Mock Sign-In (Karthik Raja - Hosteller)</span>
          </button>
        </div>

        {/* Development Persona Selector */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span>Dev Persona Quick Switch</span>
            </div>
            <button
              type="button"
              onClick={handleUnprovisionedLoginTest}
              className="text-[11px] text-danger hover:underline font-medium"
            >
              Test Unprovisioned Guard
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
            {mockUsers.map((item) => (
              <button
                key={item.email}
                type="button"
                onClick={() => handleDevLogin(item.email)}
                disabled={loading}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-colors hover:bg-surface-elevated ${item.color}`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <UserCheck className="w-4 h-4 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-text truncate">{item.label}</p>
                    <p className="text-[11px] opacity-75 font-mono truncate">{item.email}</p>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border border-current shrink-0">
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

