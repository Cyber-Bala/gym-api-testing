import { z } from 'zod';

export const createClosureSchema = z.object({
  closureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  reason: z.string().min(5, 'Closure reason is required (e.g. Annual Maintenance, Sports Day)'),
});

export interface ExecutiveAnalyticsDto {
  totalRegisteredStudents: number;
  totalHostellers: number;
  totalDayScholars: number;
  activeMembershipsCount: number;
  todayTotalCheckIns: number;
  currentLiveOccupants: number;
  totalMonthlyRevenue: number;
  totalViolationsThisMonth: number;
  peakHours: { hour: string; count: number }[];
}

export interface GymClosureDto {
  id: string;
  closureDate: string;
  reason: string;
  cancelledBookingsCount: number;
  createdAt: string;
}

export interface AuditLogEntryDto {
  id: string;
  actorEmail?: string;
  action: string;
  entity: string;
  entityId: string;
  reason: string;
  createdAt: string;
}
