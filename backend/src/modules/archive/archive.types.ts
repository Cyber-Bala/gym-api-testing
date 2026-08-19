import { z } from 'zod';

export const archiveJobSchema = z.object({
  entityType: z.enum(['access_logs', 'bookings', 'violations']),
  cutoffDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Cutoff date must be YYYY-MM-DD'),
});

export const studentDepartureSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1, 'At least one studentId UUID is required'),
  reason: z.string().min(5, 'Departure reason required (e.g. Graduation Batch 2026)'),
});

export const reactivateStudentSchema = z.object({
  studentId: z.string().uuid('Valid studentId UUID is required'),
  reason: z.string().min(5, 'Reactivation reason required (e.g. Post-graduate re-enrollment)'),
});

export interface ArchiveJobDto {
  id: string;
  entityType: string;
  cutoffDate: string;
  recordCount: number;
  status: 'completed' | 'running' | 'failed';
  storagePath: string;
  createdAt: string;
}

export interface DataLifecycleSummaryDto {
  totalArchiveJobs: number;
  coldStorageRecordsCount: number;
  departedStudentsCount: number;
  anonymizedProfilesCount: number;
  jobs: ArchiveJobDto[];
}
