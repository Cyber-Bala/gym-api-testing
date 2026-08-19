import { Queue } from 'bullmq';
import { redisConnection } from '../shared/redis/index.js';

export const QUEUES = {
  EXCEL_PROCESS: 'excel.process',
  NOTIFICATION_PUSH: 'notification.push',
  FACE_SYNC: 'face.sync',
  REPORT_GENERATE: 'report.generate',
  ARCHIVE_MOVE: 'archive.move',
} as const;

export const excelQueue = new Queue(QUEUES.EXCEL_PROCESS, { connection: redisConnection });
export const notificationQueue = new Queue(QUEUES.NOTIFICATION_PUSH, { connection: redisConnection });
export const faceSyncQueue = new Queue(QUEUES.FACE_SYNC, { connection: redisConnection });
export const reportQueue = new Queue(QUEUES.REPORT_GENERATE, { connection: redisConnection });
export const archiveQueue = new Queue(QUEUES.ARCHIVE_MOVE, { connection: redisConnection });
