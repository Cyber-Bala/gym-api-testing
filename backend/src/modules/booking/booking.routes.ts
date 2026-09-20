import { Router } from 'express';
import {
  getRollingWindowSlots,
  getSlotsForDate,
  reserveSlot,
  cancelBooking,
  getMyBookings,
  generateSlots,
  updateSlotCapacity,
  updateSlotStatus,
  getSlotConfig,
  updateSlotConfig,
  getAdminBookingsByEmail,
  adminCancelBooking,
  adminCancelAllBookings,
} from './booking.controller.js';
import { requireAuth, optionalAuth, requireRole } from '../auth/auth.middleware.js';

export const bookingRouter = Router();

// Slot schedule configuration
bookingRouter.get('/config', optionalAuth, getSlotConfig);
bookingRouter.put('/config', requireAuth, requireRole(['admin', 'super_admin']), updateSlotConfig);

// Slot visibility with optional user session
bookingRouter.get('/slots/window', optionalAuth, getRollingWindowSlots);
bookingRouter.get('/slots', optionalAuth, getSlotsForDate);

// Student booking & cancellation operations
bookingRouter.post('/reserve', requireAuth, reserveSlot);
bookingRouter.post('/cancel/:id', requireAuth, cancelBooking);
bookingRouter.get('/my-bookings', requireAuth, getMyBookings);

// Admin bookings management
bookingRouter.get(
  '/admin/user/:email/bookings',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  getAdminBookingsByEmail
);

bookingRouter.delete(
  '/admin/bookings/:id',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  adminCancelBooking
);

bookingRouter.delete(
  '/admin/user/:email/bookings',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  adminCancelAllBookings
);

// Admin slot maintenance & overrides
bookingRouter.post(
  '/slots/generate',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  generateSlots
);

bookingRouter.patch(
  '/slots/:id/capacity',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  updateSlotCapacity
);

bookingRouter.patch(
  '/slots/:id/status',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  updateSlotStatus
);

