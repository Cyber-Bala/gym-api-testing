import { pgSchema, uuid, numeric, timestamp } from 'drizzle-orm/pg-core';
import { people } from './people.js';

export const trainerSchema = pgSchema('trainer');

export const trainerProfiles = trainerSchema.table('trainer_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  personId: uuid('person_id').notNull().references(() => people.id, { onDelete: 'cascade' }).unique(),
  hourlyRate: numeric('hourly_rate', { precision: 10, scale: 2 }).notNull().default('150.00'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const workShifts = trainerSchema.table('work_shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  trainerId: uuid('trainer_id').notNull().references(() => trainerProfiles.id, { onDelete: 'cascade' }),
  clockIn: timestamp('clock_in', { withTimezone: true }).notNull(),
  clockOut: timestamp('clock_out', { withTimezone: true }),
  durationMinutes: numeric('duration_minutes', { precision: 10, scale: 2 }),
  calculatedStipend: numeric('calculated_stipend', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
