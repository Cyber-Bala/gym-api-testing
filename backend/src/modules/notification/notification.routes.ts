import { Router } from 'express';
import { getMyNotifications, subscribeToPush } from './notification.controller.js';
import { requireAuth } from '../auth/auth.middleware.js';

export const notificationRouter = Router();

notificationRouter.use(requireAuth);

notificationRouter.get('/', getMyNotifications);
notificationRouter.post('/push-subscribe', subscribeToPush);
