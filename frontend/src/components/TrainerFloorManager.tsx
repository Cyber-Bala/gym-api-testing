import React, { useState, useEffect } from 'react';
import {
  Users,
  AlertTriangle,
  LogOut,
  RefreshCw,
  Clock,
  CheckCircle2,
  HeartPulse,
  X,
  Zap,
} from 'lucide-react';

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
      <div className="bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 lg:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-rec-purple dark:text-rec-gold" />
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                Live Gym Floor & Overstayer Management
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Current Floor Supervision • Automated Overstayer Detection (&gt;15m post-slot) • Manual Floor Checkout
            </p>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
            title="Refresh floor status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
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

        {/* Quick KPI Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800">
            <span className="text-[11px] text-gray-500">Current Occupancy</span>
            <h4 className="font-bold text-xl text-gray-900 dark:text-white mt-1">
              {status?.totalInsideCount || 0} / 100 max
            </h4>
          </div>

          <div
            className={`p-4 rounded-2xl border ${
              (status?.overstayerCount || 0) > 0
                ? 'bg-red-50/40 dark:bg-red-950/20 border-red-200 dark:border-red-800/50 text-red-900 dark:text-red-200'
                : 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
            }`}
          >
            <span className="text-[11px] font-semibold">Overstaying Occupants</span>
            <h4 className="font-bold text-xl mt-1 flex items-center gap-2">
              <span>{status?.overstayerCount || 0}</span>
              {(status?.overstayerCount || 0) > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-600 text-white font-normal animate-pulse">
                  Action Required
                </span>
              )}
            </h4>
          </div>

          <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800">
            <span className="text-[11px] text-gray-500">Floor Status</span>
            <h4 className="font-bold text-base text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1.5">
              <Zap className="w-4 h-4" />
              <span>Supervised & Active</span>
            </h4>
          </div>
        </div>

        {/* Overstayers Alert Section */}
        {status && status.overstayers.length > 0 && (
          <div className="p-5 rounded-2xl bg-red-50/50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/60 space-y-3">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h4 className="font-bold text-sm">
                Overstayer Alert ({status.overstayers.length} Occupant(s) exceeded slot limit)
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {status.overstayers.map((o) => (
                <div
                  key={o.sessionId}
                  className="p-4 rounded-xl bg-white dark:bg-[#18181B] border border-red-200 dark:border-red-800/80 flex items-center justify-between shadow-sm"
                >
                  <div className="space-y-0.5">
                    <h5 className="font-bold text-sm text-gray-900 dark:text-white">{o.name}</h5>
                    <p className="text-xs text-gray-500 font-mono">
                      Roll: {o.rollNumber} • {o.department}
                    </p>
                    <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold">
                      Inside for {o.minutesElapsed} mins ({o.overdueMinutes} mins overdue)
                    </p>
                  </div>

                  <button
                    onClick={() => setCheckoutOccupant(o)}
                    className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Checkout</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Occupants List */}
        <div className="space-y-3 pt-2">
          <h4 className="font-bold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            All Current Floor Occupants ({status?.occupants.length || 0})
          </h4>

          {status && status.occupants.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {status.occupants.map((occ) => (
                <div
                  key={occ.sessionId}
                  className="p-4 rounded-2xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h5 className="font-bold text-sm text-gray-900 dark:text-white">{occ.name}</h5>
                      <span className="text-[10px] uppercase font-bold text-gray-400">
                        {occ.role} {occ.rollNumber ? `• ${occ.rollNumber}` : ''}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        occ.isOverstayer
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                      }`}
                    >
                      {occ.isOverstayer ? 'Overstay' : 'Valid'}
                    </span>
                  </div>

                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span>Inside for {occ.minutesElapsed} minutes</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-gray-50 dark:bg-[#202024] border border-dashed border-gray-200 dark:border-gray-800 text-center text-xs text-gray-500">
              No occupants currently on the gym floor.
            </div>
          )}
        </div>
      </div>

      {/* Faculty / Staff Wellness Summary */}
      <div className="bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 lg:p-8 space-y-4">
        <div className="flex items-center gap-2">
          <HeartPulse className="w-5 h-5 text-rec-purple dark:text-rec-gold" />
          <div>
            <h3 className="font-bold text-base text-gray-900 dark:text-white">
              Institutional Faculty & Staff Wellness Hours
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Monthly gym workout hours logged by college professors, administrators, and staff.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50 dark:bg-[#202024] text-gray-500">
              <tr>
                <th className="p-3.5 rounded-l-xl">Staff Member</th>
                <th className="p-3.5">Employee ID</th>
                <th className="p-3.5">Department</th>
                <th className="p-3.5">Designation</th>
                <th className="p-3.5">Workouts (Month)</th>
                <th className="p-3.5 rounded-r-xl">Total Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {staffWellness.map((s) => (
                <tr key={s.staffId}>
                  <td className="p-3.5 font-bold text-gray-900 dark:text-white">{s.name}</td>
                  <td className="p-3.5 font-mono text-gray-500">{s.staffEmpId}</td>
                  <td className="p-3.5">{s.department}</td>
                  <td className="p-3.5 text-gray-500">{s.designation}</td>
                  <td className="p-3.5 font-semibold text-emerald-600 dark:text-emerald-400">
                    {s.totalWorkoutsThisMonth} sessions
                  </td>
                  <td className="p-3.5 font-bold text-gray-900 dark:text-white">{s.totalHoursThisMonth} hrs</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Checkout Modal */}
      {checkoutOccupant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                Floor Checkout: {checkoutOccupant.name}
              </h4>
              <button onClick={() => setCheckoutOccupant(null)} className="p-1 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualCheckout} className="space-y-3 text-xs">
              <p className="text-gray-600 dark:text-gray-300">
                Manually checkout this student from the gym floor and close their active session.
              </p>

              <div>
                <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Reason for Manual Checkout
                </label>
                <textarea
                  required
                  rows={2}
                  value={checkoutReason}
                  onChange={(e) => setCheckoutReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-200 dark:border-gray-700 text-xs focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCheckoutOccupant(null)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Checking out...' : 'Confirm Checkout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
