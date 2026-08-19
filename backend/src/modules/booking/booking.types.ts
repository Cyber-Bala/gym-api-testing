import { z } from 'zod';

export const DEFAULT_SLOT_CAPACITY = 100;

export interface SlotScheduleConfig {
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  label?: string;
}

export const DEFAULT_DAILY_SLOTS: SlotScheduleConfig[] = [
  { startTime: '06:00', endTime: '07:00', label: 'Morning Slot 1' },
  { startTime: '07:00', endTime: '08:00', label: 'Morning Slot 2' },
  { startTime: '08:00', endTime: '09:00', label: 'Morning Slot 3' },
  { startTime: '09:00', endTime: '10:00', label: 'Morning Slot 4' },
  { startTime: '15:00', endTime: '16:00', label: 'Evening Slot 1' },
  { startTime: '16:00', endTime: '17:00', label: 'Evening Slot 2' },
  { startTime: '17:00', endTime: '18:00', label: 'Evening Slot 3' },
  { startTime: '18:00', endTime: '19:00', label: 'Evening Slot 4' },
  { startTime: '19:00', endTime: '20:00', label: 'Evening Slot 5' },
  { startTime: '20:00', endTime: '21:00', label: 'Evening Slot 6' },
];

export interface SlotDto {
  id: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm:ss
  endTime: string;    // HH:mm:ss
  capacity: number;
  bookedCount: number;
  availableSpots: number;
  occupancyPercentage: number;
  isFull: boolean;
  isActive: boolean;
  isPast: boolean;
  isBookedByCurrentUser: boolean;
}

export interface DaySlotsDto {
  date: string;
  dayLabel: string;
  dayOfWeek: string;
  isToday: boolean;
  hasUserBookedOnDate: boolean;
  userBookedSlotId?: string;
  totalCapacity: number;
  totalBooked: number;
  slots: SlotDto[];
}

export interface RollingWindowSlotsResponse {
  windowDates: string[];
  days: DaySlotsDto[];
}

export const reserveSlotSchema = z.object({
  slotId: z.string().uuid('Valid slotId UUID is required'),
});

export const cancelBookingSchema = z.object({
  reason: z.string().optional(),
});

export const updateCapacitySchema = z.object({
  capacity: z.coerce.number().int().min(1).max(500, 'Capacity cannot exceed 500'),
  reason: z.string().min(3, 'Audit reason is required'),
});

export const updateStatusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().min(3, 'Audit reason is required'),
});

export interface UserBookingDto {
  id: string;
  slotId: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  bookingStatus: string;
  accessStatus: string;
  canCancel: boolean;
  isLateCancellation: boolean;
  hoursUntilStart: number;
  createdAt: string;
}
