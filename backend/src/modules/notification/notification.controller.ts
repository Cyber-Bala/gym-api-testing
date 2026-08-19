import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { notificationService } from './notification.service.js';
import { ValidationError } from '../../shared/errors/index.js';

const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export const getMyNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const accountId = req.user?.accountId || 'public';
    const notifications = await notificationService.getUserNotifications(accountId);

    res.status(200).json({
      success: true,
      data: notifications,
    });
  } catch (err) {
    next(err);
  }
};

export const subscribeToPush = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parseResult = pushSubscribeSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new ValidationError('Invalid push subscription payload', parseResult.error.format());
    }

    const accountId = req.user!.accountId;
    await notificationService.registerPushSubscription(accountId, {
      ...parseResult.data,
      userAgent: req.get('user-agent'),
    });

    res.status(200).json({
      success: true,
      message: 'Push subscription registered successfully',
    });
  } catch (err) {
    next(err);
  }
};
