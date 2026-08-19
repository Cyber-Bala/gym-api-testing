import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Play,
  Square,
  RefreshCw,
  Award,
  CheckCircle2,
  Download,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface WorkShift {
  id: string;
  clockIn: string;
  clockOut?: string;
  durationMinutes: number;
  calculatedStipend: number;
  hourlyRate: string;
  isOngoing: boolean;
}

interface TrainerProfile {
  id: string;
  name: string;
  email: string;
  hourlyRate: string;
  activeShift: WorkShift | null;
  totalEarningsThisMonth: number;
  totalHoursThisMonth: number;
  shifts: WorkShift[];
}

interface MonthlyPayrollItem {
  trainerId: string;
  name: string;
  email: string;
  hourlyRate: string;
  totalShifts: number;
  totalHours: number;
  totalStipend: number;
}

export const TrainerTimesheet: React.FC = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<TrainerProfile | null>(null);
  const [payroll, setPayroll] = useState<MonthlyPayrollItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [clocking, setClocking] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isAdmin = user && ['admin', 'super_admin'].includes(user.role);
  const isTrainer = user && user.role === 'trainer';

  const fetchData = async () => {
    setLoading(true);
    try {
      if (isTrainer) {
        const res = await fetch('/api/v1/trainer/profile', { credentials: 'include' });
        const data = await res.json();
        if (res.ok && data.success) {
          setProfile(data.data);
        }
      }

      if (isAdmin) {
        const res = await fetch('/api/v1/trainer/payroll', { credentials: 'include' });
        const data = await res.json();
        if (res.ok && data.success) {
          setPayroll(data.data || []);
        }
      }
    } catch {
      // background error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleClockIn = async () => {
    setClocking(true);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/v1/trainer/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Clock in failed');

      setSuccessMsg('Successfully clocked in! Shift timer is running.');
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setClocking(false);
    }
  };

  const handleClockOut = async () => {
    setClocking(true);
    setSuccessMsg(null);
    try {
      const res = await fetch('/api/v1/trainer/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Clock out failed');

      setSuccessMsg(`Clocked out! Workout shift: ${data.data.durationMinutes} min • Earned: ₹${data.data.calculatedStipend}`);
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setClocking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Trainer Clock-In Widget */}
      {isTrainer && (
        <div className="bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 lg:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-rec-purple dark:text-rec-gold" />
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                  Student-Trainer Work Shifts & Payroll
                </h3>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Stipend Rate: ₹{profile?.hourlyRate || '200.00'}/hour • Track work shifts & earn monthly stipend
              </p>
            </div>

            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
              title="Refresh timesheet"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {successMsg && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800">
              <span className="text-[11px] text-gray-500">Hourly Stipend Rate</span>
              <h4 className="font-bold text-xl text-gray-900 dark:text-white mt-1 flex items-baseline gap-1">
                ₹{profile?.hourlyRate} <span className="text-xs font-normal text-gray-400">/hr</span>
              </h4>
            </div>

            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800">
              <span className="text-[11px] text-gray-500">Hours Worked This Month</span>
              <h4 className="font-bold text-xl text-gray-900 dark:text-white mt-1">
                {profile?.totalHoursThisMonth || 0} hrs
              </h4>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40">
              <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">Total Stipend Earned</span>
              <h4 className="font-bold text-xl text-emerald-900 dark:text-emerald-100 mt-1">
                ₹{profile?.totalEarningsThisMonth || 0}
              </h4>
            </div>
          </div>

          {/* Live Shift Control Card */}
          <div className="p-6 rounded-2xl bg-rec-purple-50/30 dark:bg-rec-purple-950/20 border border-rec-purple-200 dark:border-rec-purple-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-3.5 h-3.5 rounded-full ${profile?.activeShift ? 'bg-emerald-500 animate-ping' : 'bg-gray-400'}`} />
              <div>
                <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                  {profile?.activeShift ? 'Work Shift In Progress' : 'Currently Clocked Out'}
                </h4>
                <p className="text-xs text-gray-500">
                  {profile?.activeShift
                    ? `Clocked in at ${new Date(profile.activeShift.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Clock in before supervising students on gym floor'}
                </p>
              </div>
            </div>

            <div>
              {profile?.activeShift ? (
                <button
                  onClick={handleClockOut}
                  disabled={clocking}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>{clocking ? 'Clocking Out...' : 'Clock Out Shift'}</span>
                </button>
              ) : (
                <button
                  onClick={handleClockIn}
                  disabled={clocking}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-2 shadow-md transition-all disabled:opacity-50"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{clocking ? 'Clocking In...' : 'Clock In Now'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Recent Shifts Table */}
          {profile && profile.shifts.length > 0 && (
            <div className="space-y-3 pt-2">
              <h4 className="font-bold text-xs text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                Recent Shift History
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-50 dark:bg-[#202024] text-gray-500">
                    <tr>
                      <th className="p-3 rounded-l-xl">Date</th>
                      <th className="p-3">Clock In</th>
                      <th className="p-3">Clock Out</th>
                      <th className="p-3">Duration</th>
                      <th className="p-3 rounded-r-xl">Earned Stipend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {profile.shifts.map((s) => (
                      <tr key={s.id}>
                        <td className="p-3 font-mono">{new Date(s.clockIn).toLocaleDateString()}</td>
                        <td className="p-3 font-mono">{new Date(s.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="p-3 font-mono">{s.clockOut ? new Date(s.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'In Progress'}</td>
                        <td className="p-3">{s.durationMinutes} min</td>
                        <td className="p-3 font-semibold text-emerald-600 dark:text-emerald-400">
                          ₹{s.calculatedStipend}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Admin Trainer Payroll Ledger View */}
      {isAdmin && (
        <div className="bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 lg:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                  Trainer Payroll & Monthly Ledger
                </h3>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Automated Stipend Calculation (ADR-016) • Monthly College Accounts Disbursal Report
              </p>
            </div>

            <button
              onClick={() => alert('Exporting monthly payroll ledger report...')}
              className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-xs font-semibold flex items-center gap-1.5 text-gray-700 dark:text-gray-300"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Excel Payroll</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 dark:bg-[#202024] text-gray-500">
                <tr>
                  <th className="p-3.5 rounded-l-xl">Trainer Name</th>
                  <th className="p-3.5">Email</th>
                  <th className="p-3.5">Hourly Rate</th>
                  <th className="p-3.5">Completed Shifts</th>
                  <th className="p-3.5">Total Hours</th>
                  <th className="p-3.5 rounded-r-xl">Total Stipend Owed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {payroll.map((p) => (
                  <tr key={p.trainerId}>
                    <td className="p-3.5 font-bold text-gray-900 dark:text-white">{p.name}</td>
                    <td className="p-3.5 font-mono text-gray-500">{p.email}</td>
                    <td className="p-3.5 font-mono">₹{p.hourlyRate}/hr</td>
                    <td className="p-3.5">{p.totalShifts} shifts</td>
                    <td className="p-3.5 font-semibold">{p.totalHours} hrs</td>
                    <td className="p-3.5 font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      ₹{p.totalStipend}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
