'use client';

import React from 'react';
import { Bell, ExternalLink, Check, Circle, Archive, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/components/AuthProvider';
import { NovuProvider, useNotifications, useNovu, useCounts } from '@novu/react';
import { cn } from '@/lib/utils';
import { UnifiedMarkdown } from '@/components/markdown';
import { useAnnouncementStore, AnnouncementData } from '@/stores/announcement-store';

// Types for Novu notifications
type ChannelType = 'in_app' | 'email' | 'sms' | 'push' | 'chat';

type Redirect = {
    url: string;
    target?: '_blank' | '_self';
};

type Action = {
    label: string;
    url?: string;
    isCompleted?: boolean;
};

type Workflow = {
    id: string;
    identifier: string;
    name: string;
};

type Subscriber = {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    avatar?: string;
};

type Notification = {
    id: string;
    body: string;
    redirect?: Redirect;
    primaryAction?: Action;
    secondaryAction?: Action;
    channelType: ChannelType;
    data?: Record<string, unknown>;
    to: Subscriber;
    subject?: string;
    isRead: boolean;
    isSeen: boolean;
    isArchived: boolean;
    isSnoozed: boolean;
    readAt?: string | null;
    archivedAt?: string | null;
    avatar?: string;
    tags?: string[];
    workflow: Workflow;
    deliveredAt: string | null;
    firstSeenAt: string | null;
    updatedAt: string;
    createdAt: string;
    read: () => Promise<void>;
    unread: () => Promise<void>;
    archive: () => Promise<void>;
    unarchive: () => Promise<void>;
};

// Helper function for relative time
const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
};

// Individual notification item component
function NotificationItem({
    notification,
    onNavigate
}: {
    notification: Notification;
    onNavigate?: () => void;
}) {
    const { openAnnouncement } = useAnnouncementStore();

    const handleNavigation = (url: string, target?: '_blank' | '_self' | '_parent' | '_top') => {
        // Handle internal announcement URLs
        if (url.startsWith('/internal/announcement')) {
            const data = notification.data as unknown as AnnouncementData | undefined;
            if (data?.component) {
                openAnnouncement(data);
            }
            return;
        }

        // Handle internal action URLs
        if (url.startsWith('/internal/action/')) {
            const actionType = url.replace('/internal/action/', '');
            console.log('Trigger action:', actionType, notification.data);
            return;
        }

        // Handle external URLs
        if (url.startsWith('http://') || url.startsWith('https://')) {
            window.open(url, target || '_blank');
            return;
        }

        // Handle internal navigation
        window.location.href = url;
        onNavigate?.();
    };

    const handleClick = async () => {
        // Mark as read when clicked
        if (!notification.isRead) {
            await notification.read();
        }

        if (notification.redirect?.url) {
            handleNavigation(notification.redirect.url, notification.redirect.target);
        }
    };

    const handlePrimaryAction = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (notification.primaryAction?.url) {
            handleNavigation(notification.primaryAction.url, '_blank');
        }
    };

    const handleSecondaryAction = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (notification.secondaryAction?.url) {
            handleNavigation(notification.secondaryAction.url, '_blank');
        }
    };

    const handleMarkAsRead = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (notification.isRead) {
            await notification.unread();
        } else {
            await notification.read();
        }
    };

    const handleArchive = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (notification.isArchived) {
            await notification.unarchive();
        } else {
            await notification.archive();
        }
    };

    return (
        <div
            onClick={handleClick}
            className={cn(
                "group relative px-3 py-2.5 rounded-xl transition-all cursor-pointer",
                notification.isRead
                    ? "bg-transparent hover:bg-muted/40"
                    : "bg-primary/5 hover:bg-primary/10",
                "border border-transparent hover:border-border/50"
            )}
        >
            <div className="flex gap-2.5">
                {/* Avatar */}
                {notification.avatar && (
                    <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={notification.avatar} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {notification.subject?.charAt(0) || 'N'}
                        </AvatarFallback>
                    </Avatar>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                            {notification.subject && (
                                <h4 className={cn(
                                    "text-sm leading-tight truncate",
                                    notification.isRead ? "font-normal" : "font-medium"
                                )}>
                                    {notification.subject}
                                </h4>
                            )}
                            <div className={cn(
                                "text-xs line-clamp-2 mt-0.5",
                                notification.isRead ? "text-muted-foreground" : "text-foreground/80"
                            )}>
                                <UnifiedMarkdown content={notification.body} />
                            </div>
                        </div>

                        {/* Unread indicator */}
                        {!notification.isRead && (
                            <Circle className="h-2 w-2 fill-primary text-primary flex-shrink-0 mt-1" />
                        )}
                    </div>

                    {/* Metadata row */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-muted-foreground">
                            {getRelativeTime(notification.createdAt)}
                        </span>

                        {notification.tags && notification.tags.length > 0 && (
                            <>
                                <span className="text-muted-foreground text-[10px]">•</span>
                                <div className="flex gap-1 flex-wrap">
                                    {notification.tags.slice(0, 2).map((tag, index) => (
                                        <Badge
                                            key={index}
                                            variant="secondary"
                                            className="text-[10px] px-1.5 py-0 h-4"
                                        >
                                            {tag}
                                        </Badge>
                                    ))}
                                    {notification.tags.length > 2 && (
                                        <Badge
                                            variant="secondary"
                                            className="text-[10px] px-1.5 py-0 h-4"
                                        >
                                            +{notification.tags.length - 2}
                                        </Badge>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Action buttons */}
                    {(notification.primaryAction || notification.secondaryAction) && (
                        <div className="flex gap-1.5 pt-1">
                            {notification.primaryAction && (
                                <Button
                                    size="sm"
                                    variant="default"
                                    className="h-6 text-[10px] px-2"
                                    onClick={handlePrimaryAction}
                                >
                                    {notification.primaryAction.isCompleted && (
                                        <Check className="h-3 w-3 mr-1" />
                                    )}
                                    {notification.primaryAction.label}
                                </Button>
                            )}
                            {notification.secondaryAction && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 text-[10px] px-2"
                                    onClick={handleSecondaryAction}
                                >
                                    {notification.secondaryAction.label}
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {/* Quick action buttons on hover */}
                <div className="absolute right-2 top-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={handleMarkAsRead}
                        title={notification.isRead ? "Mark as unread" : "Mark as read"}
                    >
                        {notification.isRead ? (
                            <Circle className="h-3 w-3" />
                        ) : (
                            <Check className="h-3 w-3" />
                        )}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={handleArchive}
                        title={notification.isArchived ? "Unarchive" : "Archive"}
                    >
                        <Archive className="h-3 w-3" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

// Loading skeleton
function NotificationSkeleton() {
    return (
        <div className="px-3 py-2.5 space-y-2">
            <div className="flex gap-2.5">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/2" />
                </div>
            </div>
        </div>
    );
}

// Empty state component
function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="relative mb-4">
                <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
                    <Bell className="h-8 w-8 text-muted-foreground/50" />
                </div>
                <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary" />
                </div>
            </div>
            <p className="text-sm font-medium text-muted-foreground">Quiet for now</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
                Check back later
            </p>
        </div>
    );
}

// Inner component that uses Novu hooks - only rendered when wrapped by NovuProvider
function NavInboxContent() {
    // Use @novu/react headless hooks
    const { notifications, isLoading, hasMore, fetchMore, refetch } = useNotifications();
    const novu = useNovu();

    // useCounts requires filters - use filter for unread notifications
    const { counts } = useCounts({ filters: [{ read: false }] });

    // Calculate unread count from counts array
    const unreadCount = Array.isArray(counts) && counts.length > 0
        ? counts[0].count
        : 0;

    // Debug logging
    console.log('[NavInbox] State:', {
        isLoading,
        notificationCount: notifications?.length || 0,
        unreadCount,
        hasMore
    });

    const handleMarkAllAsRead = async () => {
        try {
            await novu.notifications.readAll();
            // Refetch to update the UI
            refetch();
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-2.5 py-3 border-b border-border/30">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <h3 className="text-xs font-medium text-muted-foreground pl-0.5">Inbox</h3>
                        {unreadCount > 0 && (
                            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                                {unreadCount}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-0.5">
                        {unreadCount > 0 && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                onClick={handleMarkAllAsRead}
                                title="Mark all as read"
                            >
                                <Check className="h-3 w-3" />
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-foreground"
                            onClick={() => refetch()}
                            title="Refresh"
                        >
                            <RefreshCw className={cn("h-3 w-3", isLoading && "animate-spin")} />
                        </Button>
                        {/*<Link href="/notifications">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                aria-label="View all notifications"
                                title="View all"
                            >
                                <ExternalLink className="h-3 w-3" />
                            </Button>
                        </Link>*/}
                    </div>
                </div>
            </div>

            {/* Notification list or empty state */}
            {!isLoading && (!notifications || notifications.length === 0) ? (
                // Empty state - rendered outside ScrollArea for proper centering
                <div className="flex-1 flex items-center justify-center">
                    <EmptyState />
                </div>
            ) : (
                <ScrollArea className="flex-1">
                    <div className="p-1.5 space-y-1">
                        {isLoading ? (
                            // Loading state
                            <>
                                <NotificationSkeleton />
                                <NotificationSkeleton />
                                <NotificationSkeleton />
                                <NotificationSkeleton />
                                <NotificationSkeleton />
                                <NotificationSkeleton />
                                <NotificationSkeleton />
                                <NotificationSkeleton />
                                <NotificationSkeleton />
                            </>
                        ) : notifications && notifications.length > 0 ? (
                            // Notifications list
                            <>
                                {notifications.map((notification) => (
                                    <NotificationItem
                                        key={notification.id}
                                        notification={notification as unknown as Notification}
                                    />
                                ))}

                                {/* Load more button */}
                                {hasMore && (
                                    <div className="pt-2 pb-1 px-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="w-full h-7 text-xs text-muted-foreground"
                                            onClick={() => fetchMore()}
                                            disabled={isLoading}
                                        >
                                            {isLoading ? (
                                                <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" />
                                            ) : null}
                                            Load more
                                        </Button>
                                    </div>
                                )}
                            </>
                        ) : null}
                    </div>
                </ScrollArea>
            )}
        </div>
    );
}

// Main NavInbox component - handles provider setup like notification-center.tsx
export function NavInbox() {
    const { user } = useAuth();
    const applicationIdentifier = process.env.NEXT_PUBLIC_NOVU_APP_IDENTIFIER;

    // Check if Novu is configured - BEFORE any hook usage
    if (!applicationIdentifier || !user?.id) {
        return (
            <div className="flex flex-col h-full">
                {/* Header */}
                <div className="px-2.5 py-3 border-b border-transparent">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-medium text-muted-foreground pl-0.5">Inbox</h3>
                    </div>
                </div>

                {/* Not configured state */}
                <div className="flex flex-col items-center justify-center h-full min-h-[200px] p-6 text-center">
                    <Bell className="h-10 w-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">Notifications Needs Configurations</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                        NEXT_PUBLIC_NOVU_APP_IDENTIFIER Required
                    </p>
                </div>
            </div>
        );
    }

    // Wrap with NovuProvider from @novu/react (proper headless hooks)
    return (
        <NovuProvider
            applicationIdentifier={applicationIdentifier}
            subscriberId={user.id}
        >
            <NavInboxContent />
        </NovuProvider>
    );
}
