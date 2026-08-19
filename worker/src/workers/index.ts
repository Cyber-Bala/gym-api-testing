import { Worker, Job } from 'bullmq';
import { QUEUES } from '../queues/index.js';
import { redisConnection } from '../shared/redis/index.js';
import { logger } from '../shared/logging/index.js';

export const initWorkers = () => {
  const excelWorker = new Worker(
    QUEUES.EXCEL_PROCESS,
    async (job: Job) => {
      logger.info({ jobId: job.id, name: job.name }, 'Processing Excel ingestion job...');
      // Sprint 3: Implement Excel parsing and provisioning
      return { processedRows: 0, status: 'success' };
    },
    { connection: redisConnection }
  );

  const notificationWorker = new Worker(
    QUEUES.NOTIFICATION_PUSH,
    async (job: Job) => {
      logger.info({ jobId: job.id, name: job.name }, 'Sending push notification...');
      // Sprint 9: Implement Web Push sending
      return { delivered: true };
    },
    { connection: redisConnection }
  );

  const faceSyncWorker = new Worker(
    QUEUES.FACE_SYNC,
    async (job: Job) => {
      logger.info({ jobId: job.id, name: job.name }, 'Syncing face enrollment to ZKBio...');
      // Sprint 11: Implement ZKBio sync
      return { synced: true };
    },
    { connection: redisConnection }
  );

  return [excelWorker, notificationWorker, faceSyncWorker];
};
