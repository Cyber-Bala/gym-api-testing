import { v4 as uuidv4 } from 'uuid';
import { eq, and, or, desc, sql, gt } from 'drizzle-orm';
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
    const slotDateTimeStr = `${slotDateStr}T${startTimeStr.slice(0, 5)}:00+05:30`;
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

    // 1. Resolve student profile from database
    const [studentRecord] = await db
      .select({
        id: students.id,
        personId: students.personId,
        residency: students.residency,
        isBanned: students.isBanned,
        violationCount: students.violationCount,
      })
      .from(students)
      .where(or(eq(students.personId, user.personId), eq(students.id, user.personId)))
      .limit(1);

    if (!studentRecord) {
      throw new NotFoundError('Student profile not found for this user account');
    }

    const studentTableId = studentRecord.id;

    // 2. Pre-validation: Ban check (ADR-010)
    if (studentRecord.isBanned || user.studentDetails?.isBanned) {
      throw new ForbiddenError(
        `Your gym booking privileges are temporarily suspended due to ${studentRecord.violationCount || user.studentDetails?.violationCount || 3} attendance/cancellation violations.`
      );
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

        // Verify user's per-user window (anchored to first booking)
        const { dates: userWindowDates } = await bookingService.getUserWindowDates(studentTableId);
        const isInWindow = userWindowDates.includes(slotDateStr);
        if (!isInWindow) {
          throw new ValidationError(
            `Slot date (${slotDateStr}) is outside your active booking window (${userWindowDates.join(', ')})`
          );
        }

        // Verify slot is not in the past
        const hoursRemaining = this.getHoursUntilSlotStart(slotDateStr, slot.start_time);
        if (hoursRemaining < 0) {
          throw new ValidationError('Cannot reserve a time slot that has already started or passed');
        }

        // 5. Day Scholar: ACTIVE membership must cover the slot date (no queued)
        const residency = studentRecord.residency || user.studentDetails?.residency;
        if (residency === 'day_scholar') {
          const now = new Date();
          const userMemberships = await db
            .select({
              id: memberships.id,
              startDate: memberships.startDate,
              endDate: memberships.endDate,
              status: memberships.status,
            })
            .from(memberships)
            .where(
              and(
                or(eq(memberships.studentId, studentTableId), eq(memberships.studentId, user.personId)),
                eq(memberships.status, 'active'),
                gt(memberships.endDate, now)
              )
            )
            .orderBy(desc(memberships.endDate));

          if (userMemberships.length === 0) {
            throw new ForbiddenError(
              'Day Scholar students require an active gym membership pass to book slots. Please purchase a membership pass first.'
            );
          }

          const slotDayStart = new Date(`${slotDateStr}T00:00:00+05:30`);
          const slotDayEnd = new Date(`${slotDateStr}T23:59:59.999+05:30`);
          const covering = userMemberships.find(
            (m) => m.startDate <= slotDayEnd && m.endDate >= slotDayStart
          );

          if (!covering) {
            const maxExpiryDate = userMemberships[0].endDate;
            const expiryFormatted = new Intl.DateTimeFormat('en-IN', {
              timeZone: 'Asia/Kolkata',
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            }).format(maxExpiryDate);

            throw new ForbiddenError(
              `Your gym membership pass expires on ${expiryFormatted}. You cannot book slots on ${slotDateStr} unless you renew your pass.`
            );
          }
        }

        // 1. Exact slot duplicate check
        const exactSlotCheck = await client.query(
          `SELECT id FROM booking.bookings 
           WHERE student_id = $1 AND slot_id = $2 AND booking_status = 'booked'`,
          [studentTableId, slotId]
        );

        if (exactSlotCheck.rows.length > 0) {
          throw new ConflictError(
            `You already have an active reservation for this exact time slot (${slot.start_time.slice(0, 5)} – ${slot.end_time.slice(0, 5)}).`
          );
        }

        // 2. Check daily quota: max 3 slots on the same day
        const dailyCountRes = await client.query(
          `SELECT COUNT(*)::int AS count 
           FROM booking.bookings b
           JOIN booking.slots s ON b.slot_id = s.id
           WHERE b.student_id = $1 
             AND s.slot_date::text = $2 
             AND b.booking_status = 'booked'`,
          [studentTableId, slotDateStr]
        );

        const dailyCount = Number(dailyCountRes.rows[0]?.count || 0);
        if (dailyCount >= 3) {
          throw new ConflictError(
            `You have already reached the maximum limit of 3 slots on ${slotDateStr}.`
          );
        }

        // 3. Check total window quota: max 3 slots total across the user's per-user window
        const { dates: myWindowDates } = await bookingService.getUserWindowDates(studentTableId);
        const windowCountRes = await client.query(
          `SELECT COUNT(*)::int AS count 
           FROM booking.bookings b
           JOIN booking.slots s ON b.slot_id = s.id
           WHERE b.student_id = $1 
             AND s.slot_date::text = ANY($2::text[]) 
             AND b.booking_status = 'booked'`,
          [studentTableId, myWindowDates]
        );

        const windowCount = Number(windowCountRes.rows[0]?.count || 0);
        if (windowCount >= 3) {
          throw new ConflictError(
            `You have reached the maximum allowed limit of 3 active bookings in your window (${myWindowDates.join(', ')}).`
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
          [studentTableId, slotId]
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
          { bookingId: newBooking.id, studentId: studentTableId, slotId, date: slotDateStr },
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
      // Always release Tier 1 Redis Lock
      if (lockValue) {
        await this.releaseSlotLock(slotId, lockValue);
      }
    }
  }

  /**
   * Cancel an existing slot booking (FR-BK-006, ADR-009)
   */
  public async cancelBooking(bookingId: string, user: SessionUser, cancellationReason?: string) {
    const lockKey = `lock:booking:cancel:${bookingId}`;
    const acquired = await redis.set(lockKey, '1', 'PX', 5000, 'NX');
    if (!acquired) {
      throw new ConflictError('A cancellation operation is already in progress for this booking.');
    }

    try {
      // Query booking with slot details
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const bookingRes = await client.query(
          `SELECT b.id, b.student_id, b.slot_id, b.booking_status, s.slot_date, s.start_time, st.person_id
           FROM booking.bookings b
           JOIN booking.slots s ON b.slot_id = s.id
           JOIN people.students st ON b.student_id = st.id
           WHERE b.id = $1 FOR UPDATE`,
          [bookingId]
        );

        if (bookingRes.rows.length === 0) {
          throw new NotFoundError(`Booking '${bookingId}' not found`);
        }

        const booking = bookingRes.rows[0];

        // Ensure user owns booking (or is admin)
        if (booking.person_id !== user.personId && booking.student_id !== user.personId && !['admin', 'super_admin'].includes(user.role)) {
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
          [cancellationReason || (isLateCancellation ? 'Late cancellation' : 'Standard cancellation'), bookingId]
        );

        // If late cancellation, record violation strike
        if (isLateCancellation) {
          await client.query(
            `INSERT INTO booking.violations (student_id, booking_id, violation_type, description, created_at)
             VALUES ($1, $2, 'late_cancellation', $3, NOW())`,
            [
              booking.student_id,
              bookingId,
              `Cancelled with ${hoursUntilStart.toFixed(1)}h remaining before slot start (< 2.0h notice threshold)`,
            ]
          );

          // Increment violation count on student record
          await client.query(
            `UPDATE people.students 
             SET violation_count = violation_count + 1,
                 updated_at = NOW()
             WHERE id = $1`,
            [booking.student_id]
          );

          // Check if violations reached 3 strikes -> apply 3-day suspension
          const strikeRes = await client.query(
            `SELECT violation_count FROM people.students WHERE id = $1`,
            [booking.student_id]
          );

          if (strikeRes.rows[0]?.violation_count >= 3) {
            await client.query(
              `UPDATE people.students 
               SET is_banned = true,
                   ban_expires_at = NOW() + INTERVAL '3 days',
               updated_at = NOW()
               WHERE id = $1`,
              [booking.student_id]
            );

            logger.warn(
              { studentId: booking.student_id, bookingId },
              'Student received 3-day booking ban due to 3 violation strikes'
            );
          }
        }

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
    } finally {
      await redis.del(lockKey);
    }
  }

  /**
   * Retrieve active and upcoming bookings for the authenticated student
   */
  public async getMyBookings(studentId: string): Promise<UserBookingDto[]> {
    const [studentRecord] = await db
      .select({ id: students.id })
      .from(students)
      .where(or(eq(students.id, studentId), eq(students.personId, studentId)))
      .limit(1);

    const targetStudentId = studentRecord?.id || studentId;

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
      .where(eq(bookings.studentId, targetStudentId))
      .orderBy(desc(slots.slotDate), desc(slots.startTime));

    return userBookings.map((b) => {
      const slotDateStr = typeof b.slotDate === 'string' ? b.slotDate.slice(0, 10) : bookingService.formatISTDate(b.slotDate);
      const hoursUntil = this.getHoursUntilSlotStart(slotDateStr, b.startTime);
      const isLate = hoursUntil < 2.0;
      const canCancel = b.bookingStatus === 'booked' && hoursUntil > 0;

      return {
        id: b.id,
        slotId: b.slotId,
        slotDate: slotDateStr,
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

  /**
   * Admin: Get bookings by user email
   */
  public async getAdminBookingsByEmail(email: string) {
    const client = await pool.connect();
    try {
      const studentRes = await client.query(
        `SELECT s.id as student_id 
         FROM people.students s
         JOIN people.people p ON s.person_id = p.id
         WHERE p.email = $1`,
        [email]
      );

      if (studentRes.rows.length === 0) {
        throw new NotFoundError(`Student with email ${email} not found`);
      }

      const studentId = studentRes.rows[0].student_id;

      const bookingsRes = await client.query(
        `SELECT 
           b.id AS booking_id,
           b.booking_status,
           b.created_at,
           s.slot_date,
           s.start_time,
           s.end_time,
           s.status AS slot_status
         FROM booking.bookings b
         JOIN booking.slots s ON b.slot_id = s.id
         WHERE b.student_id = $1
         ORDER BY s.slot_date DESC, s.start_time DESC`,
        [studentId]
      );

      return bookingsRes.rows.map((row) => ({
        id: row.booking_id,
        date: typeof row.slot_date === 'string' ? row.slot_date.slice(0, 10) : bookingService.formatISTDate(row.slot_date),
        startTime: row.start_time,
        endTime: row.end_time,
        status: row.booking_status,
        slotStatus: row.slot_status,
        createdAt: row.created_at,
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Admin: Cancel a specific booking without penalty
   */
  public async adminCancelBooking(bookingId: string, adminEmail: string) {
    const lockKey = `lock:booking:cancel:${bookingId}`;
    const acquired = await redis.set(lockKey, '1', 'PX', 5000, 'NX');
    if (!acquired) {
      throw new ConflictError('A cancellation operation is already in progress for this booking.');
    }

    try {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const bookingRes = await client.query(
          `SELECT id, slot_id, booking_status FROM booking.bookings WHERE id = $1 FOR UPDATE`,
          [bookingId]
        );

        if (bookingRes.rows.length === 0) {
          throw new NotFoundError(`Booking '${bookingId}' not found`);
        }

        const booking = bookingRes.rows[0];

        if (booking.booking_status !== 'booked') {
          throw new ValidationError(
            `Cannot cancel a booking that is already in '${booking.booking_status}' status.`
          );
        }

        // Update booking status
        await client.query(
          `UPDATE booking.bookings 
           SET booking_status = 'cancelled_by_admin',
               cancelled_at = NOW(),
               cancellation_reason = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [`Cancelled administratively by ${adminEmail}`, bookingId]
        );

        // Decrement slot booked count
        await client.query(
          `UPDATE booking.slots 
           SET booked_count = GREATEST(0, booked_count - 1) 
           WHERE id = $1`,
          [booking.slot_id]
        );

        await client.query('COMMIT');
        return { bookingId, status: 'cancelled_by_admin' };
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }
    } finally {
      await redis.del(lockKey);
    }
  }

  /**
   * Admin: Cancel all active bookings for a user
   */
  public async adminCancelAllBookings(email: string, adminEmail: string) {
    const bookings = await this.getAdminBookingsByEmail(email);
    const activeBookings = bookings.filter((b) => b.status === 'booked');
    const results = [];

    for (const booking of activeBookings) {
      try {
        const res = await this.adminCancelBooking(booking.id, adminEmail);
        results.push(res);
      } catch (err) {
        logger.error({ err, bookingId: booking.id }, 'Failed to cancel booking in bulk');
      }
    }

    return results;
  }
}

export const reservationService = new ReservationService();
