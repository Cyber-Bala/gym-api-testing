import { z } from 'zod';

export const reportFilterSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  department: z.string().optional(),
  residency: z.string().optional(),
  reportType: z.enum(['attendance', 'utilization', 'revenue', 'access_logs', 'violations', 'payroll']).default('attendance'),
});

export interface GenericReportResultDto {
  reportType: string;
  generatedAt: string;
  totalRecords: number;
  columns: string[];
  rows: Record<string, any>[];
  summary?: Record<string, any>;
}
