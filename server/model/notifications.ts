import { db } from '../db';

export type NotificationRow = {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  resourceType: string | null;
  resourceId: string | null;
  read: boolean;
  createdAt: string;
};

export async function listNotifications(userId: string): Promise<NotificationRow[]> {
  return db.orm.public.Notification
    .select('id', 'userId', 'type', 'title', 'message', 'resourceType', 'resourceId', 'read', 'createdAt')
    .where((n) => n.userId.eq(userId))
    .orderBy((n) => n.createdAt.desc())
    .all();
}

export async function getUnreadCount(userId: string): Promise<number> {
  const count = await db.orm.public.Notification
    .select('id')
    .where((n) => n.userId.eq(userId))
    .where((n) => n.read.eq(false))
    .count();
  return Number(count);
}

export async function markAsRead(notificationId: string): Promise<void> {
  await db.orm.public.Notification
    .where((n) => n.id.eq(notificationId))
    .update({ read: true });
}

export async function markAllAsRead(userId: string): Promise<void> {
  await db.orm.public.Notification
    .where((n) => n.userId.eq(userId))
    .update({ read: true });
}
