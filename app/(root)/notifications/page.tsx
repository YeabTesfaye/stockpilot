'use client';

import * as React from 'react';
import { Bell, CheckCheck, Eye } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  resourceType: string | null;
  resourceId: string | null;
  read: boolean;
  createdAt: string;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchNotifications();
  }, []);

  async function fetchNotifications() {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) throw new Error('Failed to load notifications');
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        title="Notifications"
        description="In-app alerts for low stock, out-of-stock, and reorder-point warnings triggered by the rules engine."
        actions={
          unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="mr-1 h-4 w-4" />
              Mark all read ({unreadCount})
            </Button>
          )
        }
      />

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-lg border border-zinc-200 p-4 dark:border-neutral-800">
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-lg border border-dashed border-muted bg-muted/30 p-8 text-center">
          <Bell className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">No notifications.</p>
          <p className="text-xs text-muted-foreground mt-1">
            The rules engine will create notifications when stock levels trigger alerts.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card
              key={n.id}
              className={`overflow-hidden ${n.read ? '' : 'border-l-4 border-l-primary'}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className={`flex-1 ${n.read ? '' : 'font-medium'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm capitalize">{n.type.replace(/_/g, ' ')}</span>
                      {!n.read && <Eye className="h-3.5 w-3.5 text-primary" />}
                    </div>
                    <h3 className={`text-sm mt-0.5 ${n.read ? 'text-muted-foreground' : ''}`}>
                      {n.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
