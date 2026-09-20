import { Router } from 'express';
import {
  registerHeartbeat,
  listDevices,
  rejectInAppFaceEnroll,
} from './biometrics.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export const biometricsRouter = Router();

// Device heartbeat & status
biometricsRouter.post('/device/heartbeat', registerHeartbeat);
biometricsRouter.get('/devices', requireAuth, requireRole(['admin', 'super_admin']), listDevices);

// Face enrollment is performed only on the gym biometric machine
biometricsRouter.post('/face-enroll', requireAuth, rejectInAppFaceEnroll);
biometricsRouter.post('/face-enroll/me', requireAuth, rejectInAppFaceEnroll);
