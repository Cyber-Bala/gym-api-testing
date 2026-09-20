import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Trash2, ShieldAlert } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';
import { Button, IconButton } from '../ui/Button';
import { Badge, EmptyState } from '../ui/primitives';
import { cn } from '../lib/cn';

interface Booking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  slotStatus: string;
  createdAt: string;
}

interface AdminStudentBookingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: {
    name: string;
    email: string;
    rollNumber: string;
  };
}

export const AdminStudentBookingsModal: React.FC<AdminStudentBookingsModalProps> = ({
  isOpen,
  onClose,
  student,
}) => {
  const toast = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancellingAll, setCancellingAll] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchBookings();
    }
  }, [isOpen, student.email]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const data = await api.get<Booking[]>(`/api/v1/booking/admin/user/${encodeURIComponent(student.email)}/bookings`);
      setBookings(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch bookings for student');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to administratively cancel this booking? The student will NOT receive a violation strike.')) {
      return;
    }

    setCancellingId(bookingId);
    try {
      await api.delete(`/api/v1/booking/admin/bookings/${bookingId}`);
      toast.success('Booking cancelled successfully');
      fetchBookings();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel booking');
    } finally {
      setCancellingId(null);
    }
  };

  const handleCancelAll = async () => {
    if (!window.confirm(`Are you sure you want to cancel ALL active bookings for ${student.name}?`)) {
      return;
    }

    setCancellingAll(true);
    try {
      await api.delete(`/api/v1/booking/admin/user/${encodeURIComponent(student.email)}/bookings`);
      toast.success('All active bookings cancelled successfully');
      fetchBookings();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel bookings');
    } finally {
      setCancellingAll(false);
    }
  };

  if (!isOpen) return null;

  const activeBookingsCount = bookings.filter((b) => b.status === 'booked').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-text flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Manage Bookings
            </h2>
            <p className="text-sm text-muted mt-1">
              {student.name} ({student.rollNumber})
            </p>
          </div>
          <IconButton label="Close" onClick={onClose} variant="ghost">
            <X className="w-5 h-5" />
          </IconButton>
        </div>

        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 text-center text-muted animate-pulse">Loading bookings...</div>
          ) : bookings.length === 0 ? (
            <EmptyState
              icon={<Calendar className="w-8 h-8" />}
              title="No Bookings Found"
              description="This student has not booked any slots recently."
            />
          ) : (
            <div className="space-y-4">
              {bookings.map((booking) => {
                const isBooked = booking.status === 'booked';
                return (
                  <div
                    key={booking.id}
                    className={cn(
                      'p-4 rounded-xl border flex items-center justify-between transition-all',
                      isBooked ? 'bg-surface-elevated border-primary/20' : 'bg-surface/50 border-border opacity-70'
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                        isBooked ? 'bg-primary/10 text-primary' : 'bg-surface text-muted'
                      )}>
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold text-text">
                          {booking.date}
                        </div>
                        <div className="text-sm text-secondary font-mono mt-0.5">
                          {booking.startTime.slice(0, 5)} - {booking.endTime.slice(0, 5)}
                        </div>
                        <div className="mt-1.5 flex gap-2">
                          <Badge tone={isBooked ? 'success' : 'neutral'}>
                            {booking.status.replace(/_/g, ' ')}
                          </Badge>
                          {booking.slotStatus === 'maintenance' && (
                            <Badge tone="warning">Maintenance</Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {isBooked && (
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleCancelBooking(booking.id)}
                        loading={cancellingId === booking.id}
                        disabled={cancellingAll}
                        className="shrink-0"
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> Cancel
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-border bg-surface-elevated flex items-center justify-between rounded-b-2xl">
          <div className="text-sm text-muted font-medium">
            Active Slots: <span className="text-text font-bold">{activeBookingsCount} / 3</span>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {activeBookingsCount > 0 && (
              <Button
                variant="danger"
                onClick={handleCancelAll}
                loading={cancellingAll}
              >
                <ShieldAlert className="w-4 h-4 mr-2" />
                Cancel All {activeBookingsCount} Slots
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
