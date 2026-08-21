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
   * Enroll a person's face biometric (student, staff, trainer) and queue for hardware sync (ADR-011, ACINT-011)
   */
  public async enrollStudentFace(personIdentifier: string, faceImageBase64: string): Promise<FaceSyncTaskDto> {
    const [personData] = await db
      .select({
        person: people,
        student: students,
      })
      .from(people)
      .leftJoin(students, eq(students.personId, people.id))
      .where(
        or(
          eq(people.id, personIdentifier),
          eq(people.email, personIdentifier),
          eq(students.id, personIdentifier),
          eq(students.rollNumber, personIdentifier)
        )
      )
      .limit(1);

    if (!personData) {
      throw new NotFoundError(`Person '${personIdentifier}' not found`);
    }

    const faceReferenceId =
      personData.person.faceReferenceId ||
      personData.student?.faceReferenceId ||
      `face_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

    // Update people table
    await db
      .update(people)
      .set({
        faceEnrollmentStatus: 'enrolled',
        faceReferenceId,
        updatedAt: new Date(),
      })
      .where(eq(people.id, personData.person.id));

    // If student record exists, also update students table
    if (personData.student) {
      await db
        .update(students)
        .set({
          faceEnrollmentStatus: 'enrolled',
          faceReferenceId,
          updatedAt: new Date(),
        })
        .where(eq(students.id, personData.student.id));
    }

    // Remove existing pending task for this person to avoid duplicate queue entries
    this.syncQueue = this.syncQueue.filter((s) => s.personId !== personData.person.id || s.status !== 'pending');

    const syncId = uuidv4();
    const rollNumber = personData.student?.rollNumber || (personData.person.personType === 'staff' ? 'Staff' : 'Trainer');

    const syncRecord: InMemSyncRecord = {
      id: syncId,
      studentId: personData.student?.id || personData.person.id,
      personId: personData.person.id,
      rollNumber,
      name: personData.person.name,
      status: 'pending', // Correctly queued while turnstile socket/device is offline
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.syncQueue.unshift(syncRecord);

    logger.info(
      { personId: personData.person.id, rollNumber, syncId, status: 'pending' },
      'Face biometric enrolled and queued for asynchronous turnstile sync'
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
