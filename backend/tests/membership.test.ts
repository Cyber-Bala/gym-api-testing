import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { membershipService } from '../src/modules/membership/membership.service.js';
import { paymentService } from '../src/modules/payment/payment.service.js';
import { authService } from '../src/modules/auth/auth.service.js';
import { SESSION_COOKIE_NAME } from '../src/modules/auth/auth.middleware.js';
import { SessionUser } from '../src/modules/auth/auth.types.js';

describe('Day Scholar Membership Passes & Razorpay Payments', () => {
  const app = createApp();

  const mockDayScholar: SessionUser = {
    accountId: 'acc-dayscholar-1',
    personId: 'per-dayscholar-1',
    email: 'dayscholar@rajalakshmi.edu.in',
    name: 'Priya Sharma',
    role: 'student',
    personType: 'student',
    status: 'active',
    permissions: [],
    studentDetails: {
      rollNumber: '2024IT042',
      department: 'IT',
      joiningYear: 2024,
      residency: 'day_scholar',
      isBanned: false,
      violationCount: 0,
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/v1/membership/plans returns active passes', async () => {
    vi.spyOn(membershipService, 'getPlans').mockResolvedValue([
      { id: 'plan-1', name: '1-Month Student Pass', durationDays: 30, price: '500.00', isActive: 'active' },
      { id: 'plan-2', name: '3-Month Student Pass', durationDays: 90, price: '1200.00', isActive: 'active' },
      { id: 'plan-3', name: '1-Year Annual Pass', durationDays: 365, price: '4000.00', isActive: 'active' },
    ]);

    const res = await request(app).get('/api/v1/membership/plans');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data[0].price).toBe('500.00');
  });

  it('POST /api/v1/payment/create-order creates a payment order for student', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-stu-2',
      user: mockDayScholar,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(paymentService, 'createOrder').mockResolvedValue({
      id: 'order-rec-1',
      orderId: 'order_987654321',
      amount: 500.0,
      currency: 'INR',
      status: 'created',
      planId: '11111111-1111-1111-1111-111111111111',
      planName: '1-Month Student Pass',
      keyId: 'rzp_test_rec_college_gym',
    });

    const res = await request(app)
      .post('/api/v1/payment/create-order')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-stu-2`])
      .send({ planId: '11111111-1111-1111-1111-111111111111' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.orderId).toBe('order_987654321');
  });

  it('POST /api/v1/payment/verify verifies payment and activates membership pass', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-stu-2',
      user: mockDayScholar,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(paymentService, 'verifyPayment').mockResolvedValue({
      success: true,
      message: 'Payment verified and gym membership pass activated!',
      orderId: 'order_987654321',
      paymentId: 'pay_987654321',
      membership: {
        id: 'mem-1',
        studentId: 'per-dayscholar-1',
        planId: 'plan-1',
        planName: '1-Month Student Pass',
        price: '500.00',
        durationDays: 30,
        status: 'active',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        daysRemaining: 30,
        isActive: true,
        paymentId: 'pay_987654321',
        createdAt: new Date().toISOString(),
      },
    });

    const res = await request(app)
      .post('/api/v1/payment/verify')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-stu-2`])
      .send({
        orderId: 'order_987654321',
        paymentId: 'pay_987654321',
        signature: 'simulated_success',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.membership.isActive).toBe(true);
    expect(res.body.data.membership.daysRemaining).toBe(30);
  });
});
