import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import { db, pool } from '../../shared/database/index.js';
import { logger } from '../../shared/logging/index.js';
import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors/index.js';
import { trainerProfiles, workShifts, people, auditLogs, accessSessions } from '../../db/schema/index.js';
import { TrainerProfileDto, WorkShiftDto, MonthlyPayrollItemDto } from './trainer.types.js';

export class TrainerService {
  /**
   * Get trainer profile with active shift and monthly totals derived from turnstile sessions
   */
  public async getTrainerProfile(personId: string): Promise<TrainerProfileDto> {
    const [profile] = await db
      .select({
        trainer: trainerProfiles,
        person: people,
      })
      .from(trainerProfiles)
      .innerJoin(people, eq(trainerProfiles.personId, people.id))
      .where(eq(trainerProfiles.personId, personId))
      .limit(1);

    if (!profile) {
      throw new NotFoundError(`Trainer profile for person '${personId}' not found`);
    }

    // Fetch turnstile sessions for this trainer
    const trainerSessions = await db
      .select()
      .from(accessSessions)
      .where(eq(accessSessions.personId, personId))
      .orderBy(desc(accessSessions.entryTimestamp));

    let activeShiftDto: WorkShiftDto | null = null;
    let totalMinutes = 0;

    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM

    const shiftDtos: WorkShiftDto[] = trainerSessions.map((s) => {
      const isOngoing = s.status === 'inside' || !s.exitTimestamp;
      const entryMs = new Date(s.entryTimestamp).getTime();
      const exitMs = s.exitTimestamp ? new Date(s.exitTimestamp).getTime() : now.getTime();
      const duration = Math.max(1, Math.round((exitMs - entryMs) / (1000 * 60)));

      const shiftMonth = s.entryTimestamp.toISOString().slice(0, 7);
      if (shiftMonth === currentMonth && !isOngoing) {
        totalMinutes += duration;
      }

      const dto: WorkShiftDto = {
        id: s.id,
        trainerId: profile.trainer.id,
        clockIn: s.entryTimestamp.toISOString(),
        clockOut: s.exitTimestamp?.toISOString(),
        durationMinutes: duration,
        calculatedStipend: 0, // Stipend details hidden from trainers
        hourlyRate: '0',
        isOngoing,
      };

      if (isOngoing && !activeShiftDto) {
        activeShiftDto = dto;
      }

      return dto;
    });

    return {
      id: profile.trainer.id,
      personId: profile.person.id,
      name: profile.person.name,
      email: profile.person.email,
      hourlyRate: '0', // Hidden
      activeShift: activeShiftDto,
      totalEarningsThisMonth: 0, // Hidden
      totalHoursThisMonth: Math.round((totalMinutes / 60) * 10) / 10,
      shifts: shiftDtos,
    };
  }

  /**
   * Compatibility methods for turnstile-based shift logging
   */
  public async clockIn(personId: string): Promise<WorkShiftDto> {
    const profile = await this.getTrainerProfile(personId);
    return profile.activeShift || {
      id: `shift_${Date.now()}`,
      trainerId: profile.id,
      clockIn: new Date().toISOString(),
      durationMinutes: 0,
      calculatedStipend: 0,
      hourlyRate: '0',
      isOngoing: true,
    };
  }

  public async clockOut(personId: string): Promise<WorkShiftDto> {
    const profile = await this.getTrainerProfile(personId);
    return {
      id: `shift_${Date.now()}`,
      trainerId: profile.id,
      clockIn: new Date(Date.now() - 3600000).toISOString(),
      clockOut: new Date().toISOString(),
      durationMinutes: 60,
      calculatedStipend: 0,
      hourlyRate: '0',
      isOngoing: false,
    };
  }

  /**
   * Admin: Get monthly trainer payroll ledger report (FR-TRN-004) calculated from turnstile floor hours
   */
  public async getMonthlyPayroll(monthStr?: string): Promise<MonthlyPayrollItemDto[]> {
    const targetMonth = monthStr || new Date().toISOString().slice(0, 7);

    const trainers = await db
      .select({
        trainer: trainerProfiles,
        person: people,
      })
      .from(trainerProfiles)
      .innerJoin(people, eq(trainerProfiles.personId, people.id));

    const payroll: MonthlyPayrollItemDto[] = [];

    for (const t of trainers) {
      const sessions = await db
        .select()
        .from(accessSessions)
        .where(eq(accessSessions.personId, t.person.id));

      let totalMinutes = 0;
      let shiftCount = 0;

      for (const s of sessions) {
        if (!s.exitTimestamp) continue;
        const sMonth = s.entryTimestamp.toISOString().slice(0, 7);
        if (sMonth === targetMonth) {
          shiftCount++;
          const duration = Math.max(1, Math.round((new Date(s.exitTimestamp).getTime() - new Date(s.entryTimestamp).getTime()) / 60000));
          totalMinutes += duration;
        }
      }

      const ratePerHour = parseFloat(t.trainer.hourlyRate) || 0;
      const totalStipend = Math.round(((totalMinutes / 60) * ratePerHour) * 100) / 100;

      payroll.push({
        trainerId: t.trainer.id,
        personId: t.person.id,
        name: t.person.name,
        email: t.person.email,
        hourlyRate: t.trainer.hourlyRate,
        totalShifts: shiftCount,
        totalMinutes,
        totalHours: Math.round((totalMinutes / 60) * 10) / 10,
        totalStipend,
      });
    }

    return payroll;
  }

  /**
   * Admin: Update trainer hourly stipend rate (ADR-016)
   */
  public async updateHourlyRate(trainerId: string, rate: number, reason: string, adminEmail: string) {
    const [existing] = await db.select().from(trainerProfiles).where(eq(trainerProfiles.id, trainerId)).limit(1);
    if (!existing) throw new NotFoundError('Trainer profile not found');

    const [updated] = await db
      .update(trainerProfiles)
      .set({
        hourlyRate: String(rate),
        updatedAt: new Date(),
      })
      .where(eq(trainerProfiles.id, trainerId))
      .returning();

    await db.insert(auditLogs).values({
      actorEmail: adminEmail,
      action: 'update_trainer_rate',
      entity: 'trainer',
      entityId: trainerId,
      previousValue: { hourlyRate: existing.hourlyRate },
      newValue: { hourlyRate: String(rate) },
      reason,
    });

    return updated;
  }
}

export const trainerService = new TrainerService();
