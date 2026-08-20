import { z } from 'zod';

export const updateRateSchema = z.object({
  hourlyRate: z.coerce.number().min(0).max(5000),
  reason: z.string().min(3, 'Audit reason is required'),
});

export const stipendTimeWindowSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1, 'Label is required'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:mm (24h)'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format must be HH:mm (24h)'),
  ratePerHour: z.coerce.number().min(0).max(5000),
});

export const updateStipendConfigSchema = z.object({
  defaultHourlyRate: z.coerce.number().min(0).max(5000),
  minShiftMinutes: z.coerce.number().min(0).max(480),
  timeWindows: z.array(stipendTimeWindowSchema),
});

export type StipendTimeWindow = z.infer<typeof stipendTimeWindowSchema>;
export type StipendConfigDto = z.infer<typeof updateStipendConfigSchema>;

export interface WorkShiftDto {
  id: string;
  trainerId: string;
  clockIn: string;
  clockOut?: string;
  durationMinutes: number;
  calculatedStipend: number;
  hourlyRate: string;
  isOngoing: boolean;
  timeWindowBreakdown?: Array<{
    windowLabel: string;
    minutes: number;
    ratePerHour: number;
    stipend: number;
  }>;
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
  breakdown?: Array<{
    windowLabel: string;
    minutes: number;
    ratePerHour: number;
    stipend: number;
  }>;
}
