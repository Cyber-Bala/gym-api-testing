import { Router } from 'express';
import {
  getDeviceSyncStatus,
  postDeviceSyncPull,
  getReconcilePreview,
  getBridgeHealthStatus,
  postProvisionAll,
  postImportFromZkbio,
  getSyncSettings,
  putSyncSettings,
} from './device-sync.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export const deviceSyncRouter = Router();

// Portal ↔ api_app ↔ gym-app sync health + manual reconcile (admin only).
deviceSyncRouter.get('/health', requireAuth, requireRole(['admin', 'super_admin']), getBridgeHealthStatus);
deviceSyncRouter.get('/status', requireAuth, requireRole(['admin', 'super_admin']), getDeviceSyncStatus);
deviceSyncRouter.get('/reconcile', requireAuth, requireRole(['admin', 'super_admin']), getReconcilePreview);
deviceSyncRouter.post('/pull', requireAuth, requireRole(['admin', 'super_admin']), postDeviceSyncPull);
deviceSyncRouter.post('/provision', requireAuth, requireRole(['admin', 'super_admin']), postProvisionAll);
deviceSyncRouter.post('/import-zkbio', requireAuth, requireRole(['admin', 'super_admin']), postImportFromZkbio);
deviceSyncRouter.get('/settings', requireAuth, requireRole(['admin', 'super_admin']), getSyncSettings);
deviceSyncRouter.put('/settings', requireAuth, requireRole(['admin', 'super_admin']), putSyncSettings);
