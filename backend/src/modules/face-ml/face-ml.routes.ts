import { Router } from 'express';
import { registerFace, faceMlHealth, photoStatus, captureEnroll } from './face-ml.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export const faceMlRouter = Router();

faceMlRouter.use(requireAuth, requireRole(['admin', 'super_admin']));

faceMlRouter.get('/health', faceMlHealth);
// One photo per request. Bulk upload = the admin page sends one request per photo.
faceMlRouter.post('/register', registerFace);

// Face Registration (webcam) page: is a photo uploaded, then capture + match + gate sync.
faceMlRouter.get('/status/:rollNumber', photoStatus);
faceMlRouter.post('/capture-enroll', captureEnroll);
