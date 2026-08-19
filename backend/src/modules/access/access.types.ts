import { z } from 'zod';

export const zkbioWebhookSchema = z.object({
  deviceId: z.string().min(1, 'Device ID is required'),
  eventType: z.enum(['entry', 'exit']),
  identifierType: z.enum(['roll_number', 'email', 'person_id', 'staff_id']).default('roll_number'),
  identifierValue: z.string().min(1, 'Identifier value is required'),
  verificationMode: z.enum(['face', 'qr', 'rfid', 'manual']).default('face'),
  timestamp: z.string().optional(), // ISO string or format
  rawTelemetry: z.record(z.unknown()).optional(),
});

export type ZkBioWebhookDto = z.infer<typeof zkbioWebhookSchema>;

export const manualAccessSchema = z.object({
  personId: z.string().uuid('Valid personId UUID is required'),
  eventType: z.enum(['entry', 'exit']),
  reason: z.string().optional(),
});

export interface AccessDecisionResult {
  accessGranted: boolean;
  eventType: 'entry' | 'exit';
  personId?: string;
  name?: string;
  role?: string;
  identifier?: string;
  denialReason?: string;
  bookingId?: string;
  slotTime?: string;
  durationMinutes?: number;
  message: string;
  timestamp: string;
}

export interface LiveGymOccupant {
  sessionId: string;
  personId: string;
  name: string;
  email: string;
  role: string;
  identifier: string; // rollNumber or staffId
  entryTimestamp: string;
  minutesInside: number;
  entryDeviceId?: string;
}

export interface LiveOccupancyStats {
  currentCount: number;
  maxCapacity: number;
  occupancyPercentage: number;
  occupants: LiveGymOccupant[];
}
