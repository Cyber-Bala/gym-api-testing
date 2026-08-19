import React, { useState, useEffect } from 'react';
import {
  Users,
  Activity,
  Scan,
  RefreshCw,
  Clock,
  Zap,
  CheckCircle2,
  Play,
  LogOut,
  LogIn,
  ShieldAlert,
  Bot,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
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
  const { user } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState<LiveOccupancyStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  // Custom Simulator Form (Super Admin only)
  const [customIdentifier, setCustomIdentifier] = useState<string>('2024CS001');
  const [identifierType, setIdentifierType] = useState<'roll_number' | 'staff_id' | 'email'>('roll_number');
  const [eventType, setEventType] = useState<'entry' | 'exit'>('entry');

  // No-Show trigger
  const [runningNoShow, setRunningNoShow] = useState<boolean>(false);
  const [noShowMessage, setNoShowMessage] = useState<string | null>(null);

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

  const handleManualCheckout = async (occ: LiveGymOccupant) => {
    try {
      await api.post('/api/v1/floor/checkout', {
        personId: occ.personId,
        notes: 'Manual floor supervisor checkout',
      });
      toast.success(`Checked out ${occ.name} from gym floor.`);
      fetchLiveOccupancy();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Checkout Failed');
    }
  };

  const handleTriggerNoShows = async () => {
    setRunningNoShow(true);
    setNoShowMessage(null);
    try {
      const data = await api.post<{
        violationsIssued: number;
        studentsSuspended: number;
        completedSlotsEvaluated: number;
      }>('/api/v1/access/admin/process-no-shows', {});

      const msg = `Evaluation finished: ${data.violationsIssued} strike(s) issued, ${data.studentsSuspended} student(s) suspended.`;
      setNoShowMessage(msg);
      toast.info(msg, 'No-Show Audit Completed');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'No-Show Audit Failed');
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
            <p className="text-xs text-secondary mt-0.5 flex items-center gap-2 flex-wrap">
              <span>Real-time Turnstile Biometric Stream (ZKBio CV) • Capacity Threshold: 100</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success bg-success-muted px-2 py-0.5 rounded-md border border-success/30">
                <Bot className="w-3 h-3" /> Auto-Audit Active (Every 5m)
              </span>
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
                title="Gym floor is clear"
                description={
                  isSuperAdmin
                    ? 'No members currently checked in. Use the Super Admin Turnstile Simulator below to test entry events.'
                    : 'No members are currently checked into the gym floor.'
                }
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

                      {isSuperAdmin ? (
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
                      ) : (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => handleManualCheckout(occ)}
                          className="text-danger hover:bg-danger-muted text-[11px]"
                        >
                          <span>Checkout</span>
                        </Button>
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
        <Card className="space-y-6 border-primary/30">
          <div className="flex items-center justify-between gap-2 border-b border-border pb-4">
            <div className="flex items-center gap-2">
              <Scan className="w-5 h-5 text-primary" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-text">
                    ZKBio CV Turnstile Hardware Simulator
                  </h3>
                  <Badge tone="danger">Super Admin Only</Badge>
                </div>
                <p className="text-xs text-secondary mt-0.5">
                  Test biometric turnstile ingress/egress, grace windows, and antipassback enforcement.
                </p>
              </div>
            </div>
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
                className="justify-start text-xs border-success/30 hover:bg-success-muted text-text"
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
                className="justify-start text-xs border-accent/30 hover:bg-accent-muted text-text"
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
                className="justify-start text-xs border-warning/30 hover:bg-warning-muted text-text"
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
                className="justify-start text-xs border-primary/30 hover:bg-primary-muted text-text"
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
          <div className="p-4 rounded-2xl border border-border bg-surface-elevated/40 space-y-4">
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
                'p-4 rounded-2xl border space-y-2 transition-all animate-in fade-in duration-200',
                scanResult.accessGranted
                  ? 'border-success/40 bg-success-muted/30 text-success'
                  : 'border-danger/40 bg-danger-muted/30 text-danger'
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
