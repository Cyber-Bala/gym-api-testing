import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { conflictsService } from '../src/modules/conflicts/conflicts.service.js';
import { authService } from '../src/modules/auth/auth.service.js';
import { SESSION_COOKIE_NAME } from '../src/modules/auth/auth.middleware.js';
import { SessionUser } from '../src/modules/auth/auth.types.js';

describe('Operational Turnstile Conflict Resolution', () => {
  const app = createApp();

  const mockAdminUser: SessionUser = {
    accountId: 'acc-admin-1',
    personId: 'per-admin-1',
    email: 'admin@rajalakshmi.edu.in',
    name: 'Gym Administrator',
    role: 'admin',
    personType: 'admin',
    status: 'active',
    permissions: ['students.write'],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/v1/conflicts/list returns open access conflicts', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-adm-1',
      user: mockAdminUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(conflictsService, 'listConflicts').mockResolvedValue([
      {
        id: 'conf-1',
        name: 'Karthik Raja',
        eventType: 'entry_denied',
        deviceId: 'turnstile-entry-01',
        result: 'denied',
        denialReason: 'Anti-Pass-Back Conflict',
        status: 'open',
        createdAt: new Date().toISOString(),
      },
    ]);

    const res = await request(app)
      .get('/api/v1/conflicts/list')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-adm-1`]);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].denialReason).toBe('Anti-Pass-Back Conflict');
  });

  it('POST /api/v1/conflicts/resolve records resolution and audits', async () => {
    vi.spyOn(authService, 'getSession').mockResolvedValue({
      id: 'sess-adm-1',
      user: mockAdminUser,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    });

    vi.spyOn(conflictsService, 'resolveConflict').mockResolvedValue({
      conflictId: '11111111-1111-1111-1111-111111111111',
      status: 'resolved',
      resolution: 'overridden',
      notes: 'Turnstile gate sensor glitch verified by floor CCTV',
      resolvedAt: new Date().toISOString(),
    });

    const res = await request(app)
      .post('/api/v1/conflicts/resolve')
      .set('Cookie', [`${SESSION_COOKIE_NAME}=sess-adm-1`])
      .send({
        conflictId: '11111111-1111-1111-1111-111111111111',
        resolution: 'overridden',
        notes: 'Turnstile gate sensor glitch verified by floor CCTV',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.resolution).toBe('overridden');
  });
});
