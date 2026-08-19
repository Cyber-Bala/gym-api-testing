import { Router } from 'express';
import { listConflicts, resolveConflict } from './conflicts.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export const conflictsRouter = Router();

conflictsRouter.get('/list', requireAuth, requireRole(['admin', 'super_admin', 'trainer']), listConflicts);
conflictsRouter.post('/resolve', requireAuth, requireRole(['admin', 'super_admin']), resolveConflict);
