import { Request, Response, NextFunction } from 'express';
import { faceMlService } from './face-ml.service.js';
import { faceMlCaptureSchema, faceMlRegisterSchema } from './face-ml.types.js';
import { ValidationError } from '../../shared/errors/index.js';

export const registerFace = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = faceMlRegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid face upload payload', parsed.error.format());
    }
    const result = await faceMlService.register(parsed.data);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const faceMlHealth = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.status(200).json({ success: true, data: await faceMlService.health() });
  } catch (err) {
    next(err);
  }
};

export const photoStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.status(200).json({ success: true, data: await faceMlService.hasPhoto(req.params.rollNumber) });
  } catch (err) {
    next(err);
  }
};

export const captureEnroll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = faceMlCaptureSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid capture payload', parsed.error.format());
    }
    res.status(200).json({ success: true, data: await faceMlService.captureEnroll(parsed.data) });
  } catch (err) {
    next(err);
  }
};
