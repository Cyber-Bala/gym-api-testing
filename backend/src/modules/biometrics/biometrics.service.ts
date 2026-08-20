import { v4 as uuidv4 } from 'uuid';
import { eq, desc, or } from 'drizzle-orm';
import { db, pool } from '../../shared/database/index.js';
import { logger } from '../../shared/logging/index.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { students, people, auditLogs } from '../../db/schema/index.js';
import {
  AccessDeviceDto,
  FaceSyncTaskDto,
} from './biometrics.types.js';

interface InMemSyncRecord {
  id: string;
  studentId: string;
  personId: string;
  rollNumber: string;
  name: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed' | 'admin_action_required';
  retryCount: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class BiometricsService {
  private devices: Map<string, AccessDeviceDto> = new Map([
    [
      'turnstile-entry-01',
      {
        deviceId: 'turnstile-entry-01',
        deviceName: 'Main Entrance Turnstile (Lane A)',
        ipAddress: '192.168.1.120',
        firmwareVersion: 'v2.4.1-zkbio',
        status: 'online',
        lastHeartbeatAt: new Date().toISOString(),
      },
    ],
    [
      'turnstile-exit-01',
      {
        deviceId: 'turnstile-exit-01',
        deviceName: 'Main Exit Turnstile (Lane B)',
        ipAddress: '192.168.1.121',
        firmwareVersion: 'v2.4.1-zkbio',
        status: 'online',
        lastHeartbeatAt: new Date().toISOString(),
      },
    ],
  ]);

  private syncQueue: InMemSyncRecord[] = [];

  /**
   * Register or update a turnstile device heartbeat (FR-ACC-006)
   */
  public registerHeartbeat(
    deviceId: string,
    deviceName: string,
    ipAddress: string,
    firmwareVersion: string,
    status: 'online' | 'offline' | 'degraded'
  ): AccessDeviceDto {
    const updated: AccessDeviceDto = {
      deviceId,
      deviceName,
      ipAddress,
      firmwareVersion,
      status,
      lastHeartbeatAt: new Date().toISOString(),
    };

    this.devices.set(deviceId, updated);
    logger.debug({ deviceId, status }, 'Turnstile device heartbeat registered');

    return updated;
  }

  /**
   * List all registered turnstile hardware devices
   */
  public listDevices(): AccessDeviceDto[] {
    return Array.from(this.devices.values());
  }

  /**
   * Enroll a student's face biometric and queue for hardware sync (ADR-011, ACINT-011)
   */
  public async enrollStudentFace(studentIdentifier: string, faceImageBase64: string): Promise<FaceSyncTaskDto> {
    const [studentData] = await db
      .select({
        student: students,
        person: people,
      })
      .from(students)
      .innerJoin(people, eq(students.personId, people.id))
      .where(
        or(
          eq(students.id, studentIdentifier),
          eq(students.rollNumber, studentIdentifier),
          eq(people.email, studentIdentifier)
        )
      )
      .limit(1);

    if (!studentData) {
      throw new NotFoundError(`Student '${studentIdentifier}' not found`);
    }

    // Update face enrollment status
    await db
      .update(students)
      .set({
        faceEnrollmentStatus: 'enrolled',
        updatedAt: new Date(),
      })
      .where(eq(students.id, studentData.student.id));

    const syncId = uuidv4();
    const syncRecord: InMemSyncRecord = {
      id: syncId,
      studentId: studentData.student.id,
      personId: studentData.person.id,
      rollNumber: studentData.student.rollNumber,
      name: studentData.person.name,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.syncQueue.unshift(syncRecord);

    logger.info(
      { studentId: studentData.student.id, rollNumber: studentData.student.rollNumber, syncId },
      'Face biometric enrolled and queued for asynchronous ZKBio sync'
    );

    return {
      id: syncRecord.id,
      studentId: syncRecord.studentId,
      personId: syncRecord.personId,
      rollNumber: syncRecord.rollNumber,
      name: syncRecord.name,
      status: syncRecord.status,
      retryCount: syncRecord.retryCount,
      createdAt: syncRecord.createdAt.toISOString(),
      updatedAt: syncRecord.updatedAt.toISOString(),
    };
  }

  /**
   * List all biometric synchronization tasks
   */
  public listSyncQueue(): FaceSyncTaskDto[] {
    return this.syncQueue.map((s) => ({
      id: s.id,
      studentId: s.studentId,
      personId: s.personId,
      rollNumber: s.rollNumber,
      name: s.name,
      status: s.status,
      retryCount: s.retryCount,
      errorMessage: s.errorMessage,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));
  }

  /**
   * Process asynchronous face sync queue (State machine: Pending -> Syncing -> Synced)
   */
  public processSyncQueue(): { syncedCount: number; failedCount: number } {
    let syncedCount = 0;
    let failedCount = 0;

    for (const task of this.syncQueue) {
      if (task.status === 'pending' || task.status === 'syncing') {
        task.status = 'synced';
        task.updatedAt = new Date();
        syncedCount++;
      }
    }

    logger.info({ syncedCount }, 'Processed biometric face synchronization queue');

    return { syncedCount, failedCount };
  }

  /**
   * Admin: Retry a failed synchronization task
   */
  public retrySync(syncId: string): FaceSyncTaskDto {
    const task = this.syncQueue.find((s) => s.id === syncId);
    if (!task) {
      throw new NotFoundError(`Sync task '${syncId}' not found`);
    }

    task.status = 'pending';
    task.retryCount += 1;
    task.errorMessage = undefined;
    task.updatedAt = new Date();

    return {
      id: task.id,
      studentId: task.studentId,
      personId: task.personId,
      rollNumber: task.rollNumber,
      name: task.name,
      status: task.status,
      retryCount: task.retryCount,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }
}

export const biometricsService = new BiometricsService();
