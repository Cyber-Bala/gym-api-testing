import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { biometricsService } from '../src/modules/biometrics/biometrics.service.js';
import { authService } from '../src/modules/auth/auth.service.js';
import { SESSION_COOKIE_NAME } from '../src/modules/auth/auth.middleware.js';
import { SessionUser } from '../src/modules/auth/auth.types.js';

describe('Biometrics & ZKBio Turnstile Hardware Sync', () => {
  const app = createApp();

  const mockAdminUser: SessionUser = {
    accountId: 'acc-admin-1',
    personId: 'per-admin-1',
    email: 'admin@rajalakshmi.edu.in',
    name: 'Gym Administrator',
    role: 'admin',
    personType: 'admin',
    status: 'active',
    permissions: ['students.write', 'slots.manage'],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/v1/biometrics/device/heartbeat updates hardware status', async () => {
    const res = await request(app)
      .post('/api/v1/biometrics/device/heartbeat')
      .send({
        deviceId: 'turnstile-entry-01',
        deviceName: 'Main Entrance Turnstile (Lane A)',
        ipAddress: '192.168.1.120',
        firmwareVersion: 'v2.4.1-zkbio',
        status: 'online',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.deviceId).toBe('turnstile-entry-01');
    expect(res.body.data.status).toBe('online');
  });

  it('GET /api/v1/biometrics/devices returns list of active turnstile units for admin', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-adm-1',
      user: mockAdminUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    const res = await request(app)
      .get('/api/v1/biometrics/devices')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-adm-1`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/v1/biometrics/device/face-enroll enrolls face from the gym machine', async () => {
    vi.spyOn(biometricsService, 'enrollStudentFace').mockResolvedValue({
      id: 'sync-1',
      studentId: '11111111-1111-1111-1111-111111111111',
      personId: 'per-1',
      rollNumber: '2024CS001',
      name: 'Karthik Raja',
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await request(app)
      .post('/api/v1/biometrics/device/face-enroll')
      .send({
        deviceId: 'turnstile-entry-01',
        personIdentifier: '11111111-1111-1111-1111-111111111111',
        faceImageBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('pending');
  });

  it('POST /api/v1/biometrics/face-enroll rejects in-app enrollment even for admins', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-adm-1',
      user: mockAdminUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    const res = await request(app)
      .post('/api/v1/biometrics/face-enroll')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-adm-1`])
      .send({
        studentId: '11111111-1111-1111-1111-111111111111',
        faceImageBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...',
      });

    expect(res.status).toBe(403);
  });

  it('POST /api/v1/biometrics/sync-process advances queue to synced', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-adm-1',
      user: mockAdminUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(biometricsService, 'processSyncQueue').mockReturnValue({
      syncedCount: 3,
      failedCount: 0,
    });

    const res = await request(app)
      .post('/api/v1/biometrics/sync-process')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-adm-1`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.syncedCount).toBe(3);
  });

  it('POST /api/v1/biometrics/admin-face-enroll registers student face and bridges to FastAPI/ZKBio', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-adm-1',
      user: mockAdminUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(biometricsService, 'adminEnrollStudentFace').mockResolvedValue({
      studentId: '11111111-1111-1111-1111-111111111111',
      rollNumber: '2024CS001',
      status: 'enrolled',
      message: 'Face registered successfully for student 2024CS001 and synced to device gate.',
    });

    const res = await request(app)
      .post('/api/v1/biometrics/admin-face-enroll')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-adm-1`])
      .send({
        studentId: '11111111-1111-1111-1111-111111111111',
        rollNumber: '2024CS001',
        faceImageBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('enrolled');
  });
});
