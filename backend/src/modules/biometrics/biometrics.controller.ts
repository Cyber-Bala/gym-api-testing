import { Request, Response, NextFunction } from 'express';
import { biometricsService } from './biometrics.service.js';
import {
  deviceHeartbeatSchema,
  deviceEnrollFaceSchema,
  retrySyncSchema,
} from './biometrics.types.js';
import { ValidationError, ForbiddenError, NotFoundError } from '../../shared/errors/index.js';

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

export const rejectInAppFaceEnroll = async (
  _req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  next(new ForbiddenError('Face enrollment must be completed on the gym biometric machine'));
};

export const enrollFaceFromDevice = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = deviceEnrollFaceSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid face enrollment payload', parseResult.error.format());
    }

    const device = biometricsService.getDevice(parseResult.data.deviceId);
    if (!device) {
      throw new NotFoundError(`Enrollment device '${parseResult.data.deviceId}' is not registered`);
    }

    const task = await biometricsService.enrollStudentFace(
      parseResult.data.personIdentifier,
      parseResult.data.faceImageBase64
    );

    res.status(201).json({
      success: true,
      message: 'Face biometric enrolled on machine and queued for turnstile synchronization',
      data: task,
    });
  } catch (err) {
    next(err);
  }
};

export const listSyncQueue = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const queue = biometricsService.listSyncQueue();

    res.status(200).json({
      success: true,
      data: queue,
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
      message: `Processed ${result.syncedCount} biometric sync task(s)`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const retrySync = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = retrySyncSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid retry payload', parseResult.error.format());
    }

    const task = biometricsService.retrySync(parseResult.data.syncId);

    res.status(200).json({
      success: true,
      message: 'Sync task queued for retry',
      data: task,
    });
  } catch (err) {
    next(err);
  }
};
