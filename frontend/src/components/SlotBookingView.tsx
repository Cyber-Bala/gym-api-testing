import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  X,
  Lock,
  Sun,
  Moon,
  BookmarkCheck,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

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

  return (
    <div className="bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-rec-purple dark:text-rec-gold" />
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
              Gym Slot Booking & Availability
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            3-Day Rolling Window (IST) • 100 Cap/Slot • Maximum 1 Slot per Day
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchSlots}
            disabled={loading}
            className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
            title="Refresh availability"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {bookingSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold">{bookingSuccessMsg}</span>
          </div>
          <button onClick={() => setBookingSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-semibold">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-700 hover:text-red-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3-Day Rolling Window Selector */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {data.days.map((day, idx) => (
            <button
              key={day.date}
              onClick={() => setSelectedDateIdx(idx)}
              className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden ${
                selectedDateIdx === idx
                  ? 'border-rec-purple dark:border-rec-gold bg-rec-purple-50/40 dark:bg-rec-purple-950/30 shadow-md'
                  : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-gray-50/50 dark:bg-[#202024]/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-rec-purple dark:text-rec-gold">
                  {day.dayLabel}
                </span>
                {day.hasUserBookedOnDate && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/40">
                    <CheckCircle2 className="w-3 h-3" /> Booked
                  </span>
                )}
              </div>
              <h4 className="font-bold text-base text-gray-900 dark:text-white mt-1">
                {day.dayOfWeek}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                {day.date}
              </p>

              <div className="mt-3 pt-2 border-t border-gray-200/60 dark:border-gray-800/60 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                <span>Occupancy</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {day.totalBooked} / {day.totalCapacity}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Single Slot Per Day Rule Reminder */}
      {currentDay?.hasUserBookedOnDate && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-bold">Daily Slot Quota Reached for {currentDay.dayLabel}</p>
            <p className="mt-0.5 opacity-90">
              You already have a confirmed slot on this date. In accordance with REC gym policy, students are limited to 1 slot per calendar day.
            </p>
          </div>
        </div>
      )}

      {/* Day Scholar Pass Banner */}
      {user?.studentDetails?.residency === 'day_scholar' && (
        <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 text-blue-800 dark:text-blue-200 text-xs flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            Day Scholar account: Slot booking requires an active 1-Month, 3-Month, or 1-Year pass.
          </span>
        </div>
      )}

      {/* Slots Grid */}
      {currentDay && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <span>Available Time Batches (10 Daily Slots)</span>
            </h4>
            <span className="text-xs text-gray-500">
              {currentDay.slots.filter((s) => !s.isPast && s.isActive && !s.isFull).length} slots open
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentDay.slots.map((slot) => {
              const isMorning = parseInt(slot.startTime.split(':')[0], 10) < 12;

              let cardBorder = 'border-gray-200 dark:border-gray-800';
              let badgeColor = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40';

              if (slot.isBookedByCurrentUser) {
                cardBorder = 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20';
                badgeColor = 'bg-emerald-500 text-white border-emerald-600';
              } else if (!slot.isActive) {
                cardBorder = 'border-gray-200 dark:border-gray-800 opacity-60 bg-gray-50 dark:bg-[#202024]';
                badgeColor = 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-300';
              } else if (slot.isPast) {
                cardBorder = 'border-gray-200 dark:border-gray-800 opacity-60 bg-gray-50 dark:bg-[#202024]';
                badgeColor = 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border-gray-300';
              } else if (slot.isFull) {
                badgeColor = 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-800/40';
              } else if (slot.occupancyPercentage >= 75) {
                badgeColor = 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/40';
              }

              const canBook = isStudent && !slot.isPast && slot.isActive && !slot.isFull && !currentDay.hasUserBookedOnDate;

              return (
                <div
                  key={slot.id}
                  className={`p-5 rounded-2xl border ${cardBorder} flex flex-col justify-between space-y-4 transition-all hover:shadow-sm`}
                >
                  {/* Slot Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {isMorning ? (
                          <Sun className="w-3.5 h-3.5 text-amber-500" />
                        ) : (
                          <Moon className="w-3.5 h-3.5 text-indigo-400" />
                        )}
                        <span>{isMorning ? 'Morning Session' : 'Evening Session'}</span>
                      </div>
                      <h5 className="text-base font-bold text-gray-900 dark:text-white mt-1">
                        {formatTime12h(slot.startTime)} – {formatTime12h(slot.endTime)}
                      </h5>
                    </div>

                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border ${badgeColor}`}>
                      {slot.isBookedByCurrentUser
                        ? 'Your Slot'
                        : !slot.isActive
                        ? 'Closed'
                        : slot.isPast
                        ? 'Past'
                        : slot.isFull
                        ? 'Full'
                        : 'Available'}
                    </span>
                  </div>

                  {/* Occupancy Progress Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        <span>Occupancy</span>
                      </span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {slot.bookedCount} / {slot.capacity}
                      </span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          slot.occupancyPercentage >= 95
                            ? 'bg-red-500'
                            : slot.occupancyPercentage >= 75
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${slot.occupancyPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Action & Admin Controls */}
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {slot.availableSpots} spots remaining
                    </span>

                    <div className="flex items-center gap-1.5">
                      {slot.isBookedByCurrentUser ? (
                        <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <BookmarkCheck className="w-4 h-4" /> Reserved
                        </span>
                      ) : canBook ? (
                        <button
                          onClick={() => handleReserveSlot(slot.id)}
                          disabled={reservingSlotId === slot.id}
                          className="px-3 py-1.5 rounded-xl bg-rec-purple hover:bg-rec-purple-600 text-white font-semibold text-xs shadow-md shadow-rec-purple/20 transition-all disabled:opacity-50"
                        >
                          {reservingSlotId === slot.id ? 'Reserving...' : 'Book Slot'}
                        </button>
                      ) : null}

                      {isAdmin && (
                        <button
                          onClick={() => {
                            setEditSlot(slot);
                            setEditCapacity(slot.capacity);
                            setEditReason('');
                          }}
                          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                          title="Admin Capacity Override"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {isAdmin && (
                        <button
                          onClick={() => handleAdminToggleStatus(slot)}
                          className={`p-1.5 rounded-lg border text-xs transition-colors ${
                            slot.isActive
                              ? 'border-gray-200 dark:border-gray-700 hover:bg-red-50 text-gray-500'
                              : 'border-emerald-300 text-emerald-600 bg-emerald-50'
                          }`}
                          title={slot.isActive ? 'Emergency Close Slot' : 'Reopen Slot'}
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </button>
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
      {editSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                Admin Slot Override
              </h4>
              <button onClick={() => setEditSlot(null)} className="p-1 rounded-lg text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdminUpdateCapacity} className="space-y-3 text-xs">
              <div>
                <p className="text-gray-500">Selected Slot:</p>
                <p className="font-semibold text-gray-900 dark:text-white mt-0.5">
                  {editSlot.date} ({formatTime12h(editSlot.startTime)} - {formatTime12h(editSlot.endTime)})
                </p>
              </div>

              <div>
                <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Adjust Capacity (Default: 100)
                </label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  required
                  value={editCapacity}
                  onChange={(e) => setEditCapacity(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-200 dark:border-gray-700 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Audit Reason
                </label>
                <textarea
                  required
                  rows={2}
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="e.g. Gym ventilation maintenance or special batch request"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-200 dark:border-gray-700 text-xs focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditSlot(null)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-1.5 rounded-xl bg-rec-purple text-white font-semibold disabled:opacity-50"
                >
                  {savingEdit ? 'Updating...' : 'Save Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
