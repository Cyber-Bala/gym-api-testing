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

export const createAdminSchema = z.object({
  email: z.string().email('Valid institutional email is required').toLowerCase(),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  roleId: z.string().uuid('Valid role ID is required').optional(),
  permissions: z.array(z.string()).optional(),
});

export const updateAdminSchema = z.object({
  roleId: z.string().uuid().optional(),
  permissions: z.array(z.string()).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
});

export interface RoleItemDto {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
}

export interface AdminListItemDto {
  id: string;
  accountId: string;
  personId: string;
  name: string;
  email: string;
  phone: string | null;
  roleName: string;
  roleId: string | null;
  permissions: string[];
  isProtectedSuperAdmin: boolean;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
}
