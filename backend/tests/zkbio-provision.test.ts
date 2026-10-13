import { describe, it, expect, vi, beforeEach } from 'vitest';

/** Results handed back by db.select()...limit(), in call order. */
const limits: unknown[][] = [];
/** Whether the student has a stored face photo. */
const state = { photo: true };

vi.mock('../src/shared/database/index.js', () => {
  const chain: any = {
    select: () => chain,
    from: () => chain,
    innerJoin: () => chain,
    where: () => chain,
    orderBy: () => chain,
    update: () => chain,
    set: () => chain,
    limit: async () => limits.shift() ?? [],
    then: (resolve: (v: unknown) => void) => resolve(undefined), // awaited update chains
  };
  const pool = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('SELECT 1 FROM people.student_face_photos')) return { rowCount: state.photo ? 1 : 0, rows: [] };
      if (sql.includes('SELECT photo FROM')) return { rows: state.photo ? [{ photo: Buffer.from('jpeg-bytes') }] : [] };
      return { rows: [], rowCount: 0 };
    }),
  };
  return { db: chain, pool };
});

import { reconcileStudent } from '../src/modules/device-sync/zkbio-provision.service.js';

const student = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  personId: 'p1',
  rollNumber: '2024CS001',
  residency: 'day_scholar',
  gender: 'male',
  zkbioSynced: false,
  source: 'app',
  name: 'Karthik Raja',
  phone: null,
  ...over,
});
const pass = { startDate: new Date('2026-10-01T00:00:00Z'), endDate: new Date('2026-11-01T00:00:00Z') };

const calls: Array<{ method: string; path: string; body?: any }> = [];
const bridge = (statusFor: (m: string, p: string) => number = () => 200) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any, init: any) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    calls.push({ method, path: url.pathname, body: init?.body ? JSON.parse(init.body) : undefined });
    return new Response(JSON.stringify({}), { status: statusFor(method, url.pathname) });
  });

describe('ZKBio provisioning rules', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    limits.length = 0;
    calls.length = 0;
    state.photo = true;
  });

  it('day scholar with a face but no paid pass: kept in the gym app only', async () => {
    limits.push([student()], []); // student, no active pass
    const f = bridge();
    const r = await reconcileStudent('s1');
    expect(r).toMatchObject({ action: 'kept_local', onGate: false, reason: 'awaiting_payment' });
    expect(f).not.toHaveBeenCalled();
  });

  it('day scholar with a face and a paid pass: added to ZKBio with the pass dates', async () => {
    limits.push([student()], [pass]);
    bridge();
    const r = await reconcileStudent('s1');
    expect(r).toMatchObject({ action: 'provisioned', onGate: true });
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /api/students',
      'POST /api/students/2024CS001/register-face',
      'PATCH /api/students/2024CS001/payment',
    ]);
    expect(calls[2].body).toMatchObject({ payment_status: 'paid', payment_valid_from: '2026-10-01', payment_valid_until: '2026-11-01' });
    expect(calls[1].body.photo_base64).toBe(Buffer.from('jpeg-bytes').toString('base64'));
  });

  it('hosteller with a face: added without any payment', async () => {
    limits.push([student({ residency: 'hosteller' })]);
    bridge();
    const r = await reconcileStudent('s1');
    expect(r).toMatchObject({ action: 'provisioned', onGate: true });
    expect(calls[2].body).toMatchObject({ payment_status: 'paid', payment_valid_until: null });
  });

  it('no face registered: never sent to ZKBio, even for a hosteller', async () => {
    state.photo = false;
    limits.push([student({ residency: 'hosteller' })]);
    const f = bridge();
    const r = await reconcileStudent('s1');
    expect(r).toMatchObject({ action: 'kept_local', reason: 'no_face' });
    expect(f).not.toHaveBeenCalled();
  });

  it('pass ended: removed from ZKBio, student stays in the gym app', async () => {
    limits.push([student({ zkbioSynced: true })], []); // on ZKBio, pass gone
    bridge();
    const r = await reconcileStudent('s1');
    expect(r).toMatchObject({ action: 'deprovisioned', onGate: false });
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'PATCH /api/students/2024CS001/payment',
      'DELETE /api/students/2024CS001',
    ]);
    expect(calls[0].body.payment_status).toBe('expired');
  });

  it('after renewal: added to ZKBio again from the stored face', async () => {
    limits.push([student({ zkbioSynced: false })], [pass]);
    bridge();
    const r = await reconcileStudent('s1');
    expect(r.action).toBe('provisioned');
    expect(calls.some((c) => c.path.endsWith('/register-face'))).toBe(true);
  });

  it('already on ZKBio and still paid: just refreshes the pass dates', async () => {
    limits.push([student({ zkbioSynced: true })], [pass]);
    bridge();
    const r = await reconcileStudent('s1');
    expect(r).toMatchObject({ action: 'refreshed', onGate: true });
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });

  it('people that came from ZKBio are never changed in ZKBio', async () => {
    limits.push([student({ source: 'zkbio', residency: 'hosteller', zkbioSynced: false })]);
    const f = bridge();
    const r = await reconcileStudent('s1');
    expect(r).toMatchObject({ action: 'kept_local', onGate: true });
    expect(f).not.toHaveBeenCalled();
  });

  it('ZKBio-origin day scholar with no pass is still left alone (no removal)', async () => {
    limits.push([student({ source: 'zkbio', zkbioSynced: true })], []);
    const f = bridge();
    await reconcileStudent('s1');
    expect(f).not.toHaveBeenCalled();
  });

  it('Gym API off: reports a failure that says what to turn on, keeps the student', async () => {
    limits.push([student({ residency: 'hosteller' })]);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    const r = await reconcileStudent('s1');
    expect(r.action).toBe('failed');
    expect(r.onGate).toBe(false);
    expect(r.message).toContain('Turn on the Gym API');
  });

  it('removal failing while the Gym API is off keeps the student marked as on ZKBio to retry', async () => {
    limits.push([student({ zkbioSynced: true })], []);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    const r = await reconcileStudent('s1');
    expect(r).toMatchObject({ action: 'failed', onGate: true });
  });
});
