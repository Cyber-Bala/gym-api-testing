import { Router } from 'express';
import {
  registerHeartbeat,
  listDevices,
  enrollFaceFromDevice,
  rejectInAppFaceEnroll,
  listSyncQueue,
  processSyncQueue,
  retrySync,
} from './biometrics.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export const biometricsRouter = Router();

// Device heartbeat & status
biometricsRouter.post('/device/heartbeat', registerHeartbeat);
biometricsRouter.get('/devices', requireAuth, requireRole(['admin', 'super_admin']), listDevices);

// Face enrollment is performed only on the gym biometric machine
biometricsRouter.post('/device/face-enroll', enrollFaceFromDevice);
biometricsRouter.post('/face-enroll', requireAuth, rejectInAppFaceEnroll);
biometricsRouter.post('/face-enroll/me', requireAuth, rejectInAppFaceEnroll);
biometricsRouter.get('/sync-queue', requireAuth, requireRole(['admin', 'super_admin']), listSyncQueue);
biometricsRouter.post('/sync-process', requireAuth, requireRole(['admin', 'super_admin']), processSyncQueue);
biometricsRouter.post('/sync-retry', requireAuth, requireRole(['admin', 'super_admin']), retrySync);
