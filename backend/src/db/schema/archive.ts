import { pgSchema, uuid, varchar, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const archiveSchema = pgSchema('archive');

export const archiveJobs = archiveSchema.table('archive_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  category: varchar('category', { length: 100 }).notNull(), // bookings, access_logs, payments
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  recordCount: integer('record_count').notNull(),
  storagePath: varchar('storage_path', { length: 512 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('completed'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const anonymizationRecords = archiveSchema.table('anonymization_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  personId: uuid('person_id').notNull(),
  anonymizedFields: jsonb('anonymized_fields').notNull(),
  anonymizedAt: timestamp('anonymized_at', { withTimezone: true }).notNull().defaultNow(),
});
