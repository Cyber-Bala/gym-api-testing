import { Router } from 'express';
import { getReport, exportReportCsv } from './reports.controller.js';
import { requireAuth, requireRole } from '../auth/auth.middleware.js';

export const reportsRouter = Router();

reportsRouter.get('/generate', requireAuth, requireRole(['admin', 'super_admin', 'trainer']), getReport);
reportsRouter.get('/export-csv', requireAuth, requireRole(['admin', 'super_admin', 'trainer']), exportReportCsv);
