'use client';

import { useState, useEffect } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchNotifications();
  }, [open]);

  async function fetchNotifications() {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications.slice(0, 10));
        setUnreadCount(data.unreadCount);
      }
    } catch { /* silent */ }
    finally {
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
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge variant="secondary" className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={markAllRead}>
              <CheckCheck className="mr-1 h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              Loading...
            </div>
          )}
          {!loading && notifications.length === 0 && (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              No notifications
            </div>
          )}
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`px-4 py-3 border-b last:border-b-0 ${n.read ? 'opacity-60' : 'bg-accent/30'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`text-xs capitalize ${n.read ? 'text-muted-foreground' : 'font-medium'}`}>
                    {n.type.replace(/_/g, ' ')}
                  </p>
                  <p className="text-sm font-medium mt-0.5 truncate">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        {notifications.length > 0 && (
          <div className="px-4 py-2 border-t text-xs text-muted-foreground text-center">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
