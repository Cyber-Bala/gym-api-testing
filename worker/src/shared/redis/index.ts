import { Redis } from 'ioredis';
import { config } from '../../config/index.js';
import { logger } from '../logging/index.js';

export const redisConnection = new Redis({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

redisConnection.on('connect', () => {
  logger.info('Worker connected to Redis');
});

redisConnection.on('error', (err) => {
  logger.error({ err }, 'Worker Redis error');
});
