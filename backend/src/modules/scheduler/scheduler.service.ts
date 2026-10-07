import { eq, and, sql } from 'drizzle-orm';
import { db, pool } from '../../shared/database/index.js';
import { logger } from '../../shared/logging/index.js';
import { noShowService } from '../access/no-show.service.js';
import { violationsService } from '../violations/violations.service.js';
import { floorService } from '../floor/floor.service.js';
import { violations, students, auditLogs } from '../../db/schema/index.js';

export interface ScheduledTaskStatus {
  name: string;
  intervalMinutes: number;
  lastRunAt: string | null;
  lastResult: unknown;
  status: 'active' | 'idle' | 'running' | 'error';
  totalRuns: number;
}

export class SchedulerService {
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private tasks: Record<string, ScheduledTaskStatus> = {
    noShowProcessor: {
      name: 'No-Show Slot Penalty Sweeper',
      intervalMinutes: 5,
      lastRunAt: null,
      lastResult: null,
      status: 'active',
      totalRuns: 0,
    },
    overstayerPenaltyProcessor: {
      name: 'Overstaying Violation Penalty Sweeper',
      intervalMinutes: 5,
      lastRunAt: null,
      lastResult: null,
      status: 'active',
      totalRuns: 0,
    },
    autoUnbanProcessor: {
      name: 'Auto-Unban Expired Suspension Restorer',
      intervalMinutes: 10,
      lastRunAt: null,
      lastResult: null,
      status: 'active',
      totalRuns: 0,
    },
    membershipExpiryProcessor: {
      name: 'Membership Expiry + Gate Revoke',
      intervalMinutes: 5,
      lastRunAt: null,
      lastResult: null,
      status: 'active',
      totalRuns: 0,
    },
  };

  /**
   * Start background scheduler loop
   */
  public start(): void {
    if (this.timer) return;

    logger.info('Starting College Gym automated background schedulers (5m tick)...');

    // Run initial sweep after 10 seconds of startup
    setTimeout(() => {
      this.runSweeps().catch((err) => {
        logger.warn({ err }, 'Initial scheduler sweep caught notice');
      });
    }, 10000);

    // Set recurring 5-minute interval
    this.timer = setInterval(() => {
      this.runSweeps().catch((err) => {
        logger.warn({ err }, 'Recurring scheduler sweep caught notice');
      });
    }, 5 * 60 * 1000);
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Process overstaying penalties for occupants exceeding allowed continuous slot windows
   */
  public async processOverstayers(): Promise<{
    overstayersFound: number;
    violationsIssued: number;
    studentsSuspended: number;
  }> {
    const floor = await floorService.getCurrentFloorStatus();
    let violationsIssued = 0;
    let studentsSuspended = 0;

    for (const o of floor.overstayers) {
      if (!o.rollNumber) continue; // Only apply student strike policies

      // Check if student record exists
      const [stu] = await db
        .select()
        .from(students)
        .where(eq(students.personId, o.personId))
        .limit(1);

      if (!stu) continue;

      // Check if overstay violation already issued for this session today
      const existingViolations = await db
        .select()
        .from(violations)
        .where(
          and(
            eq(violations.studentId, stu.id),
            eq(violations.violationType, 'overstay')
          )
        );

      const isRecent = existingViolations.some(
        (v) => Math.abs(Date.now() - new Date(v.createdAt).getTime()) < 4 * 60 * 60 * 1000
      );

      if (isRecent) continue;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Record overstay violation
        await client.query(
          `INSERT INTO booking.violations (student_id, violation_type, description, created_at)
           VALUES ($1, 'overstay', $2, NOW())`,
          [stu.id, `Overstayed continuous workout slot window by ${o.overdueMinutes} minutes`]
        );
        violationsIssued++;

        // Increment student strikes
        const stuRes = await client.query(
          `UPDATE people.students
           SET violation_count = violation_count + 1, updated_at = NOW()
           WHERE id = $1
           RETURNING id, is_banned, violation_count`,
          [stu.id]
        );

        const updatedStudent = stuRes.rows[0];

        // 3-Strike Rule: Auto suspend for 3 days
        if (updatedStudent.violation_count >= 3 && !updatedStudent.is_banned) {
          const banExpires = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

          await client.query(
            `UPDATE people.students
             SET is_banned = true, ban_expires_at = $1, updated_at = NOW()
             WHERE id = $2`,
            [banExpires, stu.id]
          );

          await client.query(
            `INSERT INTO audit.audit_logs (action, entity, entity_id, reason, created_at)
             VALUES ('auto_ban_overstay_3_strikes', 'student', $1, 'Automated 3-day suspension applied after 3rd violation (overstaying)', NOW())`,
            [stu.id]
          );

          studentsSuspended++;
        }

        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        logger.error({ txErr, studentId: stu.id }, 'Failed to record overstay penalty');
      } finally {
        client.release();
      }
    }

    return {
      overstayersFound: floor.overstayers.length,
      violationsIssued,
      studentsSuspended,
    };
  }

  /**
   * Run automated background jobs
   */
  public async runSweeps(): Promise<Record<string, unknown>> {
    if (this.isRunning) return { status: 'already_running' };
    this.isRunning = true;
    const results: Record<string, unknown> = {};

    try {
      // 1. No-Show Sweeper
      try {
        const noShowRes = await noShowService.processSlotNoShows();
        this.tasks.noShowProcessor.lastRunAt = new Date().toISOString();
        this.tasks.noShowProcessor.lastResult = noShowRes;
        this.tasks.noShowProcessor.totalRuns += 1;
        this.tasks.noShowProcessor.status = 'active';
        results.noShows = noShowRes;
      } catch (err) {
        this.tasks.noShowProcessor.status = 'error';
        this.tasks.noShowProcessor.lastResult = { error: String(err) };
      }

      // 2. Overstay Penalty Sweeper
      try {
        const overstayRes = await this.processOverstayers();
        this.tasks.overstayerPenaltyProcessor.lastRunAt = new Date().toISOString();
        this.tasks.overstayerPenaltyProcessor.lastResult = overstayRes;
        this.tasks.overstayerPenaltyProcessor.totalRuns += 1;
        this.tasks.overstayerPenaltyProcessor.status = 'active';
        results.overstayers = overstayRes;
      } catch (err) {
        this.tasks.overstayerPenaltyProcessor.status = 'error';
        this.tasks.overstayerPenaltyProcessor.lastResult = { error: String(err) };
      }

      // 3. Auto-Unban Sweeper
      try {
        const unbanRes = await violationsService.runAutoUnbanCheck();
        this.tasks.autoUnbanProcessor.lastRunAt = new Date().toISOString();
        this.tasks.autoUnbanProcessor.lastResult = unbanRes;
        this.tasks.autoUnbanProcessor.totalRuns += 1;
        this.tasks.autoUnbanProcessor.status = 'active';
        results.autoUnban = unbanRes;
      } catch (err) {
        this.tasks.autoUnbanProcessor.status = 'error';
        this.tasks.autoUnbanProcessor.lastResult = { error: String(err) };
      }

      // 4. Membership expiry sweeper (also revokes api_app/ZKBio gate access
      // so expired day-scholar passes show "please pay" instead of opening).
      try {
        const { membershipService } = await import('../membership/membership.service.js');
        const expiryRes = await membershipService.runDailyMembershipExpiryCheck();
        this.tasks.membershipExpiryProcessor.lastRunAt = new Date().toISOString();
        this.tasks.membershipExpiryProcessor.lastResult = expiryRes;
        this.tasks.membershipExpiryProcessor.totalRuns += 1;
        this.tasks.membershipExpiryProcessor.status = 'active';
        results.membershipExpiry = expiryRes;
      } catch (err) {
        this.tasks.membershipExpiryProcessor.status = 'error';
        this.tasks.membershipExpiryProcessor.lastResult = { error: String(err) };
      }

      return results;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get scheduler health & status for admin dashboard
   */
  public getStatus(): {
    active: boolean;
    uptimeSeconds: number;
    tasks: ScheduledTaskStatus[];
  } {
    return {
      active: Boolean(this.timer),
      uptimeSeconds: Math.round(process.uptime()),
      tasks: Object.values(this.tasks),
    };
  }
}

export const schedulerService = new SchedulerService();
