import React, { useState, useEffect } from 'react';
import {
  AlertOctagon,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  Zap,
  Sparkles,
  Ban,
  Unlock,
} from 'lucide-react';
import { Card, Badge, Modal, Alert, EmptyState } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { cn } from '../lib/cn';

interface ViolationDto {
  id: string;
  studentId: string;
  bookingId?: string;
  violationType: string;
  description?: string;
  createdAt: string;
}

interface FlaggedStudent {
  studentId: string;
  personId: string;
  rollNumber: string;
  name: string;
  email: string;
  department: string;
  violationCount: number;
  isBanned: boolean;
  banExpiresAt?: string;
  violations: ViolationDto[];
}

export const ViolationManager: React.FC = () => {
  const [flagged, setFlagged] = useState<FlaggedStudent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [forgivingViolation, setForgivingViolation] = useState<ViolationDto | null>(null);
  const [forgiveReason, setForgiveReason] = useState<string>('');
  const [banningStudent, setBanningStudent] = useState<FlaggedStudent | null>(null);
  const [banDuration, setBanDuration] = useState<number>(3);
  const [banReason, setBanReason] = useState<string>('');
  const [unbanningStudent, setUnbanningStudent] = useState<FlaggedStudent | null>(null);
  const [unbanReason, setUnbanReason] = useState<string>('');
  const [resetStrikesOnUnban, setResetStrikesOnUnban] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  const fetchFlagged = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/violations/flagged', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        setFlagged(data.data || []);
      }
    } catch {
      // background error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlagged();
  }, []);

  const handleForgive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgivingViolation) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/violations/forgive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          violationId: forgivingViolation.id,
          reason: forgiveReason,
        }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to forgive strike');

      setNotification('Strike successfully forgiven and removed.');
      setForgivingViolation(null);
      setForgiveReason('');
      fetchFlagged();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualBan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banningStudent) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/violations/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: banningStudent.studentId,
          banDurationDays: banDuration,
          reason: banReason,
        }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to suspend student');

      setNotification(`Student suspended for ${banDuration} days.`);
      setBanningStudent(null);
      setBanReason('');
      fetchFlagged();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualUnban = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unbanningStudent) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/violations/unban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: unbanningStudent.studentId,
          reason: unbanReason,
          resetStrikes: resetStrikesOnUnban,
        }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to reinstate student');

      setNotification('Student gym booking privileges restored.');
      setUnbanningStudent(null);
      setUnbanReason('');
      fetchFlagged();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunAutoUnban = async () => {
    try {
      const res = await fetch('/api/v1/violations/auto-unban-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setNotification(`Auto-unban worker ran: ${data.data.unbannedCount} student(s) reinstated.`);
        fetchFlagged();
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-danger" />
              <h3 className="font-bold text-base sm:text-lg text-text">
                Unified Violation & 3-Strike Ban Manager
              </h3>
            </div>
            <p className="text-xs text-secondary mt-0.5">
              3-Strike Automated 3-Day Suspension Engine • Administrative Forgiveness & Audit Logging
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRunAutoUnban}
              className="border-success/30 text-success hover:bg-success-muted"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Run Auto-Unban Worker</span>
            </Button>

            <IconButton
              label="Refresh violations"
              size="sm"
              onClick={fetchFlagged}
              disabled={loading}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            </IconButton>
          </div>
        </div>

        {notification && (
          <Alert tone="success" onDismiss={() => setNotification(null)}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              <span>{notification}</span>
            </div>
          </Alert>
        )}

        {/* Flagged Students List */}
        {flagged.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="w-8 h-8 text-success" />}
            title="All Students in Good Standing"
            description="Zero active strike violations or bans. The gym community is adhering cleanly to attendance and 2-hour notice policies."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {flagged.map((st) => (
              <div
                key={st.studentId}
                className={cn(
                  'p-5 rounded-2xl border bg-surface transition-colors',
                  st.isBanned
                    ? 'border-danger/40 bg-danger-muted/10'
                    : 'border-warning/40 bg-warning-muted/10'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-sm sm:text-base text-text truncate">{st.name}</h4>
                      <Badge tone={st.isBanned ? 'danger' : 'warning'}>
                        {st.isBanned ? 'Suspended (3-Day Ban)' : `${st.violationCount} Active Strike(s)`}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted font-mono mt-0.5 truncate">
                      Roll: {st.rollNumber} • {st.department}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {st.isBanned ? (
                      <Button
                        variant="success"
                        size="xs"
                        onClick={() => setUnbanningStudent(st)}
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Unban</span>
                      </Button>
                    ) : (
                      <Button
                        variant="danger"
                        size="xs"
                        onClick={() => setBanningStudent(st)}
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Ban</span>
                      </Button>
                    )}
                  </div>
                </div>

                {st.isBanned && st.banExpiresAt && (
                  <p className="text-xs text-danger font-semibold mt-2">
                    Suspension active until: {new Date(st.banExpiresAt).toLocaleDateString()} {new Date(st.banExpiresAt).toLocaleTimeString()}
                  </p>
                )}

                {/* Violations List */}
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  <p className="text-xs font-bold text-muted uppercase tracking-wider">
                    Violation History ({st.violations.length})
                  </p>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {st.violations.map((v) => (
                      <div
                        key={v.id}
                        className="p-2.5 rounded-xl bg-surface-elevated border border-border flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <AlertOctagon className="w-3.5 h-3.5 text-danger shrink-0" />
                            <span className="font-semibold capitalize text-text truncate">
                              {v.violationType.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted mt-0.5 truncate">
                            {v.description || 'No description recorded'} • {new Date(v.createdAt).toLocaleDateString()}
                          </p>
                        </div>

                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => setForgivingViolation(v)}
                          className="shrink-0 text-success border-success/30 hover:bg-success-muted"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Forgive</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Forgive Strike Modal */}
      <Modal
        open={Boolean(forgivingViolation)}
        title="Forgive Violation Strike"
        onClose={() => setForgivingViolation(null)}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setForgivingViolation(null)}>
              Cancel
            </Button>
            <Button
              variant="success"
              size="sm"
              loading={submitting}
              onClick={handleForgive}
            >
              Confirm Forgiveness
            </Button>
          </>
        }
      >
        <form onSubmit={handleForgive} className="space-y-4 text-xs">
          <p className="text-secondary">
            Forgiving this strike will decrement the student's violation counter and will be recorded in the audit log.
          </p>

          <Textarea
            label="Reason for Forgiveness"
            required
            rows={2}
            value={forgiveReason}
            onChange={(e) => setForgiveReason(e.target.value)}
            placeholder="e.g. Valid medical emergency certificate provided"
          />
        </form>
      </Modal>

      {/* Manual Ban Modal */}
      <Modal
        open={Boolean(banningStudent)}
        title="Manual Gym Suspension"
        onClose={() => setBanningStudent(null)}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setBanningStudent(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={submitting}
              onClick={handleManualBan}
            >
              Suspend Student
            </Button>
          </>
        }
      >
        <form onSubmit={handleManualBan} className="space-y-4 text-xs">
          <Input
            label="Suspension Duration (Days)"
            type="number"
            min={1}
            max={365}
            required
            value={banDuration}
            onChange={(e) => setBanDuration(parseInt(e.target.value, 10))}
          />

          <Textarea
            label="Audit Suspension Reason"
            required
            rows={2}
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            placeholder="e.g. Disciplinary equipment misuse or safety violation"
          />
        </form>
      </Modal>

      {/* Manual Unban Modal */}
      <Modal
        open={Boolean(unbanningStudent)}
        title="Reinstate Gym Privileges"
        onClose={() => setUnbanningStudent(null)}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setUnbanningStudent(null)}>
              Cancel
            </Button>
            <Button
              variant="success"
              size="sm"
              loading={submitting}
              onClick={handleManualUnban}
            >
              Reinstate Access
            </Button>
          </>
        }
      >
        <form onSubmit={handleManualUnban} className="space-y-4 text-xs">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              id="resetStrikes"
              checked={resetStrikesOnUnban}
              onChange={(e) => setResetStrikesOnUnban(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary w-4 h-4"
            />
            <span className="font-medium text-text">
              Reset strike count to 0 (Clean slate)
            </span>
          </label>

          <Textarea
            label="Reinstatement Audit Reason"
            required
            rows={2}
            value={unbanReason}
            onChange={(e) => setUnbanReason(e.target.value)}
            placeholder="e.g. Disciplinary board cleared suspension"
          />
        </form>
      </Modal>
    </div>
  );
};

