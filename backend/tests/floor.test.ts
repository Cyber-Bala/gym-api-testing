import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { floorService } from '../src/modules/floor/floor.service.js';
import { authService } from '../src/modules/auth/auth.service.js';
import { SESSION_COOKIE_NAME } from '../src/modules/auth/auth.middleware.js';
import { SessionUser } from '../src/modules/auth/auth.types.js';

describe('Trainer Live Floor Management & Overstayer Detection', () => {
  const app = createApp();

  const mockTrainerUser: SessionUser = {
    accountId: 'acc-trainer-1',
    personId: 'per-trainer-1',
    email: 'trainer@rajalakshmi.edu.in',
    name: 'Vignesh Kumar',
    role: 'trainer',
    personType: 'trainer',
    status: 'active',
    permissions: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/v1/floor/status returns active occupants and overstayers list', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-trn-1',
      user: mockTrainerUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(floorService, 'getCurrentFloorStatus').mockResolvedValue({
      currentSlotName: 'Current Active Slot Batch',
      totalInsideCount: 12,
      overstayerCount: 1,
      occupants: [],
      overstayers: [
        {
          sessionId: 'sess-123',
          personId: 'per-1',
          name: 'Karthik Raja',
          rollNumber: '2024CS001',
          department: 'CSE',
          residency: 'hosteller',
          role: 'student',
          entryTimestamp: new Date(Date.now() - 90 * 60000).toISOString(),
          minutesElapsed: 90,
          isOverstayer: true,
          overdueMinutes: 15,
        },
      ],
    });

    const res = await request(app)
      .get('/api/v1/floor/status')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-trn-1`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalInsideCount).toBe(12);
    expect(res.body.data.overstayerCount).toBe(1);
  });

  it('POST /api/v1/floor/checkout completes manual checkout for overstaying student', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-trn-1',
      user: mockTrainerUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(floorService, 'manualFloorCheckout').mockResolvedValue({
      success: true,
      sessionId: '11111111-1111-1111-1111-111111111111',
      durationMinutes: 90,
      message: 'Student checked out. Workout duration: 90 minutes.',
    });

    const res = await request(app)
      .post('/api/v1/floor/checkout')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-trn-1`])
      .send({
        sessionId: '11111111-1111-1111-1111-111111111111',
        reason: 'Workout slot ended 15 mins ago, student verbally notified',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.durationMinutes).toBe(90);
  });

  it('GET /api/v1/floor/staff-wellness returns monthly staff workout hours', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-trn-1',
      user: mockTrainerUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(floorService, 'getStaffWellnessStats').mockResolvedValue([
      {
        staffId: 'stf-1',
        personId: 'per-staff-1',
        staffEmpId: 'REC-EMP-014',
        name: 'Dr. Ramesh Kumar',
        email: 'ramesh@rajalakshmi.edu.in',
        department: 'CSE',
        designation: 'Professor & HOD',
        totalWorkoutsThisMonth: 8,
        totalMinutesThisMonth: 480,
        totalHoursThisMonth: 8,
      },
    ]);

    const res = await request(app)
      .get('/api/v1/floor/staff-wellness')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-trn-1`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].totalHoursThisMonth).toBe(8);
  });
});
