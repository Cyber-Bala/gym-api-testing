import React, { useState, useEffect } from 'react';
import { ShieldAlert, Loader2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { RecLogo } from './RecLogo';
import { ThemeToggle } from './ThemeToggle';

const carouselImages = [
  '/images/banner-1.jpg',
  '/images/banner-2.jpg',
  '/images/banner-3.jpg',
];

export const LoginPage: React.FC = () => {
  const { loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => {
      setError(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImageIndex((prevIndex) =>
        prevIndex === carouselImages.length - 1 ? 0 : prevIndex + 1
      );
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const scriptId = 'google-gsi-script-login-page';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;

    const initGsi = () => {
      const g = (
        window as unknown as {
          google?: {
            accounts?: {
              id?: {
                initialize: (cfg: unknown) => void;
                renderButton: (el: HTMLElement, opts: unknown) => void;
                prompt: () => void;
              };
            };
          };
        }
      ).google;

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
            width: '320',
            text: 'continue_with',
            shape: 'rectangular',
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
    <div className="flex h-screen relative">
      <div className="absolute top-4 right-4 z-30">
        <ThemeToggle compact />
      </div>

      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0">
          <div
            className="absolute inset-0 transition-opacity duration-1000 opacity-100 z-10"
            style={{
              backgroundImage: `url(${carouselImages[currentImageIndex]})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            <div className="absolute inset-0 bg-black/40 dark:bg-black/60" />
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 relative z-20">
        <div className="relative w-full max-w-md shadow-[0_20px_60px_rgba(0,0,0,0.45)] bg-card/85 backdrop-blur-md rounded-xl py-6 flex flex-col gap-6">
          <div className="text-center space-y-4 px-6 pt-4">
            <RecLogo alt="REC Gym Logo" className="w-60 h-24 mx-auto" />
            <div className="space-y-2">
              <h1 className="text-2xl font-bold leading-none">Login</h1>
              <p className="text-base text-muted-foreground">
                Sign in with your college Google account to access REC Gym
              </p>
            </div>
          </div>

          <div className="space-y-6 px-6">
            <div className="w-full flex flex-col items-center justify-center space-y-3 min-h-[44px]">
              <div
                id="google-signin-btn-main"
                className="w-full flex items-center justify-center min-h-[44px]"
              />
              {loading && (
                <div className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Signing in...</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col space-y-4 px-6 mt-2">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Official gym portal for Rajalakshmi Engineering College
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[min(92vw,28rem)]"
        >
          <div className="flex items-start gap-3 p-4 rounded-xl bg-card text-card-foreground shadow-lg border border-danger/30">
            <div className="w-8 h-8 rounded-md bg-danger/20 text-danger flex items-center justify-center shrink-0 mt-0.5">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-danger">Sign-in Failed</p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed break-words">
                {error}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="p-1 rounded-md text-muted-foreground hover:text-text hover:bg-surface-elevated transition-colors shrink-0"
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
