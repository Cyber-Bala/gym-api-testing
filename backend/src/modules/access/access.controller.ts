import { Request, Response, NextFunction } from 'express';
import { accessService } from './access.service.js';
import { noShowService } from './no-show.service.js';
import { zkbioWebhookSchema } from './access.types.js';
import { ValidationError, UnauthorizedError } from '../../shared/errors/index.js';

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
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const isStaffOrAdmin = Boolean(
      req.user && ['admin', 'super_admin', 'trainer'].includes(req.user.role)
    );
    const stats = await accessService.getLiveOccupancy(isStaffOrAdmin);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (err) {
    next(err);
  }
};

export const getMyAccessHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required to view your access history');
    }

    const history = await accessService.getMyAccessHistory(req.user.personId);

    res.status(200).json({
      success: true,
      data: history,
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

export const triggerFaceVerification = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required to verify face registration');
    }

    const result = await accessService.verifyFaceRegistration(req.user.personId);

    res.status(200).json({
      success: result.success,
      message: result.message,
      data: { enrolled: result.enrolled },
    });
  } catch (err) {
    next(err);
  }
};
