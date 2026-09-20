import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  Lock,
  Unlock,
  Sun,
  Moon,
  BookmarkCheck,
  Plus,
  Trash2,
  Sparkles,
  ShieldAlert,
  Award,
  ShieldCheck,
  X,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { Badge, ProgressBar, Modal, Alert } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/cn';
import { FaceRegistrationStatus } from './FaceRegistrationStatus';

interface OperatingWindow {
  startTime: string;
  endTime: string;
  label?: string;
}

interface SlotConfig {
  id?: string;
  windowMode: 'block' | 'rolling';
  windowDays: number;
  defaultCapacity: number;
  slotDurationMinutes: number;
  bufferMinutes: number;
  operatingWindows: OperatingWindow[];
  updatedAt?: string;
}

interface SlotItem {
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
  isBookedByCurrentUser: boolean;
  isPassCovered?: boolean;
}

interface DaySlots {
  date: string;
  dayLabel: string;
  dayOfWeek: string;
  isToday: boolean;
  isLocked: boolean;
  lockReason?: string;
  hasUserBookedOnDate: boolean;
  userBookedSlotId?: string;
  userBookedCountOnDate?: number;
  userBookedSlotIds?: string[];
  totalCapacity: number;
  totalBooked: number;
  isPassValidOnDate?: boolean;
  passExpiryDate?: string;
  slots: SlotItem[];
}

interface RollingWindowData {
  windowDates: string[];
  totalUserBookingsInWindow?: number;
  config?: SlotConfig;
  days: DaySlots[];
}

interface CalendarClosureItem {
  id: string;
  closureDate: string;
  reason: string;
  cancelledBookingsCount: number;
  createdAt: string;
}

interface SlotBookingViewProps {
  onBookingSuccess?: () => void;
  onNavigate?: (view: any) => void;
}

export const SlotBookingView: React.FC<SlotBookingViewProps> = ({ onBookingSuccess }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<RollingWindowData | null>(null);
  const [sessionFilter, setSessionFilter] = useState<'all' | 'morning' | 'evening'>('all');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reservingSlotId, setReservingSlotId] = useState<string | null>(null);
  const [bookingSuccessMsg, setBookingSuccessMsg] = useState<string | null>(null);

  // Admin slot editing state
  const [editSlot, setEditSlot] = useState<SlotItem | null>(null);
  const [editCapacity, setEditCapacity] = useState<number>(100);
  const [editReason, setEditReason] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  // Configure Schedule Modal State
  const [configModalOpen, setConfigModalOpen] = useState<boolean>(false);
  const [configTab, setConfigTab] = useState<'schedule' | 'closures'>('schedule');
  const [savingConfig, setSavingConfig] = useState<boolean>(false);

  // Config Form State
  const [cfgWindowMode, setCfgWindowMode] = useState<'block' | 'rolling'>('block');
  const [cfgWindowDays, setCfgWindowDays] = useState<number>(3);
  const [cfgDefaultCapacity, setCfgDefaultCapacity] = useState<number>(100);
  const [cfgSlotDuration, setCfgSlotDuration] = useState<number>(60);
  const [cfgBufferMinutes, setCfgBufferMinutes] = useState<number>(0);
  const [cfgOperatingWindows, setCfgOperatingWindows] = useState<OperatingWindow[]>([
    { startTime: '06:00', endTime: '10:00', label: 'Morning Session' },
    { startTime: '15:00', endTime: '21:00', label: 'Evening Session' },
  ]);

  // Lock / Unlock Date State
  const [lockDateVal, setLockDateVal] = useState<string>('');
  const [lockReasonVal, setLockReasonVal] = useState<string>('');
  const [lockingDate, setLockingDate] = useState<boolean>(false);
  const [closuresList, setClosuresList] = useState<CalendarClosureItem[]>([]);
  const [loadingClosures, setLoadingClosures] = useState<boolean>(false);

  const isAdmin = user && ['admin', 'super_admin'].includes(user.role);
  const isTrainer = user && (user.role === 'trainer' || user.personType === 'trainer');
  const isStaff = user && (user.role === 'staff' || user.personType === 'staff');
  const isStudent = user && (user.personType === 'student' || user.role === 'student');
  const isEnrolled = user && (user.faceEnrollmentStatus === 'enrolled' || user.studentDetails?.faceEnrollmentStatus === 'enrolled');

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resData = await api.get<RollingWindowData>('/api/v1/booking/slots/window');
      setData(resData);
      if (resData.config) {
        setCfgWindowMode(resData.config.windowMode || 'block');
        setCfgWindowDays(resData.config.windowDays || 3);
        setCfgDefaultCapacity(resData.config.defaultCapacity || 100);
        setCfgSlotDuration(resData.config.slotDurationMinutes || 60);
        setCfgBufferMinutes(resData.config.bufferMinutes || 0);
        if (resData.config.operatingWindows && resData.config.operatingWindows.length > 0) {
          setCfgOperatingWindows(resData.config.operatingWindows);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClosures = async () => {
    if (!isAdmin) return;
    setLoadingClosures(true);
    try {
      const res = await api.get<CalendarClosureItem[]>('/api/v1/admin/calendar');
      setClosuresList(res || []);
    } catch {
      // ignore
    } finally {
      setLoadingClosures(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots, user]);

  const formatTime12h = (timeStr: string) => {
    const [hh, mm] = timeStr.split(':');
    const hour = parseInt(hh, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${mm} ${ampm}`;
  };

  const formatTimeRange = (start: string, end: string) => {
    const from = formatTime12h(start);
    const to = formatTime12h(end);
    const fromPeriod = from.slice(-2);
    const toPeriod = to.slice(-2);
    if (fromPeriod === toPeriod) return `${from.slice(0, -3)}-${to}`;
    return `${from}-${to}`;
  };

  const handleReserveSlot = async (slotId: string) => {
    if (!user) {
      setError('Please sign in with your college account to reserve a gym slot.');
      return;
    }

    setReservingSlotId(slotId);
    setError(null);
    setBookingSuccessMsg(null);

    try {
      await api.post('/api/v1/booking/reserve', { slotId });

      setBookingSuccessMsg('Gym slot booked successfully! See you on the gym floor.');
      if (onBookingSuccess) {
        onBookingSuccess();
      }
      fetchSlots();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setReservingSlotId(null);
    }
  };

  const handleAdminUpdateCapacity = async () => {
    if (!editSlot) return;
    setSavingEdit(true);
    try {
      await api.patch(`/api/v1/admin/slots/${editSlot.id}/capacity`, {
        capacity: editCapacity,
        reason: editReason.trim() || 'Admin capacity adjustment',
      });
      toast.success(`Slot capacity updated to ${editCapacity}`);
      setEditSlot(null);
      fetchSlots();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Capacity Update Failed');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAdminToggleStatus = async (slot: SlotItem) => {
    try {
      const newStatus = !slot.isActive;
      await api.patch(`/api/v1/admin/slots/${slot.id}/status`, {
        isActive: newStatus,
        reason: newStatus ? 'Reopened by admin' : 'Slot closed by admin',
      });
      toast.success(`Slot ${newStatus ? 'reopened' : 'closed'} successfully`);
      fetchSlots();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Status Update Failed');
    }
  };

  const handleSaveSlotConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await api.put('/api/v1/booking/config', {
        windowMode: cfgWindowMode,
        windowDays: cfgWindowDays,
        defaultCapacity: cfgDefaultCapacity,
        slotDurationMinutes: cfgSlotDuration,
        bufferMinutes: cfgBufferMinutes,
        operatingWindows: cfgOperatingWindows,
      });

      toast.success('Gym schedule configuration updated and regenerated successfully');
      setConfigModalOpen(false);
      fetchSlots();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Save Configuration Failed');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleLockDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lockDateVal) return;
    setLockingDate(true);
    try {
      await api.post('/api/v1/admin/calendar/closure', {
        closureDate: lockDateVal,
        reason: lockReasonVal.trim() || 'Scheduled maintenance / facility closure',
      });
      toast.success(`Gym closed on ${lockDateVal}. Existing bookings cancelled and refunded.`);
      setLockDateVal('');
      setLockReasonVal('');
      fetchClosures();
      fetchSlots();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Lock Date Failed');
    } finally {
      setLockingDate(false);
    }
  };

  const handleUnlockDate = async (closureId: string) => {
    try {
      await api.delete(`/api/v1/admin/calendar/closure/${closureId}`);
      toast.success('Facility closure removed and date reopened');
      fetchClosures();
      fetchSlots();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Unlock Date Failed');
    }
  };

  const handleAddOperatingWindow = () => {
    setCfgOperatingWindows((prev) => [
      ...prev,
      { startTime: '12:00', endTime: '14:00', label: 'Midday Session' },
    ]);
  };

  const handleRemoveOperatingWindow = (idx: number) => {
    setCfgOperatingWindows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpdateOperatingWindow = (idx: number, field: keyof OperatingWindow, val: string) => {
    setCfgOperatingWindows((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: val } : item))
    );
  };

  const filterSlots = (slots: SlotItem[]) =>
    slots.filter((slot) => {
      if (sessionFilter === 'all') return true;
      const hour = parseInt(slot.startTime.split(':')[0], 10);
      return sessionFilter === 'morning' ? hour < 12 : hour >= 12;
    });

  const anyDayLocked = Boolean(data?.days.some((d) => d.isLocked));
  const anyDayQuotaReached = Boolean(
    isStudent && data?.days.some((d) => (d.userBookedCountOnDate || 0) >= 3)
  );

  const renderSlotCard = (slot: SlotItem, day: DaySlots) => {
    const isMorning = parseInt(slot.startTime.split(':')[0], 10) < 12;
    const isDayLimitReached = (day.userBookedCountOnDate || 0) >= 3;
    const isWindowLimitReached = (data?.totalUserBookingsInWindow || 0) >= 3;
    const isPassValid = slot.isPassCovered !== false && day.isPassValidOnDate !== false;
    const canBook =
      isStudent &&
      !slot.isPast &&
      slot.isActive &&
      !slot.isFull &&
      !slot.isBookedByCurrentUser &&
      !isDayLimitReached &&
      !isWindowLimitReached &&
      isPassValid;

    return (
      <div
        key={slot.id}
        className={cn(
          'h-[108px] sm:h-[120px] p-2 sm:p-2.5 rounded-lg bg-surface-elevated flex flex-col justify-between min-w-0 overflow-hidden',
          !isStudent && 'h-[132px] sm:h-[148px]',
          isAdmin && 'h-[164px] sm:h-[180px]',
          isStudent && slot.isBookedByCurrentUser
            ? 'bg-success-muted/20'
            : !slot.isActive || slot.isPast || (isStudent && !isPassValid)
              ? 'opacity-60'
              : ''
        )}
      >
        <div className="flex items-start justify-between gap-1 min-w-0 overflow-hidden">
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground">
              {isMorning ? (
                <Sun className="w-3 h-3 text-warning shrink-0" />
              ) : (
                <Moon className="w-3 h-3 text-primary shrink-0" />
              )}
              <span className="truncate">{isMorning ? 'Morning' : 'Evening'}</span>
            </div>
            <h5 className="text-[10px] sm:text-xs font-semibold text-card-foreground mt-0.5 leading-tight truncate whitespace-nowrap">
              {formatTimeRange(slot.startTime, slot.endTime)}
            </h5>
          </div>
          <Badge
            className="text-[9px] px-1.5 max-w-[3.5rem] truncate"
            tone={
              isStudent && slot.isBookedByCurrentUser
                ? 'success'
                : !slot.isActive
                  ? 'neutral'
                  : slot.isPast
                    ? 'neutral'
                    : isStudent && !isPassValid
                      ? 'warning'
                      : slot.isFull
                        ? 'danger'
                        : slot.occupancyPercentage >= 75
                          ? 'warning'
                          : 'primary'
            }
          >
            {isStudent && slot.isBookedByCurrentUser
              ? 'Yours'
              : !slot.isActive
                ? 'Closed'
                : slot.isPast
                  ? 'Past'
                  : isStudent && !isPassValid
                    ? 'Expired'
                    : slot.isFull
                      ? 'Full'
                      : !isStudent
                        ? `${slot.availableSpots}`
                        : 'Open'}
          </Badge>
        </div>

        {!isStudent && (
          <div className="space-y-1 min-w-0 overflow-hidden shrink-0">
            <div className="flex items-center justify-between text-[10px] sm:text-xs gap-1">
              <span className="text-muted-foreground flex items-center gap-1 min-w-0">
                <Users className="w-3 h-3 shrink-0" />
                <span className="hidden sm:inline truncate">Capacity</span>
              </span>
              <span className="font-medium text-card-foreground shrink-0">
                {slot.bookedCount}/{slot.capacity}
              </span>
            </div>
            <ProgressBar value={slot.occupancyPercentage} />
          </div>
        )}

        <div className="flex flex-col gap-1 shrink-0 overflow-hidden">
          {isStudent && slot.isBookedByCurrentUser ? (
            <span className="text-[10px] sm:text-xs font-medium text-success flex items-center justify-center gap-1 truncate">
              <BookmarkCheck className="w-3.5 h-3.5 shrink-0" /> Reserved
            </span>
          ) : canBook ? (
            <Button
              variant="primary"
              size="xs"
              className="w-full h-7 text-[10px] sm:text-xs shrink-0"
              loading={reservingSlotId === slot.id}
              onClick={() => handleReserveSlot(slot.id)}
            >
              Book
            </Button>
          ) : isStudent && !isPassValid ? (
            <span className="text-[10px] font-medium text-warning text-center truncate">Pass expired</span>
          ) : isTrainer ? (
            <span className="text-[10px] text-muted-foreground text-center truncate">Supervision</span>
          ) : isStaff ? (
            <span className="text-[10px] text-muted-foreground text-center truncate">Direct access</span>
          ) : isStudent ? (
            <span className="text-[10px] text-muted-foreground text-center truncate">
              {slot.isFull ? 'Full' : slot.isPast ? 'Past' : 'Unavailable'}
            </span>
          ) : null}

          {isAdmin && (
            <div className="flex items-center justify-center gap-1">
              <IconButton
                label="Admin Capacity Override"
                size="sm"
                className="h-7 w-7"
                onClick={() => {
                  setEditSlot(slot);
                  setEditCapacity(slot.capacity);
                  setEditReason('');
                }}
              >
                <Sliders className="w-3.5 h-3.5" />
              </IconButton>
              <IconButton
                label={slot.isActive ? 'Close Slot' : 'Reopen Slot'}
                size="sm"
                className="h-7 w-7"
                variant={slot.isActive ? 'default' : 'danger'}
                onClick={() => handleAdminToggleStatus(slot)}
              >
                <Lock className="w-3.5 h-3.5" />
              </IconButton>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold text-foreground mb-2">
            {isStudent ? 'Available Slots' : 'Gym Schedule & Batches'}
          </h1>
          <p className="text-lg text-muted-foreground">
            {isStudent
              ? 'Reserve your daily workout slots up to 3 days in advance'
              : isTrainer
              ? 'Gym batch operational hours, slot capacities, and real-time occupancy'
              : isStaff
              ? 'Daily facility operating schedule and student batch capacities'
              : 'Gym operating schedule and slot capacities'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setConfigModalOpen(true);
                fetchClosures();
              }}
              className="gap-1.5"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Configure Schedule</span>
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={fetchSlots} disabled={loading}>
            <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', loading && 'animate-spin')} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {(isStudent || isStaff || isTrainer) && <FaceRegistrationStatus />}

      {/* Informational Banner for Trainers */}
      {isTrainer && (
        <div className="p-4 rounded-2xl bg-accent-muted/40 flex items-center gap-3 text-xs">
          <Award className="w-5 h-5 text-accent shrink-0" />
          <div>
            <p className="font-bold text-text">Trainer Floor Supervision Access</p>
            <p className="text-[11px] text-secondary mt-0.5">
              Trainers have direct, unrestricted floor supervision access during gym operational shifts. You do not need to book workout slots.
            </p>
          </div>
        </div>
      )}

      {/* Informational Banner for Staff */}
      {isStaff && (
        <div className="p-4 rounded-2xl bg-primary-muted/40 flex items-center gap-3 text-xs">
          <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="font-bold text-text">Staff Inclusive Facility Access</p>
            <p className="text-[11px] text-secondary mt-0.5">
              College staff members have direct inclusive access to the gym facility. You do not need to reserve student booking slots.
            </p>
          </div>
        </div>
      )}

      {/* Success Alert */}
      {bookingSuccessMsg && (
        <Alert tone="success" onDismiss={() => setBookingSuccessMsg(null)}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            <span className="font-semibold">{bookingSuccessMsg}</span>
          </div>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert tone="danger" onDismiss={() => setError(null)}>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-danger shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
        </Alert>
      )}

      {isStudent && (data?.totalUserBookingsInWindow || 0) >= 3 && (
        <Alert tone="warning">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Window Quota Reached (3/3 Slots Active)</p>
              <p className="mt-0.5 text-xs text-secondary">
                You have reached the maximum allowed limit of 3 active bookings across the window. To book a new slot, cancel an existing upcoming booking first.
              </p>
            </div>
          </div>
        </Alert>
      )}

      {isStudent && anyDayQuotaReached && (data?.totalUserBookingsInWindow || 0) < 3 && (
        <Alert tone="warning">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Daily slot quota reached on one or more days</p>
              <p className="mt-0.5 text-xs text-secondary">
                You can still book remaining slots on other available window dates.
              </p>
            </div>
          </div>
        </Alert>
      )}

      {anyDayLocked && (
        <Alert tone="danger">
          <div className="flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-danger shrink-0 mt-0.5" />
            <p className="text-xs text-secondary">
              One or more dates are locked. Closed days show in the calendar below.
            </p>
          </div>
        </Alert>
      )}

      {isStudent && !isEnrolled ? (
        <div className="p-12 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-center bg-surface-elevated/50">
          <Lock className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-bold text-foreground">Slots Locked</h3>
          <p className="text-sm text-secondary mt-2 max-w-md">
            You must register your face on the physical gym turnstile and verify it above before you can view and book slots.
          </p>
        </div>
      ) : data && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span>Calendar ({data.days.length} days)</span>
            </h4>
            <div className="flex items-center gap-1 bg-surface-elevated p-1 rounded-full text-xs">
              <button
                type="button"
                onClick={() => setSessionFilter('all')}
                className={cn(
                  'px-3 py-1 rounded-md font-medium transition-colors',
                  sessionFilter === 'all'
                    ? 'bg-background text-primary shadow-xs'
                    : 'text-secondary hover:text-text'
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setSessionFilter('morning')}
                className={cn(
                  'px-3 py-1 rounded-md font-medium transition-colors',
                  sessionFilter === 'morning'
                    ? 'bg-background text-primary shadow-xs'
                    : 'text-secondary hover:text-text'
                )}
              >
                Morning
              </button>
              <button
                type="button"
                onClick={() => setSessionFilter('evening')}
                className={cn(
                  'px-3 py-1 rounded-md font-medium transition-colors',
                  sessionFilter === 'evening'
                    ? 'bg-background text-primary shadow-xs'
                    : 'text-secondary hover:text-text'
                )}
              >
                Evening
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-3 items-start min-w-0">
            {data.days.map((day) => {
              const daySlots = filterSlots(day.slots);
              return (
                <div
                  key={day.date}
                  className={cn(
                    'min-w-0 rounded-xl bg-card shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col',
                    day.isLocked && 'ring-2 ring-danger/40'
                  )}
                >
                  <div
                    className={cn(
                      'px-1.5 py-2 sm:px-3 sm:py-3 text-center',
                      day.isLocked
                        ? 'bg-danger-muted/30'
                        : day.isToday
                          ? 'bg-primary/15'
                          : 'bg-surface-elevated'
                    )}
                  >
                    <p
                      className={cn(
                        'text-[10px] sm:text-xs font-semibold uppercase tracking-wide truncate',
                        day.isLocked ? 'text-danger' : 'text-primary'
                      )}
                    >
                      {day.isToday ? 'Today' : day.dayLabel || day.dayOfWeek}
                    </p>
                    <p
                      className={cn(
                        'text-xs sm:text-base font-bold leading-tight mt-0.5 truncate',
                        day.isLocked ? 'text-danger' : 'text-card-foreground'
                      )}
                    >
                      {day.dayOfWeek}
                    </p>
                    <p className="text-[10px] sm:text-xs font-mono text-muted-foreground mt-0.5 truncate">
                      {day.date}
                    </p>
                    {day.isLocked ? (
                      <Badge tone="danger" className="mt-1.5 text-[9px] sm:text-[10px]">
                        <Lock className="w-3 h-3" /> Closed
                      </Badge>
                    ) : isStudent && (day.userBookedCountOnDate || 0) > 0 ? (
                      <Badge
                        tone={(day.userBookedCountOnDate || 0) >= 3 ? 'warning' : 'success'}
                        className="mt-1.5 text-[9px] sm:text-[10px]"
                      >
                        {day.userBookedCountOnDate}/3
                      </Badge>
                    ) : (
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-1.5">
                        {day.totalBooked}/{day.totalCapacity}
                      </p>
                    )}
                  </div>

                  <div className="p-1.5 sm:p-3 flex flex-col gap-1.5 sm:gap-2 min-w-0 overflow-hidden">
                    {day.isLocked ? (
                      <div className="py-6 px-1 text-center space-y-1">
                        <Lock className="w-5 h-5 text-danger mx-auto" />
                        <p className="text-[10px] sm:text-xs font-medium text-danger">Facility closed</p>
                        <p className="text-[10px] text-muted-foreground leading-snug">
                          {day.lockReason || 'Scheduled closure'}
                        </p>
                      </div>
                    ) : daySlots.length === 0 ? (
                      <p className="py-6 text-center text-[10px] sm:text-xs text-muted-foreground">
                        No slots
                      </p>
                    ) : (
                      daySlots.map((slot) => renderSlotCard(slot, day))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* Admin Slot Capacity Override Modal */}
      <Modal
        open={Boolean(editSlot)}
        title="Admin Slot Capacity Override"
        onClose={() => setEditSlot(null)}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEditSlot(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={savingEdit}
              onClick={handleAdminUpdateCapacity}
            >
              Save Override
            </Button>
          </>
        }
      >
        {editSlot && (
          <form onSubmit={handleAdminUpdateCapacity} className="space-y-4">
            <div className="p-3 rounded-xl bg-surface-elevated text-xs space-y-1">
              <p className="text-muted">Selected Time Batch:</p>
              <p className="font-bold text-text">
                {editSlot.date} ({formatTimeRange(editSlot.startTime, editSlot.endTime)})
              </p>
            </div>

            <Input
              label="Adjust Capacity Threshold"
              type="number"
              min="1"
              max="500"
              required
              value={editCapacity}
              onChange={(e) => setEditCapacity(parseInt(e.target.value, 10))}
              hint="Default safety threshold is 100 students per batch"
            />

            <Textarea
              label="Audit Justification"
              required
              rows={2}
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="e.g. Gym ventilation maintenance or tournament batch request"
              hint="Required for immutable compliance audit trail"
            />
          </form>
        )}
      </Modal>

      {/* Admin Configure Schedule & Date Locking Modal */}
      {configModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl rounded-3xl bg-surface-elevated shadow-2xl p-6 sm:p-7 space-y-5 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm shrink-0">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-text">Configure Slot Schedule & Locking</h3>
                  <p className="text-xs text-muted">
                    Automated slot generation, operating windows, buffer times, and calendar locking
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfigModalOpen(false)}
                className="p-1.5 rounded-lg text-muted hover:text-text hover:bg-surface"
              >
                <X className="w-4 h-4" />
              </button>

            </div>

            {/* Sub-tabs */}
            <div className="flex items-center gap-2 pb-2 text-xs">
              <button
                type="button"
                onClick={() => setConfigTab('schedule')}
                className={cn(
                  'px-3.5 py-1.5 rounded-xl font-semibold transition-all',
                  configTab === 'schedule'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted hover:text-text hover:bg-surface'
                )}
              >
                Schedule & Operating Hours
              </button>
              <button
                type="button"
                onClick={() => setConfigTab('closures')}
                className={cn(
                  'px-3.5 py-1.5 rounded-xl font-semibold transition-all flex items-center gap-1.5',
                  configTab === 'closures'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-muted hover:text-text hover:bg-surface'
                )}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Lock / Unlock Dates</span>
                {closuresList.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-danger text-white text-[10px]">
                    {closuresList.length}
                  </span>
                )}
              </button>
            </div>

            {/* TAB 1: Schedule Configuration */}
            {configTab === 'schedule' && (
              <form onSubmit={handleSaveSlotConfig} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-text block">Window Days Count</label>
                    <input
                      type="number"
                      min="1"
                      max="14"
                      required
                      value={cfgWindowDays}
                      onChange={(e) => setCfgWindowDays(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 rounded-xl bg-surface text-text text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <p className="text-[10px] text-muted">Number of open bookable days in the window (default 3)</p>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-text block">Default Slot Capacity</label>
                    <input
                      type="number"
                      min="1"
                      max="500"
                      required
                      value={cfgDefaultCapacity}
                      onChange={(e) => setCfgDefaultCapacity(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 rounded-xl bg-surface text-text text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <p className="text-[10px] text-muted">Max students allowed per batch</p>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-text block">Slot Duration (Minutes)</label>
                    <input
                      type="number"
                      min="15"
                      max="240"
                      required
                      value={cfgSlotDuration}
                      onChange={(e) => setCfgSlotDuration(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 rounded-xl bg-surface text-text text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <p className="text-[10px] text-muted">e.g. 60m, 45m, 90m per batch</p>
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-text block">Buffer Between Slots (Minutes)</label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      required
                      value={cfgBufferMinutes}
                      onChange={(e) => setCfgBufferMinutes(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 rounded-xl bg-surface text-text text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <p className="text-[10px] text-muted">
                      Transition gap between batches (e.g. 0m or 15m cleaning gap)
                    </p>
                  </div>
                </div>

                {/* Operating Sessions (Allows leaving in-between hours closed) */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-text flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      <span>Operating Sessions & Facility Hours</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAddOperatingWindow}
                      className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Session</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {cfgOperatingWindows.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-2xl bg-surface flex flex-col sm:flex-row sm:items-center gap-2 justify-between"
                      >
                        <input
                          type="text"
                          value={item.label || ''}
                          onChange={(e) => handleUpdateOperatingWindow(idx, 'label', e.target.value)}
                          placeholder="Session Label (e.g. Morning Batch)"
                          className="px-2.5 py-1.5 rounded-lg bg-surface-elevated text-text text-xs w-full sm:w-44 focus:outline-none focus:ring-1 focus:ring-primary"
                        />

                        <div className="flex items-center gap-2">
                          <span className="text-muted">From</span>
                          <input
                            type="time"
                            required
                            value={item.startTime}
                            onChange={(e) => handleUpdateOperatingWindow(idx, 'startTime', e.target.value)}
                            className="px-2 py-1.5 rounded-lg bg-surface-elevated text-text text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <span className="text-muted">To</span>
                          <input
                            type="time"
                            required
                            value={item.endTime}
                            onChange={(e) => handleUpdateOperatingWindow(idx, 'endTime', e.target.value)}
                            className="px-2 py-1.5 rounded-lg bg-surface-elevated text-text text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        {cfgOperatingWindows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOperatingWindow(idx)}
                            className="p-1.5 text-danger hover:bg-danger-muted/20 rounded-lg self-end sm:self-center"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted">
                    Hours outside these sessions (e.g. 10:00 to 15:00) will be left closed automatically.
                  </p>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2.5">
                  <Button type="button" variant="outline" size="md" onClick={() => setConfigModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="md" loading={savingConfig} className="gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    <span>Save & Automate Slots</span>
                  </Button>
                </div>
              </form>
            )}

            {/* TAB 2: Date Locking & Unlocking */}
            {configTab === 'closures' && (
              <div className="space-y-5 text-xs">
                {/* Lock a Date Form */}
                <form onSubmit={handleLockDate} className="p-4 rounded-2xl bg-surface space-y-3">
                  <h4 className="font-bold text-text flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-danger" />
                    <span>Lock Date & Auto-Cancel Active Bookings</span>
                  </h4>
                  <p className="text-[11px] text-muted">
                    Marking a date as locked cancels all existing bookings on that date, notifies affected students, and opens the next open day in the window.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="font-medium text-text block">Date to Lock</label>
                      <input
                        type="date"
                        required
                        value={lockDateVal}
                        onChange={(e) => setLockDateVal(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-surface-elevated text-text text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-medium text-text block">Closure Reason</label>
                      <input
                        type="text"
                        required
                        value={lockReasonVal}
                        onChange={(e) => setLockReasonVal(e.target.value)}
                        placeholder="e.g. Annual Maintenance / Sports Day"
                        className="w-full px-3 py-2 rounded-xl bg-surface-elevated text-text text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button type="submit" variant="danger" size="sm" loading={lockingDate} className="gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Lock Date & Cancel Bookings</span>
                    </Button>
                  </div>
                </form>

                {/* List of Currently Locked Dates */}
                <div className="space-y-2">
                  <h4 className="font-bold text-text flex items-center gap-1.5">
                    <span>Active Locked Dates & Closures</span>
                  </h4>

                  {loadingClosures ? (
                    <p className="text-muted text-xs py-4 text-center">Loading closures...</p>
                  ) : closuresList.length === 0 ? (
                    <p className="text-muted text-xs py-4 text-center bg-surface rounded-2xl">
                      No dates are currently locked. The gym is operating on standard schedule.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {closuresList.map((c) => (
                        <div
                          key={c.id}
                          className="p-3 rounded-2xl bg-surface-elevated flex items-center justify-between gap-3"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-danger text-xs">{c.closureDate}</span>
                              <Badge tone="danger">Locked</Badge>
                            </div>
                            <p className="text-xs text-text font-medium truncate">{c.reason}</p>
                            <p className="text-[10px] text-muted">
                              {c.cancelledBookingsCount} bookings auto-cancelled
                            </p>
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="xs"
                            onClick={() => handleUnlockDate(c.closureDate)}
                            className="gap-1 text-xs shrink-0"
                          >
                            <Unlock className="w-3 h-3 text-success" />
                            <span>Unlock Date</span>
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
