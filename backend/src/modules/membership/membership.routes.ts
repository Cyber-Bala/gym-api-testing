import { Router } from 'express';
import { getPlans, getMyMembership, triggerExpiryCheck } from './membership.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export const membershipRouter = Router();

// Public / Student plans
membershipRouter.get('/plans', getPlans);
membershipRouter.get('/my-membership', requireAuth, getMyMembership);

// Admin expiry check
membershipRouter.post('/expiry-check', requireAuth, requireRole(['admin', 'super_admin']), triggerExpiryCheck);
