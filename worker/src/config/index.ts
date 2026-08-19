import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: '../.env' });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
});

export const config = envSchema.parse(process.env);
