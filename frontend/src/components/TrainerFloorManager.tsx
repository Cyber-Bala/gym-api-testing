import React, { useState, useEffect } from 'react';
import {
  Users,
  AlertTriangle,
  LogOut,
  RefreshCw,
  Clock,
  CheckCircle2,
  HeartPulse,
  Zap,
} from 'lucide-react';
import { Card, Badge, Modal, Alert, Stat, EmptyState } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { Textarea } from '../ui/Input';
import { cn } from '../lib/cn';

interface LiveFloorOccupant {
  sessionId: string;
  personId: string;
  name: string;
  rollNumber?: string;
  department?: string;
  residency?: string;
  role: string;
  entryTimestamp: string;
  minutesElapsed: number;
  isOverstayer: boolean;
  overdueMinutes: number;
}

interface FloorStatus {
  currentSlotName: string;
  totalInsideCount: number;
  overstayerCount: number;
  occupants: LiveFloorOccupant[];
  overstayers: LiveFloorOccupant[];
}

interface StaffWellnessItem {
  staffId: string;
  staffEmpId: string;
  name: string;
  department: string;
  designation: string;
  totalWorkoutsThisMonth: number;
  totalHoursThisMonth: number;
}

export const TrainerFloorManager: React.FC = () => {
  const [status, setStatus] = useState<FloorStatus | null>(null);
  const [staffWellness, setStaffWellness] = useState<StaffWellnessItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<string | null>(null);

  // Manual Checkout Modal
  const [checkoutOccupant, setCheckoutOccupant] = useState<LiveFloorOccupant | null>(null);
  const [checkoutReason, setCheckoutReason] = useState<string>('Workout slot expired');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [floorRes, staffRes] = await Promise.all([
        fetch('/api/v1/floor/status', { credentials: 'include' }),
        fetch('/api/v1/floor/staff-wellness', { credentials: 'include' }),
      ]);

      const [floorData, staffData] = await Promise.all([floorRes.json(), staffRes.json()]);

      if (floorRes.ok && floorData.success) setStatus(floorData.data);
      if (staffRes.ok && staffData.success) setStaffWellness(staffData.data || []);
    } catch {
      // background error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 15000);
    return () => clearInterval(timer);
  }, []);

  const handleManualCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkoutOccupant) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/floor/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: checkoutOccupant.sessionId,
          reason: checkoutReason,
        }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Manual checkout failed');

      setNotification(`Checked out ${checkoutOccupant.name}. Recorded duration: ${data.data.durationMinutes} min.`);
      setCheckoutOccupant(null);
      setCheckoutReason('Workout slot expired');
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Floor Overview Header */}
      <Card className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-base sm:text-lg text-text">
                Live Gym Floor & Overstayer Management
              </h3>
            </div>
            <p className="text-xs text-secondary mt-0.5">
              Floor Supervision • Automated Overstayer Detection (&gt;15m post-slot) • Manual Floor Checkout
            </p>
          </div>

          <IconButton
            label="Refresh floor status"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </IconButton>
        </div>

        {notification && (
          <Alert tone="success" onDismiss={() => setNotification(null)}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              <span>{notification}</span>
            </div>
          </Alert>
        )}

        {/* Quick KPI Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Stat
            label="Current Occupancy"
            value={`${status?.totalInsideCount || 0} / 100`}
            hint="Turnstile active check-ins"
            icon={<Users className="w-4 h-4" />}
          />
          <Stat
            label="Overstaying Occupants"
            value={status?.overstayerCount || 0}
            hint={
              (status?.overstayerCount || 0) > 0 ? (
                <span className="text-danger font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Manual checkout needed
                </span>
              ) : (
                'All sessions within slot window'
              )
            }
            icon={<AlertTriangle className="w-4 h-4" />}
            className={(status?.overstayerCount || 0) > 0 ? 'border-danger/30 bg-danger-muted/10' : ''}
          />
          <Stat
            label="Floor Status"
            value="Active"
            hint="Supervisor live session"
            icon={<Zap className="w-4 h-4 text-success" />}
          />
        </div>

        {/* Overstayers Alert Section */}
        {status && status.overstayers.length > 0 && (
          <div className="p-5 rounded-2xl border border-danger/30 bg-danger-muted/20 space-y-3">
            <div className="flex items-center gap-2 text-danger">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h4 className="font-bold text-sm">
                Overstayer Alert ({status.overstayers.length} Occupant(s) exceeded slot limit)
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {status.overstayers.map((o) => (
                <div
                  key={o.sessionId}
                  className="p-4 rounded-xl bg-surface border border-danger/30 flex items-center justify-between shadow-sm"
                >
                  <div className="space-y-0.5 min-w-0">
                    <h5 className="font-bold text-sm text-text truncate">{o.name}</h5>
                    <p className="text-xs text-muted font-mono truncate">
                      Roll: {o.rollNumber} • {o.department}
                    </p>
                    <p className="text-[11px] text-danger font-semibold">
                      Inside for {o.minutesElapsed} mins ({o.overdueMinutes} mins overdue)
                    </p>
                  </div>

                  <Button
                    variant="danger"
                    size="xs"
                    onClick={() => setCheckoutOccupant(o)}
                    className="shrink-0 ml-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Checkout</span>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Occupants List */}
        <div className="space-y-3 pt-2">
          <h4 className="font-bold text-xs text-muted uppercase tracking-wider">
            All Current Floor Occupants ({status?.occupants.length || 0})
          </h4>

          {status && status.occupants.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {status.occupants.map((occ) => (
                <div
                  key={occ.sessionId}
                  className={cn(
                    'p-4 rounded-2xl border bg-surface space-y-2 transition-colors',
                    occ.isOverstayer ? 'border-danger/40 bg-danger-muted/10' : 'border-border'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h5 className="font-bold text-sm text-text">{occ.name}</h5>
                      <span className="text-[10px] uppercase font-bold text-muted">
                        {occ.role} {occ.rollNumber ? `• ${occ.rollNumber}` : ''}
                      </span>
                    </div>

                    <Badge tone={occ.isOverstayer ? 'danger' : 'success'}>
                      {occ.isOverstayer ? 'Overstay' : 'Valid'}
                    </Badge>
                  </div>

                  <div className="text-xs text-muted flex items-center gap-1">
                    <Clock className="w-3 h-3 text-muted" />
                    <span>Inside for {occ.minutesElapsed} minutes</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Users className="w-6 h-6" />}
              title="No occupants on gym floor"
              description="When students and faculty check in at the turnstile, their active floor sessions will display here."
            />
          )}
        </div>
      </Card>

      {/* Faculty / Staff Wellness Summary */}
      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <HeartPulse className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-bold text-base text-text">
              Institutional Faculty & Staff Wellness Hours
            </h3>
            <p className="text-xs text-secondary">
              Monthly gym workout hours logged by college professors, administrators, and staff.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs text-left">
            <thead className="bg-border-subtle/50 text-muted font-semibold">
              <tr>
                <th className="p-3.5">Staff Member</th>
                <th className="p-3.5">Employee ID</th>
                <th className="p-3.5">Department</th>
                <th className="p-3.5">Designation</th>
                <th className="p-3.5">Workouts (Month)</th>
                <th className="p-3.5">Total Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {staffWellness.map((s) => (
                <tr key={s.staffId} className="hover:bg-border-subtle/30 transition-colors">
                  <td className="p-3.5 font-bold text-text">{s.name}</td>
                  <td className="p-3.5 font-mono text-muted">{s.staffEmpId}</td>
                  <td className="p-3.5 text-secondary">{s.department}</td>
                  <td className="p-3.5 text-muted">{s.designation}</td>
                  <td className="p-3.5 font-semibold text-success">
                    {s.totalWorkoutsThisMonth} sessions
                  </td>
                  <td className="p-3.5 font-bold text-text">{s.totalHoursThisMonth} hrs</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Manual Checkout Modal */}
      <Modal
        open={Boolean(checkoutOccupant)}
        title={`Floor Checkout: ${checkoutOccupant?.name || ''}`}
        onClose={() => setCheckoutOccupant(null)}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setCheckoutOccupant(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={submitting}
              onClick={handleManualCheckout}
            >
              Confirm Checkout
            </Button>
          </>
        }
      >
        {checkoutOccupant && (
          <form onSubmit={handleManualCheckout} className="space-y-4 text-xs">
            <p className="text-secondary">
              Manually checkout this student from the gym floor and close their active session in the turnstile log.
            </p>

            <Textarea
              label="Reason for Manual Checkout"
              required
              rows={2}
              value={checkoutReason}
              onChange={(e) => setCheckoutReason(e.target.value)}
              placeholder="e.g. Workout slot expired, student departed"
            />
          </form>
        )}
      </Modal>
    </div>
  );
};

