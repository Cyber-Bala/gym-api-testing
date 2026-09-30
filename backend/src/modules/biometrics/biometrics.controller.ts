import { Request, Response, NextFunction } from 'express';
import { biometricsService } from './biometrics.service.js';
import {
  deviceHeartbeatSchema,
  adminFaceEnrollSchema,
} from './biometrics.types.js';
import { ValidationError, ForbiddenError } from '../../shared/errors/index.js';

export const registerHeartbeat = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = deviceHeartbeatSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid heartbeat payload', parseResult.error.format());
    }

    const device = biometricsService.registerHeartbeat(
      parseResult.data.deviceId,
      parseResult.data.deviceName,
      parseResult.data.ipAddress,
      parseResult.data.firmwareVersion,
      parseResult.data.status
    );

    res.status(200).json({
      success: true,
      data: device,
    });
  } catch (err) {
    next(err);
  }
};

export const listDevices = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const devices = biometricsService.listDevices();

    res.status(200).json({
      success: true,
      data: devices,
    });
  } catch (err) {
    next(err);
  }
};

export const adminFaceEnroll = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = adminFaceEnrollSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid face enrollment payload', parseResult.error.format());
    }

    const result = await biometricsService.adminEnrollStudentFace(parseResult.data);

    res.status(200).json({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
};

export const deviceEnrollFace = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await biometricsService.enrollStudentFace(req.body);
    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const processSyncQueue = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = biometricsService.processSyncQueue();
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const rejectInAppFaceEnroll = async (
  _req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  next(new ForbiddenError('Face enrollment must be completed on the gym biometric machine or admin panel'));
};
