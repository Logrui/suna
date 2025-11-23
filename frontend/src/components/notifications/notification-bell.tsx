'use client';

import React from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/react-query/notifications/use-notifications';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationList } from './notification-list';

export function NotificationBell() {
  const { data, isLoading } = useNotifications({ page: 1, page_size: 10, is_read: false });

  // Get unread count from response (now properly calculated by backend)
  const unreadCount = data?.unread_count ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-blue-500" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[500px] overflow-hidden p-0">
        <NotificationList />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
