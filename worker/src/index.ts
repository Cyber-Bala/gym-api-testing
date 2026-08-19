import { logger } from './shared/logging/index.js';
import { redisConnection } from './shared/redis/index.js';
import { initWorkers } from './workers/index.js';

const startWorker = async () => {
  try {
    await redisConnection.connect().catch((err) => {
      logger.warn({ err }, 'Redis connection warning during worker startup');
    });

    const workers = initWorkers();
    logger.info('College Gym Background Worker initialized with BullMQ queues.');

    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down worker...`);
      for (const worker of workers) {
        await worker.close();
      }
      await redisConnection.quit();
      logger.info('Worker shutdown complete.');
      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (err) {
    logger.fatal({ err }, 'Fatal error starting background worker');
    process.exit(1);
  }
};

startWorker();
