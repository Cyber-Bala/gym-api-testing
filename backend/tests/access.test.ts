import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { accessService } from '../src/modules/access/access.service.js';
import { noShowService } from '../src/modules/access/no-show.service.js';

describe('Biometric Turnstile Access & Attendance Pipeline', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/v1/access/webhook/zkbio rejects invalid payload with 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/v1/access/webhook/zkbio')
      .send({ invalidField: true });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/access/webhook/zkbio denies unrecognized user identifier', async () => {
    vi.spyOn(accessService, 'processTurnstileEvent').mockResolvedValue({
      accessGranted: false,
      eventType: 'entry',
      identifier: 'UNKNOWN_999',
      denialReason: 'Unrecognized user identity',
      message: 'Access denied: User is not registered in REC College Gym directory.',
      timestamp: new Date().toISOString(),
    });

    const res = await request(app)
      .post('/api/v1/access/webhook/zkbio')
      .send({
        deviceId: 'TURNSTILE_MAIN_IN',
        eventType: 'entry',
        identifierType: 'roll_number',
        identifierValue: 'UNKNOWN_999',
        verificationMode: 'face',
      });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(403);
    expect(res.body.data.accessGranted).toBe(false);
  });

  it('POST /api/v1/access/webhook/zkbio grants staff / trainer bypass access immediately', async () => {
    vi.spyOn(accessService, 'processTurnstileEvent').mockResolvedValue({
      accessGranted: true,
      eventType: 'entry',
      personId: 'per-trainer-1',
      name: 'Vignesh Kumar',
      role: 'trainer',
      identifier: 'trainer@rajalakshmi.edu.in',
      message: 'Welcome Vignesh Kumar! Access granted (Institutional Staff/Trainer Bypass).',
      timestamp: new Date().toISOString(),
    });

    const res = await request(app)
      .post('/api/v1/access/webhook/zkbio')
      .send({
        deviceId: 'TURNSTILE_MAIN_IN',
        eventType: 'entry',
        identifierType: 'email',
        identifierValue: 'trainer@rajalakshmi.edu.in',
        verificationMode: 'face',
      });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(200);
    expect(res.body.data.accessGranted).toBe(true);
    expect(res.body.data.role).toBe('trainer');
  });

  it('POST /api/v1/access/simulate grants student entry for valid slot within grace window', async () => {
    vi.spyOn(accessService, 'processTurnstileEvent').mockResolvedValue({
      accessGranted: true,
      eventType: 'entry',
      personId: 'per-student-1',
      name: 'Karthik Raja',
      role: 'student',
      identifier: '2024CS001',
      bookingId: 'bk-123',
      slotTime: '06:00 - 07:00',
      message: 'Welcome Karthik Raja! Verified for 06:00 - 07:00 slot batch.',
      timestamp: new Date().toISOString(),
    });

    const res = await request(app)
      .post('/api/v1/access/simulate')
      .send({
        deviceId: 'TURNSTILE_SIMULATOR',
        eventType: 'entry',
        identifierType: 'roll_number',
        identifierValue: '2024CS001',
        verificationMode: 'face',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessGranted).toBe(true);
    expect(res.body.data.bookingId).toBe('bk-123');
  });

  it('POST /api/v1/access/simulate records exit and computes workout duration', async () => {
    vi.spyOn(accessService, 'processTurnstileEvent').mockResolvedValue({
      accessGranted: true,
      eventType: 'exit',
      personId: 'per-student-1',
      name: 'Karthik Raja',
      role: 'student',
      identifier: '2024CS001',
      durationMinutes: 52,
      message: 'Exit recorded for Karthik Raja. Workout session duration: 52 minutes.',
      timestamp: new Date().toISOString(),
    });

    const res = await request(app)
      .post('/api/v1/access/simulate')
      .send({
        deviceId: 'TURNSTILE_MAIN_OUT',
        eventType: 'exit',
        identifierType: 'roll_number',
        identifierValue: '2024CS001',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.durationMinutes).toBe(52);
  });

  it('GET /api/v1/access/live-occupancy returns current gym headcount and list', async () => {
    vi.spyOn(accessService, 'getLiveOccupancy').mockResolvedValue({
      currentCount: 3,
      maxCapacity: 100,
      occupancyPercentage: 3,
      occupants: [
        {
          sessionId: 'sess-1',
          personId: 'per-1',
          name: 'Karthik Raja',
          email: 'hosteller@rajalakshmi.edu.in',
          role: 'student',
          identifier: '2024CS001',
          entryTimestamp: new Date().toISOString(),
          minutesInside: 25,
        },
      ],
    });

    const res = await request(app).get('/api/v1/access/live-occupancy');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.currentCount).toBe(3);
    expect(res.body.data.occupants).toHaveLength(1);
  });
});
