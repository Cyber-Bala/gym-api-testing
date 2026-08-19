import { z } from 'zod';

export const forgiveViolationSchema = z.object({
  violationId: z.string().uuid('Valid violationId UUID is required'),
  reason: z.string().min(5, 'Audit forgiveness reason is required (min 5 characters)'),
});

export const manualBanSchema = z.object({
  studentId: z.string().uuid('Valid studentId UUID is required'),
  banDurationDays: z.coerce.number().int().min(1).max(365).default(3),
  reason: z.string().min(5, 'Audit ban reason is required'),
});

export const manualUnbanSchema = z.object({
  studentId: z.string().uuid('Valid studentId UUID is required'),
  reason: z.string().min(5, 'Audit unban reason is required'),
  resetStrikes: z.boolean().default(true),
});

export interface ViolationRecordDto {
  id: string;
  studentId: string;
  bookingId?: string;
  violationType: string;
  description?: string;
  createdAt: string;
}

export interface StudentViolationSummary {
  studentId: string;
  personId: string;
  rollNumber: string;
  name: string;
  email: string;
  department: string;
  violationCount: number;
  isBanned: boolean;
  banExpiresAt?: string;
  violations: ViolationRecordDto[];
}
