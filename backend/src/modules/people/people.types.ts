import { z } from 'zod';

export const studentRowSchema = z.object({
  rollNumber: z.string().min(2, 'Roll number is required').trim(),
  name: z.string().min(2, 'Name is required').trim(),
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  department: z.string().min(2, 'Department is required').trim(),
  joiningYear: z.coerce.number().int().min(2000).max(2050),
  residency: z.enum(['hosteller', 'day_scholar']).default('day_scholar'),
  gender: z.enum(['male', 'female']).default('male'),
});

export type StudentRowInput = z.infer<typeof studentRowSchema>;

// Optional self-managed fields (not required for app access)
export const studentSelfUpdateSchema = z.object({
  phone: z.string().max(20).optional(),
  emergencyContact: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  healthConcerns: z.string().max(1000).optional(),
});

export type StudentSelfUpdateInput = z.infer<typeof studentSelfUpdateSchema>;

// Bulk trainer assignment by roll number
export const trainerBulkSchema = z.object({
  rollNumbers: z.array(z.string().trim().min(1)).min(1, 'At least one roll number is required'),
  action: z.enum(['assign', 'remove']),
});

export type TrainerBulkInput = z.infer<typeof trainerBulkSchema>;

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
  updatedRows: number;
  failedRows: number;
  errors: RowValidationError[];
  successfulIds: string[];
}

export interface StudentFilterQuery {
  search?: string;
  department?: string;
  residency?: 'hosteller' | 'day_scholar';
  gender?: 'male' | 'female';
  /** Combined bucket: day_scholar_boys | day_scholar_girls | hosteller_boys | hosteller_girls */
  category?: 'day_scholar_boys' | 'day_scholar_girls' | 'hosteller_boys' | 'hosteller_girls';
  isBanned?: boolean;
  page?: number;
  limit?: number;
}
