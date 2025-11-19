'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Bell, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { useNotifications, useMarkNotificationAsRead, type Notification } from '@/hooks/react-query/notifications/use-notifications';
import { cn } from '@/lib/utils';

// Helper function to group notifications by date
function groupNotificationsByDate(notifications: Notification[]): Record<string, Notification[]> {
  const groups: Record<string, Notification[]> = {
    'Today': [],
    'Yesterday': [],
    'Last 7 days': [],
    'Last 30 days': [],
    'Older': [],
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const last7Days = new Date(today);
  last7Days.setDate(last7Days.getDate() - 7);
  const last30Days = new Date(today);
  last30Days.setDate(last30Days.getDate() - 30);

  notifications.forEach((notification) => {
    const notificationDate = new Date(notification.created_at);

    if (notificationDate >= today) {
      groups['Today'].push(notification);
    } else if (notificationDate >= yesterday) {
      groups['Yesterday'].push(notification);
    } else if (notificationDate >= last7Days) {
      groups['Last 7 days'].push(notification);
    } else if (notificationDate >= last30Days) {
      groups['Last 30 days'].push(notification);
    } else {
      groups['Older'].push(notification);
    }
  });

  // Remove empty groups
  Object.keys(groups).forEach((key) => {
    if (groups[key].length === 0) {
      delete groups[key];
    }
  });

  return groups;
}

// Date group header component
const DateGroupHeader: React.FC<{ dateGroup: string; count: number }> = ({ dateGroup, count }) => {
  return (
    <div className="py-2 mt-4 first:mt-2">
      <div className="text-xs font-medium text-muted-foreground pl-2.5">
        {dateGroup}
      </div>
    </div>
  );
};

// Notification list item component
const NotificationListItem: React.FC<{ notification: Notification }> = ({ notification }) => {
  const router = useRouter();
  const markAsRead = useMarkNotificationAsRead();

  const handleClick = () => {
    // Mark as read if unread
    if (!notification.is_read) {
      markAsRead.mutate({ notificationIds: [notification.id] });
    }

    // Navigate to thread if available
    if (notification.thread_id) {
      router.push(`/projects/${notification.thread_id}/thread`);
    }
  };

  // Get notification type color
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      case 'warning':
        return 'text-yellow-500';
      case 'agent_complete':
        return 'text-blue-500';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'mb-2 cursor-pointer transition-colors',
        notification.is_read ? 'opacity-60' : 'opacity-100'
      )}
    >
      <SpotlightCard>
        <div className="p-3">
          <div className="flex items-start gap-2">
            <Bell className={cn('h-4 w-4 mt-0.5 flex-shrink-0', getTypeColor(notification.type))} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={cn(
                  'text-sm truncate',
                  notification.is_read ? 'font-normal' : 'font-semibold'
                )}>
                  {notification.title}
                </p>
                {!notification.is_read && (
                  <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0" />
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                {notification.message}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(notification.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </SpotlightCard>
    </div>
  );
};

// Loading state component
const LoadingState = () => (
  <div className="flex items-center justify-center p-8">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

// Empty state component
const EmptyState = () => (
  <div className="flex flex-col items-center justify-center p-8 text-center">
    <Bell className="h-12 w-12 text-muted-foreground opacity-50 mb-3" />
    <p className="text-sm font-medium text-muted-foreground">No notifications</p>
    <p className="text-xs text-muted-foreground mt-1">
      You're all caught up!
    </p>
  </div>
);

// Main NavInbox component
export function NavInbox() {
  const { data, isLoading } = useNotifications({
    page: 1,
    page_size: 50,
  });

  const groupedNotifications = useMemo(() => {
    if (!data?.notifications) return {};
    return groupNotificationsByDate(data.notifications);
  }, [data?.notifications]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (!data?.notifications?.length) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-2.5 py-3 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Inbox</h3>
          <Link href="/notifications">
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              View All <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
        {data.unread_count > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {data.unread_count} unread
          </p>
        )}
      </div>

      {/* Scrollable notification list */}
      <div className="flex-1 overflow-y-auto px-2.5">
        {Object.entries(groupedNotifications).map(([dateGroup, notifications]) => (
          <div key={dateGroup}>
            <DateGroupHeader dateGroup={dateGroup} count={notifications.length} />
            {notifications.map((notification) => (
              <NotificationListItem key={notification.id} notification={notification} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
