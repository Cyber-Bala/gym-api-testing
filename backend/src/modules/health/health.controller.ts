import { Request, Response } from 'express';
import { checkDatabaseHealth } from '../../shared/database/index.js';
import { checkRedisHealth } from '../../shared/redis/index.js';
import { checkStorageHealth } from '../../shared/storage/index.js';

export const getLiveness = (_req: Request, res: Response): void => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
};

export const getReadiness = async (_req: Request, res: Response): Promise<void> => {
  const [dbHealth, redisHealth, storageHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
    checkStorageHealth(),
  ]);

  const isHealthy = dbHealth.status === 'up' && redisHealth.status === 'up' && storageHealth.status === 'up';

  const statusCode = isHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: isHealthy ? 'ready' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealth,
      redis: redisHealth,
      storage: storageHealth,
    },
  });
};
