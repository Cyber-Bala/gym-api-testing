import { Router } from 'express';
import {
  registerHeartbeat,
  listDevices,
  adminFaceEnroll,
  deviceEnrollFace,
  processSyncQueue,
  rejectInAppFaceEnroll,
} from './biometrics.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export const biometricsRouter = Router();

// Device heartbeat & status
biometricsRouter.post('/device/heartbeat', registerHeartbeat);
biometricsRouter.get('/devices', requireAuth, requireRole(['admin', 'super_admin']), listDevices);

// Admin portal face registration (webcam capture bridge to ZKBio device)
biometricsRouter.post('/admin-face-enroll', requireAuth, requireRole(['admin', 'super_admin']), adminFaceEnroll);

// Machine device enrollment & sync queue
biometricsRouter.post('/device/face-enroll', deviceEnrollFace);
biometricsRouter.post('/sync-process', requireAuth, requireRole(['admin', 'super_admin']), processSyncQueue);

// Self face enrollment from mobile app is disallowed (must use admin portal or machine)
biometricsRouter.post('/face-enroll', requireAuth, rejectInAppFaceEnroll);
biometricsRouter.post('/face-enroll/me', requireAuth, rejectInAppFaceEnroll);
