import { Router } from 'express';
import {
  getExecutiveAnalytics,
  getCalendarClosures,
  createCalendarClosure,
  unlockCalendarDate,
  getSlotConfigHandler,
  updateSlotConfigHandler,
  getAuditLogs,
  getRolesHandler,
  getAdminsHandler,
  createAdminHandler,
  updateAdminHandler,
  deleteAdminHandler,
} from './admin.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export const adminRouter = Router();

// Executive analytics
adminRouter.get('/analytics', requireAuth, requireRole(['admin', 'super_admin']), getExecutiveAnalytics);

// Gym operational calendar & date locking
adminRouter.get('/calendar', requireAuth, requireRole(['admin', 'super_admin']), getCalendarClosures);
adminRouter.post('/calendar/closure', requireAuth, requireRole(['admin', 'super_admin']), createCalendarClosure);
adminRouter.post('/calendar/unlock', requireAuth, requireRole(['admin', 'super_admin']), unlockCalendarDate);

// Slot Schedule & Window Configuration
adminRouter.get('/slot-config', requireAuth, requireRole(['admin', 'super_admin']), getSlotConfigHandler);
adminRouter.put('/slot-config', requireAuth, requireRole(['admin', 'super_admin']), updateSlotConfigHandler);

// System audit logs
adminRouter.get('/audit-logs', requireAuth, requireRole(['admin', 'super_admin']), getAuditLogs);

// Role & Administrator Management (Super Admin Exclusive)
adminRouter.get('/roles', requireAuth, requireRole(['super_admin', 'admin']), getRolesHandler);
adminRouter.get('/admins', requireAuth, requireRole(['super_admin']), getAdminsHandler);
adminRouter.post('/admins', requireAuth, requireRole(['super_admin']), createAdminHandler);
adminRouter.patch('/admins/:id', requireAuth, requireRole(['super_admin']), updateAdminHandler);
adminRouter.delete('/admins/:id', requireAuth, requireRole(['super_admin']), deleteAdminHandler);
