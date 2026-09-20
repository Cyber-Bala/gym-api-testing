import { eq, or, isNull, desc } from 'drizzle-orm';
import { db } from '../../shared/database/index.js';
import { logger } from '../../shared/logging/index.js';
import { notificationLogs, pushSubscriptions } from '../../db/schema/notification.js';
import { NotificationLogItem, PushSubscriptionDto } from './notification.types.js';
import { sseService } from '../sse/sse.service.js';

export class NotificationService {
  /**
   * Log an event notification in the database
   */
  public async logNotification(params: {
    accountId?: string | null;
    title: string;
    body: string;
    eventType: string;
  }): Promise<void> {
    try {
      const [loggedNotif] = await db.insert(notificationLogs).values({
        accountId: params.accountId || null,
        title: params.title,
        body: params.body,
        eventType: params.eventType,
        status: 'sent',
      }).returning();
      logger.info({ eventType: params.eventType, title: params.title }, 'Notification logged');

      // Emit over SSE in real-time
      if (params.accountId) {
        sseService.sendToUser(params.accountId, 'new_notification', {
          id: loggedNotif.id,
          title: params.title,
          body: params.body,
          eventType: params.eventType,
          status: 'delivered',
          createdAt: loggedNotif.createdAt,
        });
      }

    } catch (err) {
      logger.error({ err }, 'Failed to log notification');
    }
  }

  /**
   * Fetch recent notifications for an account
   */
  public async getUserNotifications(accountId: string, limit = 20): Promise<NotificationLogItem[]> {
    const logs = await db
      .select()
      .from(notificationLogs)
      .where(
        or(
          eq(notificationLogs.accountId, accountId),
          isNull(notificationLogs.accountId)
        )
      )
      .orderBy(desc(notificationLogs.createdAt))
      .limit(limit);

    // If no notifications exist yet, synthesize institutional welcome notifications
    if (logs.length === 0) {
      return [
        {
          id: 'welcome-01',
          accountId,
          title: 'Welcome to REC College Gym Portal',
          body: 'Book your daily slots up to 3 days in advance and check-in smoothly via face biometrics.',
          eventType: 'system_announcement',
          status: 'sent',
          createdAt: new Date().toISOString(),
          read: false,
        },
        {
          id: 'guideline-02',
          accountId,
          title: 'Gym Floor Guidelines & Timings',
          body: 'Morning slots: 06:00 - 10:00. Evening slots: 16:00 - 20:00. Please wear proper gym attire.',
          eventType: 'facility_info',
          status: 'sent',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          read: false,
        },
      ];
    }

    return logs.map((l) => ({
      id: l.id,
      accountId: l.accountId,
      title: l.title,
      body: l.body,
      eventType: l.eventType,
      status: l.status,
      createdAt: l.createdAt.toISOString(),
      read: false,
    }));
  }

  /**
   * Save Web Push subscription
   */
  public async registerPushSubscription(
    accountId: string,
    sub: PushSubscriptionDto
  ): Promise<{ success: boolean }> {
    try {
      await db.insert(pushSubscriptions).values({
        accountId,
        endpoint: sub.endpoint,
        keys: sub.keys,
        userAgent: sub.userAgent || 'Browser',
      });
      return { success: true };
    } catch (err) {
      logger.error({ err }, 'Failed to register push subscription');
      return { success: false };
    }
  }
}

export const notificationService = new NotificationService();
