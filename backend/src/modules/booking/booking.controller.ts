import { Request, Response, NextFunction } from 'express';
import { bookingService } from './booking.service.js';
import { reservationService } from './reservation.service.js';
import {
  reserveSlotSchema,
  cancelBookingSchema,
  updateCapacitySchema,
  updateStatusSchema,
  updateSlotConfigSchema,
} from './booking.types.js';

import { ValidationError, UnauthorizedError } from '../../shared/errors/index.js';

export const getRollingWindowSlots = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const studentId = req.user?.personId;
    const result = await bookingService.getRollingWindowSlots(studentId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const getSlotsForDate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const dateStr = req.query.date as string;
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new ValidationError('Query parameter "date" is required in YYYY-MM-DD format');
    }

    const studentId = req.user?.personId;
    const result = await bookingService.getSlotsForDate(dateStr, studentId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const reserveSlot = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required to book a gym slot');
    }

    const parseResult = reserveSlotSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid slot reservation request', parseResult.error.format());
    }

    const booking = await reservationService.createBooking(parseResult.data.slotId, req.user);

    res.status(201).json({
      success: true,
      message: 'Slot reserved successfully',
      data: booking,
    });
  } catch (err) {
    next(err);
  }
};

export const cancelBooking = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const bookingId = req.params.id;
    const parseResult = cancelBookingSchema.safeParse(req.body);
    const reason = parseResult.success ? parseResult.data.reason : undefined;

    const result = await reservationService.cancelBooking(bookingId, req.user, reason);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const getMyBookings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const bookingsList = await reservationService.getMyBookings(req.user.personId);

    res.status(200).json({
      success: true,
      data: bookingsList,
    });
  } catch (err) {
    next(err);
  }
};

export const generateSlots = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await bookingService.ensureSlotsForWindow();

    res.status(200).json({
      success: true,
      message: 'Rolling window slots generated and verified successfully',
    });
  } catch (err) {
    next(err);
  }
};

export const updateSlotCapacity = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = updateCapacitySchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid capacity payload', parseResult.error.format());
    }

    const adminEmail = req.user?.email || 'admin@rajalakshmi.edu.in';
    const updated = await bookingService.updateSlotCapacity(
      req.params.id,
      parseResult.data.capacity,
      parseResult.data.reason,
      adminEmail
    );

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

export const updateSlotStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = updateStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid status payload', parseResult.error.format());
    }

    const adminEmail = req.user?.email || 'admin@rajalakshmi.edu.in';
    const updated = await bookingService.toggleSlotActive(
      req.params.id,
      parseResult.data.isActive,
      parseResult.data.reason,
      adminEmail
    );

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

export const getSlotConfig = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const config = await bookingService.getSlotConfig();

    res.status(200).json({
      success: true,
      data: config,
    });
  } catch (err) {
    next(err);
  }
};

export const updateSlotConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = updateSlotConfigSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid slot configuration payload', parseResult.error.format());
    }

    const adminEmail = req.user?.email || 'admin@rajalakshmi.edu.in';
    const updated = await bookingService.updateSlotConfig(parseResult.data, adminEmail);

    res.status(200).json({
      success: true,
      message: 'Gym schedule configuration updated and regenerated successfully',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

