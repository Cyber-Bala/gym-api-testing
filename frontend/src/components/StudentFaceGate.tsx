import React from 'react';
import { Loader2, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { Card, Badge } from '../ui/primitives';
import { Button } from '../ui/Button';
import { RecLogo } from './RecLogo';
import { FaceRegistrationStatus } from './FaceRegistrationStatus';

/**
 * Student flow: college email login -> gym pass (day scholars only) -> face registration -> slot booking.
 * Blocks the app until the face is registered. A student who cannot register yet
 * (no ID photo on file, face service off, managed in ZKBio) is let through with the banner on Home.
 */
export const StudentFaceGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const [state, setState] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const s = await api.get<{ state: string }>('/api/v1/face-ml/me/status');
      setState(s.state);
    } catch {
      setState('unknown'); // never lock a student out because of a failed check
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (state === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading your account...
      </div>
    );
  }

  // Blocked until the face is registered. When it cannot be done yet (no ID photo / service off) the page says why.
  if (state !== 'ready' && state !== 'no_id_photo' && state !== 'service_offline') return <>{children}</>;

  const isDay = user?.studentDetails?.residency === 'day_scholar';
  return (
    <div className="min-h-screen bg-background text-text flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center space-y-2">
          <RecLogo alt="REC Gym Logo" className="h-24 w-60 mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-foreground">Register Your Face</h1>
          <p className="text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
            Register your face once. It is checked against your ID photo. {isDay ? 'Then you buy your gym pass, and then you can book slots.' : 'Then you can book slots.'}
          </p>
        </div>
        <Card className="space-y-4 shadow-lg">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="min-w-0">
              <span className="font-bold text-text truncate">{user?.name}</span>
              <p className="text-[11px] text-muted truncate">{user?.email}</p>
            </div>
            <Badge tone="primary" className="shrink-0">
              {isDay ? 'Step 1 of 3' : 'Step 1 of 2'}
            </Badge>
          </div>
          <FaceRegistrationStatus onRegistered={() => void load()} />
          {state !== 'ready' && (
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Check again
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => void logout()}>
            <LogOut className="w-4 h-4" /> Sign out
          </Button>
        </Card>
      </div>
    </div>
  );
};
