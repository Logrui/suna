'use client';

import React from 'react';
import { NotificationList } from '@/components/notifications/notification-list';
import { useNotifications } from '@/hooks/react-query/notifications/use-notifications';

export default function NotificationsPage() {
  const { data } = useNotifications({ page: 1, page_size: 100 });
  const notifications = data?.notifications || [];
  return (
    <div className="container mx-auto py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Inbox</h1>
      </div>

      {/* Notifications List */}
      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        <NotificationList />
      </div>
    </div>
  );
}


