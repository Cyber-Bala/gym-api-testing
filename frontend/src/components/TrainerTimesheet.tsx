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
import { Card, Alert, Stat } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { cn } from '../lib/cn';

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
        <Card className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-base sm:text-lg text-text">
                  Student-Trainer Work Shifts & Payroll
                </h3>
              </div>
              <p className="text-xs text-secondary mt-0.5">
                Stipend Rate: ₹{profile?.hourlyRate || '200.00'}/hour • Track work shifts & earn monthly stipend
              </p>
            </div>

            <IconButton
              label="Refresh timesheet"
              size="sm"
              onClick={fetchData}
              disabled={loading}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            </IconButton>
          </div>

          {successMsg && (
            <Alert tone="success" onDismiss={() => setSuccessMsg(null)}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                <span>{successMsg}</span>
              </div>
            </Alert>
          )}

          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat
              label="Hourly Stipend Rate"
              value={`₹${profile?.hourlyRate || '200.00'}`}
              hint="/ hour rate"
              icon={<DollarSign className="w-4 h-4 text-primary" />}
            />
            <Stat
              label="Hours Worked This Month"
              value={`${profile?.totalHoursThisMonth || 0} hrs`}
              hint="Approved gym shifts"
              icon={<Award className="w-4 h-4 text-accent" />}
            />
            <Stat
              label="Total Stipend Earned"
              value={`₹${profile?.totalEarningsThisMonth || 0}`}
              hint="Current monthly cycle"
              className="border-success/30 bg-success-muted/20"
              icon={<DollarSign className="w-4 h-4 text-success" />}
            />
          </div>

          {/* Live Shift Control Card */}
          <div className="p-5 rounded-2xl border border-primary/30 bg-primary-muted/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-3.5 h-3.5 rounded-full',
                profile?.activeShift ? 'bg-success animate-ping' : 'bg-muted'
              )} />
              <div>
                <h4 className="font-bold text-sm text-text">
                  {profile?.activeShift ? 'Work Shift In Progress' : 'Currently Clocked Out'}
                </h4>
                <p className="text-xs text-secondary">
                  {profile?.activeShift
                    ? `Clocked in at ${new Date(profile.activeShift.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Clock in before supervising students on gym floor'}
                </p>
              </div>
            </div>

            <div>
              {profile?.activeShift ? (
                <Button
                  variant="danger"
                  size="md"
                  loading={clocking}
                  onClick={handleClockOut}
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Clock Out Shift</span>
                </Button>
              ) : (
                <Button
                  variant="success"
                  size="md"
                  loading={clocking}
                  onClick={handleClockIn}
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Clock In Now</span>
                </Button>
              )}
            </div>
          </div>

          {/* Recent Shifts Table */}
          {profile && profile.shifts.length > 0 && (
            <div className="space-y-3 pt-2">
              <h4 className="font-bold text-xs text-muted uppercase tracking-wider">
                Recent Shift History
              </h4>

              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-xs text-left">
                  <thead className="bg-border-subtle/50 text-muted font-semibold">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Clock In</th>
                      <th className="p-3">Clock Out</th>
                      <th className="p-3">Duration</th>
                      <th className="p-3">Earned Stipend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-text">
                    {profile.shifts.map((s) => (
                      <tr key={s.id} className="hover:bg-border-subtle/30 transition-colors">
                        <td className="p-3 font-mono">{new Date(s.clockIn).toLocaleDateString()}</td>
                        <td className="p-3 font-mono">{new Date(s.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="p-3 font-mono text-muted">{s.clockOut ? new Date(s.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'In Progress'}</td>
                        <td className="p-3">{s.durationMinutes} min</td>
                        <td className="p-3 font-bold text-success">
                          ₹{s.calculatedStipend}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Admin Trainer Payroll Ledger View */}
      {isAdmin && (
        <Card className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-success" />
                <h3 className="font-bold text-base sm:text-lg text-text">
                  Trainer Payroll & Monthly Ledger
                </h3>
              </div>
              <p className="text-xs text-secondary mt-0.5">
                Automated Stipend Calculation • Monthly College Accounts Disbursal Report
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => alert('Exporting monthly payroll ledger report...')}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Payroll (.xlsx)</span>
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs text-left">
              <thead className="bg-border-subtle/50 text-muted font-semibold">
                <tr>
                  <th className="p-3.5">Trainer Name</th>
                  <th className="p-3.5">Email</th>
                  <th className="p-3.5">Hourly Rate</th>
                  <th className="p-3.5">Completed Shifts</th>
                  <th className="p-3.5">Total Hours</th>
                  <th className="p-3.5">Total Stipend Owed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-text">
                {payroll.map((p) => (
                  <tr key={p.trainerId} className="hover:bg-border-subtle/30 transition-colors">
                    <td className="p-3.5 font-bold text-text">{p.name}</td>
                    <td className="p-3.5 font-mono text-muted">{p.email}</td>
                    <td className="p-3.5 font-mono">₹{p.hourlyRate}/hr</td>
                    <td className="p-3.5">{p.totalShifts} shifts</td>
                    <td className="p-3.5 font-semibold text-secondary">{p.totalHours} hrs</td>
                    <td className="p-3.5 font-bold text-success text-sm">
                      ₹{p.totalStipend}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

