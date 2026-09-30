import { eq, and, or, inArray, asc, desc, gt } from 'drizzle-orm';
import { db } from '../../shared/database/index.js';
import { logger } from '../../shared/logging/index.js';
import { ValidationError, NotFoundError } from '../../shared/errors/index.js';
import {
  slots,
  bookings,
  students,
  memberships,
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
   * Load gym calendar closures into a Map<dateStr, reason>.
   * Shared helper used by both global and per-user window builders.
   */
  public async loadLockedMap(): Promise<Map<string, string>> {
    const closures = await db.select().from(gymCalendar);
    const lockedMap = new Map<string, string>();
    for (const c of closures) {
      const cDateStr = typeof c.closureDate === 'string' ? c.closureDate.slice(0, 10) : this.formatISTDate(c.closureDate);
      lockedMap.set(cDateStr, c.reason);
    }
    return lockedMap;
  }

  /**
   * Build a block of `desiredOpenDays` open dates starting from `startStr`.
   * Locked/closure days are included but do NOT count toward the open-day tally.
   * Walks forward up to 14 calendar days max.
   */
  public buildBlockFrom(startStr: string, desiredOpenDays: number, lockedMap: Map<string, string>): string[] {
    const dates: string[] = [];
    let openDaysFound = 0;
    const startDate = new Date(`${startStr}T00:00:00+05:30`);
    let offset = 0;

    while (openDaysFound < desiredOpenDays && offset < 14) {
      const target = new Date(startDate.getTime() + offset * 24 * 60 * 60 * 1000);
      const dateStr = this.formatISTDate(target);

      dates.push(dateStr);

      if (lockedMap.has(dateStr)) {
        logger.debug({ dateStr, reason: lockedMap.get(dateStr) }, 'Date is locked in gym calendar');
      } else {
        openDaysFound++;
      }

      offset++;
    }

    return dates;
  }

  /**
   * Compute the GLOBAL active window dates in IST (used by scheduler + ensureSlotsForWindow).
   * Starts from today, counts `windowDays` open days. Same for all users.
   */
  public async getRollingWindowDates(config?: SlotConfigDto): Promise<{ dates: string[]; lockedMap: Map<string, string> }> {
    const cfg = config || (await this.getSlotConfig());
    const desiredOpenDays = cfg.windowDays || 3;
    const lockedMap = await this.loadLockedMap();
    const todayStr = this.formatISTDate();
    const dates = this.buildBlockFrom(todayStr, desiredOpenDays, lockedMap);
    return { dates, lockedMap };
  }

  /**
   * Per-user first-booking anchored lazy-start block window.
   * Greedy partition: bookings are grouped into non-overlapping blocks from the
   * earliest date. Only the block owning today locks. Expired blocks are skipped,
   * so a fresh prospective window starts after expiry.
   */
  public async getUserWindowDates(
    studentId?: string,
    config?: SlotConfigDto
  ): Promise<{ dates: string[]; lockedMap: Map<string, string>; anchor: string; locked: boolean }> {
    const cfg = config || (await this.getSlotConfig());
    const desiredOpenDays = cfg.windowDays || 3;
    const lockedMap = await this.loadLockedMap();
    const todayStr = this.formatISTDate();

    if (!studentId) {
      const dates = this.buildBlockFrom(todayStr, desiredOpenDays, lockedMap);
      return { dates, lockedMap, anchor: todayStr, locked: false };
    }

    const [studentRec] = await db
      .select({ id: students.id })
      .from(students)
      .where(or(eq(students.personId, studentId), eq(students.id, studentId)))
      .limit(1);

    const resolvedId = studentRec?.id || studentId;

    const cutoffDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const cutoffStr = this.formatISTDate(cutoffDate);

    const bookedRows = await db
      .select({ slotDate: slots.slotDate })
      .from(bookings)
      .innerJoin(slots, eq(bookings.slotId, slots.id))
      .where(
        and(
          eq(bookings.studentId, resolvedId),
          eq(bookings.bookingStatus, 'booked'),
          gt(slots.slotDate, cutoffStr)
        )
      )
      .orderBy(asc(slots.slotDate));

    const bookedDatesSet = new Set<string>();
    for (const row of bookedRows) {
      const d = typeof row.slotDate === 'string' ? row.slotDate.slice(0, 10) : this.formatISTDate(row.slotDate);
      bookedDatesSet.add(d);
    }
    const bookedDates = Array.from(bookedDatesSet).sort();

    // Greedy partition — expired blocks are consumed and skipped
    let i = 0;
    while (i < bookedDates.length) {
      const start = bookedDates[i];
      const block = this.buildBlockFrom(start, desiredOpenDays, lockedMap);
      const set = new Set(block);
      if (set.has(todayStr)) {
        return { dates: block, lockedMap, anchor: start, locked: true };
      }
      if (start > todayStr) {
        return { dates: block, lockedMap, anchor: start, locked: true };
      }
      while (i < bookedDates.length && set.has(bookedDates[i])) i++;
    }

    const dates = this.buildBlockFrom(todayStr, desiredOpenDays, lockedMap);
    return { dates, lockedMap, anchor: todayStr, locked: false };
  }

  /**
   * Check if a given date string (YYYY-MM-DD) is within the active rolling window (global).
   * Kept for backward compat — scheduler, etc.
   */
  public async isDateInRollingWindow(dateStr: string): Promise<boolean> {
    const { dates } = await this.getRollingWindowDates();
    return dates.includes(dateStr);
  }

  /**
   * Check if a given date is within the user's per-user window.
   */
  public async isDateInUserWindow(dateStr: string, studentId?: string): Promise<boolean> {
    const { dates } = await this.getUserWindowDates(studentId);
    return dates.includes(dateStr);
  }

  /**
   * Idempotently ensure slots exist in database for all active window dates,
   * removing obsolete unbooked slots and deduplicating if schedule changed.
   */
  public async ensureSlotsForWindow(config?: SlotConfigDto): Promise<void> {
    const cfg = config || (await this.getSlotConfig());
    const { dates, lockedMap } = await this.getRollingWindowDates(cfg);

    const generatedIntervals = this.generateSlotIntervals(
      cfg.operatingWindows,
      cfg.slotDurationMinutes,
      cfg.bufferMinutes
    );

    const targetIntervalKeys = new Set(
      generatedIntervals.map((i) => `${i.startTime.slice(0, 5)}|${i.endTime.slice(0, 5)}`)
    );

    const todayStr = this.formatISTDate();
    const currentISTTime = this.getISTCurrentTime();

    for (const dateStr of dates) {
      // Ignore past dates that have already finished
      if (dateStr < todayStr) {
        continue;
      }

      const isToday = dateStr === todayStr;
      const isLocked = lockedMap.has(dateStr);

      const existing = await db
        .select()
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

      // 1. Group by interval key and identify duplicates or obsolete unbooked slots
      const seenIntervals = new Map<string, typeof slots.$inferSelect>();
      const slotsToDelete: string[] = [];

      for (const s of existing) {
        const intervalKey = `${s.startTime.slice(0, 5)}|${s.endTime.slice(0, 5)}`;
        const isTarget = targetIntervalKeys.has(intervalKey);
        const hasStarted = isToday && s.startTime.slice(0, 5) <= currentISTTime;

        // Never delete slots that have already started or have active reservations
        if (hasStarted || (s.bookedCount || 0) > 0) {
          seenIntervals.set(intervalKey, s);
          continue;
        }

        // If unbooked, unstarted, and not in target schedule, delete it
        if (!isTarget) {
          slotsToDelete.push(s.id);
          continue;
        }

        // If already seen this exact interval, delete unbooked duplicate
        if (seenIntervals.has(intervalKey)) {
          const prev = seenIntervals.get(intervalKey)!;
          if ((s.bookedCount || 0) > 0 && (prev.bookedCount || 0) === 0) {
            slotsToDelete.push(prev.id);
            seenIntervals.set(intervalKey, s);
          } else if ((s.bookedCount || 0) === 0) {
            slotsToDelete.push(s.id);
          }
        } else {
          seenIntervals.set(intervalKey, s);
        }
      }

      if (slotsToDelete.length > 0) {
        await db.delete(slots).where(inArray(slots.id, slotsToDelete));
      }

      // 2. Determine which target intervals are missing
      const remainingIntervals = new Set(
        existing
          .filter((s) => !slotsToDelete.includes(s.id))
          .map((s) => `${s.startTime.slice(0, 5)}|${s.endTime.slice(0, 5)}`)
      );

      const missingIntervals = generatedIntervals.filter((schedule) => {
        // Do not generate intervals that have already passed for today
        if (isToday && schedule.startTime <= currentISTTime) {
          return false;
        }
        return !remainingIntervals.has(
          `${schedule.startTime.slice(0, 5)}|${schedule.endTime.slice(0, 5)}`
        );
      });

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
  public async getSlotsForDate(
    dateStr: string,
    studentId?: string,
    config?: SlotConfigDto,
    skipEnsure = false
  ): Promise<DaySlotsDto> {
    const cfg = config || (await this.getSlotConfig());
    // Per-user window when studentId available, else global prospective
    const { dates, lockedMap } = await this.getUserWindowDates(studentId, cfg);

    if (!dates.includes(dateStr)) {
      throw new ValidationError(
        `Date '${dateStr}' is outside the active booking window (${dates.join(', ')})`
      );
    }

    const isLocked = lockedMap.has(dateStr);
    const lockReason = lockedMap.get(dateStr);

    // Ensure database contains slots for this window (unless already ensured by caller)
    if (!skipEnsure) {
      await this.ensureSlotsForWindow(cfg);
    }

    const dbSlots = await db
      .select()
      .from(slots)
      .where(eq(slots.slotDate, dateStr))
      .orderBy(asc(slots.startTime));

    const todayStr = this.formatISTDate();
    const isToday = dateStr === todayStr;
    const currentISTTime = this.getISTCurrentTime();

    // Check all active bookings and membership coverage the student has on this date
    const userBookedSlotIds: string[] = [];
    let isPassValidOnDate = true;
    let passExpiryDate: string | undefined = undefined;

    if (studentId) {
      const [studentRec] = await db
        .select({ id: students.id, residency: students.residency })
        .from(students)
        .where(or(eq(students.personId, studentId), eq(students.id, studentId)))
        .limit(1);

      const resolvedStudentId = studentRec?.id || studentId;

      if (dbSlots.length > 0) {
        const slotIds = dbSlots.map((s) => s.id);
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

      // Day Scholar: currently ACTIVE membership must cover the slot date (no queued passes)
      if (studentRec && studentRec.residency === 'day_scholar') {
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
              or(eq(memberships.studentId, resolvedStudentId), eq(memberships.studentId, studentId)),
              eq(memberships.status, 'active'),
              gt(memberships.endDate, new Date())
            )
          )
          .orderBy(desc(memberships.endDate));

        if (userMemberships.length === 0) {
          isPassValidOnDate = false;
        } else {
          const maxExpiry = userMemberships[0].endDate;
          passExpiryDate = maxExpiry.toISOString();
          const slotDayStart = new Date(`${dateStr}T00:00:00+05:30`);
          const slotDayEnd = new Date(`${dateStr}T23:59:59.999+05:30`);
          isPassValidOnDate = userMemberships.some(
            (m) => m.startDate <= slotDayEnd && m.endDate >= slotDayStart
          );
        }
      }
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
        isPassCovered: isPassValidOnDate,
      };
    });

    const parsedDate = new Date(`${dateStr}T00:00:00Z`);
    const dayOfWeek = new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      timeZone: 'UTC',
    }).format(parsedDate);

    const tomorrowStr = this.formatISTDate(new Date(Date.now() + 24 * 60 * 60 * 1000));
    let dayLabel = dateStr;
    if (dateStr === todayStr) dayLabel = 'Today';
    else if (dateStr === tomorrowStr) dayLabel = 'Tomorrow';

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
      isPassValidOnDate,
      passExpiryDate,
      slots: isLocked ? [] : slotDtos,
    };
  }

  /**
   * Get all slots for all days in the active window
   */
  public async getRollingWindowSlots(studentId?: string): Promise<RollingWindowSlotsResponse> {
    const config = await this.getSlotConfig();
    // Per-user window: personalised dates
    const { dates } = await this.getUserWindowDates(studentId, config);

    // Ensure global slots exist (covers all potential user windows)
    await this.ensureSlotsForWindow(config);

    const days: DaySlotsDto[] = [];

    for (const dateStr of dates) {
      const daySlots = await this.getSlotsForDate(dateStr, studentId, config, true);
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
