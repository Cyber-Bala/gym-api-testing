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
} from './booking.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export const bookingRouter = Router();

// Public / Semi-public slot visibility
bookingRouter.get('/slots/window', getRollingWindowSlots);
bookingRouter.get('/slots', getSlotsForDate);

// Student booking & cancellation operations
bookingRouter.post('/reserve', requireAuth, reserveSlot);
bookingRouter.post('/cancel/:id', requireAuth, cancelBooking);
bookingRouter.get('/my-bookings', requireAuth, getMyBookings);

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
