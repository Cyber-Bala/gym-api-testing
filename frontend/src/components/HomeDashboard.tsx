import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { AppView } from '../layout/nav';
import { Card, Badge, Stat, PageHeader } from '../ui/primitives';
import { Button } from '../ui/Button';
import {
  Calendar,
  CreditCard,
  Activity,
  Users,
  Award,
  ShieldAlert,
  GraduationCap,
  Sparkles,
  ArrowRight,
  Clock,
  FileSpreadsheet,
  HeartPulse,
  Shield,
} from 'lucide-react';

interface HomeDashboardProps {
  onNavigate: (view: AppView) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [liveOccupancy, setLiveOccupancy] = useState<number | null>(null);
  const [upcomingBooking, setUpcomingBooking] = useState<any | null>(null);

  useEffect(() => {
    const fetchQuickSummary = async () => {
      try {
        const occRes = await fetch('/api/v1/access/live-occupancy', { credentials: 'include' });
        const occData = await occRes.json();
        if (occRes.ok && occData.data) {
          setLiveOccupancy(occData.data.currentCount);
        }

        if (user && (user.role === 'student' || user.personType === 'student')) {
          const bRes = await fetch('/api/v1/booking/my-bookings', { credentials: 'include' });
          const bData = await bRes.json();
          if (bRes.ok && bData.data && bData.data.length > 0) {
            const activeB = bData.data.find((b: any) => b.bookingStatus === 'booked');
            setUpcomingBooking(activeB || null);
          }
        }
      } catch {
        // background fetch
      }
    };
    fetchQuickSummary();
  }, [user]);

  // Format 12-hour time helper
  const formatTime12h = (timeStr?: string) => {
    if (!timeStr) return '';
    const [hh, mm] = timeStr.split(':');
    const hour = parseInt(hh, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${mm} ${ampm}`;
  };

  const isStudent = user && (user.role === 'student' || user.personType === 'student');
  const isTrainer = user && user.role === 'trainer';
  const isAdmin = user && ['admin', 'super_admin'].includes(user.role);
  const isStaffOrVIP = user && ['staff', 'authorized_person'].includes(user.role);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={user ? `Welcome back, ${user.name.split(' ')[0]}` : 'College Gym Facility'}
        description={
          user
            ? `Signed in as ${user.role.replace('_', ' ')} • Rajalakshmi Engineering College`
            : 'Automated turnstile access, 3-day rolling window reservations, and real-time gym management'
        }
        badge={
          user && (
            <Badge tone="primary" className="capitalize">
              {user.role.replace('_', ' ')}
            </Badge>
          )
        }
        actions={
          <Button variant="primary" size="sm" onClick={() => onNavigate('book')}>
            <Calendar className="w-4 h-4 text-accent" />
            <span>Book Slot</span>
          </Button>
        }
      />

      {/* Student View */}
      {isStudent && (
        <div className="space-y-6">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat
              label="Residency & Pass"
              value={user?.studentDetails?.residency === 'hosteller' ? 'Hosteller (Free)' : 'Day Scholar Pass'}
              hint="Access to all 10 daily batches"
              icon={<CreditCard className="w-4 h-4" />}
            />
            <Stat
              label="Live Gym Occupancy"
              value={liveOccupancy !== null ? `${liveOccupancy} / 100` : '—'}
              hint="Real-time turnstile count"
              icon={<Activity className="w-4 h-4" />}
            />
            <Stat
              label="Disciplinary Status"
              value={user?.studentDetails?.isBanned ? 'Banned' : `${user?.studentDetails?.violationCount || 0} Strikes`}
              hint={user?.studentDetails?.isBanned ? 'Suspension active' : 'Clean standing'}
              icon={<ShieldAlert className="w-4 h-4" />}
            />
          </div>

          {/* Next Workout Card or Booking CTA */}
          {upcomingBooking ? (
            <Card className="border-success/30 bg-success-muted/30 p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge tone="success">Confirmed Workout Session</Badge>
                    <span className="text-xs font-mono text-muted">{upcomingBooking.slotDate}</span>
                  </div>
                  <h3 className="text-lg font-bold text-text flex items-center gap-2">
                    <Clock className="w-4 h-4 text-success" />
                    <span>
                      {formatTime12h(upcomingBooking.startTime)} – {formatTime12h(upcomingBooking.endTime)}
                    </span>
                  </h3>
                  <p className="text-xs text-secondary">
                    Your facial scan is verified on Turnstile Lanes A & B. Please arrive within 15 minutes of session start.
                  </p>
                </div>

                <Button variant="outline" size="sm" onClick={() => onNavigate('book')}>
                  <span>Manage Reservations</span>
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="font-bold text-base text-text">No active slot booked today</h3>
                  <p className="text-xs text-secondary">
                    Reserve a session from the 3-day booking window to workout at the campus gym.
                  </p>
                </div>
                <Button variant="primary" size="md" onClick={() => onNavigate('book')}>
                  <Calendar className="w-4 h-4 text-accent" />
                  <span>Reserve a Gym Slot</span>
                </Button>
              </div>
            </Card>
          )}

          {/* Quick Action Navigation Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card
              interactive
              onClick={() => onNavigate('book')}
              className="p-5 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-primary-muted text-primary">
                  <Calendar className="w-4 h-4" />
                </div>
                <ArrowRight className="w-4 h-4 text-muted" />
              </div>
              <h4 className="font-bold text-sm text-text">Book Workout Slot</h4>
              <p className="text-xs text-secondary">
                View 3-day calendar, morning and evening batches, and check live capacity.
              </p>
            </Card>

            <Card
              interactive
              onClick={() => onNavigate('memberships')}
              className="p-5 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-primary-muted text-primary">
                  <CreditCard className="w-4 h-4" />
                </div>
                <ArrowRight className="w-4 h-4 text-muted" />
              </div>
              <h4 className="font-bold text-sm text-text">Gym Passes & Membership</h4>
              <p className="text-xs text-secondary">
                View pass validity, day scholar packages (1M / 3M / 1Y), and payment history.
              </p>
            </Card>

            <Card
              interactive
              onClick={() => onNavigate('health')}
              className="p-5 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-primary-muted text-primary">
                  <Activity className="w-4 h-4" />
                </div>
                <ArrowRight className="w-4 h-4 text-muted" />
              </div>
              <h4 className="font-bold text-sm text-text">System Status</h4>
              <p className="text-xs text-secondary">
                Check database, Redis, and turnstile storage synchronization health.
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* Trainer View */}
      {isTrainer && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat
              label="Current Gym Occupants"
              value={liveOccupancy !== null ? `${liveOccupancy}` : '—'}
              hint="Capacity cap: 100"
              icon={<Users className="w-4 h-4" />}
            />
            <Stat
              label="Stipend Rate"
              value={`₹${user?.trainerDetails?.hourlyRate || '200'}/hr`}
              hint="Student Trainer Tier"
              icon={<Award className="w-4 h-4" />}
            />
            <Stat
              label="Floor Supervision"
              value="Active"
              hint="Overstayers automated detection"
              icon={<Activity className="w-4 h-4" />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card interactive onClick={() => onNavigate('floor_management')} className="p-5 space-y-2">
              <div className="p-2 rounded-xl bg-primary-muted text-primary w-fit">
                <Users className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-sm text-text">Gym Floor & Overstayers</h4>
              <p className="text-xs text-secondary">Monitor students inside, overstay alerts, and checkout.</p>
            </Card>

            <Card interactive onClick={() => onNavigate('trainer_shifts')} className="p-5 space-y-2">
              <div className="p-2 rounded-xl bg-primary-muted text-primary w-fit">
                <Award className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-sm text-text">Shifts & Timesheet</h4>
              <p className="text-xs text-secondary">Clock in/out your shifts and view earned monthly stipend.</p>
            </Card>

            <Card interactive onClick={() => onNavigate('live_attendance')} className="p-5 space-y-2">
              <div className="p-2 rounded-xl bg-primary-muted text-primary w-fit">
                <Activity className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-sm text-text">Turnstiles & Scans</h4>
              <p className="text-xs text-secondary">View live face turnstile stream and test scan simulator.</p>
            </Card>

            <Card interactive onClick={() => onNavigate('students')} className="p-5 space-y-2">
              <div className="p-2 rounded-xl bg-primary-muted text-primary w-fit">
                <GraduationCap className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-sm text-text">Student Directory</h4>
              <p className="text-xs text-secondary">Search enrolled student roster and residency status.</p>
            </Card>
          </div>
        </div>
      )}

      {/* Admin View */}
      {isAdmin && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat
              label="Live Occupancy"
              value={liveOccupancy !== null ? `${liveOccupancy}` : '—'}
              hint="ZKBio Biometric stream"
              icon={<Activity className="w-4 h-4" />}
            />
            <Stat
              label="Slot Booking Window"
              value="3 Days (IST)"
              hint="10 batches daily • 100 cap"
              icon={<Calendar className="w-4 h-4" />}
            />
            <Stat
              label="Disciplinary Engine"
              value="3 Strikes"
              hint="Automated 3-day suspension"
              icon={<ShieldAlert className="w-4 h-4" />}
            />
            <Stat
              label="Cold Storage"
              value="Parquet/Zstd"
              hint="7-Year statutory archive"
              icon={<FileSpreadsheet className="w-4 h-4" />}
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
              Quick Administrative Access
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card interactive onClick={() => onNavigate('live_attendance')} className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-xl bg-primary-muted text-primary">
                    <Activity className="w-4 h-4" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted" />
                </div>
                <h4 className="font-bold text-sm text-text">Live Attendance & Turnstiles</h4>
                <p className="text-xs text-secondary">
                  Real-time turnstile check-ins, occupant duration, and hardware scan tester.
                </p>
              </Card>

              <Card interactive onClick={() => onNavigate('students')} className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-xl bg-primary-muted text-primary">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted" />
                </div>
                <h4 className="font-bold text-sm text-text">Student Directory & Ingestion</h4>
                <p className="text-xs text-secondary">
                  Search students, filter hostellers, and trigger bulk Excel ingestion.
                </p>
              </Card>

              <Card interactive onClick={() => onNavigate('reports')} className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-xl bg-primary-muted text-primary">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted" />
                </div>
                <h4 className="font-bold text-sm text-text">Institutional Reports & CSV</h4>
                <p className="text-xs text-secondary">
                  Export attendance logs, day scholar revenue, violations, and payroll.
                </p>
              </Card>

              <Card interactive onClick={() => onNavigate('analytics')} className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-xl bg-primary-muted text-primary">
                    <Activity className="w-4 h-4" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted" />
                </div>
                <h4 className="font-bold text-sm text-text">Executive Insights & Blackouts</h4>
                <p className="text-xs text-secondary">
                  Utilization metrics, emergency closure calendar, and audit trail explorer.
                </p>
              </Card>

              <Card interactive onClick={() => onNavigate('violations')} className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-xl bg-primary-muted text-primary">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted" />
                </div>
                <h4 className="font-bold text-sm text-text">Violations & 3-Strike Bans</h4>
                <p className="text-xs text-secondary">
                  Manage flagged students, forgive strikes with audit reason, and unban worker.
                </p>
              </Card>

              <Card interactive onClick={() => onNavigate('uat_demo')} className="p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-xl bg-accent-muted text-accent">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted" />
                </div>
                <h4 className="font-bold text-sm text-text">12 E2E Flows Console</h4>
                <p className="text-xs text-secondary">
                  Automated verification runner and quick stakeholder persona switcher.
                </p>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Staff / VIP View */}
      {isStaffOrVIP && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat
              label="Staff Privilege"
              value={user?.role === 'staff' ? 'Faculty Wellness' : 'VIP Pass'}
              hint="Free facility access"
              icon={<HeartPulse className="w-4 h-4" />}
            />
            <Stat
              label="Live Occupancy"
              value={liveOccupancy !== null ? `${liveOccupancy} / 100` : '—'}
              hint="Turnstile monitor"
              icon={<Activity className="w-4 h-4" />}
            />
            <Stat
              label="Biometric Access"
              value="Lane A & B Ready"
              hint="Instant facial recognition"
              icon={<Shield className="w-4 h-4" />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card interactive onClick={() => onNavigate('book')} className="p-5 space-y-2">
              <div className="p-2 rounded-xl bg-primary-muted text-primary w-fit">
                <Calendar className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-sm text-text">Reserve a Gym Session</h4>
              <p className="text-xs text-secondary">Book your slot in the morning or evening staff hours.</p>
            </Card>

            <Card interactive onClick={() => onNavigate('health')} className="p-5 space-y-2">
              <div className="p-2 rounded-xl bg-primary-muted text-primary w-fit">
                <Activity className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-sm text-text">System Status</h4>
              <p className="text-xs text-secondary">Check database and turnstile device connectivity.</p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

