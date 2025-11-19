'use client';

import { NotificationBell } from '@/components/notifications/notification-bell';

export function DashboardHeader() {
  return (
    <div className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4">
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <NotificationBell />
      </div>
    </div>
  );
}
