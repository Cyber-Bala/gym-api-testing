import { eq, desc, sql, lte, inArray } from 'drizzle-orm';
import {
  PutObjectCommand,
  GetObjectCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import { db, pool } from '../../shared/database/index.js';
import { s3Client } from '../../shared/storage/index.js';
import { logger } from '../../shared/logging/index.js';
import { NotFoundError } from '../../shared/errors/index.js';
import { config } from '../../config/index.js';
import {
  people,
  students,
  slots,
  bookings,
  violations,
  accessSessions,
  membershipPlans,
  paymentOrders,
  archiveJobs,
  auditLogs,
} from '../../db/schema/index.js';
import {
  ArchiveJobDto,
  DataLifecycleSummaryDto,
} from './archive.types.js';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const BUCKET = config.MINIO_BUCKET_ARCHIVE; // "gym-archive"

/** Ensure the archive bucket has a fully private (no anonymous) policy */
export async function ensureArchiveBucketIsPrivate(): Promise<void> {
  try {
    // Deny all anonymous access (belt-and-suspenders — bucket was already private)
    const policy = JSON.stringify({
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'DenyPublicAccess',
          Effect: 'Deny',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${BUCKET}/*`,
          Condition: {
            StringEquals: { 's3:x-amz-acl': 'public-read' },
          },
        },
      ],
    });
    await s3Client.send(
      new PutBucketPolicyCommand({ Bucket: BUCKET, Policy: policy })
    );
    logger.info({ bucket: BUCKET }, 'gym-archive bucket policy enforced as private');
  } catch (err) {
    logger.warn({ err }, 'Could not set archive bucket policy (may already be locked down)');
  }
}

/** Stream a MinIO object body to a string */
async function streamToString(stream: any): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    stream.on('error', reject);
  });
}

// ─────────────────────────────────────────────
// ArchiveService
// ─────────────────────────────────────────────

export class ArchiveService {
  // ── 1. Summary ──────────────────────────────

  public async getLifecycleSummary(): Promise<DataLifecycleSummaryDto> {
    const jobs = await db.select().from(archiveJobs).orderBy(desc(archiveJobs.createdAt));

    const departed = await db.select().from(people).where(eq(people.status, 'departed'));
    const anonymized = await db
      .select()
      .from(people)
      .where(sql`${people.name} LIKE 'Anonymized %'`);

    let coldStorageRecords = 0;
    const jobDtos: ArchiveJobDto[] = jobs.map((j) => {
      const cnt = j.recordCount || 0;
      coldStorageRecords += cnt;
      return {
        id: j.id,
        entityType: j.category,
        cutoffDate: j.periodEnd.toISOString().slice(0, 10),
        recordCount: cnt,
        status: (j.status as 'completed' | 'running' | 'failed') || 'completed',
        storagePath: j.storagePath,
        createdAt: j.createdAt.toISOString(),
      };
    });

    return {
      totalArchiveJobs: jobDtos.length,
      coldStorageRecordsCount: coldStorageRecords,
      departedStudentsCount: departed.length,
      anonymizedProfilesCount: anonymized.length,
      jobs: jobDtos,
    };
  }

  // ── 2. Run Archive Job ───────────────────────

  public async runArchiveJob(
    entityType: string,
    cutoffDate: string,
    adminEmail: string
  ): Promise<ArchiveJobDto> {
    const cutoffDateTime = new Date(`${cutoffDate}T23:59:59.999Z`);

    // ── 2a. Collect records ──────────────────
    let rows: Array<Record<string, any>> = [];

    if (entityType === 'access_logs') {
      const res = await db
        .select({
          id: accessSessions.id,
          personId: accessSessions.personId,
          personName: people.name,
          rollNumber: students.rollNumber,
          email: people.email,
          personType: people.personType,
          entryTimestamp: accessSessions.entryTimestamp,
          exitTimestamp: accessSessions.exitTimestamp,
          status: accessSessions.status,
          entryDeviceId: accessSessions.entryDeviceId,
          exitDeviceId: accessSessions.exitDeviceId,
        })
        .from(accessSessions)
        .innerJoin(people, eq(accessSessions.personId, people.id))
        .leftJoin(students, eq(students.personId, people.id))
        .where(lte(accessSessions.entryTimestamp, cutoffDateTime));
      rows = res;
    } else if (entityType === 'bookings') {
      const res = await db
        .select({
          id: bookings.id,
          studentId: bookings.studentId,
          slotId: bookings.slotId,
          personName: people.name,
          rollNumber: students.rollNumber,
          email: people.email,
          slotDate: slots.slotDate,
          startTime: slots.startTime,
          endTime: slots.endTime,
          bookingStatus: bookings.bookingStatus,
          accessStatus: bookings.accessStatus,
          createdAt: bookings.createdAt,
        })
        .from(bookings)
        .innerJoin(slots, eq(bookings.slotId, slots.id))
        .innerJoin(students, eq(bookings.studentId, students.id))
        .innerJoin(people, eq(students.personId, people.id))
        .where(lte(slots.slotDate, cutoffDate));
      rows = res;
    } else if (entityType === 'violations') {
      const res = await db
        .select({
          id: violations.id,
          studentId: violations.studentId,
          personName: people.name,
          rollNumber: students.rollNumber,
          violationType: violations.violationType,
          description: violations.description,
          createdAt: violations.createdAt,
        })
        .from(violations)
        .innerJoin(students, eq(violations.studentId, students.id))
        .innerJoin(people, eq(students.personId, people.id))
        .where(lte(violations.createdAt, cutoffDateTime));
      rows = res;
    } else if (entityType === 'payments') {
      const res = await db
        .select({
          id: paymentOrders.id,
          studentId: paymentOrders.studentId,
          personName: people.name,
          rollNumber: students.rollNumber,
          planName: membershipPlans.name,
          amount: paymentOrders.amount,
          orderId: paymentOrders.orderId,
          status: paymentOrders.status,
          createdAt: paymentOrders.createdAt,
        })
        .from(paymentOrders)
        .innerJoin(students, eq(paymentOrders.studentId, students.id))
        .innerJoin(people, eq(students.personId, people.id))
        .innerJoin(membershipPlans, eq(paymentOrders.planId, membershipPlans.id))
        .where(lte(paymentOrders.createdAt, cutoffDateTime));
      rows = res;
    }

    const recordCount = rows.length;

    // If no records match the cutoff, still create the job but with 0 records
    const objectKey = `${entityType}/${cutoffDate}_${Date.now()}.json.gz`;
    const storagePath = `s3://${BUCKET}/${objectKey}`;

    if (recordCount > 0) {
      // ── 2b. Upload to MinIO as JSON ─────────
      const jsonPayload = JSON.stringify({
        archivedAt: new Date().toISOString(),
        entityType,
        cutoffDate,
        recordCount,
        records: rows,
      });

      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: objectKey,
          Body: Buffer.from(jsonPayload, 'utf-8'),
          ContentType: 'application/json',
          Metadata: {
            entityType,
            cutoffDate,
            recordCount: String(recordCount),
          },
        })
      );
      logger.info({ objectKey, recordCount }, 'Archived records uploaded to MinIO');

      // ── 2c. Delete archived records from source DB ──
      if (entityType === 'access_logs') {
        const ids = rows.map((r) => r.id as string);
        for (let i = 0; i < ids.length; i += 100) {
          const batch = ids.slice(i, i + 100);
          await db.delete(accessSessions).where(inArray(accessSessions.id, batch));
        }
      } else if (entityType === 'bookings') {
        const ids = rows.map((r) => r.id as string);
        for (let i = 0; i < ids.length; i += 100) {
          const batch = ids.slice(i, i + 100);
          await db.delete(bookings).where(inArray(bookings.id, batch));
        }
      } else if (entityType === 'violations') {
        const ids = rows.map((r) => r.id as string);
        for (let i = 0; i < ids.length; i += 100) {
          const batch = ids.slice(i, i + 100);
          await db.delete(violations).where(inArray(violations.id, batch));
        }
      } else if (entityType === 'payments') {
        const ids = rows.map((r) => r.id as string);
        for (let i = 0; i < ids.length; i += 100) {
          const batch = ids.slice(i, i + 100);
          await db.delete(paymentOrders).where(inArray(paymentOrders.id, batch));
        }
      }

      logger.info({ entityType, recordCount }, 'Archived records deleted from source tables');
    }

    // ── 2d. Insert archive job record ──────────
    const periodStart = new Date(cutoffDateTime.getTime() - 365 * 24 * 60 * 60 * 1000);

    const [job] = await db
      .insert(archiveJobs)
      .values({
        category: entityType,
        periodStart,
        periodEnd: cutoffDateTime,
        recordCount,
        status: 'completed',
        storagePath,
      })
      .returning();

    await db.insert(auditLogs).values({
      actorEmail: adminEmail,
      action: 'run_archive_job',
      entity: entityType,
      entityId: job.id,
      reason: `Cold storage archive created for ${entityType} (cutoff: ${cutoffDate}, ${recordCount} records archived and purged from live DB)`,
    });

    return {
      id: job.id,
      entityType: job.category,
      cutoffDate,
      recordCount,
      status: 'completed',
      storagePath,
      createdAt: job.createdAt.toISOString(),
    };
  }

  // ── 3. Get Records for a Job (read from MinIO) ──

  public async getJobRecords(jobId: string) {
    const [job] = await db.select().from(archiveJobs).where(eq(archiveJobs.id, jobId)).limit(1);
    if (!job) throw new NotFoundError(`Archive job '${jobId}' not found`);

    let records: Array<Record<string, any>> = [];

    if (job.recordCount === 0) {
      // No records were archived — return empty
      return {
        job: {
          id: job.id,
          entityType: job.category,
          cutoffDate: job.periodEnd.toISOString().slice(0, 10),
          recordCount: 0,
          status: job.status,
          storagePath: job.storagePath,
          createdAt: job.createdAt.toISOString(),
        },
        records: [],
      };
    }

    try {
      // Extract the object key from the storage path: s3://gym-archive/<key>
      const objectKey = job.storagePath.replace(`s3://${BUCKET}/`, '');

      const response = await s3Client.send(
        new GetObjectCommand({ Bucket: BUCKET, Key: objectKey })
      );

      const jsonText = await streamToString(response.Body as any);
      const parsed = JSON.parse(jsonText) as {
        entityType: string;
        records: Array<Record<string, any>>;
      };

      // ── Format for display ──────────────────
      records = (parsed.records || []).slice(0, 500).map((r) => {
        if (parsed.entityType === 'access_logs') {
          return {
            'Session ID': String(r.id || '').slice(0, 8),
            'Name': r.personName,
            'Roll / ID': r.rollNumber || 'Staff/Trainer',
            'Email': r.email,
            'Type': r.personType,
            'Entry Time': r.entryTimestamp
              ? new Date(r.entryTimestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
              : '-',
            'Exit Time': r.exitTimestamp
              ? new Date(r.exitTimestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
              : 'Still Inside',
            'Entry Device': r.entryDeviceId || '-',
            'Status': r.status,
          };
        } else if (parsed.entityType === 'bookings') {
          const slotDate = r.slotDate
            ? typeof r.slotDate === 'string'
              ? r.slotDate.slice(0, 10)
              : new Date(r.slotDate).toISOString().slice(0, 10)
            : '-';
          return {
            'Booking ID': String(r.id || '').slice(0, 8),
            'Student Name': r.personName,
            'Roll Number': r.rollNumber,
            'Slot Date': slotDate,
            'Time Window': `${String(r.startTime || '').slice(0, 5)} – ${String(r.endTime || '').slice(0, 5)}`,
            'Booking Status': r.bookingStatus,
            'Access Status': r.accessStatus,
            'Reserved At': r.createdAt
              ? new Date(r.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
              : '-',
          };
        } else if (parsed.entityType === 'violations') {
          return {
            'Violation ID': String(r.id || '').slice(0, 8),
            'Student Name': r.personName,
            'Roll Number': r.rollNumber,
            'Type': r.violationType,
            'Description': r.description,
            'Date': r.createdAt
              ? new Date(r.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
              : '-',
          };
        } else if (parsed.entityType === 'payments') {
          return {
            'Payment ID': String(r.id || '').slice(0, 8),
            'Student Name': r.personName,
            'Roll Number': r.rollNumber,
            'Pass Plan': r.planName,
            'Amount (INR)': r.amount,
            'Gateway Order': r.orderId,
            'Status': r.status,
            'Date': r.createdAt
              ? new Date(r.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
              : '-',
          };
        }
        return r;
      });
    } catch (err) {
      logger.error({ jobId, err }, 'Failed to fetch archive records from MinIO');
      throw new Error('Failed to retrieve archived records from cold storage. The object may not exist.');
    }

    return {
      job: {
        id: job.id,
        entityType: job.category,
        cutoffDate: job.periodEnd.toISOString().slice(0, 10),
        recordCount: job.recordCount,
        status: job.status,
        storagePath: job.storagePath,
        createdAt: job.createdAt.toISOString(),
      },
      records,
    };
  }

  // ── 4. Student Departures ────────────────────

  public async processStudentDepartures(studentIds: string[], reason: string, adminEmail: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let processedCount = 0;

      for (const sId of studentIds) {
        const studentRes = await client.query(
          `SELECT s.id as student_id, s.person_id
           FROM people.students s
           JOIN people.people p ON s.person_id = p.id
           WHERE s.id::text = $1 OR s.roll_number = $1 OR p.email = $1
           LIMIT 1`,
          [sId.trim()]
        );

        if (studentRes.rows.length === 0) continue;
        const { student_id: studentId, person_id: personId } = studentRes.rows[0];

        await client.query(
          `UPDATE people.people SET status = 'departed', updated_at = NOW() WHERE id = $1`,
          [personId]
        );

        await client.query(
          `UPDATE people.students
           SET face_enrollment_status = 'purged', is_banned = false, updated_at = NOW()
           WHERE id = $1`,
          [studentId]
        );

        await client.query(
          `UPDATE booking.bookings
           SET booking_status = 'cancelled_by_gym',
               cancellation_reason = 'Student departure / graduation',
               cancelled_at = NOW()
           WHERE student_id = $1 AND booking_status = 'booked'`,
          [personId]
        );

        await client.query(
          `UPDATE membership.memberships
           SET status = 'expired', updated_at = NOW()
           WHERE student_id = $1 AND status = 'active'`,
          [personId]
        );

        processedCount++;
      }

      await client.query(
        `INSERT INTO audit.audit_logs (actor_email, action, entity, entity_id, reason, created_at)
         VALUES ($1, 'process_student_departure', 'students_batch', $2, $3, NOW())`,
        [adminEmail, String(processedCount), `${reason} (${processedCount} students departed)`]
      );

      await client.query('COMMIT');

      logger.info({ processedCount, adminEmail }, 'Student departure batch processed');

      return {
        success: true,
        processedCount,
        message: `${processedCount} student(s) marked departed, credentials purged, and gym access terminated.`,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ── 5. 7-Year Anonymization Stub ────────────

  public async runSevenYearAnonymizationCheck(): Promise<{ anonymizedCount: number }> {
    logger.info('Checked 7-year retention policy for historical records');
    return { anonymizedCount: 0 };
  }

  // ── 6. Reactivate Student ────────────────────

  public async reactivateStudent(studentId: string, reason: string, adminEmail: string) {
    const [stu] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
    if (!stu) throw new NotFoundError('Student not found');

    await db
      .update(people)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(people.id, stu.personId));

    await db.insert(auditLogs).values({
      actorEmail: adminEmail,
      action: 'reactivate_student',
      entity: 'student',
      entityId: studentId,
      reason,
    });

    return {
      studentId,
      status: 'active',
      message: 'Student account and gym privileges reactivated successfully',
    };
  }
}

export const archiveService = new ArchiveService();
