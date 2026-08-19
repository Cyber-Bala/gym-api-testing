import { pgSchema, uuid, varchar, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { accounts } from './identity.js';

export const notificationSchema = pgSchema('notification');

export const pushSubscriptions = notificationSchema.table('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull(),
  keys: jsonb('keys').notNull(), // p256dh, auth
  userAgent: varchar('user_agent', { length: 512 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const notificationLogs = notificationSchema.table('notification_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body').notNull(),
  eventType: varchar('event_type', { length: 100 }).notNull(), // booking_confirmed, slot_reminder, closure
  status: varchar('status', { length: 50 }).notNull().default('sent'), // sent, failed
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
