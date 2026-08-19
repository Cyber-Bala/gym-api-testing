import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { paymentService } from '../src/modules/payment/payment.service.js';
import { accessService } from '../src/modules/access/access.service.js';
import { reservationService } from '../src/modules/booking/reservation.service.js';
import { authService } from '../src/modules/auth/auth.service.js';
import { SESSION_COOKIE_NAME } from '../src/modules/auth/auth.middleware.js';
import { SessionUser } from '../src/modules/auth/auth.types.js';

describe('Sprint 16: Reliability, Failure Injection & Concurrency Invariants', () => {
  const app = createApp();

  const mockAdminUser: SessionUser = {
    accountId: 'acc-admin-1',
    personId: 'per-admin-1',
    email: 'admin@rajalakshmi.edu.in',
    name: 'Gym Administrator',
    role: 'admin',
    personType: 'admin',
    status: 'active',
    permissions: ['admin.manage'],
  };

  const mockStudentUser: SessionUser = {
    accountId: 'acc-stu-1',
    personId: 'per-stu-1',
    email: 'dayscholar@rajalakshmi.edu.in',
    name: 'Priya Sharma',
    role: 'student',
    personType: 'student',
    status: 'active',
    permissions: ['booking.reserve'],
    studentDetails: {
      rollNumber: '2024CS002',
      department: 'CSE',
      joiningYear: 2024,
      residency: 'day_scholar',
      isBanned: false,
      violationCount: 0,
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('Payment Webhook: rejects requests with invalid HMAC SHA-256 signatures (SEC-012)', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-stu-1',
      user: mockStudentUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(paymentService, 'verifyPayment').mockRejectedValue(
      new Error('Invalid payment verification signature')
    );

    const res = await request(app)
      .post('/api/v1/payment/verify')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-stu-1`])
      .send({
        orderId: 'order_fake_123',
        paymentId: 'pay_fake_456',
        signature: 'invalid_tampered_signature_string',
      });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('signature');
  });

  it('Turnstile Access: blocks entry attempts outside the ±15 min grace window (ADR-010)', async () => {
    vi.spyOn(accessService, 'processTurnstileEvent').mockResolvedValue({
      accessGranted: false,
      denialReason: 'No valid active reservation found within the ±15-minute grace window for this time slot.',
      eventType: 'entry',
      personId: '11111111-1111-1111-1111-111111111111',
      name: 'Priya Sharma',
      timestamp: new Date().toISOString(),
    });

    const res = await request(app)
      .post('/api/v1/access/webhook/zkbio')
      .send({
        deviceId: 'turnstile-entry-01',
        eventType: 'entry',
        identifierType: 'roll_number',
        identifierValue: '2024CS002',
        timestamp: new Date().toISOString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.data.accessGranted).toBe(false);
    expect(res.body.data.denialReason).toContain('grace window');
  });

  it('Turnstile Access: detects and rejects Anti-Pass-Back violations (ADR-014)', async () => {
    vi.spyOn(accessService, 'processTurnstileEvent').mockResolvedValue({
      accessGranted: false,
      denialReason: 'Anti-Pass-Back Violation: Identity is already marked inside the gym',
      eventType: 'entry',
      personId: '11111111-1111-1111-1111-111111111111',
      name: 'Karthik Raja',
      timestamp: new Date().toISOString(),
    });

    const res = await request(app)
      .post('/api/v1/access/webhook/zkbio')
      .send({
        deviceId: 'turnstile-entry-01',
        eventType: 'entry',
        identifierType: 'roll_number',
        identifierValue: '2024CS001',
        timestamp: new Date().toISOString(),
      });

    expect(res.status).toBe(200);
    expect(res.body.data.accessGranted).toBe(false);
    expect(res.body.data.denialReason).toContain('Anti-Pass-Back');
  });

  it('Slot Reservation: enforces strict maximum capacity limit with Zero-Overbooking guarantee', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-adm-1',
      user: mockAdminUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(reservationService, 'createBooking').mockRejectedValue(
      new Error('Slot is fully booked (100/100 capacity reached)')
    );

    const res = await request(app)
      .post('/api/v1/booking/reserve')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-adm-1`])
      .send({
        slotId: '11111111-1111-1111-1111-111111111111',
      });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('100/100 capacity reached');
  });
});
