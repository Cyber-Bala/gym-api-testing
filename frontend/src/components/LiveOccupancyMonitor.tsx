import React, { useState, useEffect } from 'react';
import {
  Users,
  Activity,
  UserCheck,
  UserX,
  Scan,
  RefreshCw,
  Clock,
  Zap,
  CheckCircle2,
  Play,
  LogOut,
  LogIn,
} from 'lucide-react';
import { Card, Badge, ProgressBar, Alert, EmptyState } from '../ui/primitives';
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
  const [stats, setStats] = useState<LiveOccupancyStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  // Custom Simulator Form
  const [customIdentifier, setCustomIdentifier] = useState<string>('2024CS001');
  const [identifierType, setIdentifierType] = useState<'roll_number' | 'staff_id' | 'email'>('roll_number');
  const [eventType, setEventType] = useState<'entry' | 'exit'>('entry');

  // No-Show trigger
  const [runningNoShow, setRunningNoShow] = useState<boolean>(false);
  const [noShowMessage, setNoShowMessage] = useState<string | null>(null);

  const fetchLiveOccupancy = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/access/live-occupancy', {
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStats(data.data);
      }
    } catch {
      // Background fetch error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveOccupancy();
    const interval = setInterval(fetchLiveOccupancy, 8000); // 8s live polling
    return () => clearInterval(interval);
  }, []);

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
      const res = await fetch('/api/v1/access/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      const resData = await res.json();
      if (resData.data) {
        setScanResult(resData.data);
      }
      fetchLiveOccupancy();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setSimulating(false);
    }
  };

  const handleTriggerNoShows = async () => {
    setRunningNoShow(true);
    setNoShowMessage(null);
    try {
      const res = await fetch('/api/v1/access/admin/process-no-shows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to trigger evaluation');

      setNoShowMessage(
        `Evaluation finished: ${data.data.violationsIssued} violation strike(s) issued, ${data.data.studentsSuspended} student(s) suspended.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setRunningNoShow(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Occupancy Summary */}
      <Card className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-base sm:text-lg text-text">
                Live Gym Occupancy & Attendance
              </h3>
            </div>
            <p className="text-xs text-secondary mt-0.5">
              Real-time Turnstile Biometric Stream (ZKBio CV) • Capacity Threshold: 100
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTriggerNoShows}
              loading={runningNoShow}
              className="border-warning/30 text-warning hover:bg-warning-muted"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Run No-Show Audit</span>
            </Button>

            <IconButton
              label="Refresh occupancy"
              size="sm"
              onClick={fetchLiveOccupancy}
              disabled={loading}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            </IconButton>
          </div>
        </div>

        {/* No-Show Alert */}
        {noShowMessage && (
          <Alert tone="warning" onDismiss={() => setNoShowMessage(null)}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-warning shrink-0" />
              <span className="font-medium">{noShowMessage}</span>
            </div>
          </Alert>
        )}

        {/* Occupancy Progress Gauge */}
        {stats && (
          <div className="p-5 rounded-2xl border border-border bg-border-subtle/40 space-y-3">
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

            <div className="flex items-center justify-between text-xs text-muted pt-1">
              <span>Real-time face verification stream</span>
              <span className="font-medium text-text">{stats.maxCapacity - stats.currentCount} spots remaining</span>
            </div>
          </div>
        )}

        {/* Active Occupants Grid */}
        {stats && (
          <div className="space-y-3">
            <h4 className="font-bold text-xs text-muted uppercase tracking-wider">
              Current Gym Occupants ({stats.occupants.length})
            </h4>

            {stats.occupants.length === 0 ? (
              <EmptyState
                icon={<Users className="w-6 h-6" />}
                title="Gym is currently empty"
                description="Use the turnstile simulator below to simulate face biometric check-in scans."
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {stats.occupants.map((occ) => (
                  <div
                    key={occ.sessionId}
                    className="p-4 rounded-2xl border border-border bg-surface flex flex-col justify-between space-y-3 shadow-sm hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <Badge tone="primary">{occ.role}</Badge>
                        <h5 className="font-bold text-sm text-text mt-1.5">
                          {occ.name}
                        </h5>
                        <p className="text-xs text-muted font-mono mt-0.5">
                          {occ.email}
                        </p>
                      </div>

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

      {/* Hardware Biometric Turnstile Simulator */}
      <Card className="space-y-6">
        <div className="flex items-center gap-2">
          <Scan className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-bold text-base text-text">
              ZKBio CV Turnstile Hardware Simulator
            </h3>
            <p className="text-xs text-secondary">
              Test real-time biometric face authentication, grace window validation, and exit duration tracking.
            </p>
          </div>
        </div>

        {/* Quick Simulator Preset Buttons */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-muted uppercase tracking-wider">
            Quick Persona Scans
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={() =>
                handleSimulateScan({
                  identifierType: 'roll_number',
                  identifierValue: '2024CS001',
                  eventType: 'entry',
                })
              }
              className="p-3.5 rounded-xl border border-border hover:border-primary/40 bg-surface text-left transition-colors"
            >
              <div className="flex items-center justify-between text-xs font-bold text-text">
                <span>Karthik (Hosteller)</span>
                <LogIn className="w-3.5 h-3.5 text-primary" />
              </div>
              <p className="text-[11px] text-muted font-mono mt-0.5">Roll: 2024CS001</p>
              <span className="text-[10px] text-success font-semibold mt-1 block">
                Simulate Face Entry
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleSimulateScan({
                  identifierType: 'email',
                  identifierValue: 'trainer@rajalakshmi.edu.in',
                  eventType: 'entry',
                })
              }
              className="p-3.5 rounded-xl border border-border hover:border-primary/40 bg-surface text-left transition-colors"
            >
              <div className="flex items-center justify-between text-xs font-bold text-text">
                <span>Vignesh (Trainer)</span>
                <LogIn className="w-3.5 h-3.5 text-primary" />
              </div>
              <p className="text-[11px] text-muted font-mono mt-0.5">Bypass Access</p>
              <span className="text-[10px] text-primary font-semibold mt-1 block">
                Simulate Face Entry
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleSimulateScan({
                  identifierType: 'staff_id',
                  identifierValue: 'REC-FAC-108',
                  eventType: 'entry',
                })
              }
              className="p-3.5 rounded-xl border border-border hover:border-primary/40 bg-surface text-left transition-colors"
            >
              <div className="flex items-center justify-between text-xs font-bold text-text">
                <span>Dr. Ramesh (Faculty)</span>
                <LogIn className="w-3.5 h-3.5 text-primary" />
              </div>
              <p className="text-[11px] text-muted font-mono mt-0.5">Staff ID: REC-FAC-108</p>
              <span className="text-[10px] text-accent font-semibold mt-1 block">
                Simulate Face Entry
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                handleSimulateScan({
                  identifierType: 'roll_number',
                  identifierValue: 'UNKNOWN_ROLL_99',
                  eventType: 'entry',
                })
              }
              className="p-3.5 rounded-xl border border-danger/30 bg-danger-muted/20 hover:border-danger text-left transition-colors"
            >
              <div className="flex items-center justify-between text-xs font-bold text-danger">
                <span>Unregistered User</span>
                <UserX className="w-3.5 h-3.5 text-danger" />
              </div>
              <p className="text-[11px] text-muted font-mono mt-0.5">Unknown Face</p>
              <span className="text-[10px] text-danger font-semibold mt-1 block">
                Test Denial Flow
              </span>
            </button>
          </div>
        </div>

        {/* Custom Scan Trigger Form */}
        <div className="p-4 rounded-2xl border border-border bg-border-subtle/30 space-y-3">
          <p className="text-xs font-bold text-muted uppercase tracking-wider">
            Custom Hardware Event
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs items-end">
            <Select
              label="Event Type"
              value={eventType}
              onChange={(e) => setEventType(e.target.value as any)}
            >
              <option value="entry">Entry Turnstile (IN)</option>
              <option value="exit">Exit Turnstile (OUT)</option>
            </Select>

            <Select
              label="Identifier Type"
              value={identifierType}
              onChange={(e) => setIdentifierType(e.target.value as any)}
            >
              <option value="roll_number">Roll Number</option>
              <option value="staff_id">Staff ID</option>
              <option value="email">Email</option>
            </Select>

            <Input
              label="Identifier Value"
              type="text"
              value={customIdentifier}
              onChange={(e) => setCustomIdentifier(e.target.value)}
              placeholder="e.g. 2024CS001"
            />

            <Button
              variant="primary"
              size="md"
              loading={simulating}
              onClick={() => handleSimulateScan()}
              className="w-full"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Send Hardware Scan</span>
            </Button>
          </div>
        </div>

        {/* Live Scan Decision Result */}
        {scanResult && (
          <Alert tone={scanResult.accessGranted ? 'success' : 'danger'}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {scanResult.accessGranted ? (
                  <UserCheck className="w-5 h-5 text-success shrink-0" />
                ) : (
                  <UserX className="w-5 h-5 text-danger shrink-0" />
                )}
                <div>
                  <h4 className="font-bold text-xs sm:text-sm">
                    {scanResult.accessGranted ? 'ACCESS GRANTED (Turnstile Unlocked)' : 'ACCESS DENIED (Turnstile Locked)'}
                  </h4>
                  <p className="text-xs opacity-90 mt-0.5">{scanResult.message}</p>
                </div>
              </div>

              <Badge tone={scanResult.accessGranted ? 'success' : 'danger'}>
                {scanResult.eventType}
              </Badge>
            </div>

            {scanResult.durationMinutes !== undefined && scanResult.durationMinutes > 0 && (
              <div className="mt-2.5 pt-2 border-t border-current/20 text-xs font-semibold">
                Completed Workout Duration: {scanResult.durationMinutes} Minutes
              </div>
            )}
          </Alert>
        )}
      </Card>
    </div>
  );
};

