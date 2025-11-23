'use client';

import React from 'react';
import { Info, CheckCircle2, AlertCircle, XCircle, CheckCheck, MoreHorizontal, Trash2 } from 'lucide-react';
import { useMarkNotificationAsRead, useDeleteNotification } from '@/hooks/react-query/notifications/use-notifications';
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

export function NotificationItem({ notification, onClick }: { notification: Notification; onClick: () => void }) {
  const markAsRead = useMarkNotificationAsRead();
  const deleteNotification = useDeleteNotification();
  const Icon = typeIcons[notification.type] || Info;
  const notificationDate = new Date(notification.created_at);

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
      className={cn(
        'group flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors border-b last:border-b-0 relative',
        !notification.is_read && 'bg-muted/20'
      )}
      onClick={onClick}
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

      {/* Time */}
      <div className="flex-shrink-0 w-20 text-right group-hover:opacity-0 transition-opacity">
        <p className="text-xs text-muted-foreground">
          {formatNotificationTime(notificationDate)}
        </p>
      </div>

      {/* Actions (visible on hover, replaces time) */}
      <div className="absolute right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded-md pl-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={handleToggleRead}
          title={notification.is_read ? "Mark as unread" : "Mark as read"}
        >
          {notification.is_read ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <div className="h-3 w-3 rounded-full border-2 border-current" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={handleDelete}
          title="Delete notification"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground md:hidden">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleToggleRead}>
              {notification.is_read ? 'Mark as unread' : 'Mark as read'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
              Delete notification
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile/Accessible Actions Menu (Always visible on mobile, or focusable) */}
      <div className="md:hidden absolute right-2 top-1/2 -translate-y-1/2">
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
            <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
              Delete notification
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

