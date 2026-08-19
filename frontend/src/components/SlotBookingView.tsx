import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  Lock,
  Sun,
  Moon,
  BookmarkCheck,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Card, Badge, ProgressBar, Modal, Alert } from '../ui/primitives';
import { Button, IconButton } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { cn } from '../lib/cn';

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
  hasUserBookedOnDate: boolean;
  userBookedSlotId?: string;
  totalCapacity: number;
  totalBooked: number;
  slots: SlotItem[];
}

interface RollingWindowData {
  windowDates: string[];
  days: DaySlots[];
}

interface SlotBookingViewProps {
  onBookingSuccess?: () => void;
}

export const SlotBookingView: React.FC<SlotBookingViewProps> = ({ onBookingSuccess }) => {
  const { user } = useAuth();
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

  const isAdmin = user && ['admin', 'super_admin'].includes(user.role);
  const isStudent = user && (user.personType === 'student' || user.role === 'student');

  const fetchSlots = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/booking/slots/window', {
        credentials: 'include',
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error?.message || 'Failed to load slots');
      setData(resData.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlots();
  }, [user]);

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
      const res = await fetch('/api/v1/booking/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId }),
        credentials: 'include',
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        throw new Error(resData.error?.message || 'Slot reservation failed');
      }

      setBookingSuccessMsg('Gym slot reserved successfully! Your face turnstile scan is ready.');
      fetchSlots();
      if (onBookingSuccess) onBookingSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setReservingSlotId(null);
    }
  };

  const handleAdminUpdateCapacity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSlot) return;

    setSavingEdit(true);
    try {
      const res = await fetch(`/api/v1/booking/slots/${editSlot.id}/capacity`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capacity: editCapacity, reason: editReason }),
        credentials: 'include',
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error?.message || 'Failed to update capacity');

      setEditSlot(null);
      fetchSlots();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAdminToggleStatus = async (slot: SlotItem) => {
    const reason = prompt(`Enter reason to ${slot.isActive ? 'close/cancel' : 'reopen'} this slot:`, 'Schedule adjustment');
    if (!reason) return;

    try {
      const res = await fetch(`/api/v1/booking/slots/${slot.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !slot.isActive, reason }),
        credentials: 'include',
      });

      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error?.message || 'Failed to toggle status');

      fetchSlots();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    }
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
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-base sm:text-lg text-text">
              Gym Slot Booking & Availability
            </h3>
          </div>
          <p className="text-xs text-secondary mt-0.5">
            3-Day Rolling Window (IST) • 100 Cap/Slot • Maximum 1 Slot per Day
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSlots}
            disabled={loading}
          >
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

      {/* 3-Day Rolling Window Tabs */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {data.days.map((day, idx) => {
            const isSelected = selectedDateIdx === idx;
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => setSelectedDateIdx(idx)}
                className={cn(
                  'p-4 rounded-2xl border text-left transition-colors relative',
                  isSelected
                    ? 'border-primary bg-primary-muted shadow-sm'
                    : 'border-border bg-surface hover:bg-border-subtle'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-primary">
                    {day.dayLabel}
                  </span>
                  {day.hasUserBookedOnDate && (
                    <Badge tone="success">
                      <CheckCircle2 className="w-3 h-3" /> Booked
                    </Badge>
                  )}
                </div>
                <h4 className="font-bold text-base text-text mt-1">
                  {day.dayOfWeek}
                </h4>
                <p className="text-xs text-muted font-mono mt-0.5">
                  {day.date}
                </p>

                <div className="mt-3 pt-2 border-t border-border flex items-center justify-between text-xs text-secondary">
                  <span>Occupancy</span>
                  <span className="font-semibold text-text">
                    {day.totalBooked} / {day.totalCapacity}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Single Slot Per Day Rule Reminder */}
      {currentDay?.hasUserBookedOnDate && (
        <Alert tone="warning">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Daily Slot Quota Reached for {currentDay.dayLabel}</p>
              <p className="mt-0.5 text-xs text-secondary">
                You already have a confirmed slot on this date. Students are limited to 1 slot per calendar day.
              </p>
            </div>
          </div>
        </Alert>
      )}

      {/* Day Scholar Pass Reminder */}
      {user?.studentDetails?.residency === 'day_scholar' && (
        <Alert tone="info">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs text-secondary">
              Day Scholar Account: Booking requires an active gym pass tier (1M, 3M, 1Y).
            </span>
          </div>
        </Alert>
      )}

      {/* Session Filter & Slot Grid */}
      {currentDay && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span>Available Batches (10 Daily Slots)</span>
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
                All (10)
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
              const canBook = isStudent && !slot.isPast && slot.isActive && !slot.isFull && !currentDay.hasUserBookedOnDate;

              return (
                <div
                  key={slot.id}
                  className={cn(
                    'p-5 rounded-2xl border bg-surface flex flex-col justify-between space-y-4 transition-colors',
                    slot.isBookedByCurrentUser
                      ? 'border-success/50 bg-success-muted/20'
                      : !slot.isActive || slot.isPast
                      ? 'border-border opacity-60 bg-border-subtle/30'
                      : 'border-border hover:border-primary/40'
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

      {/* Admin Slot Edit Modal */}
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
    </Card>
  );
};

