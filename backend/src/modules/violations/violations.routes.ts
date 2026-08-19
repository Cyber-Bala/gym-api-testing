import { Router } from 'express';
import {
  getStudentViolations,
  getAllFlaggedStudents,
  forgiveViolation,
  manualBanStudent,
  manualUnbanStudent,
  triggerAutoUnban,
} from './violations.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export const violationsRouter = Router();

// Admin / Trainer queries
violationsRouter.get('/flagged', requireAuth, requireRole(['admin', 'super_admin', 'trainer']), getAllFlaggedStudents);
violationsRouter.get('/student/:studentId', requireAuth, requireRole(['admin', 'super_admin', 'trainer']), getStudentViolations);

// Admin actions
violationsRouter.post('/forgive', requireAuth, requireRole(['admin', 'super_admin']), forgiveViolation);
violationsRouter.post('/ban', requireAuth, requireRole(['admin', 'super_admin']), manualBanStudent);
violationsRouter.post('/unban', requireAuth, requireRole(['admin', 'super_admin']), manualUnbanStudent);
violationsRouter.post('/auto-unban-check', requireAuth, requireRole(['admin', 'super_admin']), triggerAutoUnban);
