import http from 'http';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { logger } from './shared/logging/index.js';
import { pool } from './shared/database/index.js';
import { redis } from './shared/redis/index.js';
import { ensureBucketsExist } from './shared/storage/index.js';
import { runMigrations } from './db/migrate.js';
import { schedulerService } from './modules/scheduler/scheduler.service.js';

const startServer = async () => {
  try {
    // Run schema migrations and MinIO bucket setup
    await runMigrations().catch((err) => {
      logger.warn({ err }, 'Migration notice (DB may not be ready yet)');
    });

    await ensureBucketsExist().catch((err) => {
      logger.warn({ err }, 'Storage bucket notice (MinIO may not be ready yet)');
    });

    const app = createApp();
    const server = http.createServer(app);

    server.listen(config.PORT, () => {
      logger.info(
        { port: config.PORT, env: config.NODE_ENV, apiPrefix: config.API_PREFIX },
        `College Gym API Server running at http://localhost:${config.PORT}`
      );
      // Start background automation schedulers
      schedulerService.start();
    });

    const gracefulShutdown = (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown...`);
      schedulerService.stop();
      server.close(async () => {
        logger.info('HTTP server closed.');
        try {
          await pool.end();
          logger.info('PostgreSQL pool disconnected.');
          await redis.quit();
          logger.info('Redis client disconnected.');
        } catch (err) {
          logger.error({ err }, 'Error during resource cleanup');
        }
        process.exit(0);
      });

      // Force exit after 10 seconds if not gracefully closed
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (err) {
    logger.fatal({ err }, 'Fatal error during server startup');
    process.exit(1);
  }
};

startServer();
