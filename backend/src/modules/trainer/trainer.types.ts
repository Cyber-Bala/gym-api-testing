import { z } from 'zod';

export const updateRateSchema = z.object({
  hourlyRate: z.coerce.number().min(50).max(1000),
  reason: z.string().min(5, 'Audit reason is required'),
});

export interface WorkShiftDto {
  id: string;
  trainerId: string;
  clockIn: string;
  clockOut?: string;
  durationMinutes: number;
  calculatedStipend: number;
  hourlyRate: string;
  isOngoing: boolean;
}

export interface TrainerProfileDto {
  id: string;
  personId: string;
  name: string;
  email: string;
  hourlyRate: string;
  activeShift: WorkShiftDto | null;
  totalEarningsThisMonth: number;
  totalHoursThisMonth: number;
  shifts: WorkShiftDto[];
}

export interface MonthlyPayrollItemDto {
  trainerId: string;
  personId: string;
  name: string;
  email: string;
  hourlyRate: string;
  totalShifts: number;
  totalMinutes: number;
  totalHours: number;
  totalStipend: number;
}
