import { z } from 'zod';

export const faceMlRegisterSchema = z.object({
  rollNumber: z.string().trim().min(1, 'Roll number is required').max(50),
  /** Optional details typed by the admin; when present they must match the student record. */
  name: z.string().trim().max(255).optional(),
  imageBase64: z.string().min(1000, 'Photo data is too small'),
});

export type FaceMlRegisterDto = z.infer<typeof faceMlRegisterSchema>;

export type FaceMlStatus =
  | 'REGISTERED'
  | 'NOT_FOUND'
  | 'DETAILS_MISMATCH'
  | 'ALREADY_REGISTERED'
  | 'PHOTO_REJECTED'
  | 'NO_PHOTO'
  | 'NO_MATCH'
  | 'SERVICE_ERROR';

export interface FaceMlResult {
  rollNumber: string;
  status: FaceMlStatus;
  message: string;
  name?: string;
  /** Gate (ZKBio) sync result, only when the photo was accepted. */
  gateStatus?: 'enrolled' | 'pending';
  score?: number;
}

export const faceMlCaptureSchema = z.object({
  studentId: z.string().min(1),
  imageBase64: z.string().min(1000, 'Captured photo is too small'),
});

export type FaceMlCaptureDto = z.infer<typeof faceMlCaptureSchema>;
