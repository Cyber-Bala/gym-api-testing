import { eq, and, inArray, asc } from 'drizzle-orm';
import { db } from '../../shared/database/index.js';
import { logger } from '../../shared/logging/index.js';
import { ValidationError, NotFoundError } from '../../shared/errors/index.js';
import { slots, bookings, auditLogs } from '../../db/schema/index.js';
import {
  DEFAULT_SLOT_CAPACITY,
  DEFAULT_DAILY_SLOTS,
  SlotDto,
  DaySlotsDto,
  RollingWindowSlotsResponse,
} from './booking.types.js';

export class BookingService {
  /**
   * Format a date into YYYY-MM-DD in Indian Standard Time (Asia/Kolkata)
   */
  public formatISTDate(date: Date = new Date()): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date); // returns YYYY-MM-DD
  }

  /**
   * Get current time string HH:mm in Asia/Kolkata
   */
  public getISTCurrentTime(): string {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return formatter.format(new Date()); // HH:mm
  }

  /**
   * Compute the 3-day rolling window dates [Today, Today+1, Today+2] in IST
   */
  public getRollingWindowDates(): string[] {
    const dates: string[] = [];
    const now = new Date();

    for (let offset = 0; offset < 3; offset++) {
      const target = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
      dates.push(this.formatISTDate(target));
    }

    return dates;
  }

  /**
   * Check if a given date string (YYYY-MM-DD) is within the active 3-day rolling window
   */
  public isDateInRollingWindow(dateStr: string): boolean {
    const windowDates = this.getRollingWindowDates();
    return windowDates.includes(dateStr);
  }

  /**
   * Idempotently ensure slots exist in database for the 3-day rolling window
   */
  public async ensureSlotsForWindow(): Promise<void> {
    const windowDates = this.getRollingWindowDates();

    for (const dateStr of windowDates) {
      const existing = await db
        .select({ id: slots.id, startTime: slots.startTime })
        .from(slots)
        .where(eq(slots.slotDate, dateStr));

      const existingTimes = new Set(existing.map((s) => s.startTime.slice(0, 5)));

      const missingSlots = DEFAULT_DAILY_SLOTS.filter(
        (schedule) => !existingTimes.has(schedule.startTime)
      );

      if (missingSlots.length > 0) {
        logger.info(
          { date: dateStr, count: missingSlots.length },
          'Generating missing slots for date'
        );

        const slotInserts = missingSlots.map((schedule) => ({
          slotDate: dateStr,
          startTime: `${schedule.startTime}:00`,
          endTime: `${schedule.endTime}:00`,
          capacity: DEFAULT_SLOT_CAPACITY,
          bookedCount: 0,
          status: 'open',
        }));

        await db.insert(slots).values(slotInserts).onConflictDoNothing();
      }
    }
  }

  /**
   * Get slots for a specific date with user-specific booking status
   */
  public async getSlotsForDate(dateStr: string, studentId?: string): Promise<DaySlotsDto> {
    if (!this.isDateInRollingWindow(dateStr)) {
      throw new ValidationError(
        `Date '${dateStr}' is outside the 3-day rolling booking window (${this.getRollingWindowDates().join(', ')})`
      );
    }

    // Ensure database contains slots for this window
    await this.ensureSlotsForWindow();

    const dbSlots = await db
      .select()
      .from(slots)
      .where(eq(slots.slotDate, dateStr))
      .orderBy(asc(slots.startTime));

    const todayStr = this.formatISTDate();
    const isToday = dateStr === todayStr;
    const currentISTTime = this.getISTCurrentTime();

    // Check if student has an existing active booking on this date
    let userBookedSlotId: string | undefined;
    if (studentId && dbSlots.length > 0) {
      const slotIds = dbSlots.map((s) => s.id);
      const userBookings = await db
        .select({ slotId: bookings.slotId })
        .from(bookings)
        .where(
          and(
            eq(bookings.studentId, studentId),
            inArray(bookings.slotId, slotIds),
            eq(bookings.bookingStatus, 'booked')
          )
        )
        .limit(1);

      if (userBookings.length > 0) {
        userBookedSlotId = userBookings[0].slotId;
      }
    }

    const slotDtos: SlotDto[] = dbSlots.map((slot) => {
      const startHHmm = slot.startTime.slice(0, 5);
      const isPast = isToday && startHHmm <= currentISTTime;
      const bookedCount = slot.bookedCount || 0;
      const capacity = slot.capacity || DEFAULT_SLOT_CAPACITY;
      const availableSpots = Math.max(0, capacity - bookedCount);
      const isFull = availableSpots === 0;
      const occupancyPercentage = Math.min(100, Math.round((bookedCount / capacity) * 100));

      return {
        id: slot.id,
        date: slot.slotDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacity,
        bookedCount,
        availableSpots,
        occupancyPercentage,
        isFull,
        isActive: slot.status === 'open',
        isPast,
        isBookedByCurrentUser: userBookedSlotId === slot.id,
      };
    });

    const parsedDate = new Date(`${dateStr}T00:00:00Z`);
    const dayOfWeek = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: 'UTC',
    }).format(parsedDate);

    let dayLabel = dateStr;
    const windowDates = this.getRollingWindowDates();
    if (dateStr === windowDates[0]) dayLabel = 'Today';
    else if (dateStr === windowDates[1]) dayLabel = 'Tomorrow';
    else if (dateStr === windowDates[2]) dayLabel = 'Day After Tomorrow';

    const totalCapacity = slotDtos.reduce((sum, s) => sum + s.capacity, 0);
    const totalBooked = slotDtos.reduce((sum, s) => sum + s.bookedCount, 0);

    return {
      date: dateStr,
      dayLabel,
      dayOfWeek,
      isToday,
      hasUserBookedOnDate: !!userBookedSlotId,
      userBookedSlotId,
      totalCapacity,
      totalBooked,
      slots: slotDtos,
    };
  }

  /**
   * Get all slots for all 3 days in the rolling window
   */
  public async getRollingWindowSlots(studentId?: string): Promise<RollingWindowSlotsResponse> {
    const windowDates = this.getRollingWindowDates();
    const days: DaySlotsDto[] = [];

    for (const dateStr of windowDates) {
      const daySlots = await this.getSlotsForDate(dateStr, studentId);
      days.push(daySlots);
    }

    return {
      windowDates,
      days,
    };
  }

  /**
   * Admin: Update slot capacity (FR-BK-003, ADR-007)
   */
  public async updateSlotCapacity(
    slotId: string,
    capacity: number,
    reason: string,
    adminEmail: string
  ): Promise<typeof slots.$inferSelect> {
    const [existing] = await db.select().from(slots).where(eq(slots.id, slotId)).limit(1);

    if (!existing) {
      throw new NotFoundError(`Slot with ID '${slotId}' not found`);
    }

    const [updated] = await db
      .update(slots)
      .set({
        capacity,
      })
      .where(eq(slots.id, slotId))
      .returning();

    // Audit log
    await db.insert(auditLogs).values({
      actorEmail: adminEmail,
      action: 'update_capacity',
      entity: 'slot',
      entityId: slotId,
      previousValue: { capacity: existing.capacity },
      newValue: { capacity },
      reason,
    });

    return updated;
  }

  /**
   * Admin: Emergency toggle slot active/cancelled status
   */
  public async toggleSlotActive(
    slotId: string,
    isActive: boolean,
    reason: string,
    adminEmail: string
  ): Promise<typeof slots.$inferSelect> {
    const [existing] = await db.select().from(slots).where(eq(slots.id, slotId)).limit(1);

    if (!existing) {
      throw new NotFoundError(`Slot with ID '${slotId}' not found`);
    }

    const statusValue = isActive ? 'open' : 'closed';

    const [updated] = await db
      .update(slots)
      .set({
        status: statusValue,
      })
      .where(eq(slots.id, slotId))
      .returning();

    // Audit log
    await db.insert(auditLogs).values({
      actorEmail: adminEmail,
      action: isActive ? 'activate_slot' : 'deactivate_slot',
      entity: 'slot',
      entityId: slotId,
      previousValue: { status: existing.status },
      newValue: { status: statusValue },
      reason,
    });

    return updated;
  }
}

export const bookingService = new BookingService();
