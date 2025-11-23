'use client';

import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
    ArrowLeft,
    CheckCircle2,
    Circle,
    Clock,
    Copy,
    Trash2,
    AlertCircle,
    Info,
    CheckCircle,
    AlertTriangle,
    Play
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Notification } from '@/hooks/react-query/notifications/use-notifications';
import { useMarkNotificationAsRead, useDeleteNotification } from '@/hooks/react-query/notifications/use-notifications';
import { SenderIcon } from './sender-icon';
import { useUserProfile } from '@/hooks/react-query/users/use-user-profile';
import { useAgent } from '@/hooks/react-query/agents/use-agents';

interface NotificationDetailsModalProps {
    notification: Notification | null;
    isOpen: boolean;
    onClose: () => void;
    onBack?: () => void;
}

export function NotificationDetailsModal({
    notification,
    isOpen,
    onClose,
    onBack
}: NotificationDetailsModalProps) {
    const markAsRead = useMarkNotificationAsRead();
    const deleteNotification = useDeleteNotification();

    // Fetch sender details if applicable
    const { data: userProfile } = useUserProfile(
        notification?.sender_type === 'user' ? notification.sender_id : undefined
    );

    const { data: agentProfile } = useAgent(
        notification?.sender_type === 'agent' && notification.sender_id ? notification.sender_id : ''
    );

    if (!notification) return null;

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
        onClose();
    };

    const getStatusIcon = (type: string) => {
        switch (type) {
            case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
            case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
            case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
            default: return <Info className="h-4 w-4 text-blue-500" />;
        }
    };

    const getSenderName = () => {
        if (notification.sender_type === 'user') return userProfile?.name || 'User';
        if (notification.sender_type === 'agent') return agentProfile?.name || 'Agent';
        return 'System';
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden h-[80vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-background z-10">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={onBack || onClose} className="gap-1">
                            <ArrowLeft className="h-4 w-4" />
                            Back to Inbox
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleToggleRead}
                            className={cn("gap-2", notification.is_read ? "text-muted-foreground" : "text-primary")}
                        >
                            {notification.is_read ? (
                                <>
                                    <CheckCircle2 className="h-4 w-4" />
                                    Mark as Unread
                                </>
                            ) : (
                                <>
                                    <Circle className="h-4 w-4" />
                                    Mark as Read
                                </>
                            )}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={handleDelete} className="text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Status Bar */}
                <div className="flex items-center gap-2 px-6 py-2 bg-muted/30 border-b text-sm">
                    {getStatusIcon(notification.type)}
                    <span className="font-medium capitalize">{notification.type}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">
                        {notification.category || 'General Notification'}
                    </span>
                </div>

                <ScrollArea className="flex-1">
                    <div className="p-6 space-y-6">
                        {/* Title Section */}
                        <div>
                            <h2 className="text-2xl font-semibold tracking-tight mb-2">
                                {notification.title}
                            </h2>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                <span>
                                    Created on {new Date(notification.created_at).toLocaleDateString(undefined, {
                                        weekday: 'short',
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: 'numeric',
                                        minute: 'numeric'
                                    })}
                                </span>
                                <span>({formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })})</span>
                            </div>
                        </div>

                        {/* Content Card */}
                        <div className="border rounded-lg p-4 bg-card shadow-sm space-y-4">
                            <div className="flex items-center justify-between text-sm text-muted-foreground border-b pb-3">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-foreground">From:</span>
                                    <div className="flex items-center gap-2">
                                        <SenderIcon
                                            senderType={notification.sender_type as any}
                                            senderId={notification.sender_id}
                                            size="sm"
                                        />
                                        <span className="font-medium text-foreground">
                                            {getSenderName()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="prose prose-sm dark:prose-invert max-w-none">
                                <p className="whitespace-pre-wrap">{notification.message}</p>
                            </div>
                        </div>

                        {/* Timeline / Workflow History Placeholder - Only show for relevant notifications */}
                        {(notification.category === 'agent' || notification.category === 'workflow' || notification.agent_run_id || notification.thread_id) && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                    Run History
                                </h3>

                                <div className="border rounded-lg divide-y">
                                    {/* Trigger Step - Only show if we have category info */}
                                    {notification.category && (
                                        <div className="p-3 flex items-center gap-3 bg-muted/10">
                                            <div className="h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                                <Play className="h-3 w-3" />
                                            </div>
                                            <div className="flex-1 text-sm">
                                                <span className="font-medium">Triggered by {notification.category}</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Inputs Step */}
                                    <div className="p-3 space-y-2">
                                        <div className="flex items-center gap-3">
                                            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                                                <span className="text-xs font-mono">IN</span>
                                            </div>
                                            <span className="text-sm font-medium">Inputs</span>
                                        </div>

                                        <div className="pl-9 space-y-1">
                                            {notification.thread_id && (
                                                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground group">
                                                    <span>thread_id:</span>
                                                    <span className="text-foreground">{notification.thread_id}</span>
                                                    <Button variant="ghost" size="icon" className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            )}
                                            {notification.agent_run_id && (
                                                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground group">
                                                    <span>run_id:</span>
                                                    <span className="text-foreground">{notification.agent_run_id}</span>
                                                    <Button variant="ghost" size="icon" className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Step Placeholder */}
                                    <div className="p-3 flex items-center justify-between bg-muted/5">
                                        <div className="flex items-center gap-3">
                                            <div className="h-6 w-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400">
                                                <CheckCircle2 className="h-3 w-3" />
                                            </div>
                                            <span className="text-sm font-medium">Notification Sent</span>
                                        </div>
                                        <Badge variant="secondary" className="text-xs font-mono">
                                            ~150 tokens
                                        </Badge>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
