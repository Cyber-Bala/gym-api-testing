import { z } from 'zod';

export const DEFAULT_SLOT_CAPACITY = 100;

export interface OperatingWindowDto {
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  label?: string;
}

export const DEFAULT_OPERATING_WINDOWS: OperatingWindowDto[] = [
  { startTime: '06:00', endTime: '10:00', label: 'Morning Session' },
  { startTime: '15:00', endTime: '21:00', label: 'Evening Session' },
];

export interface SlotConfigDto {
  id?: string;
  windowMode: 'block' | 'rolling';
  windowDays: number;
  defaultCapacity: number;
  slotDurationMinutes: number;
  bufferMinutes: number;
  operatingWindows: OperatingWindowDto[];
  updatedAt?: string;
}

export const updateSlotConfigSchema = z.object({
  windowMode: z.enum(['block', 'rolling']).default('block'),
  windowDays: z.coerce.number().int().min(1).max(14).default(3),
  defaultCapacity: z.coerce.number().int().min(1).max(500).default(100),
  slotDurationMinutes: z.coerce.number().int().min(15).max(240).default(60),
  bufferMinutes: z.coerce.number().int().min(0).max(60).default(0),
  operatingWindows: z
    .array(
      z.object({
        startTime: z.string().regex(/^\d{2}:\d{2}$/, 'startTime must be HH:mm'),
        endTime: z.string().regex(/^\d{2}:\d{2}$/, 'endTime must be HH:mm'),
        label: z.string().optional(),
      })
    )
    .min(1, 'At least one operating session is required'),
});

export const lockDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  reason: z.string().min(3, 'Closure reason is required (e.g. Annual Maintenance, Sports Day)'),
});

export const unlockDateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
});

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
  /** Present only for the current student's cancellable, active reservation. */
  userBookingId?: string;
  isPassCovered?: boolean;
}

export interface DaySlotsDto {
  date: string;
  dayLabel: string;
  dayOfWeek: string;
  isToday: boolean;
  isLocked: boolean;
  lockReason?: string;
  hasUserBookedOnDate: boolean;
  userBookedSlotId?: string;
  userBookedCountOnDate?: number;
  userBookedSlotIds?: string[];
  totalCapacity: number;
  totalBooked: number;
  isPassValidOnDate?: boolean;
  passExpiryDate?: string;
  slots: SlotDto[];
}

export interface RollingWindowSlotsResponse {
  windowDates: string[];
  totalUserBookingsInWindow?: number;
  config?: SlotConfigDto;
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
