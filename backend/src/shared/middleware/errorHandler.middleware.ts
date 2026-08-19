import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AppError } from '../errors/index.js';
import { logger } from '../logging/index.js';
import { config } from '../../config/index.js';

export const errorHandlerMiddleware: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  const correlationId = req.correlationId || 'unknown';

  const isAppError = err instanceof AppError || (err && typeof (err as any).statusCode === 'number' && (err as any).isOperational === true);

  if (isAppError) {
    const appErr = err as AppError;
    logger.warn({
      correlationId,
      code: appErr.code || 'OPERATIONAL_ERROR',
      message: appErr.message,
      statusCode: appErr.statusCode || 400,
      details: appErr.details,
    }, `Operational error: ${appErr.message}`);

    res.status(appErr.statusCode || 400).json({
      success: false,
      error: {
        code: appErr.code || 'OPERATIONAL_ERROR',
        message: appErr.message,
        details: appErr.details,
        correlationId,
      },
    });
    return;
  }

  // Unhandled / Internal Server Error
  logger.error({
    correlationId,
    err: {
      message: err.message,
      stack: err.stack,
    },
  }, `Unhandled system error: ${err.message}`);

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: config.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
      correlationId,
      ...(config.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
};
