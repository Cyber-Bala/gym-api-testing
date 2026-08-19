import { Request, Response, NextFunction } from 'express';
import { accessService } from './access.service.js';
import { noShowService } from './no-show.service.js';
import { zkbioWebhookSchema } from './access.types.js';
import { ValidationError } from '../../shared/errors/index.js';

export const handleZkBioWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = zkbioWebhookSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid ZKBio webhook payload', parseResult.error.format());
    }

    const decision = await accessService.processTurnstileEvent(parseResult.data);

    // ZKBio Hardware response format
    res.status(200).json({
      code: decision.accessGranted ? 200 : 403,
      message: decision.message,
      data: decision,
    });
  } catch (err) {
    next(err);
  }
};

export const simulateTurnstileScan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = zkbioWebhookSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid simulation payload', parseResult.error.format());
    }

    const decision = await accessService.processTurnstileEvent(parseResult.data);

    res.status(200).json({
      success: decision.accessGranted,
      data: decision,
    });
  } catch (err) {
    next(err);
  }
};

export const getLiveOccupancy = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stats = await accessService.getLiveOccupancy();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (err) {
    next(err);
  }
};

export const getAccessLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const logs = await accessService.getAccessLogs(limit);

    res.status(200).json({
      success: true,
      data: logs,
    });
  } catch (err) {
    next(err);
  }
};

export const triggerNoShowEvaluation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const targetSlotId = req.body.slotId as string | undefined;
    const result = await noShowService.processSlotNoShows(targetSlotId);

    res.status(200).json({
      success: true,
      message: 'No-Show evaluation completed',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};
