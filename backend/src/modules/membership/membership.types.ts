import { z } from 'zod';

export interface MembershipPlanDto {
  id: string;
  name: string;
  durationDays: number;
  price: string;
  isActive: string;
}

export const createPlanSchema = z.object({
  name: z.string().min(1, 'Plan name is required').max(100),
  durationDays: z.number().int().positive('Duration must be a positive number of days'),
  price: z.number().nonnegative('Price cannot be negative'),
  isActive: z.enum(['active', 'inactive']).default('active'),
});

export const updatePlanSchema = createPlanSchema.partial();

export interface UserMembershipDto {
  id: string;
  studentId: string;
  planId: string;
  planName: string;
  price: string;
  durationDays: number;
  status: string;
  startDate: string;
  endDate: string;
  daysRemaining: number;
  isActive: boolean;
  paymentId?: string;
  createdAt: string;
}
