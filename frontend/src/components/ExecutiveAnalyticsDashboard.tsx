import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Calendar,
  RefreshCw,
  Plus,
  CheckCircle2,
  FileText,
  Users,
  CreditCard,
  Clock,
} from 'lucide-react';
import { Card, Badge, Modal, Alert, Stat, EmptyState } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/cn';

interface ExecutiveAnalytics {
  totalRegisteredStudents: number;
  totalHostellers: number;
  totalDayScholars: number;
  activeMembershipsCount: number;
  todayTotalCheckIns: number;
  currentLiveOccupants: number;
  totalMonthlyRevenue: number;
  totalViolationsThisMonth: number;
  peakHours: { hour: string; count: number }[];
}

interface GymClosure {
  id: string;
  closureDate: string;
  reason: string;
  cancelledBookingsCount: number;
  createdAt: string;
}

interface AuditLog {
  id: string;
  actorEmail?: string;
  action: string;
  entity: string;
  entityId: string;
  reason: string;
  createdAt: string;
}

export const ExecutiveAnalyticsDashboard: React.FC = () => {
  const toast = useToast();
  const [analytics, setAnalytics] = useState<ExecutiveAnalytics | null>(null);
  const [closures, setClosures] = useState<GymClosure[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // New Closure Modal
  const [showClosureModal, setShowClosureModal] = useState<boolean>(false);
  const [closureDate, setClosureDate] = useState<string>('');
  const [closureReason, setClosureReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [anData, clData, auData] = await Promise.all([
        api.get<ExecutiveAnalytics>('/api/v1/admin/analytics'),
        api.get<GymClosure[]>('/api/v1/admin/calendar'),
        api.get<AuditLog[]>('/api/v1/admin/audit-logs'),
      ]);

      if (anData) setAnalytics(anData);
      if (Array.isArray(clData)) setClosures(clData);
      if (Array.isArray(auData)) setAuditLogs(auData);
    } catch {
      // background error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateClosure = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = await api.post<{ message?: string }>('/api/v1/admin/calendar/closure', {
        closureDate,
        reason: closureReason,
      });

      const msg = data.message || 'Closure scheduled and affected bookings cancelled';
      setSuccessMsg(msg);
      toast.success(msg);
      setShowClosureModal(false);
      setClosureDate('');
      setClosureReason('');
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Failed to Schedule Closure');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <Card className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-base sm:text-lg text-text">
                Institutional Executive Dashboard & Analytics
              </h3>
            </div>
            <p className="text-xs text-secondary mt-0.5">
              Live Facility KPIs • Operational Calendar • Automated Emergency Closure Cascade
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowClosureModal(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule Emergency Closure</span>
            </Button>

            <IconButton
              label="Refresh analytics"
              size="sm"
              onClick={fetchData}
              disabled={loading}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            </IconButton>
          </div>
        </div>

        {successMsg && (
          <Alert tone="success" onDismiss={() => setSuccessMsg(null)}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              <span>{successMsg}</span>
            </div>
          </Alert>
        )}

        {/* Analytics KPI Metric Cards */}
        {analytics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat
              label="Total Registered Students"
              value={analytics.totalRegisteredStudents}
              hint={`${analytics.totalHostellers} Hostellers • ${analytics.totalDayScholars} Day Scholars`}
              icon={<Users className="w-4 h-4 text-primary" />}
            />
            <Stat
              label="Today's Check-Ins"
              value={analytics.todayTotalCheckIns}
              hint={<span className="text-success font-medium">{analytics.currentLiveOccupants} Currently inside gym</span>}
              icon={<Clock className="w-4 h-4 text-accent" />}
            />
            <Stat
              label="Active Day Scholar Passes"
              value={analytics.activeMembershipsCount}
              hint={`₹${analytics.totalMonthlyRevenue} monthly revenue`}
              icon={<CreditCard className="w-4 h-4 text-success" />}
            />
            <Stat
              label="Violations This Month"
              value={analytics.totalViolationsThisMonth}
              hint={<span className="text-warning font-medium">Late cancellations & No-shows</span>}
              icon={<AlertTriangle className="w-4 h-4 text-warning" />}
            />
          </div>
        )}

        {/* Peak Hours Breakdown */}
        {analytics && (
          <div className="space-y-3 pt-2">
            <h4 className="font-bold text-xs text-muted uppercase tracking-wider">
              Peak Slot Utilization
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {analytics.peakHours.map((ph) => (
                <div
                  key={ph.hour}
                  className="p-3 rounded-xl border border-border bg-border-subtle/30 text-center space-y-1"
                >
                  <span className="text-[10px] text-muted font-mono block truncate">{ph.hour}</span>
                  <p className="font-bold text-sm text-text">{ph.count}</p>
                  <span className="text-[9px] text-success font-semibold">avg attendees</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Gym Operational Calendar Blackouts */}
      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-bold text-base text-text">
              Gym Operational Calendar & Blackout Closures
            </h3>
            <p className="text-xs text-secondary">
              When a blackout is scheduled, all slots on that date are closed and active bookings are automatically cancelled with notice.
            </p>
          </div>
        </div>

        {closures.length === 0 ? (
          <EmptyState
            icon={<Calendar className="w-6 h-6" />}
            title="No Scheduled Closures"
            description="No upcoming emergency closures or institutional blackout dates scheduled."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {closures.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-2xl border border-warning/30 bg-warning-muted/20 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold font-mono text-sm text-text">
                    {c.closureDate}
                  </span>
                  <Badge tone="warning">Closed</Badge>
                </div>
                <p className="text-xs text-text font-medium">{c.reason}</p>
                <p className="text-[11px] text-muted">
                  {c.cancelledBookingsCount} bookings automatically cancelled with refund notice
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* System Audit Log Explorer */}
      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-bold text-base text-text">
              Institutional Audit Trail Explorer
            </h3>
            <p className="text-xs text-secondary">
              Immutable audit log of administrative actions, capacity overrides, emergency closures, and ban operations.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-xl border border-border">
          <table className="w-full text-xs text-left">
            <thead className="bg-border-subtle/60 text-muted font-semibold sticky top-0">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Action</th>
                <th className="p-3">Entity</th>
                <th className="p-3">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-text">
              {auditLogs.map((l) => (
                <tr key={l.id} className="hover:bg-border-subtle/30 transition-colors">
                  <td className="p-3 font-mono text-muted whitespace-nowrap">
                    {new Date(l.createdAt).toLocaleDateString()} {new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="p-3 font-medium text-text">{l.actorEmail || 'System Worker'}</td>
                  <td className="p-3">
                    <Badge tone="neutral">{l.action}</Badge>
                  </td>
                  <td className="p-3 font-mono text-secondary">{l.entity}</td>
                  <td className="p-3 text-muted max-w-xs truncate">{l.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Schedule Closure Modal */}
      <Modal
        open={showClosureModal}
        title="Schedule Emergency Blackout Closure"
        onClose={() => setShowClosureModal(false)}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setShowClosureModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={submitting}
              onClick={handleCreateClosure}
            >
              Confirm Closure & Cascade
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateClosure} className="space-y-4 text-xs">
          <p className="text-secondary">
            Scheduling a closure will close all 10 slots on the selected date and automatically cancel any existing student reservations with institutional notification.
          </p>

          <Input
            label="Closure Date (YYYY-MM-DD)"
            type="date"
            required
            value={closureDate}
            onChange={(e) => setClosureDate(e.target.value)}
          />

          <Textarea
            label="Reason for Closure"
            required
            rows={2}
            value={closureReason}
            onChange={(e) => setClosureReason(e.target.value)}
            placeholder="e.g. Annual Gym Flooring Refurbishment & Deep Sanitization"
          />
        </form>
      </Modal>
    </div>
  );
};

