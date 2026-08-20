import { eq, and, or, inArray, asc, desc } from 'drizzle-orm';
import { db } from '../../shared/database/index.js';
import { logger } from '../../shared/logging/index.js';
import { ValidationError, NotFoundError } from '../../shared/errors/index.js';
import {
  slots,
  bookings,
  students,
  auditLogs,
  gymCalendar,
  slotConfigs,
} from '../../db/schema/index.js';
import {
  DEFAULT_SLOT_CAPACITY,
  DEFAULT_OPERATING_WINDOWS,
  OperatingWindowDto,
  SlotConfigDto,
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
   * Helper: Parse 'HH:mm' to minutes from midnight
   */
  private parseTimeToMinutes(timeStr: string): number {
    const [hh, mm] = timeStr.split(':').map((v) => parseInt(v, 10));
    return (hh || 0) * 60 + (mm || 0);
  }

  /**
   * Helper: Convert minutes from midnight to 'HH:mm'
   */
  private formatMinutesToTime(minutes: number): string {
    const hh = Math.floor(minutes / 60)
      .toString()
      .padStart(2, '0');
    const mm = (minutes % 60).toString().padStart(2, '0');
    return `${hh}:${mm}`;
  }

  /**
   * Generate slot intervals based on operating sessions, duration, and buffer
   */
  public generateSlotIntervals(
    operatingWindows: OperatingWindowDto[] = DEFAULT_OPERATING_WINDOWS,
    slotDurationMinutes: number = 60,
    bufferMinutes: number = 0
  ): { startTime: string; endTime: string; label?: string }[] {
    const result: { startTime: string; endTime: string; label?: string }[] = [];

    for (const session of operatingWindows) {
      const sessionStartMin = this.parseTimeToMinutes(session.startTime);
      const sessionEndMin = this.parseTimeToMinutes(session.endTime);

      let currentMin = sessionStartMin;
      let slotIdx = 1;

      while (currentMin + slotDurationMinutes <= sessionEndMin) {
        const slotStart = this.formatMinutesToTime(currentMin);
        const slotEnd = this.formatMinutesToTime(currentMin + slotDurationMinutes);

        result.push({
          startTime: slotStart,
          endTime: slotEnd,
          label: session.label ? `${session.label} Slot ${slotIdx}` : `Slot ${slotIdx}`,
        });

        currentMin += slotDurationMinutes + bufferMinutes;
        slotIdx++;
      }
    }

    return result;
  }

  /**
   * Fetch current system slot configuration (creates default if none exists)
   */
  public async getSlotConfig(): Promise<SlotConfigDto> {
    const [existing] = await db.select().from(slotConfigs).limit(1);

    if (existing) {
      return {
        id: existing.id,
        windowMode: (existing.windowMode as 'block' | 'rolling') || 'block',
        windowDays: parseInt(existing.windowDays, 10) || 3,
        defaultCapacity: parseInt(existing.defaultCapacity, 10) || DEFAULT_SLOT_CAPACITY,
        slotDurationMinutes: parseInt(existing.slotDurationMinutes, 10) || 60,
        bufferMinutes: parseInt(existing.bufferMinutes, 10) || 0,
        operatingWindows: (existing.operatingWindows as OperatingWindowDto[]) || DEFAULT_OPERATING_WINDOWS,
        updatedAt: existing.updatedAt.toISOString(),
      };
    }

    // Insert initial default configuration
    const [inserted] = await db
      .insert(slotConfigs)
      .values({
        windowMode: 'block',
        windowDays: '3',
        defaultCapacity: String(DEFAULT_SLOT_CAPACITY),
        slotDurationMinutes: '60',
        bufferMinutes: '0',
        operatingWindows: DEFAULT_OPERATING_WINDOWS,
      })
      .returning();

    return {
      id: inserted.id,
      windowMode: 'block',
      windowDays: 3,
      defaultCapacity: DEFAULT_SLOT_CAPACITY,
      slotDurationMinutes: 60,
      bufferMinutes: 0,
      operatingWindows: DEFAULT_OPERATING_WINDOWS,
      updatedAt: inserted.updatedAt.toISOString(),
    };
  }

  /**
   * Update system slot configuration and trigger future slot regeneration
   */
  public async updateSlotConfig(
    data: {
      windowMode?: 'block' | 'rolling';
      windowDays?: number;
      defaultCapacity?: number;
      slotDurationMinutes?: number;
      bufferMinutes?: number;
      operatingWindows?: OperatingWindowDto[];
    },
    adminEmail: string
  ): Promise<SlotConfigDto> {
    const current = await this.getSlotConfig();

    const updates: Partial<typeof slotConfigs.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.windowMode !== undefined) updates.windowMode = data.windowMode;
    if (data.windowDays !== undefined) updates.windowDays = String(data.windowDays);
    if (data.defaultCapacity !== undefined) updates.defaultCapacity = String(data.defaultCapacity);
    if (data.slotDurationMinutes !== undefined) updates.slotDurationMinutes = String(data.slotDurationMinutes);
    if (data.bufferMinutes !== undefined) updates.bufferMinutes = String(data.bufferMinutes);
    if (data.operatingWindows !== undefined) updates.operatingWindows = data.operatingWindows;

    if (current.id) {
      await db.update(slotConfigs).set(updates).where(eq(slotConfigs.id, current.id));
    } else {
      await db.insert(slotConfigs).values(updates as typeof slotConfigs.$inferInsert);
    }

    // Audit log
    await db.insert(auditLogs).values({
      actorEmail: adminEmail,
      action: 'update_slot_configuration',
      entity: 'slot_config',
      entityId: current.id || 'default',
      reason: `Updated slot schedule config: windowDays=${data.windowDays || current.windowDays}, capacity=${data.defaultCapacity || current.defaultCapacity}, duration=${data.slotDurationMinutes || current.slotDurationMinutes}m, buffer=${data.bufferMinutes || current.bufferMinutes}m`,
    });

    const updatedConfig = await this.getSlotConfig();

    // Re-generate slots for active window
    await this.ensureSlotsForWindow(updatedConfig);

    return updatedConfig;
  }

  /**
   * Compute the active window dates in IST.
   * If a date is locked (e.g. Day 2), it is included as locked and the window
   * extends to the next open day (e.g. Day 4) so students have `windowDays` open days.
   */
  public async getRollingWindowDates(config?: SlotConfigDto): Promise<{ dates: string[]; lockedMap: Map<string, string> }> {
    const cfg = config || (await this.getSlotConfig());
    const desiredOpenDays = cfg.windowDays || 3;

    // Fetch all active closures from gym_calendar
    const closures = await db.select().from(gymCalendar);
    const lockedMap = new Map<string, string>();
    for (const c of closures) {
      const cDateStr = typeof c.closureDate === 'string' ? c.closureDate.slice(0, 10) : this.formatISTDate(c.closureDate);
      lockedMap.set(cDateStr, c.reason);
    }

    const dates: string[] = [];
    let openDaysFound = 0;
    const now = new Date();
    let offset = 0;

    // Search forward up to 14 days
    while (openDaysFound < desiredOpenDays && offset < 14) {
      const target = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
      const dateStr = this.formatISTDate(target);

      dates.push(dateStr);

      if (lockedMap.has(dateStr)) {
        // Day is locked: include it in window, but do NOT increment open days
        logger.debug({ dateStr, reason: lockedMap.get(dateStr) }, 'Date is locked in gym calendar');
      } else {
        openDaysFound++;
      }

      offset++;
    }

    return { dates, lockedMap };
  }

  /**
   * Check if a given date string (YYYY-MM-DD) is within the active rolling window
   */
  public async isDateInRollingWindow(dateStr: string): Promise<boolean> {
    const { dates } = await this.getRollingWindowDates();
    return dates.includes(dateStr);
  }

  /**
   * Idempotently ensure slots exist in database for all active window dates
   */
  public async ensureSlotsForWindow(config?: SlotConfigDto): Promise<void> {
    const cfg = config || (await this.getSlotConfig());
    const { dates, lockedMap } = await this.getRollingWindowDates(cfg);

    const generatedIntervals = this.generateSlotIntervals(
      cfg.operatingWindows,
      cfg.slotDurationMinutes,
      cfg.bufferMinutes
    );

    for (const dateStr of dates) {
      const isLocked = lockedMap.has(dateStr);

      const existing = await db
        .select({ id: slots.id, startTime: slots.startTime, status: slots.status, capacity: slots.capacity })
        .from(slots)
        .where(eq(slots.slotDate, dateStr));

      if (isLocked) {
        // If date is locked, ensure existing slots on this date are marked closed
        const openSlotIds = existing.filter((s) => s.status !== 'closed').map((s) => s.id);
        if (openSlotIds.length > 0) {
          await db.update(slots).set({ status: 'closed' }).where(inArray(slots.id, openSlotIds));
        }
        continue;
      }

      const existingTimes = new Set(existing.map((s) => s.startTime.slice(0, 5)));

      const missingIntervals = generatedIntervals.filter(
        (schedule) => !existingTimes.has(schedule.startTime)
      );

      if (missingIntervals.length > 0) {
        logger.info(
          { date: dateStr, count: missingIntervals.length },
          'Generating automated slots for date'
        );

        const slotInserts = missingIntervals.map((schedule) => ({
          slotDate: dateStr,
          startTime: `${schedule.startTime}:00`,
          endTime: `${schedule.endTime}:00`,
          capacity: cfg.defaultCapacity,
          bookedCount: 0,
          status: 'open',
        }));

        await db.insert(slots).values(slotInserts).onConflictDoNothing();
      }
    }
  }

  /**
   * Get slots for a specific date with user-specific booking status and lock information
   */
  public async getSlotsForDate(dateStr: string, studentId?: string, config?: SlotConfigDto): Promise<DaySlotsDto> {
    const cfg = config || (await this.getSlotConfig());
    const { dates, lockedMap } = await this.getRollingWindowDates(cfg);

    if (!dates.includes(dateStr)) {
      throw new ValidationError(
        `Date '${dateStr}' is outside the active booking window (${dates.join(', ')})`
      );
    }

    const isLocked = lockedMap.has(dateStr);
    const lockReason = lockedMap.get(dateStr);

    // Ensure database contains slots for this window
    await this.ensureSlotsForWindow(cfg);

    const dbSlots = await db
      .select()
      .from(slots)
      .where(eq(slots.slotDate, dateStr))
      .orderBy(asc(slots.startTime));

    const todayStr = this.formatISTDate();
    const isToday = dateStr === todayStr;
    const currentISTTime = this.getISTCurrentTime();

    // Check all active bookings the student has on this date
    const userBookedSlotIds: string[] = [];
    if (studentId && dbSlots.length > 0) {
      const slotIds = dbSlots.map((s) => s.id);

      const [studentRec] = await db
        .select({ id: students.id })
        .from(students)
        .where(or(eq(students.personId, studentId), eq(students.id, studentId)))
        .limit(1);

      const resolvedStudentId = studentRec?.id || studentId;

      const userBookings = await db
        .select({ slotId: bookings.slotId })
        .from(bookings)
        .where(
          and(
            eq(bookings.studentId, resolvedStudentId),
            inArray(bookings.slotId, slotIds),
            eq(bookings.bookingStatus, 'booked')
          )
        );

      userBookedSlotIds.push(...userBookings.map((b) => b.slotId));
    }

    const userBookedSet = new Set(userBookedSlotIds);

    const slotDtos: SlotDto[] = dbSlots.map((slot) => {
      const startHHmm = slot.startTime.slice(0, 5);
      const isPast = isToday && startHHmm <= currentISTTime;
      const bookedCount = slot.bookedCount || 0;
      const capacity = slot.capacity || cfg.defaultCapacity;
      const availableSpots = Math.max(0, capacity - bookedCount);
      const isFull = availableSpots === 0;
      const occupancyPercentage = Math.min(100, Math.round((bookedCount / capacity) * 100));

      return {
        id: slot.id,
        date: typeof slot.slotDate === 'string' ? slot.slotDate.slice(0, 10) : this.formatISTDate(slot.slotDate),
        startTime: slot.startTime,
        endTime: slot.endTime,
        capacity,
        bookedCount,
        availableSpots,
        occupancyPercentage,
        isFull,
        isActive: !isLocked && slot.status === 'open',
        isPast,
        isBookedByCurrentUser: userBookedSet.has(slot.id),
      };
    });

    const parsedDate = new Date(`${dateStr}T00:00:00Z`);
    const dayOfWeek = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: 'UTC',
    }).format(parsedDate);

    let dayLabel = dateStr;
    if (dateStr === dates[0]) dayLabel = 'Today';
    else if (dateStr === dates[1]) dayLabel = 'Tomorrow';

    const totalCapacity = isLocked ? 0 : slotDtos.reduce((sum, s) => sum + s.capacity, 0);
    const totalBooked = slotDtos.reduce((sum, s) => sum + s.bookedCount, 0);

    return {
      date: dateStr,
      dayLabel,
      dayOfWeek,
      isToday,
      isLocked,
      lockReason,
      hasUserBookedOnDate: userBookedSlotIds.length >= 3,
      userBookedSlotId: userBookedSlotIds[0],
      userBookedCountOnDate: userBookedSlotIds.length,
      userBookedSlotIds,
      totalCapacity,
      totalBooked,
      slots: isLocked ? [] : slotDtos,
    };
  }

  /**
   * Get all slots for all days in the active window
   */
  public async getRollingWindowSlots(studentId?: string): Promise<RollingWindowSlotsResponse> {
    const config = await this.getSlotConfig();
    const { dates } = await this.getRollingWindowDates(config);
    const days: DaySlotsDto[] = [];

    for (const dateStr of dates) {
      const daySlots = await this.getSlotsForDate(dateStr, studentId, config);
      days.push(daySlots);
    }

    const totalUserBookingsInWindow = days.reduce(
      (sum, d) => sum + (d.userBookedCountOnDate || 0),
      0
    );

    return {
      windowDates: dates,
      totalUserBookingsInWindow,
      config,
      days,
    };
  }

  /**
   * Admin: Update single slot capacity
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
