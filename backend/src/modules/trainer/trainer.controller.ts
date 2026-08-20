import { Request, Response, NextFunction } from 'express';
import { trainerService } from './trainer.service.js';
import { updateRateSchema, updateStipendConfigSchema } from './trainer.types.js';
import { ValidationError, UnauthorizedError } from '../../shared/errors/index.js';

export const getMyTrainerProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Authentication required');

    const profile = await trainerService.getTrainerProfile(req.user.personId);

    res.status(200).json({
      success: true,
      data: profile,
    });
  } catch (err) {
    next(err);
  }
};

export const clockIn = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Authentication required');

    const shift = await trainerService.clockIn(req.user.personId);

    res.status(200).json({
      success: true,
      message: 'Clocked in successfully to gym shift',
      data: shift,
    });
  } catch (err) {
    next(err);
  }
};

export const clockOut = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) throw new UnauthorizedError('Authentication required');

    const shift = await trainerService.clockOut(req.user.personId);

    res.status(200).json({
      success: true,
      message: 'Clocked out successfully',
      data: shift,
    });
  } catch (err) {
    next(err);
  }
};

export const getMonthlyPayroll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const month = req.query.month as string | undefined;
    const payroll = await trainerService.getMonthlyPayroll(month);

    res.status(200).json({
      success: true,
      data: payroll,
    });
  } catch (err) {
    next(err);
  }
};

export const updateHourlyRate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = updateRateSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid rate payload', parseResult.error.format());
    }

    const adminEmail = req.user?.email || 'admin@rajalakshmi.edu.in';
    const updated = await trainerService.updateHourlyRate(
      req.params.id,
      parseResult.data.hourlyRate,
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

export const getStipendConfig = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const config = await trainerService.getStipendConfig();
    res.status(200).json({
      success: true,
      data: config,
    });
  } catch (err) {
    next(err);
  }
};

export const updateStipendConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = updateStipendConfigSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid stipend configuration payload', parseResult.error.format());
    }

    const adminEmail = req.user?.email || 'admin@rajalakshmi.edu.in';
    const updated = await trainerService.updateStipendConfig(parseResult.data, adminEmail);

    res.status(200).json({
      success: true,
      message: 'Trainer stipend configuration updated successfully',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};
