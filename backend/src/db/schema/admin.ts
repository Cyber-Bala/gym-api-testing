import { pgSchema, uuid, varchar, text, timestamp, date, jsonb } from 'drizzle-orm/pg-core';
import { accounts } from './identity.js';

export const adminSchema = pgSchema('admin');

export const roles = adminSchema.table('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  permissions: jsonb('permissions').notNull().default([]), // array of permission strings
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const adminProfiles = adminSchema.table('admin_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }).unique(),
  roleId: uuid('role_id').references(() => roles.id),
  isProtectedSuperAdmin: varchar('is_protected_super_admin', { length: 10 }).notNull().default('false'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const gymCalendar = adminSchema.table('gym_calendar', {
  id: uuid('id').primaryKey().defaultRandom(),
  closureDate: date('closure_date').notNull().unique(),
  reason: varchar('reason', { length: 255 }).notNull(),
  cancelledBookingsCount: varchar('cancelled_bookings_count', { length: 20 }).default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
