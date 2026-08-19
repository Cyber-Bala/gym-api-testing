import { Router } from 'express';
import { runAllFlows } from './integration.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export const integrationRouter = Router();

integrationRouter.post('/run-all-flows', requireAuth, requireRole(['admin', 'super_admin', 'trainer']), runAllFlows);
