import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { db, pool } from '../../shared/database/index.js';
import { logger } from '../../shared/logging/index.js';
import { NotFoundError, ConflictError } from '../../shared/errors/index.js';
import {
  students,
  people,
  memberships,
  paymentOrders,
  accessSessions,
  violations,
  slots,
  bookings,
  gymCalendar,
  auditLogs,
} from '../../db/schema/index.js';
import { bookingService } from '../booking/booking.service.js';
import { ExecutiveAnalyticsDto, GymClosureDto, AuditLogEntryDto } from './admin.types.js';

export class AdminService {
  /**
   * Aggregate executive KPI analytics (FR-ADM-001)
   */
  public async getExecutiveAnalytics(): Promise<ExecutiveAnalyticsDto> {
    const todayStr = bookingService.formatISTDate();
    const now = new Date();

    // 1. Student Breakdown
    const allStudents = await db.select({ residency: students.residency }).from(students);
    const totalRegisteredStudents = allStudents.length;
    const totalHostellers = allStudents.filter((s) => s.residency === 'hosteller').length;
    const totalDayScholars = allStudents.filter((s) => s.residency === 'day_scholar').length;

    // 2. Active Memberships
    const activeMem = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.status, 'active'), sql`${memberships.endDate} >= ${now}`));
    const activeMembershipsCount = activeMem.length;

    // 3. Today's Total Check-Ins
    const todaySessions = await db
      .select({ id: accessSessions.id })
      .from(accessSessions)
      .where(sql`DATE(${accessSessions.entryTimestamp} AT TIME ZONE 'Asia/Kolkata') = ${todayStr}`);
    const todayTotalCheckIns = todaySessions.length;

    // 4. Current Live Occupants
    const live = await db
      .select({ id: accessSessions.id })
      .from(accessSessions)
      .where(eq(accessSessions.status, 'inside'));
    const currentLiveOccupants = live.length;

    // 5. Total Revenue This Month
    const currentMonth = todayStr.slice(0, 7);
    const paidOrders = await db
      .select({ amount: paymentOrders.amount, createdAt: paymentOrders.createdAt })
      .from(paymentOrders)
      .where(eq(paymentOrders.status, 'paid'));

    let totalMonthlyRevenue = 0;
    for (const o of paidOrders) {
      if (o.createdAt.toISOString().slice(0, 7) === currentMonth) {
        totalMonthlyRevenue += parseFloat(o.amount);
      }
    }

    // 6. Violations This Month
    const allViolations = await db.select({ createdAt: violations.createdAt }).from(violations);
    const totalViolationsThisMonth = allViolations.filter(
      (v) => v.createdAt.toISOString().slice(0, 7) === currentMonth
    ).length;

    // 7. Peak Hours Breakdown (Dynamic aggregate from access_sessions)
    const hourBuckets = [
      { hour: '06:00 - 07:00', startHour: 6, count: 0 },
      { hour: '07:00 - 08:00', startHour: 7, count: 0 },
      { hour: '08:00 - 09:00', startHour: 8, count: 0 },
      { hour: '09:00 - 10:00', startHour: 9, count: 0 },
      { hour: '16:00 - 17:00', startHour: 16, count: 0 },
      { hour: '17:00 - 18:00', startHour: 17, count: 0 },
      { hour: '18:00 - 19:00', startHour: 18, count: 0 },
      { hour: '19:00 - 20:00', startHour: 19, count: 0 },
    ];

    const recentSessions = await db
      .select({ entryTimestamp: accessSessions.entryTimestamp })
      .from(accessSessions)
      .limit(500);

    for (const s of recentSessions) {
      if (s.entryTimestamp) {
        const hour = new Date(s.entryTimestamp).getHours();
        const bucket = hourBuckets.find((b) => b.startHour === hour);
        if (bucket) {
          bucket.count += 1;
        }
      }
    }

    const peakHours = hourBuckets.map((b) => ({
      hour: b.hour,
      count: b.count,
    }));

    return {
      totalRegisteredStudents,
      totalHostellers,
      totalDayScholars,
      activeMembershipsCount,
      todayTotalCheckIns,
      currentLiveOccupants,
      totalMonthlyRevenue: Math.round(totalMonthlyRevenue * 100) / 100,
      totalViolationsThisMonth,
      peakHours,
    };
  }

  /**
   * Get all gym closure blackout dates
   */
  public async getCalendarClosures(): Promise<GymClosureDto[]> {
    const closures = await db.select().from(gymCalendar).orderBy(desc(gymCalendar.closureDate));

    return closures.map((c) => ({
      id: c.id,
      closureDate: c.closureDate,
      reason: c.reason,
      cancelledBookingsCount: parseInt(c.cancelledBookingsCount || '0', 10),
      createdAt: c.createdAt.toISOString(),
    }));
  }

  /**
   * Emergency Gym Closure Cascade (ADR-017, FR-ADM-002)
   */
  public async createCalendarClosure(closureDate: string, reason: string, adminEmail: string): Promise<GymClosureDto> {
    const [existing] = await db.select().from(gymCalendar).where(eq(gymCalendar.closureDate, closureDate)).limit(1);

    if (existing) {
      throw new ConflictError(`Closure already recorded for date '${closureDate}'`);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Close all slots on this date
      await client.query(
        `UPDATE booking.slots 
         SET status = 'closed' 
         WHERE slot_date = $1`,
        [closureDate]
      );

      // 2. Find and cancel all affected active bookings
      const cancelRes = await client.query(
        `UPDATE booking.bookings b
         SET booking_status = 'cancelled_by_gym',
             cancellation_reason = $1,
             cancelled_at = NOW(),
             updated_at = NOW()
         FROM booking.slots s
         WHERE b.slot_id = s.id 
           AND s.slot_date = $2 
           AND b.booking_status = 'booked'
         RETURNING b.id`,
        [`Gym Emergency Closure: ${reason}`, closureDate]
      );

      const affectedCount = cancelRes.rows.length;

      // 3. Record in gym_calendar
      const insertCal = await client.query(
        `INSERT INTO admin.gym_calendar (closure_date, reason, cancelled_bookings_count, created_at)
         VALUES ($1, $2, $3, NOW())
         RETURNING id, closure_date, reason, cancelled_bookings_count, created_at`,
        [closureDate, reason, String(affectedCount)]
      );

      const newClosure = insertCal.rows[0];

      // 4. Audit Log
      await client.query(
        `INSERT INTO audit.audit_logs (actor_email, action, entity, entity_id, reason, created_at)
         VALUES ($1, 'emergency_calendar_closure', 'calendar', $2, $3, NOW())`,
        [adminEmail, closureDate, `${reason} (${affectedCount} reservations auto-cancelled)`]
      );

      await client.query('COMMIT');

      logger.info(
        { closureDate, affectedCount, adminEmail },
        'Gym emergency blackout closure executed successfully'
      );

      return {
        id: newClosure.id,
        closureDate: newClosure.closure_date,
        reason: newClosure.reason,
        cancelledBookingsCount: affectedCount,
        createdAt: newClosure.created_at,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * System Audit Log Explorer (FR-ADM-004)
   */
  public async getAuditLogs(limit = 50): Promise<AuditLogEntryDto[]> {
    const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);

    return logs.map((l) => ({
      id: l.id,
      actorEmail: l.actorEmail || undefined,
      action: l.action,
      entity: l.entity,
      entityId: l.entityId,
      reason: l.reason,
      createdAt: l.createdAt.toISOString(),
    }));
  }
}

export const adminService = new AdminService();
