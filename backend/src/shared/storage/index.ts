import { S3Client, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import { config } from '../../config/index.js';
import { logger } from '../logging/index.js';

export const s3Client = new S3Client({
  endpoint: `${config.MINIO_USE_SSL ? 'https' : 'http'}://${config.MINIO_ENDPOINT}:${config.MINIO_PORT}`,
  region: 'us-east-1',
  credentials: {
    accessKeyId: config.MINIO_ACCESS_KEY,
    secretAccessKey: config.MINIO_SECRET_KEY,
  },
  forcePathStyle: true,
});

export const ensureBucketsExist = async (): Promise<void> => {
  const buckets = [
    config.MINIO_BUCKET_UPLOADS,
    config.MINIO_BUCKET_REPORTS,
    config.MINIO_BUCKET_ARCHIVE,
  ];

  for (const bucket of buckets) {
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: bucket }));
        logger.info({ bucket }, 'Created MinIO bucket');
      } catch (err) {
        logger.error({ bucket, err }, 'Failed to create MinIO bucket');
      }
    }
  }
};

export const checkStorageHealth = async (): Promise<{ status: 'up' | 'down'; latencyMs: number; error?: string }> => {
  const start = Date.now();
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: config.MINIO_BUCKET_UPLOADS }));
    return { status: 'up', latencyMs: Date.now() - start };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { status: 'down', latencyMs: Date.now() - start, error: errorMsg };
  }
};
