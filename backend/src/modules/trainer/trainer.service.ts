import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import { db, pool } from '../../shared/database/index.js';
import { logger } from '../../shared/logging/index.js';
import { NotFoundError, ValidationError, ConflictError } from '../../shared/errors/index.js';
import {
  trainerProfiles,
  workShifts,
  people,
  auditLogs,
  accessSessions,
  stipendConfigs,
} from '../../db/schema/index.js';
import {
  TrainerProfileDto,
  WorkShiftDto,
  MonthlyPayrollItemDto,
  StipendConfigDto,
  StipendTimeWindow,
} from './trainer.types.js';

export class TrainerService {
  /**
   * Helper: Get IST minutes of the day (0..1439) for time-of-day matching
   */
  private getISTMinutesOfDay(date: Date): number {
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(date.getTime() + istOffsetMs);
    return istDate.getUTCHours() * 60 + istDate.getUTCMinutes();
  }

  private timeStringToMinutes(timeStr: string): number {
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }

  /**
   * Calculate precise stipend with time-window tiering
   */
  public calculateSessionStipend(
    entryTime: Date,
    exitTime: Date,
    config: StipendConfigDto,
    trainerBaseRate?: number
  ): {
    durationMinutes: number;
    totalStipend: number;
    breakdown: Array<{ windowLabel: string; minutes: number; ratePerHour: number; stipend: number }>;
  } {
    const durationMinutes = Math.max(1, Math.round((exitTime.getTime() - entryTime.getTime()) / 60000));

    if (durationMinutes < config.minShiftMinutes) {
      return {
        durationMinutes,
        totalStipend: 0,
        breakdown: [
          {
            windowLabel: `Under min shift duration (< ${config.minShiftMinutes} min)`,
            minutes: durationMinutes,
            ratePerHour: 0,
            stipend: 0,
          },
        ],
      };
    }

    const baseRate = trainerBaseRate !== undefined && trainerBaseRate > 0 ? trainerBaseRate : config.defaultHourlyRate;
    const windowMinutesMap: Record<string, { label: string; rate: number; count: number }> = {};
    let defaultMinutes = 0;

    for (let i = 0; i < durationMinutes; i++) {
      const currentMinuteDate = new Date(entryTime.getTime() + i * 60000);
      const currentISTMinute = this.getISTMinutesOfDay(currentMinuteDate);

      let matched = false;
      for (const tw of config.timeWindows) {
        const startM = this.timeStringToMinutes(tw.startTime);
        const endM = this.timeStringToMinutes(tw.endTime);

        if (startM < endM) {
          if (currentISTMinute >= startM && currentISTMinute < endM) {
            if (!windowMinutesMap[tw.id]) {
              windowMinutesMap[tw.id] = { label: tw.label, rate: tw.ratePerHour, count: 0 };
            }
            windowMinutesMap[tw.id].count++;
            matched = true;
            break;
          }
        } else {
          // Overnight window (e.g. 22:00 to 06:00)
          if (currentISTMinute >= startM || currentISTMinute < endM) {
            if (!windowMinutesMap[tw.id]) {
              windowMinutesMap[tw.id] = { label: tw.label, rate: tw.ratePerHour, count: 0 };
            }
            windowMinutesMap[tw.id].count++;
            matched = true;
            break;
          }
        }
      }

      if (!matched) {
        defaultMinutes++;
      }
    }

    let totalStipend = 0;
    const breakdown: Array<{ windowLabel: string; minutes: number; ratePerHour: number; stipend: number }> = [];

    for (const twId in windowMinutesMap) {
      const w = windowMinutesMap[twId];
      const wStipend = Math.round(((w.count / 60) * w.rate) * 100) / 100;
      totalStipend += wStipend;
      breakdown.push({
        windowLabel: w.label,
        minutes: w.count,
        ratePerHour: w.rate,
        stipend: wStipend,
      });
    }

    if (defaultMinutes > 0) {
      const defStipend = Math.round(((defaultMinutes / 60) * baseRate) * 100) / 100;
      totalStipend += defStipend;
      breakdown.push({
        windowLabel: 'Standard Working Hours',
        minutes: defaultMinutes,
        ratePerHour: baseRate,
        stipend: defStipend,
      });
    }

    return {
      durationMinutes,
      totalStipend: Math.round(totalStipend * 100) / 100,
      breakdown,
    };
  }

  /**
   * Get current global stipend & shift configuration
   */
  public async getStipendConfig(): Promise<StipendConfigDto> {
    const [config] = await db.select().from(stipendConfigs).limit(1);

    if (!config) {
      const defaultConfig: StipendConfigDto = {
        defaultHourlyRate: 200,
        minShiftMinutes: 30,
        timeWindows: [
          { id: 'morning', label: 'Morning Floor Shift', startTime: '06:00', endTime: '10:00', ratePerHour: 250 },
          { id: 'evening', label: 'Evening Peak Shift', startTime: '15:00', endTime: '21:00', ratePerHour: 250 },
        ],
      };

      const [inserted] = await db
        .insert(stipendConfigs)
        .values({
          defaultHourlyRate: String(defaultConfig.defaultHourlyRate),
          minShiftMinutes: String(defaultConfig.minShiftMinutes),
          timeWindows: defaultConfig.timeWindows,
        })
        .returning();

      return {
        defaultHourlyRate: parseFloat(inserted.defaultHourlyRate) || 200,
        minShiftMinutes: parseFloat(inserted.minShiftMinutes) || 30,
        timeWindows: (inserted.timeWindows as StipendTimeWindow[]) || defaultConfig.timeWindows,
      };
    }

    return {
      defaultHourlyRate: parseFloat(config.defaultHourlyRate) || 200,
      minShiftMinutes: parseFloat(config.minShiftMinutes) || 30,
      timeWindows: (config.timeWindows as StipendTimeWindow[]) || [],
    };
  }

  /**
   * Update global stipend & shift configuration
   */
  public async updateStipendConfig(input: StipendConfigDto, adminEmail: string): Promise<StipendConfigDto> {
    const [existing] = await db.select().from(stipendConfigs).limit(1);

    let updatedRecord;
    if (existing) {
      const [updated] = await db
        .update(stipendConfigs)
        .set({
          defaultHourlyRate: String(input.defaultHourlyRate),
          minShiftMinutes: String(input.minShiftMinutes),
          timeWindows: input.timeWindows,
          updatedAt: new Date(),
        })
        .where(eq(stipendConfigs.id, existing.id))
        .returning();
      updatedRecord = updated;
    } else {
      const [inserted] = await db
        .insert(stipendConfigs)
        .values({
          defaultHourlyRate: String(input.defaultHourlyRate),
          minShiftMinutes: String(input.minShiftMinutes),
          timeWindows: input.timeWindows,
        })
        .returning();
      updatedRecord = inserted;
    }

    await db.insert(auditLogs).values({
      actorEmail: adminEmail,
      action: 'update_stipend_config',
      entity: 'stipend_config',
      entityId: updatedRecord.id,
      previousValue: existing
        ? {
            defaultHourlyRate: existing.defaultHourlyRate,
            minShiftMinutes: existing.minShiftMinutes,
            timeWindows: existing.timeWindows,
          }
        : null,
      newValue: {
        defaultHourlyRate: input.defaultHourlyRate,
        minShiftMinutes: input.minShiftMinutes,
        timeWindows: input.timeWindows,
      },
      reason: `Admin updated gym trainer stipend rates & working time windows`,
    });

    return {
      defaultHourlyRate: parseFloat(updatedRecord.defaultHourlyRate) || input.defaultHourlyRate,
      minShiftMinutes: parseFloat(updatedRecord.minShiftMinutes) || input.minShiftMinutes,
      timeWindows: (updatedRecord.timeWindows as StipendTimeWindow[]) || input.timeWindows,
    };
  }

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

    const stipendConfig = await this.getStipendConfig();
    const trainerRate = parseFloat(profile.trainer.hourlyRate) || stipendConfig.defaultHourlyRate;

    // Fetch turnstile sessions for this trainer
    const trainerSessions = await db
      .select()
      .from(accessSessions)
      .where(eq(accessSessions.personId, personId))
      .orderBy(desc(accessSessions.entryTimestamp));

    let activeShiftDto: WorkShiftDto | null = null;
    let totalMinutes = 0;
    let totalEarnings = 0;

    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM

    const shiftDtos: WorkShiftDto[] = trainerSessions.map((s) => {
      const isOngoing = s.status === 'inside' || !s.exitTimestamp;
      const entryDate = new Date(s.entryTimestamp);
      const exitDate = s.exitTimestamp ? new Date(s.exitTimestamp) : now;

      const calc = this.calculateSessionStipend(entryDate, exitDate, stipendConfig, trainerRate);
      const shiftMonth = s.entryTimestamp.toISOString().slice(0, 7);

      if (shiftMonth === currentMonth && !isOngoing) {
        totalMinutes += calc.durationMinutes;
        totalEarnings += calc.totalStipend;
      }

      const dto: WorkShiftDto = {
        id: s.id,
        trainerId: profile.trainer.id,
        clockIn: s.entryTimestamp.toISOString(),
        clockOut: s.exitTimestamp?.toISOString(),
        durationMinutes: calc.durationMinutes,
        calculatedStipend: calc.totalStipend,
        hourlyRate: String(trainerRate),
        isOngoing,
        timeWindowBreakdown: calc.breakdown,
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
      hourlyRate: String(trainerRate),
      activeShift: activeShiftDto,
      totalEarningsThisMonth: Math.round(totalEarnings * 100) / 100,
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
      hourlyRate: profile.hourlyRate,
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
      hourlyRate: profile.hourlyRate,
      isOngoing: false,
    };
  }

  /**
   * Admin: Get monthly trainer payroll ledger report (FR-TRN-004) calculated from turnstile floor hours
   */
  public async getMonthlyPayroll(monthStr?: string): Promise<MonthlyPayrollItemDto[]> {
    const targetMonth = monthStr || new Date().toISOString().slice(0, 7);
    const stipendConfig = await this.getStipendConfig();

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
      let totalStipend = 0;
      const breakdownMap: Record<string, { label: string; minutes: number; rate: number; stipend: number }> = {};

      const trainerRate = parseFloat(t.trainer.hourlyRate) || stipendConfig.defaultHourlyRate;

      for (const s of sessions) {
        if (!s.exitTimestamp) continue;
        const sMonth = s.entryTimestamp.toISOString().slice(0, 7);
        if (sMonth === targetMonth) {
          shiftCount++;
          const entryDate = new Date(s.entryTimestamp);
          const exitDate = new Date(s.exitTimestamp);

          const calc = this.calculateSessionStipend(entryDate, exitDate, stipendConfig, trainerRate);
          totalMinutes += calc.durationMinutes;
          totalStipend += calc.totalStipend;

          for (const b of calc.breakdown) {
            if (!breakdownMap[b.windowLabel]) {
              breakdownMap[b.windowLabel] = { label: b.windowLabel, minutes: 0, rate: b.ratePerHour, stipend: 0 };
            }
            breakdownMap[b.windowLabel].minutes += b.minutes;
            breakdownMap[b.windowLabel].stipend += b.stipend;
          }
        }
      }

      const breakdownList = Object.values(breakdownMap).map((b) => ({
        windowLabel: b.label,
        minutes: b.minutes,
        ratePerHour: b.rate,
        stipend: Math.round(b.stipend * 100) / 100,
      }));

      payroll.push({
        trainerId: t.trainer.id,
        personId: t.person.id,
        name: t.person.name,
        email: t.person.email,
        hourlyRate: String(trainerRate),
        totalShifts: shiftCount,
        totalMinutes,
        totalHours: Math.round((totalMinutes / 60) * 10) / 10,
        totalStipend: Math.round(totalStipend * 100) / 100,
        breakdown: breakdownList,
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
