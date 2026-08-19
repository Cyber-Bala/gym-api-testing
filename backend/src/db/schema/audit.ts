import { pgSchema, uuid, varchar, text, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { accounts } from './identity.js';

export const auditSchema = pgSchema('audit');

export const auditLogs = auditSchema.table('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').references(() => accounts.id, { onDelete: 'set null' }),
  actorEmail: varchar('actor_email', { length: 255 }),
  action: varchar('action', { length: 100 }).notNull(), // create, update, delete, override, ban, reactivate
  entity: varchar('entity', { length: 100 }).notNull(), // student, booking, membership, admin_permission
  entityId: varchar('entity_id', { length: 255 }).notNull(),
  previousValue: jsonb('previous_value'),
  newValue: jsonb('new_value'),
  reason: text('reason').notNull(),
  correlationId: varchar('correlation_id', { length: 128 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
