import React, { useState } from 'react';
import { Dumbbell, Lock, Mail, ShieldAlert, ArrowRight, KeyRound, Copy, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Badge, Alert } from '../ui/primitives';
import { Button } from '../ui/Button';
import { ThemeToggle } from './ThemeToggle';
import { cn } from '../lib/cn';

interface TestAccount {
  role: string;
  name: string;
  email: string;
  password: string;
  description: string;
  badgeTone: 'danger' | 'primary' | 'warning' | 'success' | 'neutral' | 'accent';
}

const TEST_ACCOUNTS: TestAccount[] = [
  {
    role: 'Hosteller',
    name: 'Karthik Raja',
    email: 'hosteller@rajalakshmi.edu.in',
    password: 'password123',
    description: 'Free instant slot reservations without membership pass.',
    badgeTone: 'success',
  },
  {
    role: 'Day Scholar',
    name: 'Priya Sharma',
    email: 'dayscholar@rajalakshmi.edu.in',
    password: 'password123',
    description: 'Requires active Day Scholar pass (₹500/mo) before booking.',
    badgeTone: 'accent',
  },
  {
    role: 'Trainer',
    name: 'Vignesh Kumar',
    email: 'trainer@rajalakshmi.edu.in',
    password: 'password123',
    description: 'Shift timesheets, floor supervision, and member checkouts.',
    badgeTone: 'warning',
  },
  {
    role: 'Gym Admin',
    name: 'Gym Administrator',
    email: 'admin@rajalakshmi.edu.in',
    password: 'password123',
    description: 'Capacity overrides, violation strikes, reports & Excel import.',
    badgeTone: 'primary',
  },
  {
    role: 'Super Admin',
    name: 'Principal / Management',
    email: 'superadmin@rajalakshmi.edu.in',
    password: 'password123',
    description: 'Protected identity, emergency blackouts, cold storage archives.',
    badgeTone: 'danger',
  },
  {
    role: 'Staff / Faculty',
    name: 'Dr. S. Ramesh',
    email: 'staff@rajalakshmi.edu.in',
    password: 'password123',
    description: 'Faculty wellness program & rehabilitation gym access.',
    badgeTone: 'neutral',
  },
];

export const LoginPage: React.FC = () => {
  const { devLogin } = useAuth();
  const [email, setEmail] = useState<string>('hosteller@rajalakshmi.edu.in');
  const [password, setPassword] = useState<string>('password123');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const handleFillAccount = (acc: TestAccount) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setError(null);
  };

  const handleCopy = (text: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedEmail(text);
    setTimeout(() => setCopiedEmail(null), 1500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    // Check if account is in hardcoded list
    const matchedAccount = TEST_ACCOUNTS.find(
      (a) => a.email.toLowerCase() === trimmedEmail
    );

    if (!matchedAccount) {
      setError(`Account '${trimmedEmail}' is not recognized in the college database.`);
      setLoading(false);
      return;
    }

    // Verify password (accepts specific account password or standard 'password123' / 'rec123')
    const validPasswords = [matchedAccount.password, 'password123', 'rec123', 'admin123', 'student123', 'trainer123', 'staff123'];
    if (!validPasswords.includes(trimmedPassword)) {
      setError('Invalid password. Default testing password is password123');
      setLoading(false);
      return;
    }

    try {
      await devLogin(trimmedEmail);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-text flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Header Bar */}
      <header className="max-w-5xl mx-auto w-full flex items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary text-accent flex items-center justify-center border border-accent/30 shadow-sm shrink-0">
            <Dumbbell className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm sm:text-base text-text leading-tight">
              Rajalakshmi Engineering College
            </h1>
            <p className="text-xs text-secondary">College Gym Management Portal</p>
          </div>
        </div>

        <ThemeToggle compact />
      </header>

      {/* Main Login Card */}
      <main className="max-w-5xl mx-auto w-full py-6 sm:py-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Sign In Form */}
        <div className="lg:col-span-6 w-full">
          <Card className="p-6 sm:p-8 space-y-6 shadow-sm border border-border">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                <KeyRound className="w-4 h-4" />
                <span>Portal Sign In</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-text">Sign In with Credentials</h2>
              <p className="text-xs text-secondary">
                Enter your institutional college email and password to access your gym dashboard.
              </p>
            </div>

            {error && (
              <Alert tone="danger" onDismiss={() => setError(null)}>
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-xs">Authentication Error</p>
                    <p className="text-[11px] mt-0.5 opacity-90">{error}</p>
                  </div>
                </div>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-medium text-text block">
                  Institutional Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. hosteller@rajalakshmi.edu.in"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-surface text-text text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-medium text-text block">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-surface text-text text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                className="w-full justify-center"
              >
                <span>Sign In to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
          </Card>
        </div>

        {/* Right Column: Hardcoded Test Accounts Table */}
        <div className="lg:col-span-6 w-full space-y-4">
          <Card className="p-6 space-y-4 border border-border">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-text flex items-center gap-2">
                  <span>Hardcoded Test Accounts</span>
                  <Badge tone="accent">Testing Mode</Badge>
                </h3>
              </div>
              <p className="text-xs text-secondary mt-0.5">
                Click any account below to autofill the sign-in form. Password for all test accounts is <strong className="text-primary font-mono">password123</strong>.
              </p>
            </div>

            <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
              {TEST_ACCOUNTS.map((acc) => {
                const isSelected = email.toLowerCase() === acc.email.toLowerCase();
                return (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => handleFillAccount(acc)}
                    className={cn(
                      'w-full text-left p-3 rounded-2xl border transition-colors flex flex-col justify-between space-y-2',
                      isSelected
                        ? 'border-primary bg-primary-muted/20 shadow-sm'
                        : 'border-border bg-surface hover:bg-border-subtle/50'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-xs text-text truncate">{acc.name}</span>
                        <Badge tone={acc.badgeTone}>{acc.role}</Badge>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleCopy(acc.email, e)}
                        title="Copy email"
                        className="p-1 rounded-lg text-muted hover:text-text hover:bg-border-subtle shrink-0"
                      >
                        {copiedEmail === acc.email ? (
                          <Check className="w-3.5 h-3.5 text-success" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-secondary">
                      <span className="font-mono text-muted truncate">{acc.email}</span>
                      <span className="font-mono text-xs text-primary font-semibold shrink-0">
                        {acc.password}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted leading-tight">{acc.description}</p>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto w-full text-center text-xs text-muted py-4 border-t border-border">
        <p>© 2026 Rajalakshmi Engineering College. Turnstile Biometrics & Gym Management System.</p>
      </footer>
    </div>
  );
};
