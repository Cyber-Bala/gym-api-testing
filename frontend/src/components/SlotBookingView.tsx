import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
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
  CreditCard,
  Plus,
  Trash2,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Badge, ProgressBar, Modal, Alert } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/cn';

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
}

export const SlotBookingView: React.FC<SlotBookingViewProps> = ({ onBookingSuccess }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<RollingWindowData | null>(null);
  const [selectedDateIdx, setSelectedDateIdx] = useState<number>(0);
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
  const isStudent = user && (user.personType === 'student' || user.role === 'student');

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

      const successText = 'Gym slot reserved successfully! Your face turnstile scan is ready.';
      setBookingSuccessMsg(successText);
      toast.success(successText, 'Slot Booked');
      fetchSlots();
      if (onBookingSuccess) onBookingSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(msg, 'Reservation Error');
    } finally {
      setReservingSlotId(null);
    }
  };

  const handleAdminUpdateCapacity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSlot) return;

    setSavingEdit(true);
    try {
      await api.patch(`/api/v1/booking/slots/${editSlot.id}/capacity`, {
        capacity: editCapacity,
        reason: editReason,
      });

      toast.success('Slot capacity updated successfully.');
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
    const reason = prompt(
      `Enter reason to ${slot.isActive ? 'close/cancel' : 'reopen'} this slot:`,
      'Schedule adjustment'
    );
    if (!reason) return;

    try {
      await api.patch(`/api/v1/booking/slots/${slot.id}/status`, {
        isActive: !slot.isActive,
        reason,
      });

      toast.success(`Slot status updated (${slot.isActive ? 'closed' : 'reopened'}).`);
      fetchSlots();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Status Toggle Failed');
    }
  };

  const handleSaveSlotConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await api.put('/api/v1/admin/slot-config', {
        windowMode: cfgWindowMode,
        windowDays: cfgWindowDays,
        defaultCapacity: cfgDefaultCapacity,
        slotDurationMinutes: cfgSlotDuration,
        bufferMinutes: cfgBufferMinutes,
        operatingWindows: cfgOperatingWindows,
      });

      toast.success('Slot schedule configured and slots regenerated!');
      setConfigModalOpen(false);
      fetchSlots();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Configuration Save Failed');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleLockDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lockDateVal || !lockReasonVal.trim()) {
      toast.error('Date and reason are required to lock a date.');
      return;
    }

    setLockingDate(true);
    try {
      const res = await api.post<{ message: string }>('/api/v1/admin/calendar/closure', {
        closureDate: lockDateVal,
        reason: lockReasonVal.trim(),
      });

      toast.success(res.message || `Date ${lockDateVal} locked successfully.`);
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

  const handleUnlockDate = async (closureDate: string) => {
    if (!window.confirm(`Unlock date ${closureDate} and re-open gym slots?`)) return;

    try {
      await api.post('/api/v1/admin/calendar/unlock', {
        date: typeof closureDate === 'string' ? closureDate.slice(0, 10) : closureDate,
      });

      toast.success(`Date ${closureDate} unlocked and slots reopened.`);
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

  const currentDay = data?.days[selectedDateIdx];

  const filteredSlots = (currentDay?.slots || []).filter((slot) => {
    if (sessionFilter === 'all') return true;
    const hour = parseInt(slot.startTime.split(':')[0], 10);
    return sessionFilter === 'morning' ? hour < 12 : hour >= 12;
  });

  return (
    <Card className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-base sm:text-lg text-text">Gym Slot Booking</h3>
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
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

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

      {/* Date Window Tabs (Includes Locked Dates with dynamic extension) */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {data.days.map((day, idx) => {
            const isSelected = selectedDateIdx === idx;
            const isLocked = day.isLocked;

            return (
              <button
                key={day.date}
                type="button"
                onClick={() => setSelectedDateIdx(idx)}
                className={cn(
                  'p-4 rounded-2xl text-left transition-all relative shadow-sm border',
                  isSelected
                    ? isLocked
                      ? 'bg-danger text-white border-danger shadow-md'
                      : 'bg-primary text-white border-primary shadow-md'
                    : isLocked
                    ? 'bg-danger-muted/15 border-danger/30 hover:bg-danger-muted/25'
                    : 'bg-surface-elevated border-white/5 hover:bg-surface-elevated/80'
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      'text-[10px] uppercase font-bold tracking-wider',
                      isSelected ? 'text-accent' : isLocked ? 'text-danger' : 'text-primary'
                    )}
                  >
                    {isLocked ? `${day.dayLabel || day.date} (Locked)` : day.dayLabel}
                  </span>

                  {isLocked ? (
                    <Badge tone="danger">
                      <Lock className="w-3 h-3 mr-1" />
                      Locked
                    </Badge>
                  ) : day.userBookedCountOnDate && day.userBookedCountOnDate > 0 ? (
                    <Badge tone={day.userBookedCountOnDate >= 3 ? 'warning' : 'success'}>
                      <CheckCircle2 className="w-3 h-3" /> {day.userBookedCountOnDate}/3 Booked
                    </Badge>
                  ) : null}
                </div>

                <h4
                  className={cn(
                    'font-bold text-base mt-1',
                    isSelected ? 'text-white' : isLocked ? 'text-danger' : 'text-text'
                  )}
                >
                  {day.dayOfWeek}
                </h4>
                <p
                  className={cn(
                    'text-xs font-mono mt-0.5',
                    isSelected ? 'text-white/80' : 'text-muted'
                  )}
                >
                  {day.date}
                </p>

                <div
                  className={cn(
                    'mt-3 pt-2 flex items-center justify-between text-xs',
                    isSelected
                      ? 'text-white/80 border-t border-white/20'
                      : isLocked
                      ? 'text-danger border-t border-danger/20'
                      : 'text-secondary border-t border-border'
                  )}
                >
                  <span>{isLocked ? 'Status' : 'Occupancy'}</span>
                  <span className={cn('font-semibold', isSelected ? 'text-white' : 'text-text')}>
                    {isLocked ? 'Facility Closed' : `${day.totalBooked} / ${day.totalCapacity}`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Locked Date Notice Banner */}
      {currentDay?.isLocked && (
        <Alert tone="danger">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-danger shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-sm">Gym Facility Closed on {currentDay.date}</p>
              <p className="text-xs text-secondary leading-relaxed">
                <strong>Reason:</strong> {currentDay.lockReason || 'Scheduled Maintenance / Blackout'}.
              </p>
              <p className="text-[11px] text-muted">
                All reservations on this date have been cancelled and your booking quota has been restored. Please select another open day from the tabs above.
              </p>
            </div>
          </div>
        </Alert>
      )}

      {/* Quota Indicators and Reminders */}
      {!currentDay?.isLocked && (data?.totalUserBookingsInWindow || 0) >= 3 ? (
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
      ) : !currentDay?.isLocked && (currentDay?.userBookedCountOnDate || 0) >= 3 ? (
        <Alert tone="warning">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Daily Slot Quota Reached for {currentDay?.dayLabel} (3/3 Booked)</p>
              <p className="mt-0.5 text-xs text-secondary">
                You have booked the maximum limit of 3 slots on this day. You can book remaining slots on the other available window dates.
              </p>
            </div>
          </div>
        </Alert>
      ) : null}

      {/* Day Scholar Pass Reminder */}
      {user?.studentDetails?.residency === 'day_scholar' && (
        <Alert tone="info">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs text-secondary">
              Day Scholar Account: Booking requires an active gym pass.
            </span>
          </div>
        </Alert>
      )}

      {/* Session Filter & Slot Grid (Hidden if day is locked) */}
      {currentDay && !currentDay.isLocked && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span>Available Batches ({currentDay.slots.length} Slots Generated)</span>
            </h4>

            {/* Session Tabs */}
            <div className="flex items-center gap-1 bg-border-subtle p-1 rounded-xl border border-border text-xs">
              <button
                type="button"
                onClick={() => setSessionFilter('all')}
                className={cn(
                  'px-3 py-1 rounded-lg font-medium transition-colors',
                  sessionFilter === 'all'
                    ? 'bg-surface text-primary shadow-sm font-semibold'
                    : 'text-secondary hover:text-text'
                )}
              >
                All ({currentDay.slots.length})
              </button>
              <button
                type="button"
                onClick={() => setSessionFilter('morning')}
                className={cn(
                  'px-3 py-1 rounded-lg font-medium transition-colors',
                  sessionFilter === 'morning'
                    ? 'bg-surface text-primary shadow-sm font-semibold'
                    : 'text-secondary hover:text-text'
                )}
              >
                Morning
              </button>
              <button
                type="button"
                onClick={() => setSessionFilter('evening')}
                className={cn(
                  'px-3 py-1 rounded-lg font-medium transition-colors',
                  sessionFilter === 'evening'
                    ? 'bg-surface text-primary shadow-sm font-semibold'
                    : 'text-secondary hover:text-text'
                )}
              >
                Evening
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSlots.map((slot) => {
              const isMorning = parseInt(slot.startTime.split(':')[0], 10) < 12;
              const isDayLimitReached = (currentDay.userBookedCountOnDate || 0) >= 3;
              const isWindowLimitReached = (data?.totalUserBookingsInWindow || 0) >= 3;
              const canBook =
                isStudent &&
                !slot.isPast &&
                slot.isActive &&
                !slot.isFull &&
                !slot.isBookedByCurrentUser &&
                !isDayLimitReached &&
                !isWindowLimitReached;

              return (
                <div
                  key={slot.id}
                  className={cn(
                    'p-5 rounded-2xl bg-surface-elevated flex flex-col justify-between space-y-4 shadow-sm transition-all hover:shadow-md',
                    slot.isBookedByCurrentUser
                      ? 'bg-success-muted/25'
                      : !slot.isActive || slot.isPast
                      ? 'opacity-60 bg-surface-elevated/40'
                      : ''
                  )}
                >
                  {/* Slot Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-muted">
                        {isMorning ? (
                          <Sun className="w-3.5 h-3.5 text-warning" />
                        ) : (
                          <Moon className="w-3.5 h-3.5 text-primary" />
                        )}
                        <span>{isMorning ? 'Morning Batch' : 'Evening Batch'}</span>
                      </div>
                      <h5 className="text-sm sm:text-base font-bold text-text mt-1">
                        {formatTime12h(slot.startTime)} – {formatTime12h(slot.endTime)}
                      </h5>
                    </div>

                    <Badge
                      tone={
                        slot.isBookedByCurrentUser
                          ? 'success'
                          : !slot.isActive
                          ? 'neutral'
                          : slot.isPast
                          ? 'neutral'
                          : slot.isFull
                          ? 'danger'
                          : slot.occupancyPercentage >= 75
                          ? 'warning'
                          : 'primary'
                      }
                    >
                      {slot.isBookedByCurrentUser
                        ? 'Your Slot'
                        : !slot.isActive
                        ? 'Closed'
                        : slot.isPast
                        ? 'Past'
                        : slot.isFull
                        ? 'Full'
                        : 'Available'}
                    </Badge>
                  </div>

                  {/* Occupancy Progress */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        <span>Capacity</span>
                      </span>
                      <span className="font-semibold text-text">
                        {slot.bookedCount} / {slot.capacity}
                      </span>
                    </div>
                    <ProgressBar value={slot.occupancyPercentage} />
                  </div>

                  {/* Actions & Admin Controls */}
                  <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                    <span className="text-xs text-muted">
                      {slot.availableSpots} spots open
                    </span>

                    <div className="flex items-center gap-1.5">
                      {slot.isBookedByCurrentUser ? (
                        <span className="text-xs font-bold text-success flex items-center gap-1">
                          <BookmarkCheck className="w-4 h-4" /> Reserved
                        </span>
                      ) : canBook ? (
                        <Button
                          variant="primary"
                          size="xs"
                          loading={reservingSlotId === slot.id}
                          onClick={() => handleReserveSlot(slot.id)}
                        >
                          Book Slot
                        </Button>
                      ) : null}

                      {isAdmin && (
                        <IconButton
                          label="Admin Capacity Override"
                          size="sm"
                          onClick={() => {
                            setEditSlot(slot);
                            setEditCapacity(slot.capacity);
                            setEditReason('');
                          }}
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </IconButton>
                      )}

                      {isAdmin && (
                        <IconButton
                          label={slot.isActive ? 'Close Slot' : 'Reopen Slot'}
                          size="sm"
                          variant={slot.isActive ? 'default' : 'danger'}
                          onClick={() => handleAdminToggleStatus(slot)}
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </IconButton>
                      )}
                    </div>
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
            <div className="p-3 rounded-xl border border-border bg-border-subtle text-xs space-y-1">
              <p className="text-muted">Selected Time Batch:</p>
              <p className="font-bold text-text">
                {editSlot.date} ({formatTime12h(editSlot.startTime)} - {formatTime12h(editSlot.endTime)})
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
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
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
                ✕
              </button>
            </div>

            {/* Sub-tabs */}
            <div className="flex items-center gap-2 border-b border-white/5 pb-2 text-xs">
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
                <div className="space-y-2 pt-2 border-t border-white/5">
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

                <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-white/5">
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
                          className="p-3 rounded-2xl bg-surface flex items-center justify-between gap-3 border border-white/5"
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
    </Card>
  );
};
