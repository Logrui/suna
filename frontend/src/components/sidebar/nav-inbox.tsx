'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Bell, ExternalLink, Trash2, CheckCircle2, Circle, MoreHorizontal } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { useNotifications, useMarkNotificationAsRead, useDeleteNotification } from '@/hooks/react-query/notifications/use-notifications';
import type { Notification } from '@/hooks/react-query/notifications/use-notifications';
import { SenderIcon } from '@/components/notifications/sender-icon';
import { cn } from '@/lib/utils';
import { NotificationDetailsModal } from '@/components/notifications/notification-details-modal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
    <div className="py-2 mt-4 first:mt-2 px-2.5">
      <div className="text-xs font-medium text-muted-foreground pl-2.5">
        {dateGroup}
      </div>
    </div>
  );
};

// Notification list item component
const NotificationListItem: React.FC<{
  notification: Notification;
  onClick: () => void;
}> = ({ notification, onClick }) => {
  const markAsRead = useMarkNotificationAsRead();
  const deleteNotification = useDeleteNotification();

  const handleToggleRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    markAsRead.mutate({
      notificationIds: [notification.id],
      isRead: !notification.is_read
    });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteNotification.mutate([notification.id]);
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative mb-1.5 cursor-pointer transition-colors px-2.5',
        notification.is_read ? 'opacity-60 hover:opacity-100' : 'opacity-100'
      )}
    >
      <SpotlightCard>
        <div className="p-2">
          <div className="flex items-start gap-2">
            <SenderIcon
              senderType={notification.sender_type}
              senderId={notification.sender_id}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={cn(
                  'text-sm truncate pr-16', // Add padding for actions
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
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(notification.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </SpotlightCard>

      {/* Actions (visible on hover) */}
      <div className="absolute right-4 top-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded-md pl-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={handleToggleRead}
          title={notification.is_read ? "Mark as unread" : "Mark as read"}
        >
          {notification.is_read ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <div className="h-2.5 w-2.5 rounded-full border-2 border-current" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-destructive"
          onClick={handleDelete}
          title="Delete notification"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

// Loading skeleton - matches Knowledge Base pattern
const LoadingSkeleton = () => (
  <div className="space-y-2 px-2.5">
    {Array.from({ length: 7 }).map((_, index) => (
      <div key={`skeleton-${index}`} className="flex items-start gap-2 p-3">
        <div className="h-4 w-4 bg-muted rounded-full animate-pulse flex-shrink-0 mt-0.5"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
          <div className="h-3 bg-muted/60 rounded w-full animate-pulse"></div>
          <div className="h-3 bg-muted/60 rounded w-1/2 animate-pulse"></div>
        </div>
      </div>
    ))}
  </div>
);

// Empty state component - needs to be in a flex container
const EmptyState = () => (
  <div className="flex flex-col items-center justify-center h-full min-h-[300px] p-8 text-center">
    <Bell className="h-12 w-12 text-muted-foreground opacity-50 mb-3" />
    <p className="text-sm font-medium text-muted-foreground">No notifications</p>
    <p className="text-xs text-muted-foreground mt-1">
      You're all caught up!
    </p>
  </div>
);

// Main NavInbox component
export function NavInbox() {
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const markAsRead = useMarkNotificationAsRead();

  const { data, isLoading } = useNotifications({
    page: 1,
    page_size: 50,
  });

  const groupedNotifications = useMemo(() => {
    if (!data?.notifications) return {};
    return groupNotificationsByDate(data.notifications);
  }, [data?.notifications]);

  const handleNotificationClick = (notification: Notification) => {
    setSelectedNotification(notification);
    if (!notification.is_read) {
      markAsRead.mutate({ notificationIds: [notification.id] });
    }
  };

  // Render loading skeleton
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-2.5 py-3 border-b border-transparent">
          <h3 className="text-xs font-medium text-muted-foreground pl-0.5">Inbox</h3>
        </div>
        {/* Loading skeleton */}
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  // Render empty state
  if (!data?.notifications?.length) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-2.5 py-3 border-b border-transparent">
          <h3 className="text-xs font-medium text-muted-foreground pl-0.5">Inbox</h3>
        </div>
        {/* Empty state - flex-1 allows it to take remaining space and center */}
        <div className="flex-1">
          <EmptyState />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-2.5 py-3 border-b border-transparent">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-muted-foreground pl-0.5">Inbox</h3>
            <Link href="/notifications">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                aria-label="View all notifications"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Scrollable notification list - Removed px-2.5 to make full width, added padding to items instead */}
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
          {Object.entries(groupedNotifications).map(([dateGroup, notifications]) => (
            <div key={dateGroup}>
              <DateGroupHeader dateGroup={dateGroup} count={notifications.length} />
              {notifications.map((notification) => (
                <NotificationListItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => handleNotificationClick(notification)}
                />
              ))}
            </div>
          ))}
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
