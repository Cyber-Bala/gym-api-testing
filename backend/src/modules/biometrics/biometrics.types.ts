import { z } from 'zod';

export const deviceHeartbeatSchema = z.object({
  deviceId: z.string().min(1, 'Device ID is required'),
  deviceName: z.string().default('Main Gym Turnstile 1'),
  ipAddress: z.string().ip().optional().default('192.168.1.120'),
  firmwareVersion: z.string().optional().default('v2.4.1-zkbio'),
  status: z.enum(['online', 'offline', 'degraded']).default('online'),
});

export const enrollFaceSchema = z.object({
  studentId: z.string().min(1).optional(),
  faceImageBase64: z.string().min(10, 'Face image data is required'),
});

/** Face capture is performed only on the gym biometric machine. */
export const deviceEnrollFaceSchema = z.object({
  deviceId: z.string().min(1, 'Device ID is required'),
  personIdentifier: z.string().min(1, 'Person identifier is required'),
  faceImageBase64: z.string().min(10, 'Face image data is required'),
});

export const retrySyncSchema = z.object({
  syncId: z.string().uuid('Valid syncId UUID is required'),
});

export const adminFaceEnrollSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
  personId: z.string().optional(),
  rollNumber: z.string().min(1, 'Roll number is required'),
  faceImageBase64: z.string().min(10, 'Face image data is required'),
});

export type AdminFaceEnrollDto = z.infer<typeof adminFaceEnrollSchema>;

export interface AccessDeviceDto {
  deviceId: string;
  deviceName: string;
  ipAddress: string;
  firmwareVersion: string;
  status: 'online' | 'offline' | 'degraded';
  lastHeartbeatAt: string;
}

export interface FaceSyncTaskDto {
  id: string;
  studentId: string;
  personId: string;
  rollNumber: string;
  name: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed' | 'admin_action_required';
  retryCount: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
