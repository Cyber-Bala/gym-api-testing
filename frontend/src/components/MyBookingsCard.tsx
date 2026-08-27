import React, { useState, useEffect } from 'react';
import { CalendarCheck, Clock, RefreshCw, Ban } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { Card, Badge, Modal, Alert } from '../ui/primitives';

import { Button, IconButton } from '../ui/Button';
import { Input } from '../ui/Input';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { cn } from '../lib/cn';

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
  onNavigateToBook?: () => void;
}

export const MyBookingsCard: React.FC<MyBookingsCardProps> = ({ onBookingChanged, onNavigateToBook }) => {
  const { user } = useAuth();
  const toast = useToast();
  const [bookings, setBookings] = useState<UserBooking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelModalBooking, setCancelModalBooking] = useState<UserBooking | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  const fetchBookings = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await api.get<UserBooking[]>('/api/v1/booking/my-bookings');
      if (Array.isArray(data)) {
        setBookings(data);
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
    if (!timeStr) return '';
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
      await api.post(`/api/v1/booking/cancel/${cancelModalBooking.id}`, {
        reason: cancelReason || 'Student requested cancellation',
      });

      toast.success('Reservation cancelled successfully.');
      setCancelModalBooking(null);
      setCancelReason('');
      fetchBookings();
      if (onBookingChanged) onBookingChanged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, 'Cancellation Failed');
    } finally {
      setCancellingId(null);
    }
  };

  const activeBookings = bookings.filter((b) => b.bookingStatus === 'booked');

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold text-foreground">Your Bookings</h1>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToBook && (
            <Button onClick={onNavigateToBook}>
              Book a Slot
            </Button>
          )}
          <IconButton
            label="Refresh bookings"
            size="sm"
            onClick={fetchBookings}
            disabled={loading}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </IconButton>
        </div>
      </div>

      {activeBookings.length === 0 ? (
        <Card className="p-8">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <CalendarCheck className="h-12 w-12 text-muted-foreground" />
            <h2 className="text-2xl font-semibold text-card-foreground">No Bookings Found</h2>
            <p className="text-muted-foreground max-w-sm">
              You haven't booked any workout slots yet. Browse available batches and reserve your gym session.
            </p>
            {onNavigateToBook && (
              <div className="pt-2">
                <Button onClick={onNavigateToBook}>
                  Book a Slot
                </Button>
              </div>
            )}
          </div>
        </Card>
      ) : (

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {activeBookings.map((b) => (
            <div
              key={b.id}
              className="p-4 rounded-2xl bg-success-muted/40 flex flex-col justify-between space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <Badge tone="success">Confirmed Batch</Badge>
                  <h5 className="font-bold text-sm text-text mt-1.5 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-success" />
                    <span>{formatTime12h(b.startTime)} - {formatTime12h(b.endTime)}</span>
                  </h5>
                  <p className="text-xs text-muted font-mono mt-0.5">
                    {b.slotDate}
                  </p>
                </div>
              </div>


              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-muted">
                  {b.hoursUntilStart > 0 ? `${b.hoursUntilStart}h until start` : 'In Session'}
                </span>

                {b.canCancel && (
                  <Button
                    variant="outline"
                    size="xs"
                    className="border-danger/30 text-danger hover:bg-danger-muted"
                    onClick={() => setCancelModalBooking(b)}
                    disabled={cancellingId === b.id}
                  >
                    Cancel Slot
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      <Modal
        open={Boolean(cancelModalBooking)}
        title="Cancel Gym Reservation"
        onClose={() => setCancelModalBooking(null)}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setCancelModalBooking(null)}>
              Keep Booking
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={cancellingId !== null}
              onClick={handleConfirmCancel}
            >
              Confirm Cancellation
            </Button>
          </>
        }
      >
        {cancelModalBooking && (
          <div className="space-y-4 text-xs">
            <p className="text-secondary">
              Are you sure you want to cancel your session on{' '}
              <span className="font-bold text-text">
                {cancelModalBooking.slotDate} ({formatTime12h(cancelModalBooking.startTime)} - {formatTime12h(cancelModalBooking.endTime)})
              </span>
              ?
            </p>

            {cancelModalBooking.isLateCancellation ? (
              <Alert tone="warning">
                <div className="space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <Ban className="w-3.5 h-3.5 text-warning" /> Late Cancellation Notice (&lt; 2h)
                  </p>
                  <p className="text-[11px] text-secondary">
                    This session starts in less than 2 hours. Cancelling now will be logged as a late cancellation strike.
                  </p>
                </div>
              </Alert>
            ) : (
              <Alert tone="success">
                <div className="space-y-1">
                  <p className="font-bold">Full 2-Hour Notice Maintained</p>
                  <p className="text-[11px] text-secondary">
                    Your spot will be returned to the open slot pool with zero penalty.
                  </p>
                </div>
              </Alert>
            )}

            <Input
              label="Cancellation Reason (Optional)"
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Exam schedule, illness, or emergency"
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

