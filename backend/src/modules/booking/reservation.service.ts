import { v4 as uuidv4 } from 'uuid';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db, pool } from '../../shared/database/index.js';
import { redis } from '../../shared/redis/index.js';
import { logger } from '../../shared/logging/index.js';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
  CapacityExceededError,
} from '../../shared/errors/index.js';
import { slots, bookings, students, memberships } from '../../db/schema/index.js';
import { bookingService } from './booking.service.js';
import { SessionUser } from '../auth/auth.types.js';
import { UserBookingDto } from './booking.types.js';

export class ReservationService {
  /**
   * Acquire distributed Redis lock with automatic expiration and retry
   */
  public async acquireSlotLock(slotId: string, ttlMs = 5000): Promise<string | null> {
    const lockKey = `lock:slot:${slotId}`;
    const lockValue = uuidv4();
    const maxRetries = 3;
    const retryDelayMs = 60;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const result = await redis.set(lockKey, lockValue, 'PX', ttlMs, 'NX');
      if (result === 'OK') {
        return lockValue;
      }
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }

    return null;
  }

  /**
   * Safely release Redis lock using Lua script
   */
  public async releaseSlotLock(slotId: string, lockValue: string): Promise<void> {
    const lockKey = `lock:slot:${slotId}`;
    const luaScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    try {
      await redis.eval(luaScript, 1, lockKey, lockValue);
    } catch (err) {
      logger.warn({ err, slotId }, 'Failed to cleanly release Redis lock');
    }
  }

  /**
   * Calculate hours remaining between now and slot start time in IST
   */
  public getHoursUntilSlotStart(slotDateStr: string, startTimeStr: string): number {
    const now = new Date();
    // Parse slot start in IST (+05:30)
    const slotDateTimeStr = `${slotDateStr}T${startTimeStr}+05:30`;
    const slotStartTime = new Date(slotDateTimeStr);

    const diffMs = slotStartTime.getTime() - now.getTime();
    return diffMs / (1000 * 60 * 60);
  }

  /**
   * Create slot booking with zero-overbooking two-tier locking (ADR-008)
   */
  public async createBooking(slotId: string, user: SessionUser) {
    if (user.personType !== 'student' && user.role !== 'student') {
      throw new ForbiddenError('Only registered students can reserve gym workout slots');
    }

    const studentPersonId = user.personId;

    // 1. Pre-validation: Ban check (ADR-010)
    if (user.studentDetails?.isBanned) {
      throw new ForbiddenError(
        `Your gym booking privileges are temporarily suspended due to ${user.studentDetails.violationCount} attendance/cancellation violations.`
      );
    }

    // 2. Pre-validation: Day Scholar membership check (FR-MEM-001)
    if (user.studentDetails?.residency === 'day_scholar') {
      const todayStr = bookingService.formatISTDate();
      const activeMemberships = await db
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.studentId, studentPersonId),
            eq(memberships.status, 'active'),
            sql`${memberships.endDate} >= ${todayStr}`
          )
        )
        .limit(1);

      if (activeMemberships.length === 0) {
        throw new ForbiddenError(
          'Day Scholar students require an active gym membership pass to book slots. Please purchase or activate a membership pass.'
        );
      }
    }

    // 3. Acquire Tier 1 Redis Lock
    const lockValue = await this.acquireSlotLock(slotId, 5000);

    try {
      // 4. Tier 2 PostgreSQL ACID Transaction with row-level lock
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Row lock on slots
        const slotRes = await client.query(
          `SELECT id, slot_date, start_time, end_time, capacity, booked_count, status 
           FROM booking.slots 
           WHERE id = $1 FOR UPDATE`,
          [slotId]
        );

        if (slotRes.rows.length === 0) {
          throw new NotFoundError(`Slot '${slotId}' not found`);
        }

        const slot = slotRes.rows[0];
        const slotDateStr: string = typeof slot.slot_date === 'string'
          ? slot.slot_date.slice(0, 10)
          : slot.slot_date instanceof Date
            ? bookingService.formatISTDate(slot.slot_date)
            : String(slot.slot_date).slice(0, 10);

        // Verify slot status
        if (slot.status !== 'open') {
          throw new ValidationError('This slot has been closed or cancelled by the gym administrator.');
        }

        // Verify rolling window
        if (!bookingService.isDateInRollingWindow(slotDateStr)) {
          throw new ValidationError(
            `Slot date (${slotDateStr}) is outside the active 3-day booking window`
          );
        }

        // Verify slot is not in the past
        const hoursRemaining = this.getHoursUntilSlotStart(slotDateStr, slot.start_time);
        if (hoursRemaining < 0) {
          throw new ValidationError('Cannot reserve a time slot that has already started or passed');
        }

        // Check single-slot-per-day rule (FR-BK-004)
        const duplicateCheck = await client.query(
          `SELECT b.id 
           FROM booking.bookings b
           JOIN booking.slots s ON b.slot_id = s.id
           WHERE b.student_id = $1 
             AND s.slot_date = $2 
             AND b.booking_status = 'booked'`,
          [studentPersonId, slotDateStr]
        );

        if (duplicateCheck.rows.length > 0) {
          throw new ConflictError(
            `You already have a confirmed slot on ${slotDateStr}. College policy allows a maximum of 1 slot per calendar day.`
          );
        }

        // Check capacity bounds (100 cap invariant)
        if (slot.booked_count >= slot.capacity) {
          throw new CapacityExceededError(
            `This slot is completely full (${slot.booked_count}/${slot.capacity} spots taken).`
          );
        }

        // Create booking record
        const bookingInsertRes = await client.query(
          `INSERT INTO booking.bookings (student_id, slot_id, booking_status, access_status, created_at, updated_at)
           VALUES ($1, $2, 'booked', 'not_entered', NOW(), NOW())
           RETURNING id, student_id, slot_id, booking_status, access_status, created_at`,
          [studentPersonId, slotId]
        );

        const newBooking = bookingInsertRes.rows[0];

        // Increment booked count atomically
        await client.query(
          `UPDATE booking.slots 
           SET booked_count = booked_count + 1 
           WHERE id = $1`,
          [slotId]
        );

        await client.query('COMMIT');

        logger.info(
          { bookingId: newBooking.id, studentId: studentPersonId, slotId, date: slotDateStr },
          'Slot booking created successfully'
        );

        return {
          id: newBooking.id,
          studentId: newBooking.student_id,
          slotId: newBooking.slot_id,
          slotDate: slotDateStr,
          startTime: slot.start_time,
          endTime: slot.end_time,
          bookingStatus: newBooking.booking_status,
          accessStatus: newBooking.access_status,
          createdAt: newBooking.created_at,
        };
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }
    } finally {
      // Release Redis lock
      if (lockValue) {
        await this.releaseSlotLock(slotId, lockValue);
      }
    }
  }

  /**
   * Cancel an active booking with 2-hour notice cutoff (ADR-009, FR-BK-005)
   */
  public async cancelBooking(bookingId: string, user: SessionUser, reason = 'Student requested cancellation') {
    const studentPersonId = user.personId;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const bookingRes = await client.query(
        `SELECT b.id, b.student_id, b.slot_id, b.booking_status, s.slot_date, s.start_time
         FROM booking.bookings b
         JOIN booking.slots s ON b.slot_id = s.id
         WHERE b.id = $1 FOR UPDATE`,
        [bookingId]
      );

      if (bookingRes.rows.length === 0) {
        throw new NotFoundError(`Booking '${bookingId}' not found`);
      }

      const booking = bookingRes.rows[0];

      // Permission check: student must own the booking or be admin
      if (booking.student_id !== studentPersonId && !['admin', 'super_admin'].includes(user.role)) {
        throw new ForbiddenError('You can only cancel your own gym bookings');
      }

      if (booking.booking_status !== 'booked') {
        throw new ValidationError(
          `Cannot cancel a booking that is already in '${booking.booking_status}' status.`
        );
      }

      const slotDateStr: string = typeof booking.slot_date === 'string'
        ? booking.slot_date.slice(0, 10)
        : booking.slot_date instanceof Date
          ? bookingService.formatISTDate(booking.slot_date)
          : String(booking.slot_date).slice(0, 10);

      const hoursUntilStart = this.getHoursUntilSlotStart(slotDateStr, booking.start_time);
      const isLateCancellation = hoursUntilStart < 2.0;

      // Update booking status
      await client.query(
        `UPDATE booking.bookings 
         SET booking_status = 'cancelled_by_student',
             cancelled_at = NOW(),
             cancellation_reason = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [reason, bookingId]
      );

      // Decrement slot booked count
      await client.query(
        `UPDATE booking.slots 
         SET booked_count = GREATEST(0, booked_count - 1) 
         WHERE id = $1`,
        [booking.slot_id]
      );

      await client.query('COMMIT');

      logger.info(
        { bookingId, isLateCancellation, hoursUntilStart },
        'Booking cancelled successfully'
      );

      return {
        bookingId,
        status: 'cancelled_by_student',
        isLateCancellation,
        hoursUntilStart: Number(hoursUntilStart.toFixed(2)),
        message: isLateCancellation
          ? 'Booking cancelled. Note: Cancellation within 2 hours of slot start was flagged as a late cancellation.'
          : 'Booking cancelled successfully with full 2-hour notice.',
      };
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  }

  /**
   * Retrieve active and upcoming bookings for the authenticated student
   */
  public async getMyBookings(studentId: string): Promise<UserBookingDto[]> {
    const userBookings = await db
      .select({
        id: bookings.id,
        slotId: bookings.slotId,
        slotDate: slots.slotDate,
        startTime: slots.startTime,
        endTime: slots.endTime,
        bookingStatus: bookings.bookingStatus,
        accessStatus: bookings.accessStatus,
        createdAt: bookings.createdAt,
      })
      .from(bookings)
      .innerJoin(slots, eq(bookings.slotId, slots.id))
      .where(eq(bookings.studentId, studentId))
      .orderBy(desc(slots.slotDate), desc(slots.startTime));

    return userBookings.map((b) => {
      const hoursUntil = this.getHoursUntilSlotStart(b.slotDate, b.startTime);
      const isLate = hoursUntil < 2.0;
      const canCancel = b.bookingStatus === 'booked' && hoursUntil > 0;

      return {
        id: b.id,
        slotId: b.slotId,
        slotDate: b.slotDate,
        startTime: b.startTime,
        endTime: b.endTime,
        bookingStatus: b.bookingStatus,
        accessStatus: b.accessStatus,
        canCancel,
        isLateCancellation: isLate,
        hoursUntilStart: Number(hoursUntil.toFixed(2)),
        createdAt: b.createdAt.toISOString(),
      };
    });
  }
}

export const reservationService = new ReservationService();
