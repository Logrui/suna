'use client';

// ============================================================================
// TEMPORARY DISABLED VERSION
// ============================================================================
// The original nav-inbox.tsx has been disabled because it depends on modules
// that don't exist yet:
//   - @/hooks/react-query/notifications/use-notifications
//   - @/components/notifications/sender-icon
//   - @/components/notifications/notification-details-modal
//
// The original implementation is preserved in nav-inbox.tsx.disabled
// Restore it once the notification system is fully implemented.
// ============================================================================

import { Bell, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Placeholder NavInbox component - returns a simple "coming soon" state
export function NavInbox() {
    return (
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

            {/* Coming Soon State */}
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] p-8 text-center">
                <Bell className="h-12 w-12 text-muted-foreground opacity-50 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Notifications</p>
                <p className="text-xs text-muted-foreground mt-1">
                    Coming soon
                </p>
            </div>
        </div>
    );
}
