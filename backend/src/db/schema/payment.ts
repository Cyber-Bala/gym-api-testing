import { pgSchema, uuid, varchar, numeric, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { students } from './people.js';
import { membershipPlans } from './membership.js';

export const paymentSchema = pgSchema('payment');

export const paymentOrders = paymentSchema.table('payment_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  studentId: uuid('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id').notNull().references(() => membershipPlans.id),
  orderId: varchar('order_id', { length: 255 }).notNull().unique(), // Gateway order ID
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('INR'),
  status: varchar('status', { length: 50 }).notNull().default('created'), // created, paid, failed, refunded
  paymentId: varchar('payment_id', { length: 255 }),
  gatewayResponse: jsonb('gateway_response'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
