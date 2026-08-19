import { Router } from 'express';
import {
  getMyTrainerProfile,
  clockIn,
  clockOut,
  getMonthlyPayroll,
  updateHourlyRate,
} from './trainer.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export const trainerRouter = Router();

// Trainer operations
trainerRouter.get('/profile', requireAuth, getMyTrainerProfile);
trainerRouter.post('/clock-in', requireAuth, clockIn);
trainerRouter.post('/clock-out', requireAuth, clockOut);

// Admin payroll ledger
trainerRouter.get('/payroll', requireAuth, requireRole(['admin', 'super_admin']), getMonthlyPayroll);
trainerRouter.patch('/profile/:id/rate', requireAuth, requireRole(['admin', 'super_admin']), updateHourlyRate);
