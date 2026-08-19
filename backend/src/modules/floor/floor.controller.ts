import { Request, Response, NextFunction } from 'express';
import { floorService } from './floor.service.js';
import { manualCheckoutSchema } from './floor.types.js';
import { ValidationError, UnauthorizedError } from '../../shared/errors/index.js';

export const getFloorStatus = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const status = await floorService.getCurrentFloorStatus();

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (err) {
    next(err);
  }
};

export const manualFloorCheckout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = manualCheckoutSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid manual checkout payload', parseResult.error.format());
    }

    const trainerEmail = req.user?.email || 'trainer@rajalakshmi.edu.in';
    const result = await floorService.manualFloorCheckout(
      parseResult.data.sessionId,
      parseResult.data.reason,
      trainerEmail
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const getStaffWellnessStats = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const month = req.query.month as string | undefined;
    const stats = await floorService.getStaffWellnessStats(month);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (err) {
    next(err);
  }
};
