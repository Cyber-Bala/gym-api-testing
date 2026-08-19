import { z } from 'zod';

export const resolveConflictSchema = z.object({
  conflictId: z.string().uuid('Valid conflictId UUID is required'),
  resolution: z.enum(['dismissed', 'overridden', 'penalty_applied']),
  notes: z.string().min(5, 'Audit resolution notes required'),
});

export interface ConflictItemDto {
  id: string;
  personId?: string;
  name?: string;
  eventType: string;
  deviceId: string;
  result: string;
  denialReason?: string;
  status: 'open' | 'resolved';
  createdAt: string;
}
