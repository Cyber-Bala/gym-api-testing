import { eq, and, desc, sql } from 'drizzle-orm';
import { db, pool } from '../../shared/database/index.js';
import { logger } from '../../shared/logging/index.js';
import { NotFoundError } from '../../shared/errors/index.js';
import {
  accessSessions,
  people,
  students,
  staff,
  bookings,
  slots,
  entryExitLogs,
  auditLogs,
} from '../../db/schema/index.js';
import { bookingService } from '../booking/booking.service.js';
import { FloorStatusDto, LiveFloorOccupantDto, StaffWellnessItemDto } from './floor.types.js';

export class FloorService {
  /**
   * Get live workout floor status with overstayer detection (SRS FR-ACC-005, FR-TRN-001)
   */
  public async getCurrentFloorStatus(): Promise<FloorStatusDto> {
    const activeSessions = await db
      .select({
        session: accessSessions,
        person: people,
      })
      .from(accessSessions)
      .innerJoin(people, eq(accessSessions.personId, people.id))
      .where(eq(accessSessions.status, 'inside'))
      .orderBy(desc(accessSessions.entryTimestamp));

    const now = new Date();
    const occupants: LiveFloorOccupantDto[] = [];
    const overstayers: LiveFloorOccupantDto[] = [];

    for (const item of activeSessions) {
      const entryTime = new Date(item.session.entryTimestamp);
      const minutesElapsed = Math.max(0, Math.round((now.getTime() - entryTime.getTime()) / (1000 * 60)));

      // Check student details
      const [stu] = await db.select().from(students).where(eq(students.personId, item.person.id)).limit(1);

      // Overstay criteria: workout > 75 minutes (60 min slot + 15 min buffer elapsed)
      const isOverstayer = minutesElapsed > 75;
      const overdueMinutes = isOverstayer ? minutesElapsed - 75 : 0;

      const occupantDto: LiveFloorOccupantDto = {
        sessionId: item.session.id,
        personId: item.person.id,
        name: item.person.name,
        rollNumber: stu?.rollNumber || undefined,
        department: stu?.department || undefined,
        residency: stu?.residency || undefined,
        role: item.person.personType,
        entryTimestamp: item.session.entryTimestamp.toISOString(),
        minutesElapsed,
        isOverstayer,
        overdueMinutes,
      };

      occupants.push(occupantDto);
      if (isOverstayer) {
        overstayers.push(occupantDto);
      }
    }

    return {
      currentSlotName: 'Current Active Slot Batch',
      totalInsideCount: occupants.length,
      overstayerCount: overstayers.length,
      occupants,
      overstayers,
    };
  }

  /**
   * Trainer manual checkout for overstaying student (FR-TRN-003)
   */
  public async manualFloorCheckout(sessionId: string, reason: string, trainerEmail: string) {
    const [session] = await db
      .select()
      .from(accessSessions)
      .where(and(eq(accessSessions.id, sessionId), eq(accessSessions.status, 'inside')))
      .limit(1);

    if (!session) {
      throw new NotFoundError(`Active floor session '${sessionId}' not found`);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const entryTime = new Date(session.entryTimestamp).getTime();
      const exitTime = Date.now();
      const durationMinutes = Math.max(1, Math.round((exitTime - entryTime) / (1000 * 60)));

      // 1. Close session
      await client.query(
        `UPDATE access.access_sessions
         SET exit_timestamp = NOW(),
             status = 'completed'
         WHERE id = $1`,
        [sessionId]
      );

      // 2. Log manual exit event
      await client.query(
        `INSERT INTO access.entry_exit_logs (person_id, event_type, result, denial_reason, created_at)
         VALUES ($1, 'manual_floor_checkout', 'success', $2, NOW())`,
        [session.personId, `Trainer manual checkout: ${reason}`]
      );

      // 3. Audit log
      await client.query(
        `INSERT INTO audit.audit_logs (actor_email, action, entity, entity_id, reason, created_at)
         VALUES ($1, 'trainer_manual_checkout', 'session', $2, $3, NOW())`,
        [trainerEmail, sessionId, reason]
      );

      await client.query('COMMIT');

      logger.info({ sessionId, personId: session.personId, trainerEmail }, 'Trainer manual floor checkout completed');

      return {
        success: true,
        sessionId,
        durationMinutes,
        message: `Student checked out. Workout duration: ${durationMinutes} minutes.`,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Faculty / Staff Monthly Wellness & Workout Hours Tracker (FR-STAFF-003)
   */
  public async getStaffWellnessStats(monthStr?: string): Promise<StaffWellnessItemDto[]> {
    const targetMonth = monthStr || new Date().toISOString().slice(0, 7);

    const staffMembers = await db
      .select({
        staff: staff,
        person: people,
      })
      .from(staff)
      .innerJoin(people, eq(staff.personId, people.id));

    const wellnessStats: StaffWellnessItemDto[] = [];

    for (const st of staffMembers) {
      const sessions = await db
        .select()
        .from(accessSessions)
        .where(eq(accessSessions.personId, st.person.id));

      let totalMinutes = 0;
      let totalWorkouts = 0;

      for (const s of sessions) {
        if (!s.exitTimestamp) continue;
        const sMonth = s.entryTimestamp.toISOString().slice(0, 7);
        if (sMonth === targetMonth) {
          totalWorkouts++;
          const duration = Math.max(1, Math.round((new Date(s.exitTimestamp).getTime() - new Date(s.entryTimestamp).getTime()) / 60000));
          totalMinutes += duration;
        }
      }

      wellnessStats.push({
        staffId: st.staff.id,
        personId: st.person.id,
        staffEmpId: st.staff.staffId,
        name: st.person.name,
        email: st.person.email,
        department: st.staff.department,
        designation: st.staff.designation || 'Staff Member',
        totalWorkoutsThisMonth: totalWorkouts,
        totalMinutesThisMonth: totalMinutes,
        totalHoursThisMonth: Math.round((totalMinutes / 60) * 10) / 10,
      });
    }

    return wellnessStats;
  }
}

export const floorService = new FloorService();
