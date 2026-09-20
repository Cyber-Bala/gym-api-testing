import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config/index.js';
import { correlationIdMiddleware, requestLoggerMiddleware, errorHandlerMiddleware } from './shared/middleware/index.js';
import { healthRouter } from './modules/health/health.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { peopleRouter } from './modules/people/people.routes.js';
import { bookingRouter } from './modules/booking/booking.routes.js';
import { accessRouter } from './modules/access/access.routes.js';
import { violationsRouter } from './modules/violations/violations.routes.js';
import { membershipRouter } from './modules/membership/membership.routes.js';
import { paymentRouter } from './modules/payment/payment.routes.js';
import { trainerRouter } from './modules/trainer/trainer.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { biometricsRouter } from './modules/biometrics/biometrics.routes.js';
import { floorRouter } from './modules/floor/floor.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { conflictsRouter } from './modules/conflicts/conflicts.routes.js';
import { archiveRouter } from './modules/archive/archive.routes.js';
import { integrationRouter } from './modules/integration/integration.routes.js';
import { notificationRouter } from './modules/notification/notification.routes.js';
import { sseRouter } from './modules/sse/sse.routes.js';
import { schedulerRouter } from './modules/scheduler/scheduler.routes.js';
import { NotFoundError } from './shared/errors/index.js';

export const createApp = (): Express => {
  const app = express();

  // Security headers & CORS
  app.use(helmet());
  app.use(
    cors({
      origin: config.CORS_ORIGIN.split(','),
      credentials: true,
    })
  );

  // Parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Tracing & Logging
  app.use(correlationIdMiddleware);
  app.use(requestLoggerMiddleware);

  // Health checks
  app.use('/health', healthRouter);
  app.use(`${config.API_PREFIX}/health`, healthRouter);

  // Core domain routes
  app.use(`${config.API_PREFIX}/auth`, authRouter);
  app.use(`${config.API_PREFIX}/people`, peopleRouter);
  app.use(`${config.API_PREFIX}/booking`, bookingRouter);
  app.use(`${config.API_PREFIX}/access`, accessRouter);
  app.use(`${config.API_PREFIX}/notifications`, notificationRouter);
  app.use(`${config.API_PREFIX}/sse`, sseRouter);
  app.use(`${config.API_PREFIX}/membership`, membershipRouter);
  app.use(`${config.API_PREFIX}/payment`, paymentRouter);
  app.use(`${config.API_PREFIX}/trainer`, trainerRouter);
  app.use(`${config.API_PREFIX}/admin`, adminRouter);
  app.use(`${config.API_PREFIX}/biometrics`, biometricsRouter);
  app.use(`${config.API_PREFIX}/violations`, violationsRouter);
  app.use(`${config.API_PREFIX}/floor`, floorRouter);
  app.use(`${config.API_PREFIX}/reports`, reportsRouter);
  app.use(`${config.API_PREFIX}/conflicts`, conflictsRouter);
  app.use(`${config.API_PREFIX}/archive`, archiveRouter);
  app.use(`${config.API_PREFIX}/integration`, integrationRouter);
  app.use(`${config.API_PREFIX}/scheduler`, schedulerRouter);
  app.use(`${config.API_PREFIX}/admin/scheduler`, schedulerRouter);

  // 404 Handler for undefined routes
  app.use('*', (req, _res, next) => {
    next(new NotFoundError(`Cannot ${req.method} ${req.originalUrl}`));
  });

  // Global Error Handler
  app.use(errorHandlerMiddleware);

  return app;
};
