import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { adminService } from '../src/modules/admin/admin.service.js';
import { authService } from '../src/modules/auth/auth.service.js';
import { SESSION_COOKIE_NAME } from '../src/modules/auth/auth.middleware.js';
import { SessionUser } from '../src/modules/auth/auth.types.js';

describe('Institutional Admin Analytics & Emergency Calendar Closures', () => {
  const app = createApp();

  const mockAdminUser: SessionUser = {
    accountId: 'acc-admin-1',
    personId: 'per-admin-1',
    email: 'admin@rajalakshmi.edu.in',
    name: 'Gym Administrator',
    role: 'admin',
    personType: 'admin',
    status: 'active',
    permissions: ['reports.export', 'slots.manage'],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/v1/admin/analytics returns aggregated executive dashboard metrics', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-adm-1',
      user: mockAdminUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(adminService, 'getExecutiveAnalytics').mockResolvedValue({
      totalRegisteredStudents: 1500,
      totalHostellers: 900,
      totalDayScholars: 600,
      activeMembershipsCount: 450,
      todayTotalCheckIns: 240,
      currentLiveOccupants: 35,
      totalMonthlyRevenue: 225000,
      totalViolationsThisMonth: 12,
      peakHours: [{ hour: '06:00 - 07:00', count: 85 }],
    });

    const res = await request(app)
      .get('/api/v1/admin/analytics')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-adm-1`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalRegisteredStudents).toBe(1500);
    expect(res.body.data.todayTotalCheckIns).toBe(240);
  });

  it('POST /api/v1/admin/calendar/closure creates blackout date and cancels bookings in cascade', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-adm-1',
      user: mockAdminUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(adminService, 'createCalendarClosure').mockResolvedValue({
      id: 'close-1',
      closureDate: '2026-08-25',
      reason: 'Annual Gym Flooring & Air Conditioning Maintenance',
      cancelledBookingsCount: 180,
      createdAt: new Date().toISOString(),
    });

    const res = await request(app)
      .post('/api/v1/admin/calendar/closure')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-adm-1`])
      .send({
        closureDate: '2026-08-25',
        reason: 'Annual Gym Flooring & Air Conditioning Maintenance',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.cancelledBookingsCount).toBe(180);
  });

  it('GET /api/v1/admin/audit-logs returns system audit events', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-adm-1',
      user: mockAdminUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(adminService, 'getAuditLogs').mockResolvedValue([
      {
        id: 'audit-1',
        actorEmail: 'admin@rajalakshmi.edu.in',
        action: 'emergency_calendar_closure',
        entity: 'calendar',
        entityId: '2026-08-25',
        reason: 'Maintenance',
        createdAt: new Date().toISOString(),
      },
    ]);

    const res = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-adm-1`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });
});
