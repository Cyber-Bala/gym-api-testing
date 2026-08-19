import { Router } from 'express';
import {
  getFloorStatus,
  manualFloorCheckout,
  getStaffWellnessStats,
} from './floor.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export const floorRouter = Router();

// Floor management & overstayers
floorRouter.get('/status', requireAuth, requireRole(['trainer', 'admin', 'super_admin']), getFloorStatus);
floorRouter.post('/checkout', requireAuth, requireRole(['trainer', 'admin', 'super_admin']), manualFloorCheckout);

// Staff wellness hours
floorRouter.get('/staff-wellness', requireAuth, requireRole(['trainer', 'admin', 'super_admin']), getStaffWellnessStats);
