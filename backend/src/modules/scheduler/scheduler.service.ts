import { logger } from '../../shared/logging/index.js';
import { noShowService } from '../access/no-show.service.js';
import { violationsService } from '../violations/violations.service.js';

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
    autoUnbanProcessor: {
      name: 'Auto-Unban Expired Suspension Restorer',
      intervalMinutes: 10,
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

      // 2. Auto-Unban Sweeper
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
