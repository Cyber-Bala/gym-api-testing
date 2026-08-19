import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { violationsService } from '../src/modules/violations/violations.service.js';
import { authService } from '../src/modules/auth/auth.service.js';
import { SESSION_COOKIE_NAME } from '../src/modules/auth/auth.middleware.js';
import { SessionUser } from '../src/modules/auth/auth.types.js';

describe('Unified Violation System & Ban Enforcement', () => {
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

  it('GET /api/v1/violations/student/:id requires admin authentication', async () => {
    const res = await request(app).get('/api/v1/violations/student/11111111-1111-1111-1111-111111111111');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/violations/student/:id returns student violation profile', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-adm-1',
      user: mockAdminUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(violationsService, 'getStudentViolations').mockResolvedValue({
      studentId: 'stu-1',
      personId: 'per-1',
      rollNumber: '2024CS001',
      name: 'Karthik Raja',
      email: 'hosteller@rajalakshmi.edu.in',
      department: 'CSE',
      violationCount: 2,
      isBanned: false,
      violations: [
        {
          id: 'vio-1',
          studentId: 'stu-1',
          violationType: 'no_show',
          description: 'Missed reserved slot',
          createdAt: new Date().toISOString(),
        },
      ],
    });

    const res = await request(app)
      .get('/api/v1/violations/student/stu-1')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-adm-1`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.violationCount).toBe(2);
    expect(res.body.data.violations).toHaveLength(1);
  });

  it('POST /api/v1/violations/forgive successfully removes a strike with audit log', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-adm-1',
      user: mockAdminUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(violationsService, 'forgiveViolation').mockResolvedValue({
      success: true,
      message: 'Violation forgiven and strike removed',
      studentId: 'stu-1',
      newViolationCount: 1,
    });

    const res = await request(app)
      .post('/api/v1/violations/forgive')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-adm-1`])
      .send({
        violationId: '11111111-1111-1111-1111-111111111111',
        reason: 'Valid medical excuse submitted with college clinic certificate',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.newViolationCount).toBe(1);
  });

  it('POST /api/v1/violations/ban applies suspension', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-adm-1',
      user: mockAdminUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(violationsService, 'manualBanStudent').mockResolvedValue({
      studentId: 'stu-1',
      isBanned: true,
      banExpiresAt: new Date(Date.now() + 3 * 86400000).toISOString(),
      message: 'Student suspended for 3 days',
    });

    const res = await request(app)
      .post('/api/v1/violations/ban')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-adm-1`])
      .send({
        studentId: '11111111-1111-1111-1111-111111111111',
        banDurationDays: 3,
        reason: 'Repeated unauthorized equipment misuse',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isBanned).toBe(true);
  });

  it('POST /api/v1/violations/unban restores access and resets strikes', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-adm-1',
      user: mockAdminUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(violationsService, 'manualUnbanStudent').mockResolvedValue({
      studentId: 'stu-1',
      isBanned: false,
      violationCount: 0,
      message: 'Student unbanned successfully',
    });

    const res = await request(app)
      .post('/api/v1/violations/unban')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-adm-1`])
      .send({
        studentId: '11111111-1111-1111-1111-111111111111',
        reason: 'Disciplinary review committee approved early reinstatement',
        resetStrikes: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isBanned).toBe(false);
    expect(res.body.data.violationCount).toBe(0);
  });
});
