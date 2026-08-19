import { Router } from 'express';
import {
  getExecutiveAnalytics,
  getCalendarClosures,
  createCalendarClosure,
  getAuditLogs,
} from './admin.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export const adminRouter = Router();

// Executive analytics
adminRouter.get('/analytics', requireAuth, requireRole(['admin', 'super_admin']), getExecutiveAnalytics);

// Gym operational calendar
adminRouter.get('/calendar', requireAuth, requireRole(['admin', 'super_admin']), getCalendarClosures);
adminRouter.post('/calendar/closure', requireAuth, requireRole(['admin', 'super_admin']), createCalendarClosure);

// System audit logs
adminRouter.get('/audit-logs', requireAuth, requireRole(['admin', 'super_admin']), getAuditLogs);
