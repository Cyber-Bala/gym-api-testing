import { pool } from '../../shared/database/index.js';
import { logger } from '../../shared/logging/index.js';
import { config } from '../../config/index.js';

/**
 * Admin switch for ZKBio sync (testing mode).
 * The admin button stores the choice in the database so it survives restarts.
 * Until an admin has pressed the button, the ZKBIO_SYNC_ENABLED env flag decides.
 */

const KEY = 'zkbio_sync_enabled';
const CACHE_MS = 5000;

let cache: { value: boolean | null; at: number } | null = null;

async function readOverride(): Promise<boolean | null> {
  try {
    const r = await pool.query('SELECT value FROM admin.app_settings WHERE key = $1', [KEY]);
    const v = r?.rows?.[0]?.value;
    return v === 'true' ? true : v === 'false' ? false : null;
  } catch {
    return null; // table missing / DB not ready: fall back to the env flag
  }
}

/** True when the gym app should talk to the Gym API / ZKBio. */
export async function isSyncEnabled(): Promise<boolean> {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    cache = { value: await readOverride(), at: Date.now() };
  }
  return cache.value ?? config.ZKBIO_SYNC_ENABLED;
}

export async function setSyncEnabled(enabled: boolean, adminEmail: string): Promise<void> {
  await pool.query(
    `INSERT INTO admin.app_settings (key, value, updated_by, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
    [KEY, String(enabled), adminEmail]
  );
  cache = { value: enabled, at: Date.now() };
  logger.info({ enabled, adminEmail }, 'ZKBio sync switch changed by admin');
}
