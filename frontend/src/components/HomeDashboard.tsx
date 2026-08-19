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
  TrendingUp,
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
  const isSuperAdmin = user && user.role === 'super_admin';
  const isStaffOrVIP = user && ['staff', 'authorized_person'].includes(user.role);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={user ? `Welcome, ${user.name.split(' ')[0]}` : 'Gym Facility'}
        badge={
          user && (
            <Badge tone="primary" className="capitalize font-mono text-xs">
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
        <div className="space-y-5">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat
              label="Residency"
              value={user?.studentDetails?.residency === 'hosteller' ? 'Hosteller (Free)' : 'Day Scholar'}
              icon={<CreditCard className="w-4 h-4" />}
            />
            <Stat
              label="Live Gym Occupancy"
              value={liveOccupancy !== null ? `${liveOccupancy} / 100` : '—'}
              icon={<Activity className="w-4 h-4" />}
            />
            <Stat
              label="Disciplinary Status"
              value={user?.studentDetails?.isBanned ? 'Banned' : `${user?.studentDetails?.violationCount || 0} Strikes`}
              icon={<ShieldAlert className="w-4 h-4" />}
            />
          </div>

          {/* Next Workout Card or Booking CTA */}
          {upcomingBooking ? (
            <Card className="border-success/30 bg-success-muted/30 p-5 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge tone="success">Confirmed Slot</Badge>
                    <span className="text-xs font-mono text-muted">{upcomingBooking.slotDate}</span>
                  </div>
                  <h3 className="text-lg font-bold text-text flex items-center gap-2">
                    <Clock className="w-4 h-4 text-success" />
                    <span>
                      {formatTime12h(upcomingBooking.startTime)} – {formatTime12h(upcomingBooking.endTime)}
                    </span>
                  </h3>
                </div>

                <Button variant="outline" size="sm" onClick={() => onNavigate('book')}>
                  <span>View Bookings</span>
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-sm text-text">No workout booked for today</h3>
                <p className="text-xs text-secondary mt-0.5">3-day rolling booking window is open.</p>
              </div>
              <Button variant="primary" size="sm" onClick={() => onNavigate('book')}>
                <Calendar className="w-4 h-4 text-accent" />
                <span>Reserve Slot</span>
              </Button>
            </Card>
          )}

          {/* Quick Action Navigation Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card
              interactive
              onClick={() => onNavigate('book')}
              className="p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary-muted text-primary">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-text">Book Workout Slot</h4>
                  <p className="text-[11px] text-muted">10 Daily Batches</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted" />
            </Card>

            {user?.studentDetails?.residency !== 'hosteller' && (
              <Card
                interactive
                onClick={() => onNavigate('memberships')}
                className="p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary-muted text-primary">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-text">Gym Passes</h4>
                    <p className="text-[11px] text-muted">1M / 3M / 1Y Plans</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted" />
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Trainer View */}
      {isTrainer && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat
              label="Floor Occupants"
              value={liveOccupancy !== null ? `${liveOccupancy} / 100` : '—'}
              icon={<Users className="w-4 h-4" />}
            />
            <Stat
              label="Stipend Rate"
              value={`₹${user?.trainerDetails?.hourlyRate || '200'}/hr`}
              icon={<Award className="w-4 h-4" />}
            />
            <Stat
              label="Floor Supervision"
              value="Active"
              icon={<Activity className="w-4 h-4" />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card interactive onClick={() => onNavigate('floor_management')} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary-muted text-primary">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-text">Gym Floor</h4>
                  <p className="text-[11px] text-muted">Overstayers & Checkout</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted" />
            </Card>

            <Card interactive onClick={() => onNavigate('trainer_shifts')} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary-muted text-primary">
                  <Award className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-text">Shifts & Timesheet</h4>
                  <p className="text-[11px] text-muted">Clock In / Out</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted" />
            </Card>

            <Card interactive onClick={() => onNavigate('live_attendance')} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary-muted text-primary">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-text">Live Turnstiles</h4>
                  <p className="text-[11px] text-muted">Biometric Scans</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted" />
            </Card>

            <Card interactive onClick={() => onNavigate('book')} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary-muted text-primary">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-text">Book Workout</h4>
                  <p className="text-[11px] text-muted">Student Slot</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted" />
            </Card>
          </div>
        </div>
      )}

      {/* Admin / Super Admin View */}
      {isAdmin && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat
              label="Live Occupancy"
              value={liveOccupancy !== null ? `${liveOccupancy} / 100` : '—'}
              icon={<Activity className="w-4 h-4" />}
            />
            <Stat
              label="Booking Window"
              value="3 Days (10 Slots)"
              icon={<Calendar className="w-4 h-4" />}
            />
            <Stat
              label="Disciplinary Engine"
              value="3 Strikes Policy"
              icon={<ShieldAlert className="w-4 h-4" />}
            />
            <Stat
              label="Archival Storage"
              value="Parquet/Zstd"
              icon={<FileSpreadsheet className="w-4 h-4" />}
            />
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted px-1">
              Management Modules
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Card interactive onClick={() => onNavigate('live_attendance')} className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-primary-muted text-primary shrink-0">
                    <Activity className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs text-text truncate">Live Attendance</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted shrink-0" />
              </Card>

              <Card interactive onClick={() => onNavigate('floor_management')} className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-primary-muted text-primary shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs text-text truncate">Gym Floor & Overstayers</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted shrink-0" />
              </Card>

              <Card interactive onClick={() => onNavigate('students')} className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-primary-muted text-primary shrink-0">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs text-text truncate">Student Directory</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted shrink-0" />
              </Card>

              <Card interactive onClick={() => onNavigate('violations')} className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-primary-muted text-primary shrink-0">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs text-text truncate">Violations & Strikes</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted shrink-0" />
              </Card>

              <Card interactive onClick={() => onNavigate('reports')} className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-primary-muted text-primary shrink-0">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs text-text truncate">Institutional Reports</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted shrink-0" />
              </Card>

              <Card interactive onClick={() => onNavigate('analytics')} className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-primary-muted text-primary shrink-0">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs text-text truncate">Analytics & Blackouts</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted shrink-0" />
              </Card>

              <Card interactive onClick={() => onNavigate('authorized_persons')} className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-primary-muted text-primary shrink-0">
                    <Shield className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs text-text truncate">Authorized VIP Guests</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted shrink-0" />
              </Card>

              <Card interactive onClick={() => onNavigate('conflicts')} className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-primary-muted text-primary shrink-0">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs text-text truncate">Access Conflicts</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted shrink-0" />
              </Card>

              {isSuperAdmin && (
                <Card interactive onClick={() => onNavigate('lifecycle')} className="p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-xl bg-accent-muted text-accent shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-xs text-text truncate">Data Lifecycle Archive</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-muted shrink-0" />
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Staff / VIP View */}
      {isStaffOrVIP && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat
              label="Access Privilege"
              value={user?.role === 'staff' ? 'Faculty Wellness' : 'VIP Access'}
              icon={<HeartPulse className="w-4 h-4" />}
            />
            <Stat
              label="Live Occupancy"
              value={liveOccupancy !== null ? `${liveOccupancy} / 100` : '—'}
              icon={<Activity className="w-4 h-4" />}
            />
            <Stat
              label="Biometric Status"
              value="Verified"
              icon={<Shield className="w-4 h-4" />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card interactive onClick={() => onNavigate('book')} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary-muted text-primary">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-text">Book Workout</h4>
                  <p className="text-[11px] text-muted">Staff / Faculty Hours</p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted" />
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};


