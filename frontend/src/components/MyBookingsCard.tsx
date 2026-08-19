import React, { useState, useEffect } from 'react';
import { CalendarCheck, Clock, AlertTriangle, RefreshCw, X, CheckCircle2, Ban } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface UserBooking {
  id: string;
  slotId: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  bookingStatus: string;
  accessStatus: string;
  canCancel: boolean;
  isLateCancellation: boolean;
  hoursUntilStart: number;
  createdAt: string;
}

interface MyBookingsCardProps {
  onBookingChanged?: () => void;
}

export const MyBookingsCard: React.FC<MyBookingsCardProps> = ({ onBookingChanged }) => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<UserBooking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelModalBooking, setCancelModalBooking] = useState<UserBooking | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  const fetchBookings = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/booking/my-bookings', {
        credentials: 'include',
      });
      const resData = await res.json();
      if (res.ok) {
        setBookings(resData.data || []);
      }
    } catch {
      // Ignore background fetch error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [user]);

  if (!user || (user.personType !== 'student' && user.role !== 'student')) {
    return null;
  }

  const formatTime12h = (timeStr: string) => {
    const [hh, mm] = timeStr.split(':');
    const hour = parseInt(hh, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${mm} ${ampm}`;
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalBooking) return;
    setCancellingId(cancelModalBooking.id);

    try {
      const res = await fetch(`/api/v1/booking/cancel/${cancelModalBooking.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cancelReason || 'Student requested cancellation' }),
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to cancel booking');

      setCancelModalBooking(null);
      setCancelReason('');
      fetchBookings();
      if (onBookingChanged) onBookingChanged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg);
    } finally {
      setCancellingId(null);
    }
  };

  const activeBookings = bookings.filter((b) => b.bookingStatus === 'booked');

  return (
    <div className="bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-rec-purple-50 dark:bg-rec-purple-900/40 text-rec-purple dark:text-rec-gold border border-rec-purple-200 dark:border-rec-purple-800/40">
            <CalendarCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-gray-900 dark:text-white">
              My Active Gym Reservations
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {activeBookings.length} upcoming confirmed session{activeBookings.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <button
          onClick={fetchBookings}
          disabled={loading}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Refresh bookings"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {activeBookings.length === 0 ? (
        <div className="p-6 rounded-2xl bg-gray-50 dark:bg-[#202024] border border-gray-100 dark:border-gray-800/80 text-center space-y-1">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            No active gym slots reserved
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Choose an available slot from the 3-day booking calendar below to reserve your workout batch.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {activeBookings.map((b) => (
            <div
              key={b.id}
              className="p-4 rounded-2xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50 flex flex-col justify-between space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                    Confirmed Batch
                  </span>
                  <h5 className="font-bold text-sm text-gray-900 dark:text-white mt-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{formatTime12h(b.startTime)} – {formatTime12h(b.endTime)}</span>
                  </h5>
                  <p className="text-xs text-gray-600 dark:text-gray-300 font-mono mt-0.5">
                    {b.slotDate}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Turnstile Ready
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between">
                <span className="text-[11px] text-gray-500">
                  {b.hoursUntilStart > 0 ? `${b.hoursUntilStart} hrs remaining` : 'In Session'}
                </span>

                {b.canCancel && (
                  <button
                    onClick={() => setCancelModalBooking(b)}
                    disabled={cancellingId === b.id}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#18181B] hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60 text-xs font-medium transition-colors"
                  >
                    Cancel Slot
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {cancelModalBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-[#18181B] rounded-3xl border border-gray-200 dark:border-gray-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="w-5 h-5" />
                <h4 className="font-bold text-sm">Cancel Gym Reservation</h4>
              </div>
              <button
                onClick={() => setCancelModalBooking(null)}
                className="p-1 rounded-lg text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
              <p>
                Are you sure you want to cancel your session on{' '}
                <span className="font-bold text-gray-900 dark:text-white">
                  {cancelModalBooking.slotDate} ({formatTime12h(cancelModalBooking.startTime)} - {formatTime12h(cancelModalBooking.endTime)})
                </span>
                ?
              </p>

              {cancelModalBooking.isLateCancellation ? (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200">
                  <p className="font-bold flex items-center gap-1">
                    <Ban className="w-3.5 h-3.5 text-amber-600" /> Late Cancellation Notice (&lt; 2h)
                  </p>
                  <p className="mt-0.5 text-[11px]">
                    This session starts in less than 2 hours. Cancelling now will be logged as a late cancellation strike.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200">
                  <p className="font-bold">Full 2-Hour Notice Maintained</p>
                  <p className="mt-0.5 text-[11px]">
                    Your spot will be returned to the open slot pool with zero penalty.
                  </p>
                </div>
              )}

              <div>
                <label className="font-medium text-gray-700 dark:text-gray-300 block mb-1">
                  Reason (Optional)
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Exam schedule, personal emergency"
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#202024] border border-gray-200 dark:border-gray-700 text-xs focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setCancelModalBooking(null)}
                className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
              >
                Keep Booking
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancellingId !== null}
                className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50"
              >
                {cancellingId ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
