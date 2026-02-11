'use client';

import { cn } from '@/lib/utils';
import { Monitor, Circle, MoreHorizontal, Pencil, Trash2, Loader2 } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { UserBrowser } from '@/hooks/browser/use-user-browsers';

interface BrowserCardProps {
    browser: UserBrowser;
    selected?: boolean;
    onSelect?: () => void;
    onRename?: (browser: UserBrowser) => void;
    onDelete?: (browserId: string) => void;
    isChecking?: boolean;
    className?: string;
}

export function BrowserCard({
    browser,
    selected = false,
    onSelect,
    onRename,
    onDelete,
    isChecking = false,
    className,
}: BrowserCardProps) {
    const isOnline = browser.is_online;

    // Extract browser info - parse user agent if it's the full string
    const browserName = browser.name || 'My Browser';

    // Parse browser type from user agent string or use stored value
    const rawBrowser = browser.browser_info?.browser || 'Chrome';
    const browserType = rawBrowser.includes('Chrome')
        ? 'Chrome'
        : rawBrowser.includes('Firefox')
            ? 'Firefox'
            : rawBrowser.includes('Safari')
                ? 'Safari'
                : rawBrowser.includes('Edge')
                    ? 'Edge'
                    : 'Browser';

    // Parse OS from platform string
    const rawOs = browser.browser_info?.os || 'Unknown';
    const osInfo = rawOs.includes('Win')
        ? 'Windows'
        : rawOs.includes('Mac')
            ? 'macOS'
            : rawOs.includes('Linux')
                ? 'Linux'
                : rawOs;

    // Format last seen
    const lastSeen = browser.last_seen_at
        ? new Date(browser.last_seen_at).toLocaleDateString()
        : 'Never';

    const showMenu = onRename || onDelete;

    return (
        <button
            type="button"
            onClick={onSelect}
            className={cn(
                // Base styles
                'relative w-full text-left rounded-xl border p-4 transition-all overflow-hidden',
                // Glassmorphism
                'bg-background/50 backdrop-blur-sm',
                // Border states
                selected
                    ? 'border-primary/50 ring-1 ring-primary/20'
                    : 'border-border/50 hover:border-border/80',
                // Interactive
                onSelect && 'cursor-pointer',
                className
            )}
        >
            {/* Grain overlay */}
            <div
                className="pointer-events-none absolute inset-0 rounded-xl opacity-5 mix-blend-overlay"
                style={{ backgroundImage: "url('/noise.png')" }}
            />

            <div className="relative z-10 flex items-start justify-between gap-3">
                {/* Left: Icon & Info */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Selection indicator */}
                    <div className={cn(
                        'mt-1 flex h-4 w-4 items-center justify-center rounded-full border flex-shrink-0',
                        selected
                            ? 'border-primary bg-primary'
                            : 'border-muted-foreground/40'
                    )}>
                        {selected && (
                            <div className="h-2 w-2 rounded-full bg-primary-foreground" />
                        )}
                    </div>

                    {/* Browser icon */}
                    <div className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0',
                        isOnline
                            ? 'bg-purple-500/20'
                            : 'bg-muted/50'
                    )}>
                        <Monitor className={cn(
                            'h-5 w-5',
                            isOnline ? 'text-purple-400' : 'text-muted-foreground'
                        )} />
                    </div>

                    {/* Text content */}
                    <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-medium text-sm truncate">{browserName}</span>
                        <span className="text-xs text-muted-foreground truncate">
                            {browserType} • {osInfo}
                        </span>
                        {!isOnline && (
                            <span className="text-xs text-muted-foreground/60">
                                Last seen: {lastSeen}
                            </span>
                        )}
                    </div>
                </div>

                {/* Right: Status + Menu */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Online status */}
                    <div className="flex items-center gap-1.5">
                        {isChecking && !isOnline ? (
                            <>
                                <Loader2 className="h-2.5 w-2.5 animate-spin text-yellow-500" />
                                <span className="text-xs text-yellow-500">Checking...</span>
                            </>
                        ) : (
                            <>
                                <Circle
                                    className={cn(
                                        'h-2.5 w-2.5 fill-current',
                                        isOnline ? 'text-green-500' : 'text-red-400'
                                    )}
                                />
                                <span className={cn(
                                    'text-xs',
                                    isOnline ? 'text-green-500' : 'text-muted-foreground'
                                )}>
                                    {isOnline ? 'Online' : 'Offline'}
                                </span>
                            </>
                        )}
                    </div>

                    {/* Context menu */}
                    {showMenu && (
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 rounded-md hover:bg-muted/50 transition-colors"
                            >
                                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                                {onRename && (
                                    <DropdownMenuItem
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onRename(browser);
                                        }}
                                        className="gap-2"
                                    >
                                        <Pencil className="h-4 w-4" />
                                        Rename
                                    </DropdownMenuItem>
                                )}
                                {onDelete && (
                                    <DropdownMenuItem
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(browser.id);
                                        }}
                                        className="gap-2 text-destructive focus:text-destructive"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Delete
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>
        </button>
    );
}
