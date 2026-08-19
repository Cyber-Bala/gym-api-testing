import { Request, Response, NextFunction } from 'express';
import { integrationService } from './integration.service.js';

export const runAllFlows = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const summary = await integrationService.runAllE2EWorkflows();

    res.status(200).json({
      success: true,
      message: 'All 12 End-to-End system integration workflows executed successfully',
      data: summary,
    });
  } catch (err) {
    next(err);
  }
};
