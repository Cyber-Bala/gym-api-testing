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
  customPermissions: jsonb('custom_permissions'), // optional custom/override permissions array
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

export const slotConfigs = adminSchema.table('slot_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  windowMode: varchar('window_mode', { length: 20 }).notNull().default('block'), // 'block' | 'rolling'
  windowDays: varchar('window_days', { length: 10 }).notNull().default('3'),
  defaultCapacity: varchar('default_capacity', { length: 10 }).notNull().default('100'),
  slotDurationMinutes: varchar('slot_duration_minutes', { length: 10 }).notNull().default('60'),
  bufferMinutes: varchar('buffer_minutes', { length: 10 }).notNull().default('0'),
  operatingWindows: jsonb('operating_windows').notNull().default([
    { startTime: '06:00', endTime: '10:00', label: 'Morning Session' },
    { startTime: '15:00', endTime: '21:00', label: 'Evening Session' },
  ]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

