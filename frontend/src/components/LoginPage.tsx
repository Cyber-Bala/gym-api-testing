import React, { useState, useEffect } from 'react';
import { ShieldAlert, Loader2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card } from '../ui/primitives';
import { ThemeToggle } from './ThemeToggle';

export const LoginPage: React.FC = () => {
  const { loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-dismiss snackbar after 7 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => {
      setError(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    const scriptId = 'google-gsi-script-login-page';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const initGsi = () => {
      const g = (window as unknown as {
        google?: {
          accounts?: {
            id?: {
              initialize: (cfg: unknown) => void;
              renderButton: (el: HTMLElement, opts: unknown) => void;
              prompt: () => void;
            };
          };
        };
      }).google;

      if (g?.accounts?.id) {
        const clientId =
          import.meta.env.VITE_GOOGLE_CLIENT_ID ||
          '9029127515-jnnre2q9gn4vqfnqgffc6r09e9jpoq37.apps.googleusercontent.com';

        g.accounts.id.initialize({
          client_id: clientId,
          callback: async (response: { credential: string }) => {
            setLoading(true);
            setError(null);
            try {
              await loginWithGoogle(response.credential);
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              setError(
                msg || 'Google Authentication failed. Ensure your email is registered with REC.'
              );
            } finally {
              setLoading(false);
            }
          },
        });

        const btnContainer = document.getElementById('google-signin-btn-main');
        if (btnContainer) {
          btnContainer.innerHTML = '';
          g.accounts.id.renderButton(btnContainer, {
            theme: 'outline',
            size: 'large',
            width: '280',
            text: 'continue_with',
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
  }, [loginWithGoogle]);

  return (
    <div className="min-h-screen bg-background text-text flex items-center justify-center p-4 relative">
      {/* Top Right Theme Toggle */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <ThemeToggle compact />
      </div>

      {/* Centered Sign In Card */}
      <main className="w-full max-w-sm flex items-center justify-center">
        <Card className="w-full p-8 sm:p-9 space-y-6 shadow-xl text-center flex flex-col items-center justify-center">
          <img
            src="/icons/desktop-icon-256x256.png"
            alt="REC Gym Logo"
            className="w-16 h-16 rounded-2xl object-contain shadow-md"
          />

          <div className="space-y-1">
            <h1 className="text-xl font-bold text-text">REC College Gym</h1>
            <p className="text-xs text-muted">Rajalakshmi Engineering College</p>
          </div>

          {/* Centered Google Sign In Button */}
          <div className="w-full pt-1 flex flex-col items-center justify-center space-y-3">
            <div
              id="google-signin-btn-main"
              className="w-full flex items-center justify-center min-h-[44px]"
            ></div>

            {loading && (
              <div className="flex items-center justify-center gap-2 text-xs font-medium text-muted">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Verifying session...</span>
              </div>
            )}
          </div>
        </Card>
      </main>

      {/* Floating Error Snackbar */}
      {error && (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,28rem)] animate-in fade-in slide-in-from-bottom-5 duration-200"
        >
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-[#18181b] text-white shadow-2xl border border-red-500/20">
            <div className="w-8 h-8 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-xs text-red-200">Sign-in Failed</p>
              <p className="text-[11px] text-zinc-300 mt-0.5 leading-relaxed break-words">
                {error}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
