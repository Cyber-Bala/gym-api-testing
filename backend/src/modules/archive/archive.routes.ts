import { Router } from 'express';
import {
  getLifecycleSummary,
  runArchiveJob,
  processStudentDepartures,
  reactivateStudent,
  triggerAnonymizationCheck,
} from './archive.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export const archiveRouter = Router();

archiveRouter.get('/summary', requireAuth, requireRole(['admin', 'super_admin']), getLifecycleSummary);
archiveRouter.post('/job', requireAuth, requireRole(['admin', 'super_admin']), runArchiveJob);
archiveRouter.post('/departure', requireAuth, requireRole(['admin', 'super_admin']), processStudentDepartures);
archiveRouter.post('/reactivate', requireAuth, requireRole(['admin', 'super_admin']), reactivateStudent);
archiveRouter.post('/anonymize-check', requireAuth, requireRole(['admin', 'super_admin']), triggerAnonymizationCheck);
