import { Router } from 'express';
import {
  getDeviceSyncStatus,
  postDeviceSyncPull,
  getReconcilePreview,
} from './device-sync.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export const deviceSyncRouter = Router();

// Portal ↔ api_app ↔ gym-app sync health + manual reconcile (admin only).
deviceSyncRouter.get('/status', requireAuth, requireRole(['admin', 'super_admin']), getDeviceSyncStatus);
deviceSyncRouter.get('/reconcile', requireAuth, requireRole(['admin', 'super_admin']), getReconcilePreview);
deviceSyncRouter.post('/pull', requireAuth, requireRole(['admin', 'super_admin']), postDeviceSyncPull);
