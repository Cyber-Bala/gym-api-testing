import { Request, Response, NextFunction } from 'express';
import { adminService } from './admin.service.js';
import { createClosureSchema } from './admin.types.js';
import { ValidationError } from '../../shared/errors/index.js';

export const getExecutiveAnalytics = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const analytics = await adminService.getExecutiveAnalytics();

    res.status(200).json({
      success: true,
      data: analytics,
    });
  } catch (err) {
    next(err);
  }
};

export const getCalendarClosures = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const closures = await adminService.getCalendarClosures();

    res.status(200).json({
      success: true,
      data: closures,
    });
  } catch (err) {
    next(err);
  }
};

export const createCalendarClosure = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = createClosureSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid closure payload', parseResult.error.format());
    }

    const adminEmail = req.user?.email || 'admin@rajalakshmi.edu.in';
    const result = await adminService.createCalendarClosure(
      parseResult.data.closureDate,
      parseResult.data.reason,
      adminEmail
    );

    res.status(201).json({
      success: true,
      message: `Gym closed for ${result.closureDate}. ${result.cancelledBookingsCount} bookings cancelled.`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const getAuditLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const logs = await adminService.getAuditLogs(limit);

    res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (err) {
    next(err);
  }
};
