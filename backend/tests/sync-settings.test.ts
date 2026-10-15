import { describe, it, expect, vi, beforeEach } from 'vitest';

const store: { value: string | null } = { value: null };

vi.mock('../src/shared/database/index.js', () => ({
  db: {},
  pool: {
    query: vi.fn(async (sql: string, params: unknown[]) => {
      if (sql.startsWith('SELECT')) return { rows: store.value === null ? [] : [{ value: store.value }] };
      store.value = String(params[1]);
      return { rows: [] };
    }),
  },
}));

import { isSyncEnabled, setSyncEnabled } from '../src/modules/device-sync/sync-settings.service.js';
import { config } from '../src/config/index.js';

describe('admin ZKBio sync switch', () => {
  beforeEach(() => {
    store.value = null;
    config.ZKBIO_SYNC_ENABLED = true;
  });

  it('turning it off from the admin button is saved and read back', async () => {
    await setSyncEnabled(false, 'admin@x.in');
    expect(store.value).toBe('false');
    expect(await isSyncEnabled()).toBe(false);
  });

  it('turning it on again is saved and read back', async () => {
    await setSyncEnabled(false, 'admin@x.in');
    await setSyncEnabled(true, 'admin@x.in');
    expect(await isSyncEnabled()).toBe(true);
  });
});
