'use client';

import React from 'react';
import { Info, CheckCircle2, AlertCircle, XCircle, CheckCheck, MoreHorizontal } from 'lucide-react';
import { useMarkNotificationAsRead } from '@/hooks/react-query/notifications/use-notifications';
import type { Notification } from '@/hooks/react-query/notifications/use-notifications';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { SenderIcon } from './sender-icon';

interface NotificationItemProps {
  notification: Notification;
}

const typeIcons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertCircle,
  error: XCircle,
  agent_complete: CheckCheck,
};

// Format time intelligently (without "about")
function formatNotificationTime(date: Date): string {
  if (isToday(date)) {
    const distance = formatDistanceToNow(date, { addSuffix: true });
    return distance.replace('about ', '');
  } else if (isYesterday(date)) {
    return 'Yesterday';
  } else {
    return format(date, 'MMM d');
  }
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const markAsRead = useMarkNotificationAsRead();
  const Icon = typeIcons[notification.type] || Info;
  const notificationDate = new Date(notification.created_at);

  const handleToggleRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    markAsRead.mutate({
      notificationIds: [notification.id],
      isRead: !notification.is_read
    });
  };

  const handleClick = () => {
    if (!notification.is_read) {
      markAsRead.mutate({ notificationIds: [notification.id] });
    }
  };

  return (
    <div
      className={cn(
        'group flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors border-b last:border-b-0',
        !notification.is_read && 'bg-muted/20'
      )}
      onClick={handleClick}
    >
      {/* Read/Unread Indicator */}
      <div className="flex-shrink-0 w-2">
        {!notification.is_read && (
          <div className="h-2 w-2 rounded-full bg-blue-500" />
        )}
      </div>

      {/* Sender Icon */}
      <SenderIcon
        senderType={notification.sender_type}
        senderId={notification.sender_id}
        size="md"
      />

      {/* Title */}
      <div className="flex-shrink-0 w-48 min-w-0">
        <p className={cn(
          'text-sm truncate',
          notification.is_read ? 'font-normal text-muted-foreground' : 'font-semibold'
        )}>
          {notification.title}
        </p>
      </div>

      {/* Icon + Snippet */}
      <div className="flex-1 flex items-center gap-3 min-w-0">
        <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <p className="text-sm text-muted-foreground truncate">
          {notification.message}
        </p>
      </div>

      {/* Empty Column (placeholder for future use) */}
      <div className="flex-shrink-0 w-20"></div>

      {/* Time */}
      <div className="flex-shrink-0 w-28 text-right">
        <p className="text-xs text-muted-foreground">
          {formatNotificationTime(notificationDate)}
        </p>
      </div>

      {/* Actions Menu (visible on hover) */}
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleToggleRead}>
              {notification.is_read ? 'Mark as unread' : 'Mark as read'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

