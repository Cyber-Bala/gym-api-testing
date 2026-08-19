import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { bookingService } from '../src/modules/booking/booking.service.js';
import { authService } from '../src/modules/auth/auth.service.js';
import { SESSION_COOKIE_NAME } from '../src/modules/auth/auth.middleware.js';
import { SessionUser } from '../src/modules/auth/auth.types.js';

describe('Booking & Rolling Window Module', () => {
  const app = createApp();

  const mockAdminUser: SessionUser = {
    accountId: 'admin-acc-1',
    personId: 'admin-per-1',
    email: 'admin@rajalakshmi.edu.in',
    name: 'Gym Administrator',
    role: 'admin',
    personType: 'admin',
    status: 'active',
    permissions: ['slots.manage'],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('computes exactly 3 rolling window dates in IST format (YYYY-MM-DD)', () => {
    const dates = bookingService.getRollingWindowDates();
    expect(dates).toHaveLength(3);
    dates.forEach((d) => {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    expect(bookingService.isDateInRollingWindow(dates[0])).toBe(true);
    expect(bookingService.isDateInRollingWindow(dates[1])).toBe(true);
    expect(bookingService.isDateInRollingWindow(dates[2])).toBe(true);
    expect(bookingService.isDateInRollingWindow('2020-01-01')).toBe(false);
    expect(bookingService.isDateInRollingWindow('2099-12-31')).toBe(false);
  });

  it('GET /api/v1/booking/slots/window returns 3-day rolling window structure', async () => {
    const mockDates = bookingService.getRollingWindowDates();
    vi.spyOn(bookingService, 'getRollingWindowSlots').mockResolvedValue({
      windowDates: mockDates,
      days: mockDates.map((dateStr, idx) => ({
        date: dateStr,
        dayLabel: idx === 0 ? 'Today' : idx === 1 ? 'Tomorrow' : 'Day After Tomorrow',
        dayOfWeek: 'Monday',
        isToday: idx === 0,
        hasUserBookedOnDate: false,
        totalCapacity: 1000,
        totalBooked: 0,
        slots: [
          {
            id: `slot-${idx}-1`,
            date: dateStr,
            startTime: '06:00:00',
            endTime: '07:00:00',
            capacity: 100,
            bookedCount: 0,
            availableSpots: 100,
            occupancyPercentage: 0,
            isFull: false,
            isActive: true,
            isPast: false,
            isBookedByCurrentUser: false,
          },
        ],
      })),
    });

    const res = await request(app).get('/api/v1/booking/slots/window');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.windowDates).toHaveLength(3);
    expect(res.body.data.days).toHaveLength(3);
    expect(res.body.data.days[0].slots[0].capacity).toBe(100);
  });

  it('GET /api/v1/booking/slots with invalid date parameter returns 400 VALIDATION_ERROR', async () => {
    const res = await request(app).get('/api/v1/booking/slots?date=invalid-date');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('PATCH /api/v1/booking/slots/:id/capacity requires admin authentication', async () => {
    const res = await request(app)
      .patch('/api/v1/booking/slots/slot-123/capacity')
      .send({ capacity: 120, reason: 'Increased ventilation capacity' });

    expect(res.status).toBe(401);
  });

  it('PATCH /api/v1/booking/slots/:id/capacity updates capacity for authenticated admin', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-admin-1',
      user: mockAdminUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    const updateSpy = vi.spyOn(bookingService, 'updateSlotCapacity').mockResolvedValue({
      id: 'slot-123',
      date: '2026-08-20',
      startTime: '06:00:00',
      endTime: '07:00:00',
      capacity: 120,
      bookedCount: 15,
      isActive: true,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app)
      .patch('/api/v1/booking/slots/slot-123/capacity')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-admin-1`])
      .send({ capacity: 120, reason: 'Increased ventilation capacity' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.capacity).toBe(120);
    expect(updateSpy).toHaveBeenCalledWith(
      'slot-123',
      120,
      'Increased ventilation capacity',
      'admin@rajalakshmi.edu.in'
    );
  });
});
