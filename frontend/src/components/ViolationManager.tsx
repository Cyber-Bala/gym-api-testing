import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  Zap,
  Bot,
  Ban,
  Unlock,
} from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
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
  const toast = useToast();
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
      const data = await api.get<FlaggedStudent[]>('/api/v1/violations/flagged');
      if (Array.isArray(data)) {
        setFlagged(data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Failed to Load Flagged Students');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlagged();
  }, []);

  const handleForgive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgivingViolation || !forgiveReason.trim()) return;

    setSubmitting(true);
    try {
      await api.post('/api/v1/violations/forgive', {
        violationId: forgivingViolation.id,
        reason: forgiveReason.trim(),
      });

      toast.success('Violation forgiven and strike point deducted.');
      setForgivingViolation(null);
      setForgiveReason('');
      fetchFlagged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Forgiveness Error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualBan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banningStudent || !banReason.trim()) return;

    setSubmitting(true);
    try {
      await api.post('/api/v1/violations/ban', {
        studentId: banningStudent.studentId,
        banDurationDays: banDuration,
        reason: banReason.trim(),
      });

      toast.success(`Student suspended from gym access for ${banDuration} days.`);
      setBanningStudent(null);
      setBanReason('');
      fetchFlagged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Suspension Error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualUnban = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unbanningStudent || !unbanReason.trim()) return;

    setSubmitting(true);
    try {
      await api.post('/api/v1/violations/unban', {
        studentId: unbanningStudent.studentId,
        reason: unbanReason.trim(),
        resetStrikes: resetStrikesOnUnban,
      });

      toast.success('Student gym booking privileges restored.');
      setUnbanningStudent(null);
      setUnbanReason('');
      fetchFlagged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Reinstatement Error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunAutoUnban = async () => {
    try {
      const data = await api.post<{ unbannedCount: number }>('/api/v1/violations/auto-unban-check', {});
      const msg = `Auto-unban sweep completed: ${data.unbannedCount} student(s) reinstated.`;
      setNotification(msg);
      toast.info(msg, 'Auto-Unban Sweep Complete');
      fetchFlagged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Auto-Unban Sweep Failed');
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
            <p className="text-xs text-secondary mt-0.5 flex items-center gap-2 flex-wrap">
              <span>3-Strike Automated 3-Day Suspension Engine • Administrative Forgiveness</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success bg-success-muted px-2 py-0.5 rounded-md border border-success/30">
                <Bot className="w-3 h-3" /> Auto-Restore Active (Every 10m)
              </span>
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
              <span>Run Auto-Unban Sweep</span>
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
            description="Zero active strike violations or bans. The gym community is adhering cleanly to attendance and notice policies."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {flagged.map((s) => (
              <div
                key={s.studentId}
                className={cn(
                  'p-5 rounded-2xl border bg-surface flex flex-col justify-between space-y-4 shadow-sm transition-colors',
                  s.isBanned
                    ? 'border-danger/40 bg-danger-muted/10'
                    : s.violationCount >= 2
                    ? 'border-warning/40 bg-warning-muted/10'
                    : 'border-border'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-base text-text">{s.name}</h4>
                      {s.isBanned ? (
                        <Badge tone="danger">BANNED ({s.violationCount}/3 STRIKES)</Badge>
                      ) : (
                        <Badge tone={s.violationCount >= 2 ? 'warning' : 'neutral'}>
                          {s.violationCount}/3 ACTIVE STRIKES
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-muted font-mono mt-0.5">
                      {s.rollNumber} • {s.department}
                    </p>
                    <p className="text-xs text-secondary font-mono">{s.email}</p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {s.isBanned ? (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => setUnbanningStudent(s)}
                        className="border-success/40 text-success hover:bg-success-muted"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Reinstate</span>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => setBanningStudent(s)}
                        className="border-danger/40 text-danger hover:bg-danger-muted"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Ban</span>
                      </Button>
                    )}
                  </div>
                </div>

                {s.isBanned && s.banExpiresAt && (
                  <div className="p-3 rounded-xl border border-danger/20 bg-danger-muted/30 text-xs text-danger flex items-center justify-between">
                    <span>Active Suspension Lock</span>
                    <span className="font-mono font-bold">
                      Expires: {new Date(s.banExpiresAt).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {/* Strikes List */}
                <div className="space-y-2 border-t border-border pt-3">
                  <p className="text-[11px] font-bold text-muted uppercase tracking-wider">
                    Violation History ({s.violations.length})
                  </p>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {s.violations.map((v) => (
                      <div
                        key={v.id}
                        className="p-2.5 rounded-xl border border-border bg-border-subtle/40 flex items-center justify-between text-xs gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold capitalize text-text">
                              {v.violationType.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[10px] text-muted font-mono">
                              {new Date(v.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          {v.description && (
                            <p className="text-[11px] text-secondary truncate mt-0.5">
                              {v.description}
                            </p>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setForgivingViolation(v)}
                          className="text-primary hover:bg-primary-muted shrink-0 text-[11px]"
                        >
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

      {/* Forgive Violation Modal */}
      {forgivingViolation && (
        <Modal
          open={Boolean(forgivingViolation)}
          onClose={() => setForgivingViolation(null)}
          title="Forgive Strike Violation"
        >
          <form onSubmit={handleForgive} className="space-y-4 text-xs">
            <p className="text-secondary leading-relaxed">
              Forgiving this violation will remove 1 strike from the student’s record and restore good standing if below 3 strikes.
            </p>

            <Input
              label="Administrative Justification Reason"
              required
              placeholder="e.g. Valid medical leave certificate presented to HOD."
              value={forgiveReason}
              onChange={(e) => setForgiveReason(e.target.value)}
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setForgivingViolation(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                loading={submitting}
              >
                Confirm Forgiveness
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Manual Ban Modal */}
      {banningStudent && (
        <Modal
          open={Boolean(banningStudent)}
          onClose={() => setBanningStudent(null)}
          title={`Manual Suspension — ${banningStudent.name}`}
        >
          <form onSubmit={handleManualBan} className="space-y-4 text-xs">
            <p className="text-secondary leading-relaxed">
              Manually place a temporary lock on this student’s gym booking permissions and biometric turnstile entry.
            </p>

            <Input
              label="Suspension Duration (Days)"
              type="number"
              min={1}
              max={30}
              required
              value={banDuration}
              onChange={(e) => setBanDuration(parseInt(e.target.value, 10))}
            />

            <Textarea
              label="Disciplinary Reason"
              required
              placeholder="e.g. Failure to comply with gym floor dress code and trainer instructions."
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBanningStudent(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                type="submit"
                loading={submitting}
              >
                Issue Disciplinary Suspension
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Manual Unban Modal */}
      {unbanningStudent && (
        <Modal
          open={Boolean(unbanningStudent)}
          onClose={() => setUnbanningStudent(null)}
          title={`Reinstate Student Access — ${unbanningStudent.name}`}
        >
          <form onSubmit={handleManualUnban} className="space-y-4 text-xs">
            <p className="text-secondary leading-relaxed">
              Lifting this suspension will immediately restore slot booking and turnstile access for this student.
            </p>

            <Input
              label="Reinstatement Justification"
              required
              placeholder="e.g. Apology letter received and suspension period completed."
              value={unbanReason}
              onChange={(e) => setUnbanReason(e.target.value)}
            />

            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={resetStrikesOnUnban}
                onChange={(e) => setResetStrikesOnUnban(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-secondary font-medium">Reset active strike count to 0 upon unban</span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUnbanningStudent(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                loading={submitting}
              >
                Confirm Reinstatement
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
