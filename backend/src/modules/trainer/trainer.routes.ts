import { Router } from 'express';
import {
  getMyTrainerProfile,
  clockIn,
  clockOut,
  getMonthlyPayroll,
  updateHourlyRate,
  getStipendConfig,
  updateStipendConfig,
} from './trainer.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export const trainerRouter = Router();

// Trainer operations
trainerRouter.get('/profile', requireAuth, getMyTrainerProfile);
trainerRouter.post('/clock-in', requireAuth, clockIn);
trainerRouter.post('/clock-out', requireAuth, clockOut);

// Admin payroll ledger & stipend configuration
trainerRouter.get('/payroll', requireAuth, requireRole(['admin', 'super_admin']), getMonthlyPayroll);
trainerRouter.get('/stipend-config', requireAuth, requireRole(['admin', 'super_admin']), getStipendConfig);
trainerRouter.put('/stipend-config', requireAuth, requireRole(['admin', 'super_admin']), updateStipendConfig);
trainerRouter.patch('/profile/:id/rate', requireAuth, requireRole(['admin', 'super_admin']), updateHourlyRate);
