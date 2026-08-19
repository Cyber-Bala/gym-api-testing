import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import * as XLSX from 'xlsx';
import { createApp } from '../src/app.js';
import { peopleService } from '../src/modules/people/people.service.js';
import { authService } from '../src/modules/auth/auth.service.js';
import { SESSION_COOKIE_NAME } from '../src/modules/auth/auth.middleware.js';
import { SessionUser } from '../src/modules/auth/auth.types.js';

describe('People & Ingestion Module', () => {
  const app = createApp();

  const mockAdminUser: SessionUser = {
    accountId: 'admin-acc-1',
    personId: 'admin-per-1',
    email: 'admin@rajalakshmi.edu.in',
    name: 'Gym Administrator',
    role: 'admin',
    personType: 'admin',
    status: 'active',
    permissions: ['students.read', 'students.write'],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/v1/people/template/students returns valid Excel template buffer', async () => {
    const res = await request(app).get('/api/v1/people/template/students');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.headers['content-disposition']).toContain('rec_students_template.xlsx');

    const buffer = peopleService.generateStudentTemplateBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    expect(workbook.SheetNames).toContain('Students');
    const sheet = workbook.Sheets['Students'];
    const rows = XLSX.utils.sheet_to_json(sheet);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]).toHaveProperty('Roll Number');
    expect(rows[0]).toHaveProperty('College Email');
  });

  it('GET /api/v1/people/template/staff returns valid Staff Excel template', async () => {
    const res = await request(app).get('/api/v1/people/template/staff');
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('rec_staff_template.xlsx');

    const buffer = peopleService.generateStaffTemplateBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    expect(workbook.SheetNames).toContain('Staff');
  });

  it('POST /api/v1/people/import/students requires admin authentication', async () => {
    const res = await request(app)
      .post('/api/v1/people/import/students')
      .send({ rows: [{ rollNumber: '2024CS999', name: 'Test', email: 'test@test.com' }] });

    expect(res.status).toBe(401);
  });

  it('processes student rows with validation and reports invalid records without failing batch', async () => {
    const rawBatch = [
      {
        // Malformed row: invalid email and missing department
        'Roll Number': '2024CS502',
        'Full Name': 'Bala',
        'College Email': 'not-an-email',
        Department: '',
        'Joining Year': 1990, // Invalid year
      },
      {
        // Duplicate roll number in batch
        'Roll Number': '2024CS501',
        'Full Name': 'Aravind',
        'College Email': 'aravind@rajalakshmi.edu.in',
        Department: 'CSE',
        'Joining Year': 2024,
      },
      {
        // Duplicate roll number
        'Roll Number': '2024CS501',
        'Full Name': 'Duplicate Person',
        'College Email': 'duplicate@rajalakshmi.edu.in',
        Department: 'CSE',
        'Joining Year': 2024,
      },
    ];

    const report = await peopleService.processStudentRows(rawBatch);

    expect(report.totalRows).toBe(3);
    expect(report.errors.length).toBeGreaterThanOrEqual(2);
    expect(report.errors[0].row).toBe(2); // Malformed row
    expect(report.errors.some((e) => e.reason.includes('Duplicate Roll Number'))).toBe(true);
  });

  it('GET /api/v1/people/students returns paginated list for authenticated admin', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-admin-1',
      user: mockAdminUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(peopleService, 'getStudentsList').mockResolvedValue({
      items: [
        {
          id: 'stu-1',
          personId: 'per-1',
          rollNumber: '2024CS001',
          name: 'Karthik Raja',
          email: 'karthik@rajalakshmi.edu.in',
          phone: null,
          department: 'CSE',
          joiningYear: 2024,
          residency: 'hosteller',
          faceEnrollmentStatus: 'enrolled',
          isBanned: false,
          violationCount: 0,
          status: 'active',
          createdAt: new Date(),
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    });

    const res = await request(app)
      .get('/api/v1/people/students')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-admin-1`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.items[0].rollNumber).toBe('2024CS001');
  });

  it('creates and revokes an authorized person record with audit logging', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-admin-1',
      user: mockAdminUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    const createSpy = vi.spyOn(peopleService, 'createAuthorizedPerson').mockResolvedValue({
      id: 'auth-per-1',
      personId: 'per-vip-1',
      designation: 'College Trustee',
      notes: 'VIP guest',
      revokedAt: null,
      createdAt: new Date(),
    });

    const res = await request(app)
      .post('/api/v1/people/authorized-persons')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-admin-1`])
      .send({
        name: 'VIP Trustee',
        email: 'trustee.vip@rajalakshmi.edu.in',
        designation: 'College Trustee',
        notes: 'VIP guest',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(createSpy).toHaveBeenCalled();
  });
});
