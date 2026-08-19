import { z } from 'zod';

export interface MembershipPlanDto {
  id: string;
  name: string;
  durationDays: number;
  price: string;
  isActive: string;
}

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
