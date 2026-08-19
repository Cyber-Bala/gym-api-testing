import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { reportsService } from '../src/modules/reports/reports.service.js';
import { authService } from '../src/modules/auth/auth.service.js';
import { SESSION_COOKIE_NAME } from '../src/modules/auth/auth.middleware.js';
import { SessionUser } from '../src/modules/auth/auth.types.js';

describe('Institutional Multi-Domain Reports Generator & CSV Export', () => {
  const app = createApp();

  const mockAdminUser: SessionUser = {
    accountId: 'acc-admin-1',
    personId: 'per-admin-1',
    email: 'admin@rajalakshmi.edu.in',
    name: 'Gym Administrator',
    role: 'admin',
    personType: 'admin',
    status: 'active',
    permissions: ['reports.export'],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/v1/reports/generate produces structured tabular report', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-adm-1',
      user: mockAdminUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(reportsService, 'generateReport').mockResolvedValue({
      reportType: 'Gym Attendance & Check-In Report',
      generatedAt: new Date().toISOString(),
      totalRecords: 1,
      columns: ['Session ID', 'Name', 'Email', 'Role', 'Date', 'Entry Time', 'Exit Time', 'Duration (Mins)'],
      rows: [
        {
          'Session ID': 'sess-1',
          'Name': 'Karthik Raja',
          'Email': 'hosteller@rajalakshmi.edu.in',
          'Role': 'student',
          'Entry Time': '06:05 AM',
          'Exit Time': '06:55 AM',
          'Duration (Mins)': 50,
          'Date': '19/08/2026',
        },
      ],
    });

    const res = await request(app)
      .get('/api/v1/reports/generate?reportType=attendance')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-adm-1`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.rows).toHaveLength(1);
    expect(res.body.data.rows[0].Name).toBe('Karthik Raja');
  });

  it('GET /api/v1/reports/export-csv streams CSV content with attachment headers', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-adm-1',
      user: mockAdminUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(reportsService, 'generateReport').mockResolvedValue({
      reportType: 'Revenue Report',
      generatedAt: new Date().toISOString(),
      totalRecords: 1,
      columns: ['Order ID', 'Student Name', 'Amount (₹)'],
      rows: [{ 'Order ID': 'order-1', 'Student Name': 'Priya', 'Amount (₹)': '500.00' }],
    });

    vi.spyOn(reportsService, 'exportToCsv').mockReturnValue(
      'Order ID,Student Name,Amount (₹)\n"order-1","Priya","500.00"'
    );

    const res = await request(app)
      .get('/api/v1/reports/export-csv?reportType=revenue')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-adm-1`]);

    expect(res.status).toBe(200);
    expect(res.header['content-type']).toContain('text/csv');
    expect(res.text).toContain('Order ID,Student Name,Amount (₹)');
  });
});
