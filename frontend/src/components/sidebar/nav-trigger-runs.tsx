'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThreadIcon } from './thread-icon';
import { usePathname, useRouter } from 'next/navigation';
import { useSidebar } from '@/components/ui/sidebar';
import { ThreadWithProject, GroupedThreads } from '@/hooks/sidebar/use-sidebar';
import { processThreadsWithProjects, useProjects, useThreads, groupThreadsByDate } from '@/hooks/sidebar/use-sidebar';
import { cn } from '@/lib/utils';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { formatDateForList } from '@/lib/utils/date-formatting';
import { useAllTriggers, type TriggerWithAgent } from '@/hooks/triggers/use-all-triggers';
import { useComposioAppsWithTriggers } from '@/hooks/composio/use-composio-triggers';

// Component for date group headers
const DateGroupHeader: React.FC<{ dateGroup: string; count: number }> = ({ dateGroup, count }) => {
    return (
        <div className="py-2 mt-4 first:mt-2">
            <div className="text-xs font-medium text-muted-foreground pl-2.5">
                {dateGroup}
            </div>
        </div>
    );
};

// Component for individual trigger run item
const TriggerRunItem: React.FC<{
    thread: ThreadWithProject;
    isActive: boolean;
    isThreadLoading: boolean;
    pathname: string | null;
    isMobile: boolean;
    handleThreadClick: (e: React.MouseEvent<HTMLAnchorElement>, threadId: string, url: string) => void;
    composioAppLogo?: string;
}> = ({ thread, isActive, isThreadLoading, handleThreadClick, isMobile, composioAppLogo }) => {
    return (
        <SpotlightCard
            className={cn(
                "transition-colors cursor-pointer",
                isActive ? "bg-muted" : "bg-transparent"
            )}
        >
            <a
                href={thread.url}
                onClick={(e) => handleThreadClick(e, thread.threadId, thread.url)}
                className="block"
            >
                <div className="flex items-center gap-3 p-2.5 text-sm">
                    <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-card border-[1.5px] border-border flex-shrink-0">
                        {isThreadLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        ) : composioAppLogo ? (
                            <img src={composioAppLogo} alt="" className="w-5 h-5 object-contain" />
                        ) : (
                            <ThreadIcon
                                iconName={thread.iconName}
                                className="text-muted-foreground"
                                size={16}
                            />
                        )}
                    </div>
                    <span className="flex-1 truncate">{thread.projectName}</span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatDateForList(thread.updatedAt)}
                    </span>
                </div>
            </a>
        </SpotlightCard>
    );
};

export function NavTriggerRuns() {
    const { isMobile, state, setOpenMobile } = useSidebar();
    const [loadingThreadId, setLoadingThreadId] = useState<string | null>(null);
    const pathname = usePathname();
    const router = useRouter();
    const isNavigatingRef = useRef(false);
    const queryClient = useQueryClient();

    const {
        data: projects = [],
        isLoading: isProjectsLoading,
        error: projectsError,
    } = useProjects();

    const {
        data: threadsResponse,
        isLoading: isThreadsLoading,
        error: threadsError,
    } = useThreads();

    const combinedThreads: ThreadWithProject[] =
        !isProjectsLoading && !isThreadsLoading ? processThreadsWithProjects(threadsResponse?.threads || [], projects) : [];

    // Filter only trigger threads (threads with projectName starting with "Trigger: ")
    const triggerThreads = combinedThreads.filter((thread) =>
        thread.projectName?.startsWith('Trigger: ')
    );

    const groupedTriggerThreads: GroupedThreads = groupThreadsByDate(triggerThreads);

    // Fetch triggers and Composio apps data for icons
    const { data: triggersData = [] } = useAllTriggers();
    const { data: composioAppsData } = useComposioAppsWithTriggers();

    // Build lookup map: trigger name -> toolkit slug from qualified_name
    const triggerNameToToolkitSlug = useMemo(() => {
        const map = new Map<string, string>();
        for (const trigger of triggersData) {
            const qualifiedName = trigger.config?.qualified_name;
            if (qualifiedName?.startsWith('composio.')) {
                const slug = qualifiedName.replace('composio.', '').toLowerCase();
                // Map trigger name (lowercased) to slug
                map.set(trigger.name.toLowerCase(), slug);
            }
        }
        return map;
    }, [triggersData]);

    // Build lookup map: toolkit slug -> logo URL
    const composioAppsLogoMap = useMemo(() => {
        const map = new Map<string, string>();
        if (composioAppsData?.items) {
            for (const app of composioAppsData.items) {
                if (app.slug && app.logo) {
                    map.set(app.slug.toLowerCase(), app.logo);
                }
            }
        }
        return map;
    }, [composioAppsData]);

    // Get all known toolkit slugs for fallback matching
    const knownToolkitSlugs = useMemo(() => {
        return Array.from(composioAppsLogoMap.keys());
    }, [composioAppsLogoMap]);

    // Helper to get Composio logo for a thread
    const getComposioLogoForThread = (thread: ThreadWithProject): string | undefined => {
        // projectName format: "Trigger: Gmail → Agent" or "Trigger: TriggerName"
        const projectName = thread.projectName;
        if (!projectName.startsWith('Trigger: ')) return undefined;

        // Extract trigger name (everything after "Trigger: ")
        const triggerNamePart = projectName.replace('Trigger: ', '').toLowerCase();

        // Strategy 1: Try exact match by trigger name
        let toolkitSlug = triggerNameToToolkitSlug.get(triggerNamePart);

        // Strategy 2: Try partial match - check if any trigger name is contained in project name
        if (!toolkitSlug) {
            for (const [name, slug] of triggerNameToToolkitSlug.entries()) {
                if (triggerNamePart.includes(name) || name.includes(triggerNamePart)) {
                    toolkitSlug = slug;
                    break;
                }
            }
        }

        // Strategy 3: Look for known toolkit slugs directly in the project name (e.g., "gmail" in "Gmail Trigger")
        if (!toolkitSlug) {
            for (const slug of knownToolkitSlugs) {
                if (triggerNamePart.includes(slug)) {
                    toolkitSlug = slug;
                    break;
                }
            }
        }

        return toolkitSlug ? composioAppsLogoMap.get(toolkitSlug) : undefined;
    };

    useEffect(() => {
        setLoadingThreadId(null);
    }, [pathname]);

    useEffect(() => {
        const handleNavigationComplete = () => {
            document.body.style.pointerEvents = 'auto';
            isNavigatingRef.current = false;
        };

        window.addEventListener('popstate', handleNavigationComplete);

        return () => {
            window.removeEventListener('popstate', handleNavigationComplete);
            document.body.style.pointerEvents = 'auto';
        };
    }, []);

    useEffect(() => {
        isNavigatingRef.current = false;
        document.body.style.pointerEvents = 'auto';
    }, [pathname]);

    // Function to handle thread click with loading state
    const handleThreadClick = (
        e: React.MouseEvent<HTMLAnchorElement>,
        threadId: string,
        url: string
    ) => {
        // Set loading state for normal clicks (not meta key)
        if (!e.metaKey) {
            setLoadingThreadId(threadId);
        }

        // Close mobile sidebar
        if (isMobile) {
            setOpenMobile(false);
        }
    };

    // Loading state or error handling
    const isLoading = isProjectsLoading || isThreadsLoading;
    const hasError = projectsError || threadsError;

    if (hasError) {
        console.error('Error loading trigger runs:', { projectsError, threadsError });
    }

    return (
        <div>
            {/* Section Header */}
            <div className="px-2.5 py-3 border-b border-transparent">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-medium text-muted-foreground pl-0.5">Trigger Runs</h3>
                    <Link href="/triggers">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-muted-foreground hover:text-foreground"
                            aria-label="View all triggers"
                        >
                            <ExternalLink className="h-3 w-3" />
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="overflow-y-auto max-h-[calc(100vh-480px)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] pb-10">
                {(state !== 'collapsed' || isMobile) && (
                    <>
                        {isLoading ? (
                            // Show skeleton loaders while loading
                            <div className="space-y-1">
                                {Array.from({ length: 3 }).map((_, index) => (
                                    <div key={`skeleton-${index}`} className="flex items-center gap-3 px-2 py-2">
                                        <div className="h-10 w-10 bg-muted/10 border-[1.5px] border-border rounded-2xl animate-pulse"></div>
                                        <div className="h-4 bg-muted rounded flex-1 animate-pulse"></div>
                                        <div className="h-3 w-8 bg-muted rounded animate-pulse"></div>
                                    </div>
                                ))}
                            </div>
                        ) : triggerThreads.length > 0 ? (
                            // Show trigger runs grouped by date
                            <>
                                {Object.entries(groupedTriggerThreads).map(([dateGroup, threadsInGroup]) => (
                                    <div key={dateGroup}>
                                        <DateGroupHeader dateGroup={dateGroup} count={threadsInGroup.length} />
                                        {threadsInGroup.map((thread) => {
                                            const isActive = pathname?.includes(thread.threadId) || false;
                                            const isThreadLoading = loadingThreadId === thread.threadId;

                                            return (
                                                <TriggerRunItem
                                                    key={`trigger-run-${thread.threadId}`}
                                                    thread={thread}
                                                    isActive={isActive}
                                                    isThreadLoading={isThreadLoading}
                                                    pathname={pathname}
                                                    isMobile={isMobile}
                                                    handleThreadClick={handleThreadClick}
                                                    composioAppLogo={getComposioLogoForThread(thread)}
                                                />
                                            );
                                        })}
                                    </div>
                                ))}
                            </>
                        ) : (
                            <div className="py-2 text-sm text-muted-foreground pl-2">
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
