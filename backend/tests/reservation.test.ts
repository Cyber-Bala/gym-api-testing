import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { reservationService } from '../src/modules/booking/reservation.service.js';
import { authService } from '../src/modules/auth/auth.service.js';
import { SESSION_COOKIE_NAME } from '../src/modules/auth/auth.middleware.js';
import { SessionUser } from '../src/modules/auth/auth.types.js';
import { ConflictError, ForbiddenError, CapacityExceededError } from '../src/shared/errors/index.js';

describe('Slot Reservation & Concurrency Engine', () => {
  const app = createApp();

  const mockHostellerStudent: SessionUser = {
    accountId: 'acc-hosteller-1',
    personId: 'per-hosteller-1',
    email: 'hosteller@rajalakshmi.edu.in',
    name: 'Karthik Raja',
    role: 'student',
    personType: 'student',
    status: 'active',
    permissions: [],
    studentDetails: {
      rollNumber: '2024CS001',
      department: 'CSE',
      joiningYear: 2024,
      residency: 'hosteller',
      isBanned: false,
      violationCount: 0,
    },
  };

  const mockBannedStudent: SessionUser = {
    ...mockHostellerStudent,
    accountId: 'acc-banned-1',
    personId: 'per-banned-1',
    studentDetails: {
      ...mockHostellerStudent.studentDetails!,
      isBanned: true,
      violationCount: 3,
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/v1/booking/reserve without authentication returns 401 UNAUTHORIZED', async () => {
    const res = await request(app)
      .post('/api/v1/booking/reserve')
      .send({ slotId: '11111111-1111-1111-1111-111111111111' });

    expect(res.status).toBe(401);
  });

  it('POST /api/v1/booking/reserve with invalid UUID returns 400 VALIDATION_ERROR', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-stu-1',
      user: mockHostellerStudent,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    const res = await request(app)
      .post('/api/v1/booking/reserve')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-stu-1`])
      .send({ slotId: 'not-a-uuid' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/booking/reserve successfully creates a confirmed booking for Hosteller student', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-stu-1',
      user: mockHostellerStudent,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(reservationService, 'createBooking').mockResolvedValue({
      id: 'bk-123',
      studentId: 'per-hosteller-1',
      slotId: '11111111-1111-1111-1111-111111111111',
      slotDate: '2026-08-20',
      startTime: '06:00:00',
      endTime: '07:00:00',
      bookingStatus: 'booked',
      accessStatus: 'not_entered',
      createdAt: new Date(),
    });

    const res = await request(app)
      .post('/api/v1/booking/reserve')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-stu-1`])
      .send({ slotId: '11111111-1111-1111-1111-111111111111' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.bookingStatus).toBe('booked');
    expect(res.body.data.slotId).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('POST /api/v1/booking/reserve rejects banned students with 403 FORBIDDEN', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-banned-1',
      user: mockBannedStudent,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(reservationService, 'createBooking').mockRejectedValue(
      new ForbiddenError('Your gym booking privileges are temporarily suspended.')
    );

    const res = await request(app)
      .post('/api/v1/booking/reserve')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-banned-1`])
      .send({ slotId: '11111111-1111-1111-1111-111111111111' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('POST /api/v1/booking/reserve enforces single slot per day rule with 409 CONFLICT', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-stu-1',
      user: mockHostellerStudent,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(reservationService, 'createBooking').mockRejectedValue(
      new ConflictError('You already have a confirmed slot on 2026-08-20.')
    );

    const res = await request(app)
      .post('/api/v1/booking/reserve')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-stu-1`])
      .send({ slotId: '11111111-1111-1111-1111-111111111111' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('POST /api/v1/booking/reserve rejects when capacity limit is reached with 409 CAPACITY_EXCEEDED', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-stu-1',
      user: mockHostellerStudent,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(reservationService, 'createBooking').mockRejectedValue(
      new CapacityExceededError('Slot capacity (100) has been reached.')
    );

    const res = await request(app)
      .post('/api/v1/booking/reserve')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-stu-1`])
      .send({ slotId: '11111111-1111-1111-1111-111111111111' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CAPACITY_EXCEEDED');
  });

  it('POST /api/v1/booking/cancel/:id cancels confirmed booking with cancellation notice flag', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-stu-1',
      user: mockHostellerStudent,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(reservationService, 'cancelBooking').mockResolvedValue({
      bookingId: 'bk-123',
      status: 'cancelled_by_student',
      isLateCancellation: false,
      hoursUntilStart: 4.5,
      message: 'Booking cancelled successfully with full 2-hour notice.',
    });

    const res = await request(app)
      .post('/api/v1/booking/cancel/bk-123')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-stu-1`])
      .send({ reason: 'Class reschedule' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('cancelled_by_student');
    expect(res.body.data.isLateCancellation).toBe(false);
  });

  it('GET /api/v1/booking/my-bookings returns student reservation history', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-stu-1',
      user: mockHostellerStudent,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(reservationService, 'getMyBookings').mockResolvedValue([
      {
        id: 'bk-123',
        slotId: 'slot-1',
        slotDate: '2026-08-20',
        startTime: '06:00:00',
        endTime: '07:00:00',
        bookingStatus: 'booked',
        accessStatus: 'not_entered',
        canCancel: true,
        isLateCancellation: false,
        hoursUntilStart: 8,
        createdAt: new Date().toISOString(),
      },
    ]);

    const res = await request(app)
      .get('/api/v1/booking/my-bookings')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-stu-1`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].canCancel).toBe(true);
  });
});
