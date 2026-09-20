import { v4 as uuidv4 } from 'uuid';
import { eq, desc, or } from 'drizzle-orm';
import { db, pool } from '../../shared/database/index.js';
import { logger } from '../../shared/logging/index.js';
import { NotFoundError, ValidationError } from '../../shared/errors/index.js';
import { students, people, auditLogs } from '../../db/schema/index.js';
import {
  AccessDeviceDto,
} from './biometrics.types.js';

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

  public getDevice(deviceId: string): AccessDeviceDto | undefined {
    return this.devices.get(deviceId);
  }
}

export const biometricsService = new BiometricsService();
