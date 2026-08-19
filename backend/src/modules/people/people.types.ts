import { z } from 'zod';

export const studentRowSchema = z.object({
  rollNumber: z.string().min(2, 'Roll number is required').trim(),
  name: z.string().min(2, 'Name is required').trim(),
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  phone: z.string().optional(),
  department: z.string().min(2, 'Department is required').trim(),
  joiningYear: z.coerce.number().int().min(2000).max(2050),
  residency: z.enum(['hosteller', 'day_scholar']).default('day_scholar'),
  emergencyContact: z.string().optional(),
  address: z.string().optional(),
  healthConcerns: z.string().optional(),
});

export type StudentRowInput = z.infer<typeof studentRowSchema>;

export const staffRowSchema = z.object({
  staffId: z.string().min(2, 'Staff ID is required').trim(),
  name: z.string().min(2, 'Name is required').trim(),
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  phone: z.string().optional(),
  department: z.string().min(2, 'Department is required').trim(),
  designation: z.string().optional(),
});

export type StaffRowInput = z.infer<typeof staffRowSchema>;

export const authorizedPersonSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email is required').toLowerCase(),
  phone: z.string().optional(),
  designation: z.string().min(2, 'Designation is required'),
  notes: z.string().optional(),
});

export type AuthorizedPersonInput = z.infer<typeof authorizedPersonSchema>;

export interface RowValidationError {
  row: number;
  identifier?: string;
  field?: string;
  reason: string;
}

export interface IngestionResultReport {
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  errors: RowValidationError[];
  successfulIds: string[];
}

export interface StudentFilterQuery {
  search?: string;
  department?: string;
  residency?: 'hosteller' | 'day_scholar';
  isBanned?: boolean;
  page?: number;
  limit?: number;
}
