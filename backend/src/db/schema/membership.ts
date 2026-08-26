import { pgSchema, uuid, varchar, integer, timestamp, numeric } from 'drizzle-orm/pg-core';
import { students } from './people.js';

export const membershipSchema = pgSchema('membership');

export const membershipPlans = membershipSchema.table('membership_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull(),
  durationDays: integer('duration_days').notNull(),
  price: numeric('price', { precision: 10, scale: 2 }).notNull(),
  isActive: varchar('is_active', { length: 20 }).notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = membershipSchema.table('memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id').notNull().references(() => membershipPlans.id),
  status: varchar('status', { length: 50 }).notNull().default('active'), // active, expired, cancelled (no queued)
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  paymentId: varchar('payment_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
