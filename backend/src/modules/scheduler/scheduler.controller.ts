import { Request, Response, NextFunction } from 'express';
import { schedulerService } from './scheduler.service.js';

export const getSchedulerStatus = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const status = schedulerService.getStatus();
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (err) {
    next(err);
  }
};

export const triggerManualSweep = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const results = await schedulerService.runSweeps();
    res.status(200).json({
      success: true,
      message: 'Background scheduler sweeps executed successfully',
      data: results,
    });
  } catch (err) {
    next(err);
  }
};
