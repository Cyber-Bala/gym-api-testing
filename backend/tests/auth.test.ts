import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { authService } from '../src/modules/auth/auth.service.js';
import { SessionUser } from '../src/modules/auth/auth.types.js';
import { SESSION_COOKIE_NAME } from '../src/modules/auth/auth.middleware.js';

describe('Auth Module & Middleware', () => {
  const app = createApp();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/v1/auth/google with missing idToken returns 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/v1/auth/google')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/auth/dev-login with invalid email format returns 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/v1/auth/dev-login')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/v1/auth/me without session returns 401 UNAUTHORIZED', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/v1/auth/dev-login with valid provisioned mock returns session cookie', async () => {
    const mockUser: SessionUser = {
      accountId: 'acc-123',
      personId: 'per-123',
      email: 'student@rajalakshmi.edu.in',
      name: 'Test Student',
      role: 'student',
      personType: 'student',
      status: 'active',
      permissions: [],
      studentDetails: {
        rollNumber: '2024CS100',
        department: 'CSE',
        joiningYear: 2024,
        residency: 'hosteller',
        isBanned: false,
        violationCount: 0,
      },
    };

    vi.spyOn(authService, 'findAndSyncProvisionedUser').mockResolvedValue(mockUser);
    vi.spyOn(authService, 'createSession').mockResolvedValue({
      sessionId: 'sess-test-token-123',
      user: mockUser,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    });

    const res = await request(app)
      .post('/api/v1/auth/dev-login')
      .send({ email: 'student@rajalakshmi.edu.in' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('student@rajalakshmi.edu.in');
    expect(res.headers['set-cookie']).toBeDefined();
    expect(res.headers['set-cookie'][0]).toContain(SESSION_COOKIE_NAME);
  });

  it('GET /api/v1/auth/me with valid session cookie returns user profile', async () => {
    const mockUser: SessionUser = {
      accountId: 'acc-123',
      personId: 'per-123',
      email: 'student@rajalakshmi.edu.in',
      name: 'Test Student',
      role: 'student',
      personType: 'student',
      status: 'active',
      permissions: [],
    };

    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-test-token-123',
      user: mockUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-test-token-123`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('student@rajalakshmi.edu.in');
    expect(res.body.data.user.role).toBe('student');
  });

  it('POST /api/v1/auth/logout clears cookie and destroys session', async () => {
    const destroySpy = vi.spyOn(authService, 'destroySession').mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-test-token-123`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(destroySpy).toHaveBeenCalledWith('sess-test-token-123');
    expect(res.headers['set-cookie'][0]).toContain(`${SESSION_COOKIE_NAME}=;`);
  });
});
