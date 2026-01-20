'use client';

import { useState, memo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Monitor, Globe, ChevronRight } from 'lucide-react';
import { MyBrowserModal } from './my-browser-modal';
import {
    useUserBrowsers,
    useThreadBrowser,
    type UserBrowser,
} from '@/hooks/browser/use-user-browsers';
import { SpotlightCard } from '@/components/ui/spotlight-card';

interface BrowserSelectorProps {
    threadId: string;
    className?: string;
}

/**
 * Self-contained browser selector component.
 * Manages its own modal state and fetches browser data internally.
 * 
 * Renders:
 * - A trigger row (for use in dropdown menus)
 * - The MyBrowserModal (controlled internally)
 */
export const BrowserSelector = memo(function BrowserSelector({
    threadId,
    className,
}: BrowserSelectorProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Fetch current thread's browser selection
    const { data: threadBrowserId } = useThreadBrowser(threadId);

    // Fetch all user browsers to display the selected browser's name
    const { data: browsers } = useUserBrowsers();

    // Find the currently selected browser (if any)
    const selectedBrowser = threadBrowserId
        ? browsers?.find((b) => b.id === threadBrowserId)
        : null;

    const handleOpenModal = useCallback(() => {
        setIsModalOpen(true);
    }, []);

    const handleCloseModal = useCallback((open: boolean) => {
        setIsModalOpen(open);
    }, []);

    // Determine display text
    const displayName = selectedBrowser?.name || 'Sandbox';
    const isOnline = selectedBrowser?.is_online ?? false;
    const isUsingExtension = !!selectedBrowser;

    return (
        <>
            {/* Trigger Row - designed to be placed in dropdown menus */}
            <SpotlightCard className={cn('transition-colors bg-transparent cursor-pointer', className)}>
                <div
                    className="flex items-center gap-3 text-sm px-1 py-1"
                    onClick={handleOpenModal}
                >
                    {/* Icon */}
                    <div className="flex items-center justify-center w-8 h-8 bg-card border-[1.5px] border-border flex-shrink-0" style={{ borderRadius: '10.4px' }}>
                        {isUsingExtension ? (
                            <Monitor className="h-4 w-4 text-purple-400" />
                        ) : (
                            <Globe className="h-4 w-4 text-muted-foreground" />
                        )}
                    </div>

                    {/* Label and status */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="font-medium truncate">Kortix Browser</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="truncate">{displayName}</span>
                            {isUsingExtension && (
                                <>
                                    <span className="text-border">•</span>
                                    <span className={cn(
                                        'flex items-center gap-1',
                                        isOnline ? 'text-emerald-500' : 'text-muted-foreground/60'
                                    )}>
                                        <span className={cn(
                                            'w-1.5 h-1.5 rounded-full',
                                            isOnline ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                                        )} />
                                        {isOnline ? 'Online' : 'Offline'}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Chevron */}
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                </div>
            </SpotlightCard>

            {/* Modal - rendered at this level, controlled by internal state */}
            <MyBrowserModal
                open={isModalOpen}
                onOpenChange={handleCloseModal}
                threadId={threadId}
                currentBrowserId={threadBrowserId ?? null}
            />
        </>
    );
});

export default BrowserSelector;
