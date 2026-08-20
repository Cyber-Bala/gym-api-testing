import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  RefreshCw,
  Award,
  CheckCircle2,
  Download,
  Activity,
  Sliders,
  Plus,
  Trash2,
  Clock,
  Pencil,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Stat, Badge, Modal } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { Input } from '../ui/Input';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/cn';

interface WorkShift {
  id: string;
  clockIn: string;
  clockOut?: string;
  durationMinutes: number;
  isOngoing: boolean;
  calculatedStipend?: number;
  timeWindowBreakdown?: Array<{
    windowLabel: string;
    minutes: number;
    ratePerHour: number;
    stipend: number;
  }>;
}

interface TrainerProfile {
  id: string;
  name: string;
  email: string;
  activeShift: WorkShift | null;
  totalHoursThisMonth: number;
  shifts: WorkShift[];
}

interface StipendTimeWindow {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  ratePerHour: number;
}

interface StipendConfig {
  defaultHourlyRate: number;
  minShiftMinutes: number;
  timeWindows: StipendTimeWindow[];
}

interface MonthlyPayrollItem {
  trainerId: string;
  personId: string;
  name: string;
  email: string;
  hourlyRate: string;
  totalShifts: number;
  totalHours: number;
  totalStipend: number;
  breakdown?: Array<{
    windowLabel: string;
    minutes: number;
    ratePerHour: number;
    stipend: number;
  }>;
}

export const TrainerTimesheet: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState<TrainerProfile | null>(null);
  const [payroll, setPayroll] = useState<MonthlyPayrollItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Stipend Configuration Modal State
  const [configModalOpen, setConfigModalOpen] = useState<boolean>(false);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [stipendConfig, setStipendConfig] = useState<StipendConfig>({
    defaultHourlyRate: 200,
    minShiftMinutes: 30,
    timeWindows: [
      { id: 'morning', label: 'Morning Floor Shift', startTime: '06:00', endTime: '10:00', ratePerHour: 250 },
      { id: 'evening', label: 'Evening Peak Shift', startTime: '15:00', endTime: '21:00', ratePerHour: 250 },
    ],
  });

  // Edit Individual Trainer Rate Modal State
  const [editingTrainer, setEditingTrainer] = useState<MonthlyPayrollItem | null>(null);
  const [trainerRateInput, setTrainerRateInput] = useState<string>('200');
  const [trainerRateReason, setTrainerRateReason] = useState<string>('Standard rate adjustment');
  const [savingTrainerRate, setSavingTrainerRate] = useState<boolean>(false);

  // Expanded Breakdown Rows
  const [expandedTrainerId, setExpandedTrainerId] = useState<string | null>(null);

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
        const [payrollData, configData] = await Promise.all([
          api.get<MonthlyPayrollItem[]>('/api/v1/trainer/payroll'),
          api.get<StipendConfig>('/api/v1/trainer/stipend-config'),
        ]);

        if (Array.isArray(payrollData)) {
          setPayroll(payrollData);
        }
        if (configData && configData.timeWindows) {
          setStipendConfig(configData);
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

  const handleSaveStipendConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const updated = await api.put<StipendConfig>('/api/v1/trainer/stipend-config', stipendConfig);
      if (updated) {
        setStipendConfig(updated);
      }
      toast.success('Stipend rates and working time windows saved!');
      setConfigModalOpen(false);
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Failed to save stipend configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveTrainerRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrainer) return;
    setSavingTrainerRate(true);
    try {
      await api.patch(`/api/v1/trainer/profile/${editingTrainer.trainerId}/rate`, {
        hourlyRate: Number(trainerRateInput),
        reason: trainerRateReason.trim() || 'Custom rate update',
      });
      toast.success(`Updated base rate for ${editingTrainer.name} to ₹${trainerRateInput}/hr`);
      setEditingTrainer(null);
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Failed to update trainer rate');
    } finally {
      setSavingTrainerRate(false);
    }
  };

  const handleAddTimeWindow = () => {
    const newId = `window_${Date.now()}`;
    setStipendConfig({
      ...stipendConfig,
      timeWindows: [
        ...stipendConfig.timeWindows,
        {
          id: newId,
          label: 'New Time Window',
          startTime: '06:00',
          endTime: '09:00',
          ratePerHour: stipendConfig.defaultHourlyRate,
        },
      ],
    });
  };

  const handleRemoveTimeWindow = (id: string) => {
    setStipendConfig({
      ...stipendConfig,
      timeWindows: stipendConfig.timeWindows.filter((tw) => tw.id !== id),
    });
  };

  const handleUpdateTimeWindow = (index: number, field: keyof StipendTimeWindow, value: any) => {
    const updated = [...stipendConfig.timeWindows];
    updated[index] = { ...updated[index], [field]: value };
    setStipendConfig({ ...stipendConfig, timeWindows: updated });
  };

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

      {/* Admin Trainer Payroll Ledger & Stipend Configuration View */}
      {isAdmin && (
        <Card className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-success" />
                <h3 className="font-bold text-base sm:text-lg text-text">
                  Trainer Payroll & Stipend Accounting
                </h3>
              </div>
              <p className="text-xs text-secondary mt-0.5">
                Configurable Time-Window Stipends • Monthly College Disbursal Ledger
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setConfigModalOpen(true)}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Configure Stipend & Shift Times</span>
              </Button>

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
                <span>Export (CSV)</span>
              </Button>

              <IconButton
                label="Refresh payroll"
                size="sm"
                onClick={fetchData}
                disabled={loading}
              >
                <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
              </IconButton>
            </div>
          </div>

          {/* Active Stipend Summary Banner */}
          <div className="p-4 rounded-2xl bg-surface-elevated border border-border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary-muted text-primary">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-text">Active Time-Based Stipend Rates: </span>
                <span className="text-secondary">
                  Base: ₹{stipendConfig.defaultHourlyRate}/hr • Min Shift: {stipendConfig.minShiftMinutes} min
                </span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {stipendConfig.timeWindows.map((tw) => (
                    <span
                      key={tw.id}
                      className="px-2 py-0.5 rounded-md bg-surface border border-border text-[11px] font-mono text-text"
                    >
                      {tw.label} ({tw.startTime} - {tw.endTime}): <strong className="text-success">₹{tw.ratePerHour}/hr</strong>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="xs"
              onClick={() => setConfigModalOpen(true)}
              className="text-primary hover:underline shrink-0"
            >
              Modify Rules
            </Button>
          </div>

          {/* Payroll Table */}
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs text-left">
              <thead className="bg-border-subtle/50 text-muted font-semibold">
                <tr>
                  <th className="p-3.5">Trainer Name</th>
                  <th className="p-3.5">Email</th>
                  <th className="p-3.5">Base Rate</th>
                  <th className="p-3.5">Completed Shifts</th>
                  <th className="p-3.5">Total Hours</th>
                  <th className="p-3.5">Total Stipend Owed</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-text">
                {payroll.map((p) => {
                  const isExpanded = expandedTrainerId === p.trainerId;
                  return (
                    <React.Fragment key={p.trainerId}>
                      <tr className="hover:bg-border-subtle/30 transition-colors">
                        <td className="p-3.5 font-bold text-text">
                          <div className="flex items-center gap-1.5">
                            {p.breakdown && p.breakdown.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setExpandedTrainerId(isExpanded ? null : p.trainerId)}
                                className="text-muted hover:text-text"
                                title="View time-window breakdown"
                              >
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            )}
                            <span>{p.name}</span>
                          </div>
                        </td>
                        <td className="p-3.5 font-mono text-muted">{p.email}</td>
                        <td className="p-3.5 font-mono">
                          <span>₹{p.hourlyRate}/hr</span>
                        </td>
                        <td className="p-3.5">{p.totalShifts} shifts</td>
                        <td className="p-3.5 font-semibold text-secondary">{p.totalHours} hrs</td>
                        <td className="p-3.5 font-bold text-success text-sm">
                          ₹{p.totalStipend}
                        </td>
                        <td className="p-3.5 text-right">
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() => {
                              setEditingTrainer(p);
                              setTrainerRateInput(p.hourlyRate);
                              setTrainerRateReason('Standard rate update');
                            }}
                            className="text-[11px]"
                          >
                            <Pencil className="w-3 h-3 mr-1" /> Edit Rate
                          </Button>
                        </td>
                      </tr>

                      {/* Expanded Breakdown Row */}
                      {isExpanded && p.breakdown && p.breakdown.length > 0 && (
                        <tr className="bg-surface-elevated/60">
                          <td colSpan={7} className="p-3 px-8">
                            <div className="text-[11px] space-y-1.5">
                              <span className="font-semibold text-secondary">Time-Window Stipend Breakdown:</span>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {p.breakdown.map((b, idx) => (
                                  <div
                                    key={idx}
                                    className="p-2 rounded-lg bg-surface border border-border flex items-center justify-between"
                                  >
                                    <div>
                                      <div className="font-medium text-text">{b.windowLabel}</div>
                                      <div className="text-[10px] text-muted">
                                        {Math.round((b.minutes / 60) * 10) / 10} hrs ({b.minutes} min) @ ₹{b.ratePerHour}/hr
                                      </div>
                                    </div>
                                    <span className="font-bold text-success text-xs">₹{b.stipend}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Global Stipend & Specific Working Time Modal */}
      <Modal
        open={configModalOpen}
        title="Configure Stipend Rates & Specific Working Time Windows"
        onClose={() => setConfigModalOpen(false)}
        wide
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfigModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={savingConfig}
              onClick={handleSaveStipendConfig}
            >
              Save Configuration
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveStipendConfig} className="space-y-5 text-xs">
          <div className="p-3 rounded-xl bg-primary-muted/20 border border-primary/20 text-primary text-xs flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Automated Time-Window Stipend Calculation</p>
              <p className="text-[11px] text-secondary mt-0.5">
                Set custom hourly stipend amounts for specific times of the day (e.g. Peak Morning or Evening shifts).
                When trainers clock in through turnstiles, their stipend is calculated based on the exact minutes worked in each window.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Default Base Hourly Rate (₹ / hr)"
              type="number"
              required
              min={0}
              max={5000}
              value={stipendConfig.defaultHourlyRate}
              onChange={(e) =>
                setStipendConfig({
                  ...stipendConfig,
                  defaultHourlyRate: Number(e.target.value),
                })
              }
              hint="Applied outside specific time windows"
            />

            <Input
              label="Minimum Shift Duration (Minutes)"
              type="number"
              required
              min={0}
              max={240}
              value={stipendConfig.minShiftMinutes}
              onChange={(e) =>
                setStipendConfig({
                  ...stipendConfig,
                  minShiftMinutes: Number(e.target.value),
                })
              }
              hint="Minimum logged floor time to qualify for stipend"
            />
          </div>

          {/* Time Windows List */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <div>
                <h4 className="font-bold text-text text-sm flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-accent" />
                  <span>Specific Working Time Windows & Stipend Amounts</span>
                </h4>
                <p className="text-[11px] text-muted">
                  Configure specific hours and their payable stipend amounts per hour
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={handleAddTimeWindow}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Time Window</span>
              </Button>
            </div>

            {stipendConfig.timeWindows.length === 0 ? (
              <div className="p-4 rounded-xl bg-surface-elevated border border-dashed border-border text-center text-muted">
                No specific time windows defined. All hours will use the default base rate (₹{stipendConfig.defaultHourlyRate}/hr).
              </div>
            ) : (
              <div className="space-y-2.5">
                {stipendConfig.timeWindows.map((tw, idx) => (
                  <div
                    key={tw.id}
                    className="p-3 rounded-xl bg-surface-elevated border border-border grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                  >
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-semibold text-muted mb-1">
                        Shift / Window Label
                      </label>
                      <input
                        type="text"
                        required
                        className="w-full h-8 px-2.5 rounded-lg bg-surface border border-border text-text text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                        value={tw.label}
                        placeholder="e.g. Morning Shift"
                        onChange={(e) => handleUpdateTimeWindow(idx, 'label', e.target.value)}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-muted mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        required
                        className="w-full h-8 px-2 rounded-lg bg-surface border border-border text-text text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                        value={tw.startTime}
                        onChange={(e) => handleUpdateTimeWindow(idx, 'startTime', e.target.value)}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-muted mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        required
                        className="w-full h-8 px-2 rounded-lg bg-surface border border-border text-text text-xs font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                        value={tw.endTime}
                        onChange={(e) => handleUpdateTimeWindow(idx, 'endTime', e.target.value)}
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-semibold text-muted mb-1">
                        Stipend Amount (₹/hr)
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1.5 text-muted">₹</span>
                        <input
                          type="number"
                          required
                          min={0}
                          max={5000}
                          className="w-full h-8 pl-6 pr-2.5 rounded-lg bg-surface border border-border text-text text-xs font-bold text-success focus:ring-1 focus:ring-primary focus:outline-none"
                          value={tw.ratePerHour}
                          onChange={(e) => handleUpdateTimeWindow(idx, 'ratePerHour', Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-1 flex justify-end sm:pt-4">
                      <button
                        type="button"
                        onClick={() => handleRemoveTimeWindow(tw.id)}
                        className="p-1.5 rounded-lg text-danger hover:bg-danger-muted/30 transition-colors"
                        title="Delete Window"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Edit Individual Trainer Base Rate Modal */}
      <Modal
        open={Boolean(editingTrainer)}
        title={`Edit Base Stipend Rate — ${editingTrainer?.name}`}
        onClose={() => setEditingTrainer(null)}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEditingTrainer(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={savingTrainerRate}
              onClick={handleSaveTrainerRate}
            >
              Update Rate
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveTrainerRate} className="space-y-4 text-xs">
          <Input
            label="Trainer Base Hourly Rate (₹ / hr)"
            type="number"
            required
            min={0}
            max={5000}
            value={trainerRateInput}
            onChange={(e) => setTrainerRateInput(e.target.value)}
          />

          <Input
            label="Reason for Adjustment"
            type="text"
            required
            placeholder="e.g. Senior trainer stipend tier promotion"
            value={trainerRateReason}
            onChange={(e) => setTrainerRateReason(e.target.value)}
          />
        </form>
      </Modal>
    </div>
  );
};
