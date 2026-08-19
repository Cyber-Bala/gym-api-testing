export interface NotificationLogItem {
  id: string;
  accountId: string | null;
  title: string;
  body: string;
  eventType: string;
  status: string;
  createdAt: string;
  read?: boolean;
}

export interface PushSubscriptionDto {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
}
