import { Router } from 'express';
import {
  registerHeartbeat,
  listDevices,
  enrollFace,
  listSyncQueue,
  processSyncQueue,
  retrySync,
} from './biometrics.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export const biometricsRouter = Router();

// Device heartbeat & status
biometricsRouter.post('/device/heartbeat', registerHeartbeat);
biometricsRouter.get('/devices', requireAuth, requireRole(['admin', 'super_admin']), listDevices);

// Face enrollment & async synchronization (Students can self-enroll; admins can enroll any student)
biometricsRouter.post('/face-enroll', requireAuth, enrollFace);
biometricsRouter.post('/face-enroll/me', requireAuth, enrollFace);
biometricsRouter.get('/sync-queue', requireAuth, requireRole(['admin', 'super_admin']), listSyncQueue);
biometricsRouter.post('/sync-process', requireAuth, requireRole(['admin', 'super_admin']), processSyncQueue);
biometricsRouter.post('/sync-retry', requireAuth, requireRole(['admin', 'super_admin']), retrySync);
