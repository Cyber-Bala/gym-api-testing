import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../src/shared/database/index.js', () => ({ db: {}, pool: {} }));

import { config } from '../src/config/index.js';
import { getBridgeHealth, assertSyncReady, GYM_API_OFFLINE_MSG, FACE_SERVICE_OFFLINE_MSG, ZKBIO_OFFLINE_MSG } from '../src/modules/device-sync/device-sync.service.js';

// The real .env may switch sync off for local testing; tests choose explicitly.
beforeEach(() => {
  config.ZKBIO_SYNC_ENABLED = true;
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** Route fetch by URL: gym api (api_app) and face service. */
const mockApps = (opts: { gymApi: 'up' | 'down'; zkbioOk?: boolean; face: 'up' | 'down' }) =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
    const url = String(input);
    if (url.includes(':8001')) {
      if (opts.face === 'down') throw new Error('ECONNREFUSED');
      return json({ ok: true, students: 2 });
    }
    if (opts.gymApi === 'down') throw new Error('ECONNREFUSED');
    if (url.endsWith('/api/sync/status')) {
      return json({ zkbio_enabled: true, last_pull_ok: opts.zkbioOk ?? true, last_pull_at: '2026-10-13T10:00:00' });
    }
    return json({});
  });

describe('bridge health', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.FORCE_SYNC_CHECK = '1';
  });
  afterEach(() => {
    delete process.env.FORCE_SYNC_CHECK;
  });

  it('all on: ok, no issues', async () => {
    mockApps({ gymApi: 'up', zkbioOk: true, face: 'up' });
    const h = await getBridgeHealth();
    expect(h.ok).toBe(true);
    expect(h.issues).toEqual([]);
    expect(h.zkbio.up).toBe(true);
  });

  it('Gym API off: says turn it on', async () => {
    mockApps({ gymApi: 'down', face: 'up' });
    const h = await getBridgeHealth();
    expect(h.ok).toBe(false);
    expect(h.gymApi.up).toBe(false);
    expect(h.issues).toContain(GYM_API_OFFLINE_MSG);
  });

  it('ZKBio portal unreachable from the Gym API: says turn on ZKBio', async () => {
    mockApps({ gymApi: 'up', zkbioOk: false, face: 'up' });
    const h = await getBridgeHealth();
    expect(h.zkbio.up).toBe(false);
    expect(h.issues).toContain(ZKBIO_OFFLINE_MSG);
  });

  it('face service off: says turn it on', async () => {
    mockApps({ gymApi: 'up', face: 'down' });
    const h = await getBridgeHealth();
    expect(h.issues).toContain(FACE_SERVICE_OFFLINE_MSG);
  });
});

describe('assertSyncReady (guards create / import / delete)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.FORCE_SYNC_CHECK = '1';
  });
  afterEach(() => {
    delete process.env.FORCE_SYNC_CHECK;
  });

  it('passes when everything is on', async () => {
    mockApps({ gymApi: 'up', face: 'up' });
    await expect(assertSyncReady({ needFaceService: true })).resolves.toBeUndefined();
  });

  it('refuses with 503 and the turn-on message when the Gym API is off', async () => {
    mockApps({ gymApi: 'down', face: 'up' });
    await expect(assertSyncReady()).rejects.toMatchObject({ statusCode: 503, message: GYM_API_OFFLINE_MSG });
  });

  it('refuses a delete when the face service is off', async () => {
    mockApps({ gymApi: 'up', face: 'down' });
    await expect(assertSyncReady({ needFaceService: true })).rejects.toMatchObject({
      statusCode: 503,
      message: FACE_SERVICE_OFFLINE_MSG,
    });
  });

  it('does not need the face service for create / import', async () => {
    mockApps({ gymApi: 'up', face: 'down' });
    await expect(assertSyncReady()).resolves.toBeUndefined();
  });
});

describe('testing mode (ZKBIO_SYNC_ENABLED=false)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.FORCE_SYNC_CHECK = '1';
    config.ZKBIO_SYNC_ENABLED = false;
  });
  afterEach(() => {
    config.ZKBIO_SYNC_ENABLED = true;
    delete process.env.FORCE_SYNC_CHECK;
  });

  it('never calls the Gym API and reports no ZKBio issues', async () => {
    const f = mockApps({ gymApi: 'down', face: 'up' });
    const h = await getBridgeHealth();
    expect(h.syncEnabled).toBe(false);
    expect(h.issues).toEqual([]);
    expect(h.gymApi.up).toBeNull();
    expect(f.mock.calls.every(([u]) => String(u).includes(':8001'))).toBe(true);
  });

  it('create / import / delete are not blocked by an offline Gym API', async () => {
    mockApps({ gymApi: 'down', face: 'up' });
    await expect(assertSyncReady({ needFaceService: true })).resolves.toBeUndefined();
  });

  it('still tells you when the face service is off', async () => {
    mockApps({ gymApi: 'down', face: 'down' });
    const h = await getBridgeHealth();
    expect(h.issues).toContain(FACE_SERVICE_OFFLINE_MSG);
  });
});
