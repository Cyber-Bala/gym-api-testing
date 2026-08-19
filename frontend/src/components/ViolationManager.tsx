import React, { useState, useEffect } from 'react';
import {
  AlertOctagon,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  X,
  CheckCircle2,
  Zap,
  Sparkles,
  Ban,
  Unlock,
} from 'lucide-react';

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
      <div className="bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 lg:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                Unified Violation & 3-Strike Ban Manager
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              3-Strike Automated 3-Day Suspension Engine (ADR-010) • Administrative Forgiveness & Audit Logging
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunAutoUnban}
              className="px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Run Auto-Unban Worker</span>
            </button>

            <button
              onClick={fetchFlagged}
              disabled={loading}
              className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
              title="Refresh violations"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {notification && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{notification}</span>
            </div>
            <button onClick={() => setNotification(null)} className="text-emerald-700 hover:text-emerald-900">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Flagged Students List */}
        {flagged.length === 0 ? (
          <div className="p-10 rounded-2xl bg-gray-50 dark:bg-[#202024] border border-dashed border-gray-200 dark:border-gray-800 text-center space-y-2">
            <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto" />
            <h4 className="font-bold text-sm text-gray-900 dark:text-white">All Students in Good Standing</h4>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Zero active strike violations or bans. The gym community is adhering cleanly to attendance and 2-hour notice policies.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {flagged.map((st) => (
              <div
                key={st.studentId}
                className={`p-5 rounded-2xl border transition-all ${
                  st.isBanned
                    ? 'border-red-300 dark:border-red-900/60 bg-red-50/30 dark:bg-red-950/20'
                    : 'border-amber-300 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/20'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-base text-gray-900 dark:text-white">{st.name}</h4>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                          st.isBanned
                            ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border-red-300'
                            : 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-300'
                        }`}
                      >
                        {st.isBanned ? 'Suspended (3-Day Ban)' : `${st.violationCount} Active Strike(s)`}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">
                      Roll: {st.rollNumber} • {st.department}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {st.isBanned ? (
                      <button
                        onClick={() => setUnbanningStudent(st)}
                        className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 shadow-sm"
                        title="Reinstate Gym Access"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Unban</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setBanningStudent(st)}
                        className="px-2.5 py-1 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1 shadow-sm"
                        title="Manual Suspension"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Ban</span>
                      </button>
                    )}
                  </div>
                </div>

                {st.isBanned && st.banExpiresAt && (
                  <p className="text-xs text-red-700 dark:text-red-300 font-semibold mt-2">
                    Suspension active until: {new Date(st.banExpiresAt).toLocaleDateString()} {new Date(st.banExpiresAt).toLocaleTimeString()}
                  </p>
                )}

                {/* Violations List */}
                <div className="mt-3 pt-3 border-t border-gray-200/60 dark:border-gray-800 space-y-2">
                  <p className="text-[11px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Violation History ({st.violations.length})
                  </p>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {st.violations.map((v) => (
                      <div
                        key={v.id}
                        className="p-2.5 rounded-xl bg-white dark:bg-[#18181B] border border-gray-200 dark:border-gray-700/80 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <AlertOctagon className="w-3.5 h-3.5 text-red-500" />
                            <span className="font-semibold capitalize text-gray-900 dark:text-white">
                              {v.violationType.replace('_', ' ')}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {v.description || 'No description recorded'} • {new Date(v.createdAt).toLocaleDateString()}
                          </p>
                        </div>

                        <button
                          onClick={() => setForgivingViolation(v)}
                          className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[11px] font-semibold flex items-center gap-1 transition-colors"
                          title="Forgive strike"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Forgive</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Forgive Strike Modal */}
      {forgivingViolation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">Forgive Violation Strike</h4>
              <button onClick={() => setForgivingViolation(null)} className="p-1 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleForgive} className="space-y-3 text-xs">
              <p className="text-gray-600 dark:text-gray-300">
                Forgiving this strike will decrement the student's violation counter and will be recorded in the audit log.
              </p>

              <div>
                <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Reason for Forgiveness
                </label>
                <textarea
                  required
                  rows={2}
                  value={forgiveReason}
                  onChange={(e) => setForgiveReason(e.target.value)}
                  placeholder="e.g. Valid medical emergency certificate provided"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-200 dark:border-gray-700 text-xs focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setForgivingViolation(null)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Processing...' : 'Confirm Forgiveness'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Ban Modal */}
      {banningStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h4 className="font-bold text-sm text-red-600">Manual Gym Suspension</h4>
              <button onClick={() => setBanningStudent(null)} className="p-1 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualBan} className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Suspension Duration (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  required
                  value={banDuration}
                  onChange={(e) => setBanDuration(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-200 dark:border-gray-700 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Audit Suspension Reason
                </label>
                <textarea
                  required
                  rows={2}
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="e.g. Disciplinary equipment misuse or safety violation"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-200 dark:border-gray-700 text-xs focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBanningStudent(null)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Suspending...' : 'Suspend Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Unban Modal */}
      {unbanningStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h4 className="font-bold text-sm text-emerald-600">Reinstate Gym Privileges</h4>
              <button onClick={() => setUnbanningStudent(null)} className="p-1 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualUnban} className="space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="resetStrikes"
                  checked={resetStrikesOnUnban}
                  onChange={(e) => setResetStrikesOnUnban(e.target.checked)}
                  className="rounded border-gray-300 text-rec-purple"
                />
                <label htmlFor="resetStrikes" className="font-medium text-gray-700 dark:text-gray-300">
                  Reset strike count to 0 (Clean slate)
                </label>
              </div>

              <div>
                <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Reinstatement Audit Reason
                </label>
                <textarea
                  required
                  rows={2}
                  value={unbanReason}
                  onChange={(e) => setUnbanReason(e.target.value)}
                  placeholder="e.g. Disciplinary board cleared suspension"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-200 dark:border-gray-700 text-xs focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUnbanningStudent(null)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Reinstating...' : 'Reinstate Access'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
