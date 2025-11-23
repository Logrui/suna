'use client';

import React, { useMemo, useState } from 'react';
import { useNotifications, useMarkNotificationAsRead } from '@/hooks/react-query/notifications/use-notifications';
import { NotificationItem } from './notification-item';
import { NotificationDetailsModal } from './notification-details-modal';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { isToday, isYesterday, format, startOfDay, isSameDay } from 'date-fns';
import type { Notification } from '@/hooks/react-query/notifications/use-notifications';

// Group notifications by date
function groupNotificationsByDate(notifications: Notification[]) {
  const groups: Record<string, Notification[]> = {};
  const groupOrder: string[] = [];

  notifications.forEach(notification => {
    const date = new Date(notification.created_at);
    let groupKey: string;

    if (isToday(date)) {
      groupKey = 'Today';
    } else if (isYesterday(date)) {
      groupKey = 'Yesterday';
    } else {
      groupKey = format(date, 'EEE MMM d');
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
      groupOrder.push(groupKey);
    }
    groups[groupKey].push(notification);
  });

  return { groups, groupOrder };
}

export function NotificationList() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const { data, isLoading } = useNotifications({ page: 1, page_size: 100 });
  const markAsRead = useMarkNotificationAsRead();

  const notifications = data?.notifications || [];

  // Filter notifications based on active tab
  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') {
      return notifications.filter(n => !n.is_read);
    }
    return notifications;
  }, [notifications, filter]);

  // Group filtered notifications by date
  const { groups, groupOrder } = useMemo(() =>
    groupNotificationsByDate(filteredNotifications),
    [filteredNotifications]
  );

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleMarkAllAsRead = () => {
    const unreadNotifications = filteredNotifications.filter(n => !n.is_read);
    if (unreadNotifications.length > 0) {
      markAsRead.mutate({
        notificationIds: unreadNotifications.map(n => n.id),
      });
    }
  };

  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  const handleNotificationClick = (notification: Notification) => {
    setSelectedNotification(notification);
    // Mark as read when opening details if not already read
    if (!notification.is_read) {
      markAsRead.mutate({ notificationIds: [notification.id] });
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Loading notifications...
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col max-h-[60vh]">
        {/* Header with Tabs and Actions */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-full">
            <div className="flex items-center justify-between">
              <TabsList className="w-64">
                <TabsTrigger value="all" className="flex-1">
                  All {notifications.length > 0 && `(${notifications.length})`}
                </TabsTrigger>
                <TabsTrigger value="unread" className="flex-1">
                  Unread {unreadCount > 0 && `(${unreadCount})`}
                </TabsTrigger>
              </TabsList>

              {/* Bulk Actions */}
              <div className="flex gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllAsRead}
                    className="text-xs"
                  >
                    Mark all as read
                  </Button>
                )}
              </div>
            </div>
          </Tabs>
        </div>

        {/* Notifications List with Date Grouping */}
        <div className="divide-y overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {filteredNotifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {filter === 'unread' && 'No unread notifications'}
              {filter === 'all' && 'No notifications'}
            </div>
          ) : (
            groupOrder.map(groupKey => (
              <div key={groupKey}>
                {/* Date Header */}
                <div className="px-4 py-2 bg-muted/30 border-b">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {groupKey}
                  </h3>
                </div>

                {/* Notifications in this group */}
                <div>
                  {groups[groupKey].map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onClick={() => handleNotificationClick(notification)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <NotificationDetailsModal
        notification={selectedNotification}
        isOpen={!!selectedNotification}
        onClose={() => setSelectedNotification(null)}
      />
    </>
  );
}
