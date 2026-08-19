import { pgSchema, uuid, varchar, integer, timestamp, date, time } from 'drizzle-orm/pg-core';
import { students } from './people.js';

export const bookingSchema = pgSchema('booking');

export const slots = bookingSchema.table('slots', {
  id: uuid('id').primaryKey().defaultRandom(),
  slotDate: date('slot_date').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  capacity: integer('capacity').notNull().default(100),
  bookedCount: integer('booked_count').notNull().default(0),
  status: varchar('status', { length: 50 }).notNull().default('open'), // open, closed, cancelled
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const bookings = bookingSchema.table('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  slotId: uuid('slot_id').notNull().references(() => slots.id, { onDelete: 'cascade' }),
  bookingStatus: varchar('booking_status', { length: 50 }).notNull().default('booked'), // booked, attended, completed, no_show, cancelled_by_student, cancelled_by_gym, expired, rejected
  accessStatus: varchar('access_status', { length: 50 }).notNull().default('not_entered'), // not_entered, inside, exited
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancellationReason: varchar('cancellation_reason', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const violations = bookingSchema.table('violations', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  bookingId: uuid('booking_id').references(() => bookings.id, { onDelete: 'set null' }),
  violationType: varchar('violation_type', { length: 50 }).notNull(), // cancellation, no_show
  description: varchar('description', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
