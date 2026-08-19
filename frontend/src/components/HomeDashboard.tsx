import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { AppView } from '../layout/nav';
import { Card, Badge, Stat, ProgressBar, EmptyState } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { StudentOnboardingCard } from './StudentOnboardingCard';
import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Flame,
  GraduationCap,
  IndianRupee,
  RefreshCw,
  ShieldAlert,
  Timer,
  Users,
} from 'lucide-react';

interface HomeDashboardProps {
  onNavigate: (view: AppView) => void;
}

interface LiveOccupancy {
  currentCount: number;
  maxCapacity: number;
  occupancyPercentage: number;
}

interface DaySlot {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  availableSpots: number;
  occupancyPercentage: number;
  isFull: boolean;
  isActive: boolean;
  isPast: boolean;
  isBookedByCurrentUser?: boolean;
}

interface DaySlots {
  date: string;
  dayLabel: string;
  dayOfWeek: string;
  isToday: boolean;
  totalCapacity: number;
  totalBooked: number;
  slots: DaySlot[];
}

interface AdminAnalytics {
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

interface FloorStatus {
  currentSlotName: string;
  totalInsideCount: number;
  overstayerCount: number;
}

interface BookingItem {
  id: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  bookingStatus: string;
}

interface MembershipInfo {
  activeMembership?: {
    planName: string;
    daysRemaining: number;
    isActive: boolean;
  } | null;
}

const formatTime12h = (timeStr?: string) => {
  if (!timeStr) return '';
  const [hh, mm] = timeStr.split(':');
  const hour = parseInt(hh, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${mm} ${ampm}`;
};

export const HomeDashboard: React.FC<HomeDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [live, setLive] = useState<LiveOccupancy | null>(null);
  const [today, setToday] = useState<DaySlots | null>(null);
  const [floor, setFloor] = useState<FloorStatus | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [membership, setMembership] = useState<MembershipInfo | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const isStudent = user?.role === 'student' || user?.personType === 'student';
  const isTrainer = user?.role === 'trainer';
  const isAdmin = user ? ['admin', 'super_admin'].includes(user.role) : false;
  const isStaffOrVIP = user ? ['staff', 'authorized_person'].includes(user.role) : false;

  const load = useCallback(async () => {
    const jobs: Promise<void>[] = [];

    jobs.push(
      api
        .get<LiveOccupancy>('/api/v1/access/live-occupancy')
        .then((d) => setLive(d))
        .catch(() => undefined)
    );

    jobs.push(
      api
        .get<DaySlots>('/api/v1/booking/slots', {
          params: { date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) },
        })
        .then((d) => setToday(d))
        .catch(() => undefined)
    );

    if (isStudent) {
      jobs.push(
        api
          .get<BookingItem[]>('/api/v1/booking/my-bookings')
          .then((d) => setBookings(Array.isArray(d) ? d : []))
          .catch(() => undefined)
      );
      jobs.push(
        api
          .get<MembershipInfo>('/api/v1/membership/my-membership')
          .then((d) => setMembership(d))
          .catch(() => undefined)
      );
    }

    if (isTrainer || isAdmin) {
      jobs.push(
        api
          .get<FloorStatus>('/api/v1/floor/status')
          .then((d) => setFloor(d))
          .catch(() => undefined)
      );
    }

    if (isAdmin) {
      jobs.push(
        api
          .get<AdminAnalytics>('/api/v1/admin/analytics')
          .then((d) => setAnalytics(d))
          .catch(() => undefined)
      );
    }

    await Promise.all(jobs);
    setLastUpdated(new Date());
  }, [isStudent, isTrainer, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const greeting = useMemo(() => {
    const hour = parseInt(
      new Date().toLocaleString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        hour12: false,
      }),
      10
    );
    if (hour < 5) return 'Good night';
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const upcomingBooking = useMemo(
    () => bookings.find((b) => b.bookingStatus === 'booked') || null,
    [bookings]
  );

  const passStatus = useMemo(() => {
    if (!user) return '—';
    if (user.studentDetails?.residency === 'hosteller') return 'Free access';
    return membership?.activeMembership?.isActive ? membership.activeMembership.planName : 'No active pass';
  }, [user, membership]);

  const maxPeak = useMemo(
    () => Math.max(...(analytics?.peakHours.map((p) => p.count) ?? [0]), 1),
    [analytics]
  );

  const renderSlotCard = (slot: DaySlot) => (
    <Card
      key={slot.id}
      className={cn(
        'p-4 space-y-2.5',
        slot.isBookedByCurrentUser && 'border-success/40 bg-success-muted/30'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-text">
          {formatTime12h(slot.startTime)} – {formatTime12h(slot.endTime)}
        </span>
        {slot.isBookedByCurrentUser ? (
          <Badge tone="success">Your slot</Badge>
        ) : slot.isPast ? (
          <Badge tone="neutral">Passed</Badge>
        ) : !slot.isActive ? (
          <Badge tone="danger">Closed</Badge>
        ) : slot.isFull ? (
          <Badge tone="danger">Full</Badge>
        ) : (
          <Badge tone="success">{slot.availableSpots} open</Badge>
        )}
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-muted">
          <span>
            {slot.bookedCount} / {slot.capacity} booked
          </span>
          <span>{slot.occupancyPercentage}%</span>
        </div>
        <ProgressBar
          value={slot.occupancyPercentage}
          tone={slot.isFull ? 'danger' : slot.occupancyPercentage >= 75 ? 'warning' : 'success'}
        />
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="page-title">
              {greeting}, {user?.name.split(' ')[0] ?? 'there'}
            </h1>
            <Badge tone="primary" className="capitalize font-mono text-xs">
              {user?.role.replace('_', ' ') ?? 'signed out'}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isStudent && (
            <Button variant="primary" size="sm" onClick={() => onNavigate('book')}>
              <Calendar className="w-4 h-4 text-accent" />
              <span>Book a Slot</span>
            </Button>
          )}
          <IconButton label="Refresh analytics" size="sm" onClick={load}>
            <RefreshCw className="w-4 h-4" />
          </IconButton>
        </div>
      </div>

      {/* Student Onboarding — self-fill contact/emergency/address/health */}
      {isStudent && <StudentOnboardingCard />}

      {/* KPI Stats — Student */}
      {isStudent && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat
            label="Live Occupancy"
            value={live ? `${live.currentCount} / ${live.maxCapacity}` : '—'}
            icon={<Activity className="w-4 h-4" />}
          />
          <Stat
            label="Upcoming Booking"
            value={upcomingBooking ? formatTime12h(upcomingBooking.startTime) : 'None'}
            icon={<Clock className="w-4 h-4" />}
          />
          <Stat label="Membership" value={passStatus} icon={<CreditCard className="w-4 h-4" />} />
          <Stat
            label="Disciplinary"
            value={user?.studentDetails?.isBanned ? 'Banned' : `${user?.studentDetails?.violationCount ?? 0} strikes`}
            icon={<ShieldAlert className="w-4 h-4" />}
          />
        </div>
      )}

      {/* KPI Stats — Trainer */}
      {isTrainer && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat
            label="On the Floor"
            value={floor ? String(floor.totalInsideCount) : live ? String(live.currentCount) : '—'}
            icon={<Users className="w-4 h-4" />}
          />
          <Stat
            label="Overstayers"
            value={floor ? String(floor.overstayerCount) : '—'}
            icon={<Timer className="w-4 h-4" />}
          />
          <Stat
            label="Booked Today"
            value={today ? `${today.totalBooked} / ${today.totalCapacity}` : '—'}
            icon={<Calendar className="w-4 h-4" />}
          />
          <Stat
            label="Live Occupancy"
            value={live ? `${live.currentCount} / ${live.maxCapacity}` : '—'}
            icon={<Activity className="w-4 h-4" />}
          />
        </div>
      )}

      {/* KPI Stats — Admin */}
      {isAdmin && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat
              label="Registered Students"
              value={analytics ? analytics.totalRegisteredStudents.toLocaleString() : '—'}
              icon={<GraduationCap className="w-4 h-4" />}
            />
            <Stat
              label="Active Memberships"
              value={analytics ? String(analytics.activeMembershipsCount) : '—'}
              icon={<CreditCard className="w-4 h-4" />}
            />
            <Stat
              label="Check-ins Today"
              value={analytics ? String(analytics.todayTotalCheckIns) : '—'}
              icon={<Users className="w-4 h-4" />}
            />
            <Stat
              label="Live Occupancy"
              value={live ? `${live.currentCount} / ${live.maxCapacity}` : '—'}
              icon={<Activity className="w-4 h-4" />}
            />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat
              label="Revenue This Month"
              value={analytics ? `₹${analytics.totalMonthlyRevenue.toLocaleString('en-IN')}` : '—'}
              icon={<IndianRupee className="w-4 h-4" />}
            />
            <Stat
              label="Violations This Month"
              value={analytics ? String(analytics.totalViolationsThisMonth) : '—'}
              icon={<ShieldAlert className="w-4 h-4" />}
            />
            <Stat
              label="Overstayers Now"
              value={floor ? String(floor.overstayerCount) : '—'}
              icon={<Timer className="w-4 h-4" />}
            />
            <Stat
              label="Booked Today"
              value={today ? `${today.totalBooked} / ${today.totalCapacity}` : '—'}
              icon={<Calendar className="w-4 h-4" />}
            />
          </div>
        </>
      )}

      {/* KPI Stats — Staff / VIP */}
      {isStaffOrVIP && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Stat
            label="Access Privilege"
            value={user?.role === 'staff' ? 'Faculty Wellness' : 'VIP Access'}
            icon={<Award className="w-4 h-4" />}
          />
          <Stat
            label="Live Occupancy"
            value={live ? `${live.currentCount} / ${live.maxCapacity}` : '—'}
            icon={<Activity className="w-4 h-4" />}
          />
          <Stat
            label="Booked Today"
            value={today ? `${today.totalBooked} / ${today.totalCapacity}` : '—'}
            icon={<Calendar className="w-4 h-4" />}
          />
        </div>
      )}

      {/* Role-specific highlights */}
      {isStudent && upcomingBooking && (
        <Card className="p-4 border-success/40 bg-success-muted/30 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2.5 rounded-xl bg-success text-white shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-text">
                Workout confirmed for {upcomingBooking.slotDate}
              </p>
              <p className="text-[11px] font-semibold text-success">
                {formatTime12h(upcomingBooking.startTime)} – {formatTime12h(upcomingBooking.endTime)}
              </p>
            </div>
          </div>
        </Card>
      )}

      {isTrainer && floor && floor.overstayerCount > 0 && (
        <Card className="p-4 flex items-center gap-3 border-warning/30 bg-warning-muted/30">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
          <div className="flex-1">
            <p className="text-xs font-bold text-text">
              {floor.overstayerCount} overstayer{floor.overstayerCount > 1 ? 's' : ''} on the floor
            </p>
          </div>
          <Button variant="outline" size="xs" onClick={() => onNavigate('floor_management')}>
            Review
          </Button>
        </Card>
      )}

      {/* Today's Batch Occupancy */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm text-text">Today's Batch Occupancy</h3>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="primary">{today?.dayLabel ?? 'Today'}</Badge>
            {lastUpdated && (
              <span className="text-[10px] text-muted font-mono">
                {lastUpdated.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
              </span>
            )}
          </div>
        </div>

        {!today || today.slots.length === 0 ? (
          <EmptyState
            icon={<Calendar className="w-6 h-6" />}
            title="No batches for today"
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {today.slots.map(renderSlotCard)}
          </div>
        )}
      </Card>

      {/* Peak Usage Hours — Admin */}
      {isAdmin && analytics && analytics.peakHours.length > 0 && (
        <Card className="space-y-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-accent" />
            <h3 className="font-bold text-sm text-text">Peak Usage Hours</h3>
          </div>
          <div className="space-y-2">
            {analytics.peakHours.map((p) => (
              <div key={p.hour} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-[11px] text-muted font-mono">{p.hour}</span>
                <div className="flex-1 h-2 rounded-full bg-border-subtle overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${Math.round((p.count / maxPeak) * 100)}%` }}
                  />
                </div>
                <span className="w-8 text-right text-[11px] font-bold text-text">{p.count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};