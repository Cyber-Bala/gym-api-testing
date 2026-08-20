import { Router } from 'express';
import {
  getPlans,
  getAllPlansForAdmin,
  createPlan,
  updatePlan,
  togglePlanActive,
  deletePlan,
  getMyMembership,
  triggerExpiryCheck,
} from './membership.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export const membershipRouter = Router();

// Public / Student plans
membershipRouter.get('/plans', getPlans);
membershipRouter.get('/my-membership', requireAuth, getMyMembership);

// Admin: plan management (configurable from the admin console)
membershipRouter.get('/plans/manage', requireAuth, requireRole(['admin', 'super_admin']), getAllPlansForAdmin);
membershipRouter.post('/plans', requireAuth, requireRole(['admin', 'super_admin']), createPlan);
membershipRouter.patch('/plans/:id', requireAuth, requireRole(['admin', 'super_admin']), updatePlan);
membershipRouter.post('/plans/:id/toggle', requireAuth, requireRole(['admin', 'super_admin']), togglePlanActive);
membershipRouter.delete('/plans/:id', requireAuth, requireRole(['admin', 'super_admin']), deletePlan);

// Admin expiry check
membershipRouter.post('/expiry-check', requireAuth, requireRole(['admin', 'super_admin']), triggerExpiryCheck);