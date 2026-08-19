import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { config } from '../../config/index.js';
import { logger } from '../logging/index.js';
import * as schema from '../../db/schema/index.js';

// Force node-postgres to parse DATE (OID 1082) as exact YYYY-MM-DD strings without local timezone shifting
pg.types.setTypeParser(1082, (val: string) => val);

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', (client) => {
  // Enforce UTC timezone on every database session
  client.query("SET TIME ZONE 'UTC'");
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected PostgreSQL pool error');
});

export const db = drizzle(pool, { schema });

export const checkDatabaseHealth = async (): Promise<{ status: 'up' | 'down'; latencyMs: number; error?: string }> => {
  const start = Date.now();
  try {
    const res = await pool.query('SELECT 1 AS health_check');
    if (res.rows[0]?.health_check === 1) {
      return { status: 'up', latencyMs: Date.now() - start };
    }
    return { status: 'down', latencyMs: Date.now() - start, error: 'Invalid response from DB' };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { status: 'down', latencyMs: Date.now() - start, error: errorMsg };
  }
};
