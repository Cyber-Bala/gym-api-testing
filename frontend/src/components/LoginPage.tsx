import React, { useState, useEffect } from 'react';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Alert } from '../ui/primitives';
import { ThemeToggle } from './ThemeToggle';

export const LoginPage: React.FC = () => {
  const { loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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
            width: '300',
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
  }, [loginWithGoogle]);

  return (
    <div className="min-h-screen bg-background text-text flex flex-col justify-between p-4 sm:p-6">
      {/* Top Bar with Theme Toggle */}
      <div className="max-w-md mx-auto w-full flex justify-end py-2">
        <ThemeToggle compact />
      </div>

      {/* Centered Sign In Card */}
      <main className="max-w-sm mx-auto w-full py-6">
        <Card className="p-8 space-y-6 shadow-xl text-center flex flex-col items-center">
          <img
            src="/icons/desktop-icon-256x256.png"
            alt="REC Gym Logo"
            className="w-16 h-16 rounded-2xl object-contain shadow-md"
          />

          <div className="space-y-1">
            <h1 className="text-xl font-bold text-text">REC College Gym</h1>
            <p className="text-xs text-muted">Rajalakshmi Engineering College</p>
          </div>

          {error && (
            <Alert tone="danger" onDismiss={() => setError(null)} className="w-full text-left">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="text-xs">{error}</p>
              </div>
            </Alert>
          )}

          {/* Google Sign In Button */}
          <div className="w-full pt-2 flex flex-col items-center space-y-3">
            <div id="google-signin-btn-main" className="flex justify-center min-h-[44px]"></div>

            {loading && (
              <div className="flex items-center justify-center gap-2 text-xs font-medium text-muted">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Verifying session...</span>
              </div>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
};
