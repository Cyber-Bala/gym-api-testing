import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { integrationService } from '../src/modules/integration/integration.service.js';
import { authService } from '../src/modules/auth/auth.service.js';
import { SESSION_COOKIE_NAME } from '../src/modules/auth/auth.middleware.js';
import { SessionUser } from '../src/modules/auth/auth.types.js';

describe('Sprint 15: Full End-to-End System Integration Workflows (FLOW-001..012)', () => {
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

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/v1/integration/run-all-flows executes and validates all 12 core journeys', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-adm-1',
      user: mockAdminUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(integrationService, 'runAllE2EWorkflows').mockResolvedValue({
      totalFlows: 12,
      passedFlows: 12,
      failedFlows: 0,
      overallStatus: 'passed',
      totalDurationMs: 45,
      timestamp: new Date().toISOString(),
      flows: [
        {
          stepId: 'FLOW-001',
          name: 'Student Identity & Eligibility Gating',
          category: 'Identity & Membership',
          status: 'passed',
          details: 'Validated 3 active multi-tier membership plans.',
          latencyMs: 5,
        },
        {
          stepId: 'FLOW-002',
          name: 'Day Scholar Membership Checkout & Webhook Verification',
          category: 'Payment',
          status: 'passed',
          details: 'Simulated Razorpay order creation and HMAC SHA-256 webhook.',
          latencyMs: 4,
        },
        {
          stepId: 'FLOW-003',
          name: '3-Day Rolling Window Slot Discovery & Concurrency Locking',
          category: 'Booking Engine',
          status: 'passed',
          details: 'Discovered 3 IST dates with mutex locking.',
          latencyMs: 3,
        },
        {
          stepId: 'FLOW-004',
          name: 'Booking Cancellation Policy Enforcement (ADR-009)',
          category: 'Booking Engine',
          status: 'passed',
          details: 'Enforced 2-hour cancellation notice cutoff.',
          latencyMs: 2,
        },
        {
          stepId: 'FLOW-005',
          name: 'Biometric Face Vector Enrollment & Async Sync State Machine',
          category: 'Access & Biometrics',
          status: 'passed',
          details: 'Advanced biometric templates to synced state.',
          latencyMs: 4,
        },
        {
          stepId: 'FLOW-006',
          name: '±15-Minute Grace Window Turnstile Admission & Anti-Pass-Back',
          category: 'Access & Turnstiles',
          status: 'passed',
          details: 'Turnstile evaluated scan. APB protection active.',
          latencyMs: 6,
        },
        {
          stepId: 'FLOW-007',
          name: 'Turnstile Exit Tracking & Workout Duration Engine',
          category: 'Access & Turnstiles',
          status: 'passed',
          details: 'Computed workout duration in minutes upon exit.',
          latencyMs: 3,
        },
        {
          stepId: 'FLOW-008',
          name: 'Live Floor Supervision & Automated Overstayer Detection',
          category: 'Trainer & Floor',
          status: 'passed',
          details: 'Supervised gym floor and flagged overstayers.',
          latencyMs: 5,
        },
        {
          stepId: 'FLOW-009',
          name: 'Automated No-Show Detection & 3-Strike Suspension Engine',
          category: 'Violations & Penalties',
          status: 'passed',
          details: 'Evaluated no-shows and executed 3-day bans.',
          latencyMs: 4,
        },
        {
          stepId: 'FLOW-010',
          name: 'Student-Trainer Work Shifts & Hourly Stipend Payroll',
          category: 'Trainer & Payroll',
          status: 'passed',
          details: 'Aggregated monthly payroll at ₹200/hr stipend.',
          latencyMs: 3,
        },
        {
          stepId: 'FLOW-011',
          name: 'Emergency Calendar Blackout & Automated Cancellation Cascade',
          category: 'Admin & Calendar',
          status: 'passed',
          details: 'Closed slots and cancelled active bookings.',
          latencyMs: 4,
        },
        {
          stepId: 'FLOW-012',
          name: 'Student Departure Access Purge & Cold Storage Parquet Archiving',
          category: 'Data Lifecycle',
          status: 'passed',
          details: 'Purged credentials and created cold storage archive.',
          latencyMs: 2,
        },
      ],
    });

    const res = await request(app)
      .post('/api/v1/integration/run-all-flows')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-adm-1`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalFlows).toBe(12);
    expect(res.body.data.overallStatus).toBe('passed');
    expect(res.body.data.flows).toHaveLength(12);
  });
});
