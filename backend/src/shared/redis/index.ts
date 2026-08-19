import { Redis } from 'ioredis';
import { config } from '../../config/index.js';
import { logger } from '../logging/index.js';

export const redis = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  lazyConnect: true,
});

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});

export const checkRedisHealth = async (): Promise<{ status: 'up' | 'down'; latencyMs: number; error?: string }> => {
  const start = Date.now();
  try {
    if (redis.status !== 'ready') {
      await redis.connect().catch(() => {});
    }
    const pong = await redis.ping();
    if (pong === 'PONG') {
      return { status: 'up', latencyMs: Date.now() - start };
    }
    return { status: 'down', latencyMs: Date.now() - start, error: 'Redis ping failed' };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { status: 'down', latencyMs: Date.now() - start, error: errorMsg };
  }
};
