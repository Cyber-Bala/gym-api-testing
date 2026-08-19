import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { archiveService } from '../src/modules/archive/archive.service.js';
import { authService } from '../src/modules/auth/auth.service.js';
import { SESSION_COOKIE_NAME } from '../src/modules/auth/auth.middleware.js';
import { SessionUser } from '../src/modules/auth/auth.types.js';

describe('Data Lifecycle, Cold Storage Archive & 7-Year Anonymization', () => {
  const app = createApp();

  const mockAdminUser: SessionUser = {
    accountId: 'acc-admin-1',
    personId: 'per-admin-1',
    email: 'admin@rajalakshmi.edu.in',
    name: 'Gym Administrator',
    role: 'admin',
    personType: 'admin',
    status: 'active',
    permissions: ['archive.manage'],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/v1/archive/summary returns data lifecycle status', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-adm-1',
      user: mockAdminUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(archiveService, 'getLifecycleSummary').mockResolvedValue({
      totalArchiveJobs: 3,
      coldStorageRecordsCount: 4500,
      departedStudentsCount: 210,
      anonymizedProfilesCount: 15,
      jobs: [],
    });

    const res = await request(app)
      .get('/api/v1/archive/summary')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-adm-1`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalArchiveJobs).toBe(3);
    expect(res.body.data.departedStudentsCount).toBe(210);
  });

  it('POST /api/v1/archive/job creates a cold storage archive job', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-adm-1',
      user: mockAdminUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(archiveService, 'runArchiveJob').mockResolvedValue({
      id: 'job-1',
      entityType: 'access_logs',
      cutoffDate: '2025-08-01',
      recordCount: 1200,
      status: 'completed',
      storagePath: 'minio://gym-archives/access_logs/2025-08-01.parquet.zst',
      createdAt: new Date().toISOString(),
    });

    const res = await request(app)
      .post('/api/v1/archive/job')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-adm-1`])
      .send({
        entityType: 'access_logs',
        cutoffDate: '2025-08-01',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.recordCount).toBe(1200);
  });

  it('POST /api/v1/archive/departure processes graduating student access revocation', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-adm-1',
      user: mockAdminUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(archiveService, 'processStudentDepartures').mockResolvedValue({
      success: true,
      processedCount: 1,
      message: '1 student(s) marked departed, credentials purged, and gym access terminated.',
    });

    const res = await request(app)
      .post('/api/v1/archive/departure')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-adm-1`])
      .send({
        studentIds: ['11111111-1111-1111-1111-111111111111'],
        reason: '2026 Batch Graduation',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.processedCount).toBe(1);
  });
});
