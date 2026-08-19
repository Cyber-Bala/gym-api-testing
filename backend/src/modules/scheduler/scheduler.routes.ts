import { Router } from 'express';
import { getSchedulerStatus, triggerManualSweep } from './scheduler.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export const schedulerRouter = Router();

schedulerRouter.use(requireAuth);

schedulerRouter.get('/status', requireRole(['admin', 'super_admin']), getSchedulerStatus);
schedulerRouter.post('/run-now', requireRole(['admin', 'super_admin']), triggerManualSweep);
schedulerRouter.post('/trigger-now', requireRole(['admin', 'super_admin']), triggerManualSweep);
