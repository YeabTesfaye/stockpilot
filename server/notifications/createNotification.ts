import { db } from '../db';

export type CreateNotificationInput = {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  resourceType?: string | null;
  resourceId?: string | null;
};

/**
 * Create an in-app notification for a user. Notifications are tenant-scoped
 * and can be marked as read. Used by the rules engine and other parts of the
 * application to alert users about important events.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  await db.orm.public.Notification.create({
    tenantId: input.tenantId,
    userId: input.userId,
    type: input.type,
    title: input.title,
    message: input.message,
    resourceType: input.resourceType ?? null,
    resourceId: input.resourceId ?? null,
    read: false,
  });
}

/**
 * Mark a notification as read.
 */
export async function markNotificationRead(notificationId: string, tenantId: string): Promise<void> {
  await db.orm.public.Notification
    .where((n) => n.id.eq(notificationId))
    .update({ read: true });
}

/**
 * Mark all notifications as read for a user in a tenant.
 */
export async function markAllNotificationsRead(userId: string, tenantId: string): Promise<void> {
  await db.orm.public.Notification
    .where((n) => n.userId.eq(userId))
    .update({ read: true });
}
