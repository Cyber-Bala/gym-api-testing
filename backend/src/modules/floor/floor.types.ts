import { z } from 'zod';

export const manualCheckoutSchema = z.object({
  sessionId: z.string().uuid('Valid sessionId UUID is required'),
  reason: z.string().min(5, 'Checkout reason is required'),
});

export interface LiveFloorOccupantDto {
  sessionId: string;
  personId: string;
  name: string;
  rollNumber?: string;
  department?: string;
  residency?: string;
  role: string;
  entryTimestamp: string;
  minutesElapsed: number;
  isOverstayer: boolean;
  overdueMinutes: number;
  slotTime?: string;
}

export interface FloorStatusDto {
  currentSlotName: string;
  totalInsideCount: number;
  overstayerCount: number;
  occupants: LiveFloorOccupantDto[];
  overstayers: LiveFloorOccupantDto[];
}

export interface StaffWellnessItemDto {
  staffId: string;
  personId: string;
  staffEmpId: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  totalWorkoutsThisMonth: number;
  totalMinutesThisMonth: number;
  totalHoursThisMonth: number;
}
