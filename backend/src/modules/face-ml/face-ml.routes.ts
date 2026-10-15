import { Router } from 'express';
import {
  registerFace,
  faceMlHealth,
  photoStatus,
  captureEnroll,
  selfFaceStatus,
  selfFaceRegister,
} from './face-ml.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export const faceMlRouter = Router();

// Student portal: any signed-in student registers their own face (checked against the ID photo on file).
faceMlRouter.get('/me/status', requireAuth, selfFaceStatus);
faceMlRouter.post('/me/register', requireAuth, selfFaceRegister);

// Face Registration page (webcam): teachers (trainers) and admins can register a student's face.
const staffOrAdmin = requireRole(['admin', 'super_admin', 'trainer']);
faceMlRouter.get('/status/:rollNumber', requireAuth, staffOrAdmin, photoStatus);
faceMlRouter.post('/capture-enroll', requireAuth, staffOrAdmin, captureEnroll);

// Face Upload (ID photos) and service health: admins only.
faceMlRouter.use(requireAuth, requireRole(['admin', 'super_admin']));
faceMlRouter.get('/health', faceMlHealth);
// One photo per request. Bulk upload = the admin page sends one request per photo.
faceMlRouter.post('/register', registerFace);
