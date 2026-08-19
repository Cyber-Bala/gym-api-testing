import { eq, and, sql, lte, inArray } from 'drizzle-orm';
import { db, pool } from '../../shared/database/index.js';
import { logger } from '../../shared/logging/index.js';
import {
  slots,
  bookings,
  violations,
  students,
  auditLogs,
} from '../../db/schema/index.js';
import { bookingService } from '../booking/booking.service.js';

export interface NoShowProcessResult {
  completedSlotsEvaluated: number;
  unattendedBookingsFound: number;
  violationsIssued: number;
  studentsSuspended: number;
  timestamp: string;
}

export class NoShowService {
  /**
   * Helper: Parse time HH:mm into minutes from midnight
   */
  private timeToMinutes(timeStr: string): number {
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1] || '0', 10);
    return hours * 60 + minutes;
  }

  /**
   * Process all ended slots to mark un-attended reservations as No-Shows (ADR-010, ADR-013, FR-BK-006)
   */
  public async processSlotNoShows(targetSlotId?: string): Promise<NoShowProcessResult> {
    const todayStr = bookingService.formatISTDate();
    const currentISTTime = bookingService.getISTCurrentTime(); // HH:mm
    const currentMinutes = this.timeToMinutes(currentISTTime);

    logger.info({ todayStr, currentISTTime, targetSlotId }, 'Starting No-Show violation evaluation...');

    // 1. Fetch relevant slots
    let candidateSlots: (typeof slots.$inferSelect)[] = [];

    if (targetSlotId) {
      candidateSlots = await db.select().from(slots).where(eq(slots.id, targetSlotId));
    } else {
      // Find all slots for today or earlier
      const allTodaySlots = await db
        .select()
        .from(slots)
        .where(lte(slots.slotDate, todayStr));

      // Filter slots that have ended + 15 min grace period passed
      candidateSlots = allTodaySlots.filter((s) => {
        if (s.slotDate < todayStr) return true; // past date slot
        const slotEndMinutes = this.timeToMinutes(s.endTime.slice(0, 5));
        return currentMinutes > slotEndMinutes + 15; // slot ended and grace passed
      });
    }

    if (candidateSlots.length === 0) {
      return {
        completedSlotsEvaluated: 0,
        unattendedBookingsFound: 0,
        violationsIssued: 0,
        studentsSuspended: 0,
        timestamp: new Date().toISOString(),
      };
    }

    const slotIds = candidateSlots.map((s) => s.id);

    // 2. Find all bookings for these slots that are still in 'booked' state (never scanned turnstile)
    const unattendedBookings = await db
      .select({
        bookingId: bookings.id,
        studentId: bookings.studentId,
        slotId: bookings.slotId,
      })
      .from(bookings)
      .where(and(inArray(bookings.slotId, slotIds), eq(bookings.bookingStatus, 'booked')));

    let violationsIssued = 0;
    let studentsSuspended = 0;

    for (const b of unattendedBookings) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Transition booking to no_show
        await client.query(
          `UPDATE booking.bookings 
           SET booking_status = 'no_show', updated_at = NOW() 
           WHERE id = $1`,
          [b.bookingId]
        );

        // Create violation strike
        await client.query(
          `INSERT INTO booking.violations (student_id, booking_id, violation_type, description, created_at)
           VALUES ($1, $2, 'no_show', 'Missed reserved workout slot without required 2-hour notice', NOW())`,
          [b.studentId, b.bookingId]
        );
        violationsIssued++;

        // Increment student's violation count
        const studentRes = await client.query(
          `UPDATE people.students 
           SET violation_count = violation_count + 1, updated_at = NOW()
           WHERE id = $1
           RETURNING id, is_banned, violation_count`,
          [b.studentId]
        );

        const updatedStudent = studentRes.rows[0];

        // 3-Strike Rule (ADR-010): If 3 or more strikes, apply 3-day ban (72 hours)
        if (updatedStudent.violation_count >= 3 && !updatedStudent.is_banned) {
          const banExpires = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days

          await client.query(
            `UPDATE people.students 
             SET is_banned = true, ban_expires_at = $1, updated_at = NOW()
             WHERE id = $2`,
            [banExpires, b.studentId]
          );

          await client.query(
            `INSERT INTO audit.audit_logs (action, entity, entity_id, reason, created_at)
             VALUES ('auto_ban_3_strikes', 'student', $1, 'Automated 3-day suspension applied after 3rd attendance violation', NOW())`,
            [b.studentId]
          );

          studentsSuspended++;
          logger.warn(
            { studentId: b.studentId, strikes: updatedStudent.violation_count },
            'Student suspended for 3 days due to 3-strike violation policy'
          );
        }

        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        logger.error({ txErr, bookingId: b.bookingId }, 'Failed to process no-show for booking');
      } finally {
        client.release();
      }
    }

    logger.info(
      {
        completedSlots: candidateSlots.length,
        unattendedCount: unattendedBookings.length,
        violationsIssued,
        studentsSuspended,
      },
      'No-Show evaluation completed successfully'
    );

    return {
      completedSlotsEvaluated: candidateSlots.length,
      unattendedBookingsFound: unattendedBookings.length,
      violationsIssued,
      studentsSuspended,
      timestamp: new Date().toISOString(),
    };
  }
}

export const noShowService = new NoShowService();
