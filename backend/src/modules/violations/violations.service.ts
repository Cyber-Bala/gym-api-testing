import { eq, and, desc, sql, lte } from 'drizzle-orm';
import { db, pool } from '../../shared/database/index.js';
import { logger } from '../../shared/logging/index.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { students, people, violations, auditLogs } from '../../db/schema/index.js';
import { StudentViolationSummary, ViolationRecordDto } from './violations.types.js';

export class ViolationsService {
  /**
   * Get violations and status for a specific student
   */
  public async getStudentViolations(studentId: string): Promise<StudentViolationSummary> {
    const [studentData] = await db
      .select({
        student: students,
        person: people,
      })
      .from(students)
      .innerJoin(people, eq(students.personId, people.id))
      .where(eq(students.id, studentId))
      .limit(1);

    if (!studentData) {
      throw new NotFoundError(`Student '${studentId}' not found`);
    }

    const studentViolations = await db
      .select()
      .from(violations)
      .where(eq(violations.studentId, studentId))
      .orderBy(desc(violations.createdAt));

    const violationDtos: ViolationRecordDto[] = studentViolations.map((v) => ({
      id: v.id,
      studentId: v.studentId,
      bookingId: v.bookingId || undefined,
      violationType: v.violationType,
      description: v.description || undefined,
      createdAt: v.createdAt.toISOString(),
    }));

    return {
      studentId: studentData.student.id,
      personId: studentData.person.id,
      rollNumber: studentData.student.rollNumber,
      name: studentData.person.name,
      email: studentData.person.email,
      department: studentData.student.department,
      violationCount: studentData.student.violationCount,
      isBanned: studentData.student.isBanned,
      banExpiresAt: studentData.student.banExpiresAt?.toISOString(),
      violations: violationDtos,
    };
  }

  /**
   * Get all students with active violation strikes or bans
   */
  public async getAllFlaggedStudents(): Promise<StudentViolationSummary[]> {
    const flagged = await db
      .select({
        student: students,
        person: people,
      })
      .from(students)
      .innerJoin(people, eq(students.personId, people.id))
      .where(sql`${students.violationCount} > 0 OR ${students.isBanned} = true`)
      .orderBy(desc(students.violationCount));

    const summaries: StudentViolationSummary[] = [];

    for (const item of flagged) {
      const vList = await db
        .select()
        .from(violations)
        .where(eq(violations.studentId, item.student.id))
        .orderBy(desc(violations.createdAt));

      summaries.push({
        studentId: item.student.id,
        personId: item.person.id,
        rollNumber: item.student.rollNumber,
        name: item.person.name,
        email: item.person.email,
        department: item.student.department,
        violationCount: item.student.violationCount,
        isBanned: item.student.isBanned,
        banExpiresAt: item.student.banExpiresAt?.toISOString(),
        violations: vList.map((v) => ({
          id: v.id,
          studentId: v.studentId,
          bookingId: v.bookingId || undefined,
          violationType: v.violationType,
          description: v.description || undefined,
          createdAt: v.createdAt.toISOString(),
        })),
      });
    }

    return summaries;
  }

  /**
   * Admin: Forgive a violation strike
   */
  public async forgiveViolation(violationId: string, reason: string, adminEmail: string) {
    const [existingViolation] = await db
      .select()
      .from(violations)
      .where(eq(violations.id, violationId))
      .limit(1);

    if (!existingViolation) {
      throw new NotFoundError(`Violation '${violationId}' not found`);
    }

    const studentId = existingViolation.studentId;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete violation record
      await client.query(`DELETE FROM booking.violations WHERE id = $1`, [violationId]);

      // Decrement violation count
      const updatedRes = await client.query(
        `UPDATE people.students 
         SET violation_count = GREATEST(0, violation_count - 1),
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, violation_count, is_banned`,
        [studentId]
      );

      const updated = updatedRes.rows[0];

      // If strikes dropped below 3, auto-lift ban
      if (updated.violation_count < 3 && updated.is_banned) {
        await client.query(
          `UPDATE people.students 
           SET is_banned = false, ban_expires_at = NULL, updated_at = NOW() 
           WHERE id = $1`,
          [studentId]
        );
      }

      // Audit log
      await client.query(
        `INSERT INTO audit.audit_logs (actor_email, action, entity, entity_id, reason, created_at)
         VALUES ($1, 'forgive_violation', 'violation', $2, $3, NOW())`,
        [adminEmail, violationId, reason]
      );

      await client.query('COMMIT');

      logger.info({ violationId, studentId, adminEmail }, 'Violation forgiven successfully');

      return {
        success: true,
        message: 'Violation forgiven and strike removed',
        studentId,
        newViolationCount: updated.violation_count,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Admin: Manual student suspension
   */
  public async manualBanStudent(
    studentId: string,
    banDurationDays: number,
    reason: string,
    adminEmail: string
  ) {
    const [existing] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
    if (!existing) throw new NotFoundError(`Student '${studentId}' not found`);

    const banExpires = new Date(Date.now() + banDurationDays * 24 * 60 * 60 * 1000);

    await db
      .update(students)
      .set({
        isBanned: true,
        banExpiresAt: banExpires,
        updatedAt: new Date(),
      })
      .where(eq(students.id, studentId));

    await db.insert(auditLogs).values({
      actorEmail: adminEmail,
      action: 'manual_ban_student',
      entity: 'student',
      entityId: studentId,
      reason: `${reason} (${banDurationDays} days duration)`,
    });

    return {
      studentId,
      isBanned: true,
      banExpiresAt: banExpires.toISOString(),
      message: `Student suspended for ${banDurationDays} days`,
    };
  }

  /**
   * Admin: Manual student unban / strike reset
   */
  public async manualUnbanStudent(
    studentId: string,
    reason: string,
    adminEmail: string,
    resetStrikes = true
  ) {
    const [existing] = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
    if (!existing) throw new NotFoundError(`Student '${studentId}' not found`);

    await db
      .update(students)
      .set({
        isBanned: false,
        banExpiresAt: null,
        violationCount: resetStrikes ? 0 : existing.violationCount,
        updatedAt: new Date(),
      })
      .where(eq(students.id, studentId));

    await db.insert(auditLogs).values({
      actorEmail: adminEmail,
      action: 'manual_unban_student',
      entity: 'student',
      entityId: studentId,
      reason: `${reason}${resetStrikes ? ' (Strikes reset to 0)' : ''}`,
    });

    return {
      studentId,
      isBanned: false,
      violationCount: resetStrikes ? 0 : existing.violationCount,
      message: 'Student unbanned successfully',
    };
  }

  /**
   * Automated Background Worker: Auto-unban students whose 3-day penalty has expired
   */
  public async runAutoUnbanCheck(): Promise<{ unbannedCount: number }> {
    const now = new Date();

    const expiredBans = await db
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.isBanned, true), lte(students.banExpiresAt, now)));

    let unbannedCount = 0;

    for (const s of expiredBans) {
      await db
        .update(students)
        .set({
          isBanned: false,
          banExpiresAt: null,
          violationCount: 0, // Fresh slate after serving full 3-day ban
          updatedAt: new Date(),
        })
        .where(eq(students.id, s.id));

      await db.insert(auditLogs).values({
        action: 'auto_unban_expired',
        entity: 'student',
        entityId: s.id,
        reason: 'Automated unban: 3-day suspension period elapsed successfully',
      });

      unbannedCount++;
    }

    if (unbannedCount > 0) {
      logger.info({ unbannedCount }, 'Auto-unban worker restored gym access for students');
    }

    return { unbannedCount };
  }
}

export const violationsService = new ViolationsService();
