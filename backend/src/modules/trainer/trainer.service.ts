import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import { db, pool } from '../../shared/database/index.js';
import { logger } from '../../shared/logging/index.js';
import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors/index.js';
import { trainerProfiles, workShifts, people, auditLogs } from '../../db/schema/index.js';
import { TrainerProfileDto, WorkShiftDto, MonthlyPayrollItemDto } from './trainer.types.js';

export class TrainerService {
  /**
   * Get trainer profile with active shift and monthly totals
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

    const trainerId = profile.trainer.id;

    // Fetch shifts
    const allShifts = await db
      .select()
      .from(workShifts)
      .where(eq(workShifts.trainerId, trainerId))
      .orderBy(desc(workShifts.clockIn));

    let activeShiftDto: WorkShiftDto | null = null;
    let totalMinutes = 0;
    let totalEarnings = 0;

    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM

    const shiftDtos: WorkShiftDto[] = allShifts.map((s) => {
      const isOngoing = !s.clockOut;
      const duration = s.durationMinutes ? parseFloat(s.durationMinutes) : 0;
      const stipend = s.calculatedStipend ? parseFloat(s.calculatedStipend) : 0;

      const shiftMonth = s.clockIn.toISOString().slice(0, 7);
      if (shiftMonth === currentMonth && !isOngoing) {
        totalMinutes += duration;
        totalEarnings += stipend;
      }

      const dto: WorkShiftDto = {
        id: s.id,
        trainerId: s.trainerId,
        clockIn: s.clockIn.toISOString(),
        clockOut: s.clockOut?.toISOString(),
        durationMinutes: duration,
        calculatedStipend: stipend,
        hourlyRate: profile.trainer.hourlyRate,
        isOngoing,
      };

      if (isOngoing) {
        activeShiftDto = dto;
      }

      return dto;
    });

    return {
      id: profile.trainer.id,
      personId: profile.person.id,
      name: profile.person.name,
      email: profile.person.email,
      hourlyRate: profile.trainer.hourlyRate,
      activeShift: activeShiftDto,
      totalEarningsThisMonth: Math.round(totalEarnings * 100) / 100,
      totalHoursThisMonth: Math.round((totalMinutes / 60) * 10) / 10,
      shifts: shiftDtos,
    };
  }

  /**
   * Trainer Clock-In (FR-TRN-002)
   */
  public async clockIn(personId: string): Promise<WorkShiftDto> {
    const [profile] = await db
      .select()
      .from(trainerProfiles)
      .where(eq(trainerProfiles.personId, personId))
      .limit(1);

    if (!profile) {
      throw new NotFoundError('Trainer profile not found');
    }

    // Check if already clocked in
    const [ongoing] = await db
      .select()
      .from(workShifts)
      .where(and(eq(workShifts.trainerId, profile.id), isNull(workShifts.clockOut)))
      .limit(1);

    if (ongoing) {
      throw new ConflictError('You are already clocked in to an ongoing gym shift');
    }

    const [newShift] = await db
      .insert(workShifts)
      .values({
        trainerId: profile.id,
        clockIn: new Date(),
      })
      .returning();

    logger.info({ trainerId: profile.id, shiftId: newShift.id }, 'Trainer clocked in');

    return {
      id: newShift.id,
      trainerId: newShift.trainerId,
      clockIn: newShift.clockIn.toISOString(),
      durationMinutes: 0,
      calculatedStipend: 0,
      hourlyRate: profile.hourlyRate,
      isOngoing: true,
    };
  }

  /**
   * Trainer Clock-Out & Stipend Calculation (FR-TRN-003)
   */
  public async clockOut(personId: string): Promise<WorkShiftDto> {
    const [profile] = await db
      .select()
      .from(trainerProfiles)
      .where(eq(trainerProfiles.personId, personId))
      .limit(1);

    if (!profile) {
      throw new NotFoundError('Trainer profile not found');
    }

    const [ongoing] = await db
      .select()
      .from(workShifts)
      .where(and(eq(workShifts.trainerId, profile.id), isNull(workShifts.clockOut)))
      .limit(1);

    if (!ongoing) {
      throw new ValidationError('No active ongoing shift found to clock out from');
    }

    const clockInTime = new Date(ongoing.clockIn).getTime();
    const clockOutTime = new Date().getTime();

    const durationMinutes = Math.max(1, Math.round((clockOutTime - clockInTime) / (1000 * 60)));
    const ratePerHour = parseFloat(profile.hourlyRate);
    const calculatedStipend = Math.round(((durationMinutes / 60) * ratePerHour) * 100) / 100;

    const [closedShift] = await db
      .update(workShifts)
      .set({
        clockOut: new Date(),
        durationMinutes: String(durationMinutes),
        calculatedStipend: String(calculatedStipend),
      })
      .where(eq(workShifts.id, ongoing.id))
      .returning();

    logger.info(
      { trainerId: profile.id, durationMinutes, calculatedStipend },
      'Trainer clocked out and stipend computed'
    );

    return {
      id: closedShift.id,
      trainerId: closedShift.trainerId,
      clockIn: closedShift.clockIn.toISOString(),
      clockOut: closedShift.clockOut!.toISOString(),
      durationMinutes,
      calculatedStipend,
      hourlyRate: profile.hourlyRate,
      isOngoing: false,
    };
  }

  /**
   * Admin: Get monthly trainer payroll ledger report (FR-TRN-004)
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
      const shifts = await db
        .select()
        .from(workShifts)
        .where(eq(workShifts.trainerId, t.trainer.id));

      let totalMinutes = 0;
      let totalStipend = 0;
      let shiftCount = 0;

      for (const s of shifts) {
        if (!s.clockOut) continue;
        const shiftMonth = s.clockIn.toISOString().slice(0, 7);
        if (shiftMonth === targetMonth) {
          shiftCount++;
          totalMinutes += s.durationMinutes ? parseFloat(s.durationMinutes) : 0;
          totalStipend += s.calculatedStipend ? parseFloat(s.calculatedStipend) : 0;
        }
      }

      payroll.push({
        trainerId: t.trainer.id,
        personId: t.person.id,
        name: t.person.name,
        email: t.person.email,
        hourlyRate: t.trainer.hourlyRate,
        totalShifts: shiftCount,
        totalMinutes,
        totalHours: Math.round((totalMinutes / 60) * 10) / 10,
        totalStipend: Math.round(totalStipend * 100) / 100,
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
