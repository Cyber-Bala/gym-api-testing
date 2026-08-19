import { Router } from 'express';
import {
  handleZkBioWebhook,
  simulateTurnstileScan,
  getLiveOccupancy,
  getAccessLogs,
  triggerNoShowEvaluation,
} from './access.controller.js';
import { requireAuth, requireRole, optionalAuth } from '../auth/auth.middleware.js';

export const accessRouter = Router();

// Hardware biometric webhook (turnstiles)
accessRouter.post('/webhook/zkbio', handleZkBioWebhook);

// Simulation endpoint for UI / manual testing
accessRouter.post('/simulate', simulateTurnstileScan);

// Live attendance and audit feeds
accessRouter.get('/live-occupancy', optionalAuth, getLiveOccupancy);
accessRouter.get('/logs', requireAuth, requireRole(['admin', 'super_admin', 'trainer']), getAccessLogs);

// Admin trigger for No-Show processing
accessRouter.post(
  '/admin/process-no-shows',
  requireAuth,
  requireRole(['admin', 'super_admin']),
  triggerNoShowEvaluation
);
