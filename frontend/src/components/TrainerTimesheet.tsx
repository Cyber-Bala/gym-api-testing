import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  RefreshCw,
  Award,
  CheckCircle2,
  Download,
  Activity,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Stat, Badge } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/cn';

interface WorkShift {
  id: string;
  clockIn: string;
  clockOut?: string;
  durationMinutes: number;
  isOngoing: boolean;
}

interface TrainerProfile {
  id: string;
  name: string;
  email: string;
  activeShift: WorkShift | null;
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
  const toast = useToast();
  const [profile, setProfile] = useState<TrainerProfile | null>(null);
  const [payroll, setPayroll] = useState<MonthlyPayrollItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const isAdmin = user && ['admin', 'super_admin'].includes(user.role);
  const isTrainer = user && user.role === 'trainer';

  const fetchData = async () => {
    setLoading(true);
    try {
      if (isTrainer) {
        const data = await api.get<TrainerProfile>('/api/v1/trainer/profile');
        setProfile(data);
      }

      if (isAdmin) {
        const data = await api.get<MonthlyPayrollItem[]>('/api/v1/trainer/payroll');
        if (Array.isArray(data)) {
          setPayroll(data);
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

  return (
    <div className="space-y-6">
      {/* Trainer Timesheet Widget */}
      {isTrainer && (
        <Card className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-base sm:text-lg text-text">
                  Trainer Floor Hours & Timesheet
                </h3>
              </div>
              <p className="text-xs text-secondary mt-0.5">
                Automated biometric turnstile check-in / check-out time tracking
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

          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat
              label="Hours on Floor (This Month)"
              value={`${profile?.totalHoursThisMonth || 0} hrs`}
              hint="Turnstile biometric logs"
              icon={<Award className="w-4 h-4 text-primary" />}
            />
            <Stat
              label="Completed Sessions"
              value={profile?.shifts.filter((s) => !s.isOngoing).length || 0}
              hint="Logged gym shifts"
              icon={<CheckCircle2 className="w-4 h-4 text-success" />}
            />
            <Stat
              label="Current Turnstile Status"
              value={profile?.activeShift ? 'Inside (On Floor)' : 'Outside'}
              hint="Live turnstile session"
              icon={<Activity className={cn('w-4 h-4', profile?.activeShift ? 'text-success' : 'text-muted')} />}
            />
          </div>

          {/* Live Turnstile Status Notice */}
          <div className="p-4 rounded-2xl bg-surface-elevated flex items-center gap-3 shadow-sm">
            <div className={cn(
              'w-3 h-3 rounded-full shrink-0',
              profile?.activeShift ? 'bg-success animate-ping' : 'bg-muted'
            )} />
            <div>
              <h4 className="font-bold text-xs text-text">
                {profile?.activeShift ? 'Active Floor Session in Progress' : 'No Active Session'}
              </h4>
              <p className="text-[11px] text-secondary">
                {profile?.activeShift
                  ? `Turnstile entry scanned at ${new Date(profile.activeShift.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Scan your face or card at the exit turnstile when departing.`
                  : 'Time is automatically calculated upon scanning through the biometric turnstile.'}
              </p>
            </div>
          </div>

          {/* Recent Shifts Table */}
          {profile && profile.shifts.length > 0 && (
            <div className="space-y-3 pt-2">
              <h4 className="font-bold text-xs text-muted uppercase tracking-wider">
                Turnstile Shift Logs
              </h4>

              <div className="overflow-x-auto rounded-xl bg-surface-elevated shadow-sm">
                <table className="w-full text-xs text-left">
                  <thead className="text-muted font-semibold border-b border-border">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Entry Time</th>
                      <th className="p-3">Exit Time</th>
                      <th className="p-3">Duration</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-text">
                    {profile.shifts.map((s) => (
                      <tr key={s.id} className="hover:bg-border-subtle transition-colors">
                        <td className="p-3 font-mono">{new Date(s.clockIn).toLocaleDateString()}</td>
                        <td className="p-3 font-mono">{new Date(s.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="p-3 font-mono text-muted">{s.clockOut ? new Date(s.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                        <td className="p-3 font-semibold">{s.durationMinutes} min</td>
                        <td className="p-3">
                          <Badge tone={s.isOngoing ? 'warning' : 'success'}>
                            {s.isOngoing ? 'Active on Floor' : 'Completed'}
                          </Badge>
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
              onClick={async () => {
                try {
                  await api.downloadBlob(
                    '/api/v1/reports/export-csv?reportType=payroll',
                    'rec_trainer_payroll_ledger.csv'
                  );
                  toast.success('Downloaded Trainer Payroll Ledger (CSV)');
                } catch {
                  toast.error('Failed to download payroll ledger');
                }
              }}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Payroll (CSV)</span>
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

