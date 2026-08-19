import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Calendar,
  RefreshCw,
  Plus,
  X,
  CheckCircle2,
  FileText,
} from 'lucide-react';

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
      const [anRes, clRes, auRes] = await Promise.all([
        fetch('/api/v1/admin/analytics', { credentials: 'include' }),
        fetch('/api/v1/admin/calendar', { credentials: 'include' }),
        fetch('/api/v1/admin/audit-logs', { credentials: 'include' }),
      ]);

      const [anData, clData, auData] = await Promise.all([
        anRes.json(),
        clRes.json(),
        auRes.json(),
      ]);

      if (anRes.ok && anData.success) setAnalytics(anData.data);
      if (clRes.ok && clData.success) setClosures(clData.data || []);
      if (auRes.ok && auData.success) setAuditLogs(auData.data || []);
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
      const res = await fetch('/api/v1/admin/calendar/closure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          closureDate,
          reason: closureReason,
        }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to schedule closure');

      setSuccessMsg(data.message || 'Closure scheduled and affected bookings cancelled');
      setShowClosureModal(false);
      setClosureDate('');
      setClosureReason('');
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-rec-purple dark:text-rec-gold" />
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                Institutional Executive Dashboard & Analytics
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Live Facility KPIs • Operational Calendar • Automated Emergency Closure Cascade
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowClosureModal(true)}
              className="px-3 py-1.5 rounded-xl bg-rec-purple hover:bg-rec-purple-600 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-rec-purple/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule Emergency Closure</span>
            </button>

            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
              title="Refresh analytics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Analytics KPI Metric Cards */}
        {analytics && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800 space-y-1">
              <span className="text-[11px] text-gray-500 font-medium">Total Registered Students</span>
              <h4 className="text-2xl font-black text-gray-900 dark:text-white">
                {analytics.totalRegisteredStudents}
              </h4>
              <p className="text-[11px] text-gray-400">
                {analytics.totalHostellers} Hostellers • {analytics.totalDayScholars} Day Scholars
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800 space-y-1">
              <span className="text-[11px] text-gray-500 font-medium">Today's Check-Ins</span>
              <h4 className="text-2xl font-black text-gray-900 dark:text-white">
                {analytics.todayTotalCheckIns}
              </h4>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                {analytics.currentLiveOccupants} Currently inside gym
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800 space-y-1">
              <span className="text-[11px] text-gray-500 font-medium">Active Day Scholar Passes</span>
              <h4 className="text-2xl font-black text-gray-900 dark:text-white">
                {analytics.activeMembershipsCount}
              </h4>
              <p className="text-[11px] text-gray-400">
                ₹{analytics.totalMonthlyRevenue} monthly revenue
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800 space-y-1">
              <span className="text-[11px] text-gray-500 font-medium">Violations This Month</span>
              <h4 className="text-2xl font-black text-gray-900 dark:text-white">
                {analytics.totalViolationsThisMonth}
              </h4>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                Late cancellations & No-shows
              </p>
            </div>
          </div>
        )}

        {/* Peak Hours Breakdown */}
        {analytics && (
          <div className="space-y-3 pt-2">
            <h4 className="font-bold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              Peak Slot Utilization
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {analytics.peakHours.map((ph) => (
                <div
                  key={ph.hour}
                  className="p-3 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800 text-center space-y-1"
                >
                  <span className="text-[10px] text-gray-400 font-mono block truncate">{ph.hour}</span>
                  <p className="font-bold text-sm text-gray-900 dark:text-white">{ph.count}</p>
                  <span className="text-[9px] text-emerald-600 font-semibold">avg attendees</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Gym Operational Calendar Blackouts */}
      <div className="bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 lg:p-8 space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-rec-purple dark:text-rec-gold" />
          <div>
            <h3 className="font-bold text-base text-gray-900 dark:text-white">
              Gym Operational Calendar & Blackout Closures
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              When a blackout is scheduled, all slots on that date are closed and active bookings are automatically cancelled with notice.
            </p>
          </div>
        </div>

        {closures.length === 0 ? (
          <div className="p-6 rounded-2xl bg-gray-50 dark:bg-[#202024] border border-dashed border-gray-200 dark:border-gray-800 text-center text-xs text-gray-500">
            No scheduled emergency closures or blackout dates.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {closures.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-2xl bg-amber-50/30 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold font-mono text-sm text-gray-900 dark:text-white">
                    {c.closureDate}
                  </span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200">
                    Closed
                  </span>
                </div>
                <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">{c.reason}</p>
                <p className="text-[11px] text-gray-500">
                  {c.cancelledBookingsCount} bookings automatically cancelled with refund notice
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* System Audit Log Explorer */}
      <div className="bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 lg:p-8 space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-rec-purple dark:text-rec-gold" />
          <div>
            <h3 className="font-bold text-base text-gray-900 dark:text-white">
              Institutional Audit Trail Explorer
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Immutable audit log of administrative actions, capacity overrides, emergency closures, and ban operations.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 dark:bg-[#202024] text-gray-500 sticky top-0">
              <tr>
                <th className="p-3 rounded-l-xl">Timestamp</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Action</th>
                <th className="p-3">Entity</th>
                <th className="p-3 rounded-r-xl">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {auditLogs.map((l) => (
                <tr key={l.id}>
                  <td className="p-3 font-mono text-gray-400 whitespace-nowrap">
                    {new Date(l.createdAt).toLocaleDateString()} {new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="p-3 font-medium text-gray-900 dark:text-white">{l.actorEmail || 'System Worker'}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 font-mono text-[10px]">
                      {l.action}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-gray-500">{l.entity}</td>
                  <td className="p-3 text-gray-600 dark:text-gray-300 max-w-xs truncate">{l.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Closure Modal */}
      {showClosureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Schedule Emergency Blackout Closure
              </h4>
              <button onClick={() => setShowClosureModal(false)} className="p-1 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateClosure} className="space-y-3 text-xs">
              <p className="text-gray-600 dark:text-gray-300">
                Scheduling a closure will close all 10 slots on the selected date and automatically cancel any existing student reservations with institutional notification.
              </p>

              <div>
                <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Closure Date (YYYY-MM-DD)
                </label>
                <input
                  type="date"
                  required
                  value={closureDate}
                  onChange={(e) => setClosureDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-200 dark:border-gray-700 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Reason for Closure
                </label>
                <textarea
                  required
                  rows={2}
                  value={closureReason}
                  onChange={(e) => setClosureReason(e.target.value)}
                  placeholder="e.g. Annual Gym Flooring Refurbishment & Deep Sanitization"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-200 dark:border-gray-700 text-xs focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowClosureModal(false)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-xl bg-rec-purple hover:bg-rec-purple-600 text-white font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Executing Closure...' : 'Confirm Closure & Cascade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
