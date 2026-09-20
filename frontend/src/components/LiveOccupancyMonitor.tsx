import React, { useState, useEffect } from 'react';
import {
  Users,
  Activity,
  Scan,
  RefreshCw,
  Clock,
  CheckCircle2,
  Play,
  LogOut,
  LogIn,
  ShieldAlert,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useSSE } from '../context/SSEContext';
import { useToast } from '../context/ToastContext';
import { Card, Badge, ProgressBar, EmptyState } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { cn } from '../lib/cn';

interface LiveGymOccupant {
  sessionId: string;
  personId: string;
  name: string;
  email: string;
  role: string;
  identifier: string;
  entryTimestamp: string;
  minutesInside: number;
}

interface LiveOccupancyStats {
  currentCount: number;
  maxCapacity: number;
  occupancyPercentage: number;
  occupants: LiveGymOccupant[];
}

interface ScanResult {
  accessGranted: boolean;
  eventType: 'entry' | 'exit';
  name?: string;
  role?: string;
  identifier?: string;
  slotTime?: string;
  durationMinutes?: number;
  denialReason?: string;
  message: string;
  timestamp: string;
}

export const LiveOccupancyMonitor: React.FC = () => {
  const { user } = useAuth();
  const { liveOccupancy } = useSSE();
  const toast = useToast();
  const [stats, setStats] = useState<LiveOccupancyStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  // Custom Simulator Form (Super Admin only)
  const [customIdentifier, setCustomIdentifier] = useState<string>('2024CS001');
  const [identifierType, setIdentifierType] = useState<'roll_number' | 'staff_id' | 'email'>('roll_number');
  const [eventType, setEventType] = useState<'entry' | 'exit'>('entry');

  const isSuperAdmin = user?.role === 'super_admin';

  const fetchLiveOccupancy = async () => {
    try {
      const data = await api.get<LiveOccupancyStats>('/api/v1/access/live-occupancy');
      setStats(data);
    } catch {
      // Background fetch error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveOccupancy();
  }, []);

  // Update when SSE pushes new live occupancy data
  useEffect(() => {
    if (liveOccupancy) {
      setStats(liveOccupancy);
    }
  }, [liveOccupancy]);

  const handleSimulateScan = async (overrideParams?: {
    identifierType: string;
    identifierValue: string;
    eventType: 'entry' | 'exit';
  }) => {
    setSimulating(true);
    setScanResult(null);

    const payload = overrideParams
      ? {
          deviceId: 'SIM_TURNSTILE_01',
          eventType: overrideParams.eventType,
          identifierType: overrideParams.identifierType,
          identifierValue: overrideParams.identifierValue,
          verificationMode: 'face',
        }
      : {
          deviceId: 'SIM_TURNSTILE_01',
          eventType,
          identifierType,
          identifierValue: customIdentifier,
          verificationMode: 'face',
        };

    try {
      const resData = await api.post<ScanResult>('/api/v1/access/simulate', payload);
      setScanResult(resData);
      if (resData.accessGranted) {
        toast.success(resData.message, 'Turnstile Hardware Access Granted');
      } else {
        toast.error(resData.denialReason || resData.message, 'Turnstile Access Denied');
      }
      fetchLiveOccupancy();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Simulation Error');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Occupancy Summary */}
      <Card className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-base sm:text-lg text-text">
              Live Gym Occupancy
            </h3>
          </div>

          <IconButton
            label="Refresh occupancy"
            size="sm"
            onClick={fetchLiveOccupancy}
            disabled={loading}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </IconButton>
        </div>

        {/* Occupancy Progress Gauge */}
        {stats && (
          <div className="p-5 rounded-2xl bg-surface-elevated space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-text">
                  Inside Gym Right Now
                </span>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-text">
                  {stats.currentCount}
                </span>
                <span className="text-xs text-muted font-medium"> / {stats.maxCapacity} Capacity</span>
              </div>
            </div>

            <ProgressBar value={stats.occupancyPercentage} />

            <div className="flex items-center justify-between text-xs text-muted">
              <span />
              <span>{Math.max(0, stats.maxCapacity - stats.currentCount)} spots remaining</span>
            </div>
          </div>
        )}

        {/* Current Occupants Detailed Cards */}
        {stats && (
          <div className="space-y-3">
            <h4 className="font-bold text-xs text-muted uppercase tracking-wider">
              Current Gym Occupants ({stats.occupants.length})
            </h4>

            {stats.occupants.length === 0 ? (
              <EmptyState
                icon={<Users className="w-6 h-6" />}
                title="Gym Floor is Currently Clear"
                description="No active check-in sessions recorded at the turnstiles right now."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {stats.occupants.map((occ) => (
                  <div
                    key={occ.sessionId}
                    className="p-4 rounded-2xl bg-surface-elevated flex flex-col justify-between space-y-3 shadow-sm transition-all hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h5 className="font-bold text-sm text-text">
                          {occ.name}
                        </h5>
                        <p className="text-xs text-muted font-mono mt-0.5">
                          {occ.email}
                        </p>
                      </div>

                      {isSuperAdmin && (
                        <IconButton
                          label="Simulate Exit"
                          size="sm"
                          variant="danger"
                          onClick={() =>
                            handleSimulateScan({
                              identifierType: 'email',
                              identifierValue: occ.email,
                              eventType: 'exit',
                            })
                          }
                        >
                          <LogOut className="w-3.5 h-3.5" />
                        </IconButton>
                      )}
                    </div>

                    <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted">
                      <span className="flex items-center gap-1 text-secondary font-medium">
                        <Clock className="w-3.5 h-3.5 text-success" />
                        <span>Inside: {occ.minutesInside} min</span>
                      </span>
                      <span className="text-[11px] font-mono">
                        {new Date(occ.entryTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Hardware Biometric Turnstile Simulator — SUPER ADMIN ONLY */}
      {isSuperAdmin && (
        <Card className="space-y-6">
          <div className="flex items-center gap-2">
            <Scan className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-base text-text">
              ZKBio CV Turnstile Hardware Simulator
            </h3>
            <Badge tone="danger">Super Admin</Badge>
          </div>

          {/* Quick Simulator Preset Buttons */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted uppercase tracking-wider">
              Quick Persona Biometric Scans
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="justify-start text-xs hover:bg-success-muted hover:text-success text-text"
                loading={simulating}
                onClick={() =>
                  handleSimulateScan({
                    identifierType: 'roll_number',
                    identifierValue: '2024CS001',
                    eventType: 'entry',
                  })
                }
              >
                <LogIn className="w-3.5 h-3.5 text-success" />
                <span className="truncate">Karthik (Hosteller Entry)</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="justify-start text-xs hover:bg-accent-muted hover:text-accent text-text"
                loading={simulating}
                onClick={() =>
                  handleSimulateScan({
                    identifierType: 'roll_number',
                    identifierValue: '2024IT002',
                    eventType: 'entry',
                  })
                }
              >
                <LogIn className="w-3.5 h-3.5 text-accent" />
                <span className="truncate">Priya (Day Scholar Entry)</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="justify-start text-xs hover:bg-warning-muted hover:text-warning text-text"
                loading={simulating}
                onClick={() =>
                  handleSimulateScan({
                    identifierType: 'email',
                    identifierValue: 'trainer@rajalakshmi.edu.in',
                    eventType: 'entry',
                  })
                }
              >
                <LogIn className="w-3.5 h-3.5 text-warning" />
                <span className="truncate">Trainer Vignesh Bypass</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="justify-start text-xs hover:bg-primary-muted hover:text-primary text-text"
                loading={simulating}
                onClick={() =>
                  handleSimulateScan({
                    identifierType: 'staff_id',
                    identifierValue: 'REC-STAFF-101',
                    eventType: 'entry',
                  })
                }
              >
                <LogIn className="w-3.5 h-3.5 text-primary" />
                <span className="truncate">Staff Dr. Ramesh Entry</span>
              </Button>
            </div>
          </div>

          {/* Custom Turnstile Trigger Form */}
          <div className="p-4 rounded-2xl bg-surface-elevated space-y-4 shadow-sm">
            <p className="text-xs font-bold text-text">Custom Turnstile Event Dispatcher</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select
                label="Identifier Type"
                value={identifierType}
                onChange={(e) => setIdentifierType(e.target.value as any)}
              >
                <option value="roll_number">Student Roll Number</option>
                <option value="staff_id">Staff Employee ID</option>
                <option value="email">College Email</option>
              </Select>

              <Input
                label="Identifier Value"
                value={customIdentifier}
                onChange={(e) => setCustomIdentifier(e.target.value)}
                placeholder="e.g. 2024CS001"
              />

              <Select
                label="Event Direction"
                value={eventType}
                onChange={(e) => setEventType(e.target.value as any)}
              >
                <option value="entry">Entry Gate (Check-In)</option>
                <option value="exit">Exit Gate (Check-Out)</option>
              </Select>
            </div>

            <Button
              variant="primary"
              size="md"
              loading={simulating}
              onClick={() => handleSimulateScan()}
              className="w-full sm:w-auto"
            >
              <Play className="w-4 h-4" />
              <span>Dispatch Biometric Scan Event</span>
            </Button>
          </div>

          {/* Biometric Gate Decision Result */}
          {scanResult && (
            <div
              className={cn(
                'p-4 rounded-2xl space-y-2 transition-all shadow-md animate-in fade-in duration-200',
                scanResult.accessGranted
                  ? 'bg-success-muted/30 text-success'
                  : 'bg-danger-muted/30 text-danger'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {scanResult.accessGranted ? (
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  ) : (
                    <ShieldAlert className="w-5 h-5 text-danger" />
                  )}
                  <h4 className="font-bold text-sm">
                    {scanResult.accessGranted ? 'ACCESS GRANTED — Gate Unlocked' : 'ACCESS DENIED — Turnstile Locked'}
                  </h4>
                </div>
                <Badge tone={scanResult.accessGranted ? 'success' : 'danger'}>
                  {scanResult.eventType.toUpperCase()}
                </Badge>
              </div>

              <p className="text-xs font-medium text-text">{scanResult.message}</p>

              {scanResult.durationMinutes !== undefined && (
                <p className="text-xs text-secondary font-mono">
                  Recorded Workout Session Duration: {scanResult.durationMinutes} minutes
                </p>
              )}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
