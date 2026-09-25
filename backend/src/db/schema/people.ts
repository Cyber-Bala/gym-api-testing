import { pgSchema, uuid, varchar, integer, timestamp, text, boolean } from 'drizzle-orm/pg-core';
import { accounts } from './identity.js';

export const peopleSchema = pgSchema('people');

export const people = peopleSchema.table('people', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phone: varchar('phone', { length: 20 }),
  personType: varchar('person_type', { length: 50 }).notNull(), // student, staff, trainer, authorized_person, admin
  status: varchar('status', { length: 50 }).notNull().default('active'), // active, inactive, departed
  faceEnrollmentStatus: varchar('face_enrollment_status', { length: 50 }).notNull().default('not_enrolled'),
  faceReferenceId: varchar('face_reference_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});


export const students = peopleSchema.table('students', {
  id: uuid('id').primaryKey().defaultRandom(),
  personId: uuid('person_id').notNull().references(() => people.id, { onDelete: 'cascade' }).unique(),
  rollNumber: varchar('roll_number', { length: 50 }).notNull().unique(),
  department: varchar('department', { length: 100 }).notNull(),
  joiningYear: integer('joining_year').notNull(),
  residency: varchar('residency', { length: 50 }).notNull().default('day_scholar'), // hosteller, day_scholar
  gender: varchar('gender', { length: 20 }).notNull().default('male'), // male, female
  faceEnrollmentStatus: varchar('face_enrollment_status', { length: 50 }).notNull().default('not_enrolled'),
  faceReferenceId: varchar('face_reference_id', { length: 255 }),
  emergencyContact: varchar('emergency_contact', { length: 20 }), // optional
  address: text('address'), // optional
  healthConcerns: text('health_concerns'), // optional
  isBanned: boolean('is_banned').notNull().default(false),
  banExpiresAt: timestamp('ban_expires_at', { withTimezone: true }),
  violationCount: integer('violation_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const staff = peopleSchema.table('staff', {
  id: uuid('id').primaryKey().defaultRandom(),
  personId: uuid('person_id').notNull().references(() => people.id, { onDelete: 'cascade' }).unique(),
  staffId: varchar('staff_id', { length: 50 }).notNull().unique(),
  department: varchar('department', { length: 100 }).notNull(),
  designation: varchar('designation', { length: 100 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const authorizedPersons = peopleSchema.table('authorized_persons', {
  id: uuid('id').primaryKey().defaultRandom(),
  personId: uuid('person_id').notNull().references(() => people.id, { onDelete: 'cascade' }).unique(),
  designation: varchar('designation', { length: 100 }).notNull(), // owner, guest, contractor
  notes: text('notes'),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
