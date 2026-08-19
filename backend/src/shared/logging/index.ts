import pino from 'pino';
import { config } from '../../config/index.js';

export const logger = pino({
  level: config.NODE_ENV === 'test' ? 'silent' : config.NODE_ENV === 'development' ? 'debug' : 'info',
  transport:
    config.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  base: {
    service: 'college-gym-api',
    env: config.NODE_ENV,
  },
});

export const createChildLogger = (moduleName: string, extraContext: Record<string, unknown> = {}) => {
  return logger.child({ module: moduleName, ...extraContext });
};
