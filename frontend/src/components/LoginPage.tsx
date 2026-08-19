import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Check,
  Copy,
  Sparkles,
  Info,
  Calendar,
  CreditCard,
  Activity,
  Cpu,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Badge, Alert } from '../ui/primitives';
import { ThemeToggle } from './ThemeToggle';

interface TestPersona {
  role: string;
  name: string;
  email: string;
  description: string;
  badgeTone: 'danger' | 'primary' | 'warning' | 'success' | 'neutral' | 'accent';
}

const TEST_PERSONAS: TestPersona[] = [
  {
    role: 'Super Admin',
    name: 'IIIC Super Administrator',
    email: 'iiic@rajalakshmi.edu.in',
    description: 'Unrestricted control, admin provisioning, and system oversight.',
    badgeTone: 'danger',
  },
  {
    role: 'Gym Admin',
    name: 'Gym Administrator',
    email: 'admin@rajalakshmi.edu.in',
    description: 'Capacity overrides, violation strikes, reports & student directory.',
    badgeTone: 'primary',
  },
  {
    role: 'Hosteller',
    name: 'Karthik Raja',
    email: 'hosteller@rajalakshmi.edu.in',
    description: 'Free slot bookings and biometric turnstile check-in.',
    badgeTone: 'success',
  },
  {
    role: 'Day Scholar',
    name: 'Priya Sharma',
    email: 'dayscholar@rajalakshmi.edu.in',
    description: 'Active Day Scholar membership pass holder.',
    badgeTone: 'accent',
  },
  {
    role: 'Trainer',
    name: 'Vignesh Kumar',
    email: 'trainer@rajalakshmi.edu.in',
    description: 'Turnstile shift timesheets and floor occupancy monitoring.',
    badgeTone: 'warning',
  },
  {
    role: 'Staff / Faculty',
    name: 'Dr. S. Ramesh',
    email: 'staff@rajalakshmi.edu.in',
    description: 'Faculty wellness program and rehabilitation access.',
    badgeTone: 'neutral',
  },
];

export const LoginPage: React.FC = () => {
  const { loginWithGoogle, devLogin } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [showDevPersonas, setShowDevPersonas] = useState<boolean>(false);

  useEffect(() => {
    const scriptId = 'google-gsi-script-login-page';
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
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              setError(msg || 'Google Authentication failed. Ensure your email is registered with REC.');
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

  const handlePersonaLogin = async (email: string) => {
    setLoading(true);
    setError(null);
    try {
      await devLogin(email);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedEmail(text);
    setTimeout(() => setCopiedEmail(null), 1500);
  };

  return (
    <div className="min-h-screen bg-background text-text flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="max-w-5xl mx-auto w-full flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <img
            src="/icons/desktop-icon-256x256.png"
            alt="REC Gym Logo"
            className="w-10 h-10 rounded-xl object-contain shadow-sm shrink-0"
          />
          <div>
            <h1 className="font-bold text-sm sm:text-base text-text leading-tight">
              Rajalakshmi Engineering College
            </h1>
            <p className="text-xs text-muted">College Gym Management Portal</p>
          </div>
        </div>

        <ThemeToggle compact />
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto w-full py-6 sm:py-12 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          {/* Left Column: Primary Sign In */}
          <div className="md:col-span-6 space-y-6">
            <Card className="p-6 sm:p-8 space-y-6 shadow-md">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-muted/20 text-primary text-[11px] font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Institutional Single Sign-On</span>
                </div>
                <h2 className="text-2xl font-bold text-text">Sign In with Google</h2>
                <p className="text-xs text-muted leading-relaxed">
                  Access your gym bookings, turnstile entry passes, and floor statistics using your official college Google account.
                </p>
              </div>

              {error && (
                <Alert tone="danger" onDismiss={() => setError(null)}>
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-xs">Access Denied</p>
                      <p className="text-[11px] mt-0.5 opacity-90">{error}</p>
                    </div>
                  </div>
                </Alert>
              )}

              {/* Google Sign In Button Container */}
              <div className="space-y-4 pt-2">
                <div className="flex justify-center min-h-[44px]">
                  <div id="google-signin-btn-main" className="flex justify-center"></div>
                </div>

                {loading && (
                  <div className="flex items-center justify-center gap-2 text-xs font-medium text-muted py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span>Verifying institutional identity...</span>
                  </div>
                )}

                <div className="rounded-2xl bg-surface-elevated p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>Authorized Domain Access</span>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Sign-in is exclusively provisioned for registered <strong className="text-text">@rajalakshmi.edu.in</strong> accounts. Students, faculty, trainers, and administrators pre-enrolled by the college administration will be automatically directed to their dedicated portal.
                  </p>
                </div>
              </div>

              {/* Dev Persona Accordion Trigger */}
              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setShowDevPersonas(!showDevPersonas)}
                  className="text-muted hover:text-text font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>{showDevPersonas ? 'Hide Quick Personas' : 'Quick Access Personas (Dev & Test)'}</span>
                </button>
              </div>
            </Card>
          </div>

          {/* Right Column: Key System Features Overview */}
          <div className="md:col-span-6 space-y-4">
            <div className="space-y-1">
              <h3 className="font-bold text-base text-text">Automated Turnstile & Facility Features</h3>
              <p className="text-xs text-muted">Integrated biometrics, smart slots, and capacity management</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card className="p-4 space-y-2">
                <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm">
                  <Calendar className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-xs text-text">Rolling Slot Booking</h4>
                <p className="text-[11px] text-muted">
                  3-day rolling window reservations with a 100-student cap per hour slot.
                </p>
              </Card>

              <Card className="p-4 space-y-2">
                <div className="w-8 h-8 rounded-xl bg-accent text-white flex items-center justify-center shadow-sm">
                  <Cpu className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-xs text-text">Biometric Turnstiles</h4>
                <p className="text-[11px] text-muted">
                  Facial recognition & turnstile integration for automated ingress/egress.
                </p>
              </Card>

              <Card className="p-4 space-y-2">
                <div className="w-8 h-8 rounded-xl bg-success text-white flex items-center justify-center shadow-sm">
                  <CreditCard className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-xs text-text">Membership Passes</h4>
                <p className="text-[11px] text-muted">
                  Instant free access for hostellers and official passes for day scholars.
                </p>
              </Card>

              <Card className="p-4 space-y-2">
                <div className="w-8 h-8 rounded-xl bg-warning text-white flex items-center justify-center shadow-sm">
                  <Activity className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-xs text-text">Live Occupancy</h4>
                <p className="text-[11px] text-muted">
                  Real-time floor occupancy monitor with continuous slot overstay tracking.
                </p>
              </Card>
            </div>
          </div>
        </div>

        {/* Quick Access Personas (Visible when toggled) */}
        {showDevPersonas && (
          <Card className="p-6 space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-text flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span>Pre-Provisioned Institutional Personas</span>
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Click any role below for instant one-click portal preview.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {TEST_PERSONAS.map((persona) => (
                <button
                  key={persona.email}
                  type="button"
                  onClick={() => handlePersonaLogin(persona.email)}
                  className="w-full text-left p-3.5 rounded-2xl bg-surface-elevated hover:bg-surface transition-all flex flex-col justify-between space-y-2 group shadow-sm hover:shadow-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs text-text truncate group-hover:text-primary transition-colors">
                      {persona.name}
                    </span>
                    <Badge tone={persona.badgeTone}>{persona.role}</Badge>
                  </div>

                  <p className="text-[11px] text-muted font-mono truncate">{persona.email}</p>
                  <p className="text-[10px] text-muted leading-tight">{persona.description}</p>

                  <div className="pt-1 flex items-center justify-end">
                    <span
                      onClick={(e) => handleCopy(persona.email, e)}
                      title="Copy email"
                      className="p-1 rounded-lg text-muted hover:text-text hover:bg-surface"
                    >
                      {copiedEmail === persona.email ? (
                        <Check className="w-3.5 h-3.5 text-success" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto w-full text-center text-xs text-muted py-4 border-t border-white/5">
        <p>© 2026 Rajalakshmi Engineering College. Turnstile Biometrics & Gym Management System.</p>
      </footer>
    </div>
  );
};
