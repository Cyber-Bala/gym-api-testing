import { pgSchema, uuid, varchar, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { people } from './people.js';

export const accessSchema = pgSchema('access');

export const accessSessions = accessSchema.table('access_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  personId: uuid('person_id').notNull().references(() => people.id, { onDelete: 'cascade' }),
  entryTimestamp: timestamp('entry_timestamp', { withTimezone: true }).notNull().defaultNow(),
  exitTimestamp: timestamp('exit_timestamp', { withTimezone: true }),
  status: varchar('status', { length: 50 }).notNull().default('inside'), // inside, exited, conflict
  entryDeviceId: varchar('entry_device_id', { length: 100 }),
  exitDeviceId: varchar('exit_device_id', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const entryExitLogs = accessSchema.table('entry_exit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  personId: uuid('person_id').references(() => people.id, { onDelete: 'set null' }),
  eventType: varchar('event_type', { length: 50 }).notNull(), // entry_granted, entry_denied, exit_recorded, hardware_fault
  deviceId: varchar('device_id', { length: 100 }).notNull(),
  result: varchar('result', { length: 50 }).notNull(), // success, denied, error
  denialReason: varchar('denial_reason', { length: 255 }),
  rawTelemetry: jsonb('raw_telemetry'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
