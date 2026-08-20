import { Request, Response, NextFunction } from 'express';
import { biometricsService } from './biometrics.service.js';
import {
  deviceHeartbeatSchema,
  enrollFaceSchema,
  retrySyncSchema,
} from './biometrics.types.js';
import { ValidationError, UnauthorizedError } from '../../shared/errors/index.js';
import { authService } from '../auth/auth.service.js';

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

export const enrollFace = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required to enroll face biometric');
    }

    const parseResult = enrollFaceSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid face enrollment payload', parseResult.error.format());
    }

    const isStaffOrAdmin = ['admin', 'super_admin', 'staff', 'trainer'].includes(req.user.role);
    const targetStudentId = isStaffOrAdmin && parseResult.data.studentId
      ? parseResult.data.studentId
      : req.user.personId;

    const task = await biometricsService.enrollStudentFace(
      targetStudentId,
      parseResult.data.faceImageBase64
    );

    // Sync fresh user data to active session in Redis
    let freshUser = req.user;
    if (req.sessionId) {
      freshUser = await authService.findAndSyncProvisionedUser(req.user.email);
      await authService.updateSessionUser(req.sessionId, freshUser);
    }

    res.status(201).json({
      success: true,
      message: 'Face biometric enrolled and queued for turnstile synchronization',
      data: {
        ...task,
        user: freshUser,
      },
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
