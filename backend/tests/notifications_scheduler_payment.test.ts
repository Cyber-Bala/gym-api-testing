import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { authService } from '../src/modules/auth/auth.service';
import { notificationService } from '../src/modules/notification/notification.service';
import { schedulerService } from '../src/modules/scheduler/scheduler.service';
import { paymentService } from '../src/modules/payment/payment.service';
import { SESSION_COOKIE_NAME } from '../src/modules/auth/auth.middleware';
import { SessionUser } from '../src/modules/auth/auth.types';

describe('Notifications, Schedulers, and Payment History Domain Tests', () => {
  const app = createApp();

  const mockStudentUser: SessionUser = {
    accountId: 'acc-stud-1',
    personId: 'per-stud-1',
    email: 'hosteller@rajalakshmi.edu.in',
    name: 'Karthik Raja',
    role: 'student',
    personType: 'student',
    status: 'active',
    permissions: ['slots.book'],
    studentDetails: {
      studentId: 'stud-1',
      rollNumber: '2024CS001',
      department: 'CSE',
      residency: 'hosteller',
      yearOfStudy: 2,
    },
  };

  const mockAdminUser: SessionUser = {
    accountId: 'acc-admin-1',
    personId: 'per-admin-1',
    email: 'admin@rajalakshmi.edu.in',
    name: 'Gym Administrator',
    role: 'admin',
    personType: 'admin',
    status: 'active',
    permissions: ['reports.export', 'slots.manage', 'violations.manage'],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/v1/notifications returns user notifications', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-stud-1',
      user: mockStudentUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(notificationService, 'getUserNotifications').mockResolvedValue([
      {
        id: 'notif-1',
        accountId: 'acc-stud-1',
        title: 'Booking Confirmed',
        body: 'Your 6:00 AM slot reservation is confirmed.',
        eventType: 'booking_confirmation',
        status: 'sent',
        createdAt: new Date().toISOString(),
        read: false,
      },
    ]);

    const res = await request(app)
      .get('/api/v1/notifications')
      .set('Cookie', `${SESSION_COOKIE_NAME}=sess-stud-1`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].title).toBe('Booking Confirmed');
  });

  it('POST /api/v1/notifications/push-subscribe saves subscription', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-stud-1',
      user: mockStudentUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(notificationService, 'registerPushSubscription').mockResolvedValue({
      success: true,
    });

    const res = await request(app)
      .post('/api/v1/notifications/push-subscribe')
      .set('Cookie', `${SESSION_COOKIE_NAME}=sess-stud-1`)
      .send({
        endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/gAAAAAB...',
        keys: {
          p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls',
          auth: 'tBHItJI5svbpez7KI4CCXg',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('GET /api/v1/scheduler/status retrieves automated scheduler status for admins', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-adm-1',
      user: mockAdminUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(schedulerService, 'getStatus').mockReturnValue({
      isRunning: true,
      tasks: {
        noShowProcessor: {
          name: 'No-Show Slot Penalty Sweeper',
          intervalMinutes: 5,
          lastRunAt: new Date().toISOString(),
          lastResult: null,
          status: 'active',
          totalRuns: 12,
        },
      },
    });

    const res = await request(app)
      .get('/api/v1/scheduler/status')
      .set('Cookie', `${SESSION_COOKIE_NAME}=sess-adm-1`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isRunning).toBe(true);
  });

  it('POST /api/v1/scheduler/trigger-now runs immediate sweep for admin', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-adm-1',
      user: mockAdminUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(schedulerService, 'runSweeps').mockResolvedValue({
      noShowProcessor: { violationsIssued: 2, studentsSuspended: 1 },
      autoUnbanProcessor: { unbannedCount: 1 },
    });

    const res = await request(app)
      .post('/api/v1/scheduler/trigger-now')
      .set('Cookie', `${SESSION_COOKIE_NAME}=sess-adm-1`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.noShowProcessor).toBeDefined();
  });

  it('GET /api/v1/payment/my-history returns transaction ledger for authenticated student', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-stud-1',
      user: mockStudentUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(paymentService, 'getPaymentHistory').mockResolvedValue([
      {
        id: 'pay-ord-1',
        orderId: 'order_1234567890',
        paymentId: 'pay_9876543210',
        amount: 500,
        currency: 'INR',
        status: 'paid',
        planName: '1-Month Day Scholar Pass',
        durationDays: 30,
        createdAt: new Date().toISOString(),
      },
    ]);

    const res = await request(app)
      .get('/api/v1/payment/my-history')
      .set('Cookie', `${SESSION_COOKIE_NAME}=sess-stud-1`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].amount).toBe(500);
    expect(res.body.data[0].status).toBe('paid');
  });
});
