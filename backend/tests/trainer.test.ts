import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { trainerService } from '../src/modules/trainer/trainer.service.js';
import { authService } from '../src/modules/auth/auth.service.js';
import { SESSION_COOKIE_NAME } from '../src/modules/auth/auth.middleware.js';
import { SessionUser } from '../src/modules/auth/auth.types.js';

describe('Student-Trainer Work Shifts & Hourly Stipend Payroll', () => {
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

  const mockAdminUser: SessionUser = {
    accountId: 'acc-admin-1',
    personId: 'per-admin-1',
    email: 'admin@rajalakshmi.edu.in',
    name: 'Gym Administrator',
    role: 'admin',
    personType: 'admin',
    status: 'active',
    permissions: ['trainers.read', 'trainers.manage'],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/v1/trainer/profile returns trainer profile with shift history', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-trn-1',
      user: mockTrainerUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(trainerService, 'getTrainerProfile').mockResolvedValue({
      id: 'trn-1',
      personId: 'per-trainer-1',
      name: 'Vignesh Kumar',
      email: 'trainer@rajalakshmi.edu.in',
      hourlyRate: '200.00',
      activeShift: null,
      totalEarningsThisMonth: 1200,
      totalHoursThisMonth: 6,
      shifts: [],
    });

    const res = await request(app)
      .get('/api/v1/trainer/profile')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-trn-1`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.hourlyRate).toBe('200.00');
    expect(res.body.data.totalEarningsThisMonth).toBe(1200);
  });

  it('POST /api/v1/trainer/clock-in starts active gym shift', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-trn-1',
      user: mockTrainerUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(trainerService, 'clockIn').mockResolvedValue({
      id: 'shift-1',
      trainerId: 'trn-1',
      clockIn: new Date().toISOString(),
      durationMinutes: 0,
      calculatedStipend: 0,
      hourlyRate: '200.00',
      isOngoing: true,
    });

    const res = await request(app)
      .post('/api/v1/trainer/clock-in')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-trn-1`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isOngoing).toBe(true);
  });

  it('POST /api/v1/trainer/clock-out closes shift and calculates stipend', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-trn-1',
      user: mockTrainerUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(trainerService, 'clockOut').mockResolvedValue({
      id: 'shift-1',
      trainerId: 'trn-1',
      clockIn: new Date(Date.now() - 3600000).toISOString(),
      clockOut: new Date().toISOString(),
      durationMinutes: 60,
      calculatedStipend: 200.0,
      hourlyRate: '200.00',
      isOngoing: false,
    });

    const res = await request(app)
      .post('/api/v1/trainer/clock-out')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-trn-1`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.durationMinutes).toBe(60);
    expect(res.body.data.calculatedStipend).toBe(200.0);
  });

  it('GET /api/v1/trainer/payroll returns monthly payroll ledger for admin', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-adm-1',
      user: mockAdminUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(trainerService, 'getMonthlyPayroll').mockResolvedValue([
      {
        trainerId: 'trn-1',
        personId: 'per-trainer-1',
        name: 'Vignesh Kumar',
        email: 'trainer@rajalakshmi.edu.in',
        hourlyRate: '200.00',
        totalShifts: 15,
        totalMinutes: 900,
        totalHours: 15,
        totalStipend: 3000,
      },
    ]);

    const res = await request(app)
      .get('/api/v1/trainer/payroll')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-adm-1`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].totalStipend).toBe(3000);
  });
});
