import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import { db, pool } from '../../shared/database/index.js';
import { logger } from '../../shared/logging/index.js';
import {
  people,
  students,
  staff,
  authorizedPersons,
  bookingSchema,
  slots,
  bookings,
  accessSessions,
  entryExitLogs,
  trainerProfiles,
} from '../../db/schema/index.js';
import { bookingService } from '../booking/booking.service.js';
import { ZkBioWebhookDto, AccessDecisionResult, LiveOccupancyStats, LiveGymOccupant } from './access.types.js';
import { sseService } from '../sse/sse.service.js';
import { membershipService } from '../membership/membership.service.js';
import { membershipPlans, memberships } from '../../db/schema/index.js';
import { config } from '../../config/index.js';

export class AccessService {
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
   * Lookup person and their role metadata from any identifier
   */
  public async lookupPerson(identifierType: string, identifierValue: string) {
    if (identifierType === 'roll_number') {
      const [result] = await db
        .select({
          person: people,
          student: students,
        })
        .from(students)
        .innerJoin(people, eq(students.personId, people.id))
        .where(eq(students.rollNumber, identifierValue))
        .limit(1);

      if (!result) return null;
      return {
        ...result.person,
        studentDetails: result.student,
        identifier: result.student.rollNumber,
      };
    }

    if (identifierType === 'staff_id') {
      const [result] = await db
        .select({
          person: people,
          staff: staff,
        })
        .from(staff)
        .innerJoin(people, eq(staff.personId, people.id))
        .where(eq(staff.staffId, identifierValue))
        .limit(1);

      if (!result) return null;
      return {
        ...result.person,
        staffDetails: result.staff,
        identifier: result.staff.staffId,
      };
    }

    if (identifierType === 'email') {
      const [person] = await db.select().from(people).where(eq(people.email, identifierValue)).limit(1);
      if (!person) return null;

      let studentDetails;
      if (person.personType === 'student') {
        const [st] = await db.select().from(students).where(eq(students.personId, person.id)).limit(1);
        studentDetails = st;
      }

      return {
        ...person,
        studentDetails,
        identifier: studentDetails?.rollNumber || person.email,
      };
    }

    if (identifierType === 'person_id') {
      const [person] = await db.select().from(people).where(eq(people.id, identifierValue)).limit(1);
      if (!person) return null;

      let studentDetails;
      if (person.personType === 'student') {
        const [st] = await db.select().from(students).where(eq(students.personId, person.id)).limit(1);
        studentDetails = st;
      }

      return {
        ...person,
        studentDetails,
        identifier: studentDetails?.rollNumber || person.email,
      };
    }

    return null;
  }

  /**
   * Process incoming biometric turnstile scan (entry / exit)
   */
  public async processTurnstileEvent(dto: ZkBioWebhookDto): Promise<AccessDecisionResult> {
    const timestampNow = new Date().toISOString();
    const person = await this.lookupPerson(dto.identifierType, dto.identifierValue);

    if (!person) {
      await db.insert(entryExitLogs).values({
        personId: null,
        eventType: dto.eventType === 'entry' ? 'entry_denied' : 'exit_recorded',
        deviceId: dto.deviceId,
        result: 'denied',
        denialReason: `Unrecognized biometric identifier (${dto.identifierType}: ${dto.identifierValue})`,
        rawTelemetry: dto.rawTelemetry || {},
      });

      return {
        accessGranted: false,
        eventType: dto.eventType,
        identifier: dto.identifierValue,
        denialReason: 'Unrecognized user identity',
        message: 'Access denied: User is not registered in REC College Gym directory.',
        timestamp: timestampNow,
      };
    }

    let result: AccessDecisionResult;
    // Process Entry
    if (dto.eventType === 'entry') {
      result = await this.handleEntry(person, dto);
    } else {
      // Process Exit
      result = await this.handleExit(person, dto);
    }

    // Broadcast new occupancy if access was granted
    if (result.accessGranted) {
      const occ = await this.getLiveOccupancy(false);
      sseService.broadcast('occupancy_update', occ);
    }

    return result;
  }

  /**
   * Process Entry verification pipeline (ADR-012, FR-ACC-002)
   */
  private async handleEntry(person: any, dto: ZkBioWebhookDto): Promise<AccessDecisionResult> {
    const timestampNow = new Date().toISOString();

    // 0. Anti-Pass-Back Check (ADR-014, FR-ACC-004)
    const [alreadyInside] = await db
      .select({ id: accessSessions.id, entryTimestamp: accessSessions.entryTimestamp })
      .from(accessSessions)
      .where(and(eq(accessSessions.personId, person.id), eq(accessSessions.status, 'inside')))
      .limit(1);

    if (alreadyInside) {
      await db.insert(entryExitLogs).values({
        personId: person.id,
        eventType: 'entry_denied',
        deviceId: dto.deviceId,
        result: 'denied',
        denialReason: 'Anti-Pass-Back Violation: Identity is already marked inside the gym',
        rawTelemetry: dto.rawTelemetry || {},
      });

      return {
        accessGranted: false,
        eventType: 'entry',
        personId: person.id,
        name: person.name,
        role: person.personType,
        identifier: person.identifier,
        denialReason: 'Anti-Pass-Back Conflict',
        message: `Access denied for ${person.name}. Anti-Pass-Back alert: This identity is already checked in. Please scan exit turnstile first.`,
        timestamp: timestampNow,
      };
    }

    // 1. Staff, Trainer, VIP bypass
    if (['staff', 'trainer', 'admin', 'authorized_person'].includes(person.personType)) {
      await db.insert(accessSessions).values({
        personId: person.id,
        entryTimestamp: new Date(),
        status: 'inside',
        entryDeviceId: dto.deviceId,
      });

      await db.insert(entryExitLogs).values({
        personId: person.id,
        eventType: 'entry_granted',
        deviceId: dto.deviceId,
        result: 'success',
        rawTelemetry: dto.rawTelemetry || {},
      });

      return {
        accessGranted: true,
        eventType: 'entry',
        personId: person.id,
        name: person.name,
        role: person.personType,
        identifier: person.identifier,
        message: `Welcome ${person.name}! Access granted (Institutional Staff/Trainer Bypass).`,
        timestamp: timestampNow,
      };
    }

    // 2. Student: Ban check (ADR-010)
    if (person.studentDetails?.isBanned) {
      await db.insert(entryExitLogs).values({
        personId: person.id,
        eventType: 'entry_denied',
        deviceId: dto.deviceId,
        result: 'denied',
        denialReason: 'Active suspension / 3-strike violation ban',
        rawTelemetry: dto.rawTelemetry || {},
      });

      return {
        accessGranted: false,
        eventType: 'entry',
        personId: person.id,
        name: person.name,
        role: person.personType,
        identifier: person.identifier,
        denialReason: 'Active gym booking suspension',
        message: `Access denied for ${person.name}. Gym access is suspended due to attendance violations.`,
        timestamp: timestampNow,
      };
    }

    // 3. Student: Confirmed booking match with ±15-min grace window (ADR-012)
    const todayStr = bookingService.formatISTDate();
    const currentISTTime = bookingService.getISTCurrentTime(); // HH:mm
    const currentMinutes = this.timeToMinutes(currentISTTime);

    // Fetch today's student bookings
    const studentBookings = await db
      .select({
        booking: bookings,
        slot: slots,
      })
      .from(bookings)
      .innerJoin(slots, eq(bookings.slotId, slots.id))
      .where(
        and(
          eq(bookings.studentId, person.studentDetails.id),
          eq(slots.slotDate, todayStr),
          sql`${bookings.bookingStatus} IN ('booked', 'attended')`
        )
      );

    let matchingBooking: (typeof studentBookings)[0] | null = null;

    for (const b of studentBookings) {
      const slotStartMinutes = this.timeToMinutes(b.slot.startTime.slice(0, 5));
      const slotEndMinutes = this.timeToMinutes(b.slot.endTime.slice(0, 5));

      // Grace Window: 15 minutes before slot start to 15 minutes before slot end
      const allowedEntryStart = slotStartMinutes - 15;
      const allowedEntryEnd = slotEndMinutes - 15;

      if (currentMinutes >= allowedEntryStart && currentMinutes <= allowedEntryEnd) {
        matchingBooking = b;
        break;
      }
    }

    if (!matchingBooking) {
      const reason = studentBookings.length > 0
        ? `Outside permitted ±15m grace window for reserved slot (${studentBookings[0].slot.startTime.slice(0, 5)} - ${studentBookings[0].slot.endTime.slice(0, 5)})`
        : 'No confirmed slot booking for today';

      await db.insert(entryExitLogs).values({
        personId: person.id,
        eventType: 'entry_denied',
        deviceId: dto.deviceId,
        result: 'denied',
        denialReason: reason,
        rawTelemetry: dto.rawTelemetry || {},
      });

      return {
        accessGranted: false,
        eventType: 'entry',
        personId: person.id,
        name: person.name,
        role: person.personType,
        identifier: person.identifier,
        denialReason: reason,
        message: `Access denied for ${person.name}. ${reason}. Allowed entry: 15m before slot start to 15m before slot end.`,
        timestamp: timestampNow,
      };
    }

    // 4. Valid booking verified: Update attendance & create access session
    await db
      .update(bookings)
      .set({
        bookingStatus: 'attended',
        accessStatus: 'inside',
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, matchingBooking.booking.id));

    await db.insert(accessSessions).values({
      personId: person.id,
      entryTimestamp: new Date(),
      status: 'inside',
      entryDeviceId: dto.deviceId,
    });

    await db.insert(entryExitLogs).values({
      personId: person.id,
      eventType: 'entry_granted',
      deviceId: dto.deviceId,
      result: 'success',
      rawTelemetry: dto.rawTelemetry || {},
    });

    const slotTimeStr = `${matchingBooking.slot.startTime.slice(0, 5)} - ${matchingBooking.slot.endTime.slice(0, 5)}`;

    return {
      accessGranted: true,
      eventType: 'entry',
      personId: person.id,
      name: person.name,
      role: person.personType,
      identifier: person.identifier,
      bookingId: matchingBooking.booking.id,
      slotTime: slotTimeStr,
      message: `Welcome ${person.name}! Verified for ${slotTimeStr} slot batch.`,
      timestamp: timestampNow,
    };
  }

  /**
   * Process Turnstile Exit & calculate workout duration (FR-ACC-003)
   */
  private async handleExit(person: any, dto: ZkBioWebhookDto): Promise<AccessDecisionResult> {
    const timestampNow = new Date().toISOString();

    // 1. Find active open session
    const [activeSession] = await db
      .select()
      .from(accessSessions)
      .where(and(eq(accessSessions.personId, person.id), eq(accessSessions.status, 'inside')))
      .orderBy(desc(accessSessions.entryTimestamp))
      .limit(1);

    let durationMinutes = 0;

    if (activeSession) {
      const entryTime = new Date(activeSession.entryTimestamp).getTime();
      const exitTime = new Date().getTime();
      durationMinutes = Math.max(1, Math.round((exitTime - entryTime) / (1000 * 60)));

      await db
        .update(accessSessions)
        .set({
          status: 'exited',
          exitTimestamp: new Date(),
          exitDeviceId: dto.deviceId,
        })
        .where(eq(accessSessions.id, activeSession.id));
    }

    // 2. If student, mark today's attended booking as completed
    if (person.personType === 'student' && person.studentDetails) {
      const todayStr = bookingService.formatISTDate();
      const [activeBooking] = await db
        .select({ id: bookings.id })
        .from(bookings)
        .innerJoin(slots, eq(bookings.slotId, slots.id))
        .where(
          and(
            eq(bookings.studentId, person.studentDetails.id),
            eq(slots.slotDate, todayStr),
            eq(bookings.accessStatus, 'inside')
          )
        )
        .limit(1);

      if (activeBooking) {
        await db
          .update(bookings)
          .set({
            accessStatus: 'exited',
            bookingStatus: 'completed',
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, activeBooking.id));
      }
    }

    // 3. Log Exit telemetry
    await db.insert(entryExitLogs).values({
      personId: person.id,
      eventType: 'exit_recorded',
      deviceId: dto.deviceId,
      result: 'success',
      rawTelemetry: { durationMinutes, ...dto.rawTelemetry },
    });

    return {
      accessGranted: true,
      eventType: 'exit',
      personId: person.id,
      name: person.name,
      role: person.personType,
      identifier: person.identifier,
      durationMinutes,
      message: `Exit recorded for ${person.name}. Workout session duration: ${durationMinutes} minutes. Have a great day!`,
      timestamp: timestampNow,
    };
  }

  /**
   * Get real-time gym occupancy details
   */
  public async getLiveOccupancy(canViewPii = true): Promise<LiveOccupancyStats> {
    const activeSessions = await db
      .select({
        sessionId: accessSessions.id,
        personId: accessSessions.personId,
        entryTimestamp: accessSessions.entryTimestamp,
        entryDeviceId: accessSessions.entryDeviceId,
        name: people.name,
        email: people.email,
        personType: people.personType,
      })
      .from(accessSessions)
      .innerJoin(people, eq(accessSessions.personId, people.id))
      .leftJoin(trainerProfiles, eq(trainerProfiles.personId, people.id))
      .where(
        and(eq(accessSessions.status, 'inside'), eq(people.personType, 'student'), isNull(trainerProfiles.personId))
      )
      .orderBy(desc(accessSessions.entryTimestamp));

    const now = new Date().getTime();

    const occupants: LiveGymOccupant[] = activeSessions.map((s) => {
      const entryTime = new Date(s.entryTimestamp).getTime();
      const minutesInside = Math.max(0, Math.round((now - entryTime) / (1000 * 60)));

      return {
        sessionId: s.sessionId,
        personId: s.personId,
        name: s.name,
        email: s.email,
        role: s.personType,
        identifier: s.email,
        entryTimestamp: s.entryTimestamp.toISOString(),
        minutesInside,
        entryDeviceId: s.entryDeviceId || undefined,
      };
    });

    const maxCapacity = 100;
    const currentCount = occupants.length;
    const occupancyPercentage = Math.min(100, Math.round((currentCount / maxCapacity) * 100));

    return {
      currentCount,
      maxCapacity,
      occupancyPercentage,
      occupants: canViewPii ? occupants : [],
    };
  }

/**
   * Get a person's own entry/exit access history (self-service)
   */
  public async getMyAccessHistory(personId: string, limit = 30) {
    const sessions = await db
      .select({
        id: accessSessions.id,
        entryTimestamp: accessSessions.entryTimestamp,
        exitTimestamp: accessSessions.exitTimestamp,
        status: accessSessions.status,
        entryDeviceId: accessSessions.entryDeviceId,
        exitDeviceId: accessSessions.exitDeviceId,
      })
      .from(accessSessions)
      .where(eq(accessSessions.personId, personId))
      .orderBy(desc(accessSessions.entryTimestamp))
      .limit(limit);

    const now = Date.now();
    const sessionDtos = sessions.map((s) => {
      const entry = new Date(s.entryTimestamp).getTime();
      const exit = s.exitTimestamp ? new Date(s.exitTimestamp).getTime() : null;
      const durationMinutes =
        exit !== null
          ? Math.max(0, Math.round((exit - entry) / (1000 * 60)))
          : s.status === 'inside'
            ? Math.max(0, Math.round((now - entry) / (1000 * 60)))
            : null;

      return {
        id: s.id,
        entryTimestamp: s.entryTimestamp.toISOString(),
        exitTimestamp: s.exitTimestamp ? s.exitTimestamp.toISOString() : null,
        status: s.status,
        entryDeviceId: s.entryDeviceId || undefined,
        exitDeviceId: s.exitDeviceId || undefined,
        durationMinutes,
      };
    });

    const logs = await db
      .select({
        id: entryExitLogs.id,
        eventType: entryExitLogs.eventType,
        deviceId: entryExitLogs.deviceId,
        result: entryExitLogs.result,
        denialReason: entryExitLogs.denialReason,
        createdAt: entryExitLogs.createdAt,
      })
      .from(entryExitLogs)
      .where(eq(entryExitLogs.personId, personId))
      .orderBy(desc(entryExitLogs.createdAt))
      .limit(limit);

    return { sessions: sessionDtos, logs };
  }

  /**
   * Get recent access turnstile event logs
   */
  public async getAccessLogs(limit = 50) {
    const logs = await db
      .select({
        id: entryExitLogs.id,
        personId: entryExitLogs.personId,
        name: people.name,
        email: people.email,
        eventType: entryExitLogs.eventType,
        deviceId: entryExitLogs.deviceId,
        result: entryExitLogs.result,
        denialReason: entryExitLogs.denialReason,
        createdAt: entryExitLogs.createdAt,
      })
      .from(entryExitLogs)
      .leftJoin(people, eq(entryExitLogs.personId, people.id))
      .orderBy(desc(entryExitLogs.createdAt))
      .limit(limit);

    return logs;
  }

  /**
   * Verify face registration via api_app and activate hosteller pass
   */
  public async verifyFaceRegistration(personId: string) {
    const [person] = await db.select().from(people).where(eq(people.id, personId)).limit(1);
    if (!person || person.personType !== 'student') {
      throw new Error('Only students can verify face registration');
    }

    const [stu] = await db.select().from(students).where(eq(students.personId, personId)).limit(1);
    if (!stu) {
      throw new Error('Student record not found');
    }

    if (stu.faceEnrollmentStatus === 'enrolled') {
      return { success: true, message: 'Face is already enrolled.' };
    }

    try {
      // Check with api_app (ngrok header needed when API_APP_URL is a tunnel URL)
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15_000);
      let response: Response;
      try {
        response = await fetch(`${config.API_APP_URL}/api/students/${stu.rollNumber}/face-status`, {
          headers: { 'ngrok-skip-browser-warning': 'true' },
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }
      if (!response.ok) {
        throw new Error('Failed to reach ZKBio integration service');
      }
      
      const data = await response.json() as any;
      if (data.enrolled) {
        // Face is registered on the machine!
        // 1. Update status
        await db.update(students)
          .set({ faceEnrollmentStatus: 'enrolled', updatedAt: new Date() })
          .where(eq(students.id, stu.id));
        
        await db.update(people)
          .set({ faceEnrollmentStatus: 'enrolled', updatedAt: new Date() })
          .where(eq(people.id, personId));

        // 2. If hosteller, activate 90-day window
        let message = 'Face successfully verified and enrolled.';
        if (stu.residency === 'hosteller') {
          // Find 3-Month Student Pass
          const [plan] = await db.select().from(membershipPlans).where(eq(membershipPlans.durationDays, 90)).limit(1);
          if (plan) {
            await membershipService.activateMembership(stu.id, plan.id, 'hosteller-free-pass');
            message += ' 90-day hosteller access activated.';
          } else {
            message += ' (Note: 90-day membership plan not found in database).';
          }
        } else if (stu.residency === 'day_scholar') {
          // Find pending_activation membership and activate it
          const [pendingMem] = await db.select().from(memberships).where(
            and(
              eq(memberships.studentId, stu.id),
              eq(memberships.status, 'pending_activation')
            )
          ).orderBy(desc(memberships.createdAt)).limit(1);
          
          if (pendingMem) {
            await membershipService.activateMembership(stu.id, pendingMem.planId, pendingMem.paymentId || 'pending-activation');
            await db.delete(memberships).where(eq(memberships.id, pendingMem.id)); // Clean up the pending row as activateMembership creates a new active one or extends an existing one
            message += ' Your purchased gym pass is now active.';
          }
        }
        
        return { success: true, message, enrolled: true };
      } else {
        return { success: false, message: 'Face not yet registered on the machine.', enrolled: false };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, rollNumber: stu.rollNumber }, 'Error verifying face registration');
      throw new Error(`Verification failed: ${msg}`);
    }
  }
}

export const accessService = new AccessService();
