import { eq, or, sql } from 'drizzle-orm';
import { db, pool } from '../shared/database/index.js';
import { logger } from '../shared/logging/index.js';
import {
  accounts,
  people,
  students,
  memberships,
  paymentOrders,
  bookings,
  violations,
  accessSessions,
  entryExitLogs,
  oauthProviders,
  sessions,
  auditLogs,
  notificationLogs,
  pushSubscriptions,
} from '../db/schema/index.js';

async function removeUserCompletely(targetEmail: string) {
  logger.info({ targetEmail }, 'Starting complete removal of user from database...');

  const normalizedEmail = targetEmail.trim().toLowerCase();

  // 1. Find account and person
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(sql`lower(${accounts.email})`, normalizedEmail))
    .limit(1);

  const [person] = await db
    .select()
    .from(people)
    .where(eq(sql`lower(${people.email})`, normalizedEmail))
    .limit(1);

  logger.info(
    {
      accountId: account?.id,
      personId: person?.id,
    },
    'Located user identifiers'
  );

  let studentId: string | null = null;
  if (person) {
    const [stu] = await db
      .select()
      .from(students)
      .where(eq(students.personId, person.id))
      .limit(1);
    if (stu) {
      studentId = stu.id;
      logger.info({ studentId }, 'Located student record');
    }
  }

  // 2. Delete student child records if student exists
  if (studentId) {
    await db.delete(violations).where(eq(violations.studentId, studentId));
    await db.delete(bookings).where(eq(bookings.studentId, studentId));
    await db.delete(paymentOrders).where(eq(paymentOrders.studentId, studentId));
    await db.delete(memberships).where(eq(memberships.studentId, studentId));
    logger.info({ studentId }, 'Deleted student domain records (violations, bookings, payments, memberships)');
  }

  // 3. Delete person child records if person exists
  if (person) {
    await db.delete(accessSessions).where(eq(accessSessions.personId, person.id));
    await db.delete(entryExitLogs).where(eq(entryExitLogs.personId, person.id));
    await db.delete(students).where(eq(students.personId, person.id));
    await db.delete(people).where(eq(people.id, person.id));
    logger.info({ personId: person.id }, 'Deleted person records');
  }

  // 4. Delete account child records and account if account exists
  if (account) {
    await db.delete(oauthProviders).where(eq(oauthProviders.accountId, account.id));
    await db.delete(sessions).where(eq(sessions.accountId, account.id));
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.accountId, account.id));
    await db.delete(notificationLogs).where(eq(notificationLogs.accountId, account.id));
    await db.delete(auditLogs).where(
      or(
        eq(auditLogs.actorId, account.id),
        eq(sql`lower(${auditLogs.actorEmail})`, normalizedEmail)
      )
    );
    await db.delete(accounts).where(eq(accounts.id, account.id));
    logger.info({ accountId: account.id }, 'Deleted account records, oauth, sessions, and audit entries');
  }

  // 5. Final fallback sweep on any table with matching email
  await db.execute(sql`DELETE FROM identity.accounts WHERE lower(email) = ${normalizedEmail}`);
  await db.execute(sql`DELETE FROM people.people WHERE lower(email) = ${normalizedEmail}`);
  await db.execute(sql`DELETE FROM audit.audit_logs WHERE lower(actor_email) = ${normalizedEmail}`);

  logger.info({ targetEmail: normalizedEmail }, 'Successfully removed user completely from database');
}

const emailToRemove = process.argv[2] || 'princerohith.a.2024.cse@rajalakshmi.edu.in';
removeUserCompletely(emailToRemove)
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error({ err }, 'Failed to remove user');
    await pool.end();
    process.exit(1);
  });
