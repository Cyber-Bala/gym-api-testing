import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env from root or local
dotenv.config({ path: '../.env' });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost'),
  TIMEZONE: z.string().default('Asia/Kolkata'),

  // PostgreSQL
  DATABASE_URL: z.string().default('postgresql://gym_user:gym_password@localhost:5432/gym_db'),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),

  // MinIO
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: z.string().transform((v) => v === 'true').default('false'),
  MINIO_ACCESS_KEY: z.string().default('gym_minio_admin'),
  MINIO_SECRET_KEY: z.string().default('gym_minio_secret'),
  MINIO_BUCKET_UPLOADS: z.string().default('gym-uploads'),
  MINIO_BUCKET_REPORTS: z.string().default('gym-reports'),
  MINIO_BUCKET_ARCHIVE: z.string().default('gym-archive'),

  // Sessions & Auth
  SESSION_SECRET: z.string().default('dev_session_secret_replace_in_production_32chars'),
  ALLOW_DEV_LOGIN: z.string().transform((v) => v === 'true' || v === '1').default('true'),
  GOOGLE_CLIENT_ID: z.string().default('placeholder_client_id'),
  GOOGLE_CLIENT_SECRET: z.string().default('placeholder_client_secret'),
  GOOGLE_REDIRECT_URI: z.string().default('http://localhost:4000/api/v1/auth/google/callback'),

  // PayU Payment Gateway
  PAYU_MERCHANT_KEY: z.string().default('placeholder_payu_key'),
  PAYU_MERCHANT_SALT: z.string().default('placeholder_payu_salt'),
  PAYU_VERIFICATION_SALT: z.string().default(''),
  PAYU_ENV: z.enum(['TEST', 'PRODUCTION']).default('TEST'),
  PAYU_BASE_URL: z.string().default('https://test.payu.in/_payment'),
  PAYU_BACKEND_URL: z.string().default('http://localhost:4000'),
  FRONTEND_URL: z.string().default('http://localhost:5173'),

  // Access WebSocket
  ACCESS_WS_PORT: z.coerce.number().default(4001),
  ACCESS_DEVICE_TOKEN: z.string().default('dev_access_device_token_secret'),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('Invalid environment variables:', parsedEnv.error.format());
  process.exit(1);
}

export const config = parsedEnv.data;
export type Config = typeof config;
