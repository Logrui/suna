'use client';

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2, BookOpen, Star, FileText, ChevronDown } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { formatDateForList } from '@/lib/utils/date-formatting';
import { Button } from '@/components/ui/button';
import { listSandboxFiles, getProjects } from '@/lib/api';
import { getFileType, FILE_ICONS } from '@/lib/utils/fileTypeDetector';
import {
  ThreadWithProject,
  processThreadsWithProjects,
  groupThreadsByDate,
  useThreads,
  useProjects
} from '@/hooks/react-query/sidebar/use-sidebar';
import { useGlobalFileViewerStore } from '@/stores/global-file-viewer-store';

// Pagination constants
const THREADS_PER_PAGE = 8;
const MAX_FILES_PER_THREAD = 3;

// ============= SUB-COMPONENTS =============

// Date group header
const DateGroupHeader: React.FC<{ dateGroup: string; count: number }> = ({ dateGroup, count }) => {
  return (
    <div className="py-2 mt-4 first:mt-2">
      <div className="text-xs font-medium text-muted-foreground pl-2.5">
        {dateGroup}
      </div>
    </div>
  );
};

// Thread list item with file list and loading tracking
const ThreadListItem: React.FC<{
  thread: ThreadWithProject;
  isActive: boolean;
  isFavorite: boolean;
  onThreadClick: (threadId: string, url: string) => void;
  onToggleFavorite: (threadId: string) => void;
  onFileLoadingChange?: (threadId: string, isLoading: boolean) => void;
}> = ({ thread, isActive, isFavorite, onThreadClick, onToggleFavorite, onFileLoadingChange }) => {
  const [showAllFiles, setShowAllFiles] = useState(false);
  const router = useRouter();
  const { openFileViewer } = useGlobalFileViewerStore();

  // Fetch project to get sandboxId
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getProjects(),
  });

  const project = projects.find(p => p.id === thread.projectId);
  const sandboxId = project?.sandbox?.id;

  // Fetch files for this thread
  const { data: files = [], isLoading: filesLoading } = useQuery({
    queryKey: ['sidebar-sandbox-files', sandboxId],
    queryFn: async () => {
      if (!sandboxId) return [];
      try {
        const fileList = await listSandboxFiles(sandboxId, '/workspace');
        return fileList
          .filter((file: any) => !file.is_dir)
          .sort((a: any, b: any) => {
            const aTime = new Date(a.mod_time).getTime();
            const bTime = new Date(b.mod_time).getTime();
            return bTime - aTime;
          });
      } catch {
        return [];
      }
    },
    enabled: !!sandboxId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Notify parent of loading status changes
  useEffect(() => {
    if (onFileLoadingChange) {
      onFileLoadingChange(thread.threadId, filesLoading);
    }
  }, [filesLoading, thread.threadId, onFileLoadingChange]);

  const maxFilesShown = MAX_FILES_PER_THREAD;
  const displayedFiles = files.slice(0, showAllFiles ? files.length : maxFilesShown);
  const hasMoreFiles = files.length > maxFilesShown;

  return (
    <div className="mb-2">
      {/* Thread Header Row */}
      <SpotlightCard
        className={cn(
          "transition-colors cursor-pointer",
          isActive ? "bg-muted" : "bg-transparent"
        )}
      >
        <div className="flex items-center justify-between gap-2 px-3 py-2.5">
          {/* Thread name */}
          <div
            className="flex-1 min-w-0"
            onClick={() => onThreadClick(thread.threadId, thread.url)}
          >
            <h4 className="text-sm font-medium truncate hover:underline text-foreground">
              {thread.projectName}
            </h4>
          </div>

          {/* Timestamp */}
          <span className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
            {formatDateForList(thread.updatedAt)}
          </span>

          {/* Favorite button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(thread.threadId);
            }}
            className="h-6 w-6 flex-shrink-0 -mr-1"
          >
            <Star
              className={cn(
                'w-3.5 h-3.5',
                isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground hover:text-foreground'
              )}
            />
          </Button>
        </div>

        {/* Files List */}
        {files.length > 0 && (
          <div className="px-3 pb-2 pt-0">
            {filesLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground/60 py-1">
                <FileText className="w-3.5 h-3.5 animate-pulse" />
                <span className="italic">Loading...</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {displayedFiles.map((file: any) => {
                  const fileType = getFileType(file.name || '');
                  const IconComponent = FILE_ICONS[fileType] || FileText;

                  return (
                    <div
                      key={file.path}
                      className="flex items-center gap-2 py-1 px-2 hover:bg-muted/40 transition-colors cursor-pointer rounded text-xs group"
                      onClick={() => {
                        // Open file in global file viewer modal if sandboxId exists
                        if (sandboxId) {
                          openFileViewer({
                            sandboxId,
                            filePath: file.path,
                            project,
                          });
                        } else {
                          // Fallback to navigating to thread if no sandbox
                          router.push(thread.url);
                        }
                      }}
                    >
                      <IconComponent className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                      <span className="truncate text-muted-foreground group-hover:text-foreground transition-colors">
                        {file.name || 'Untitled'}
                      </span>
                    </div>
                  );
                })}

                {/* Show More Button */}
                {hasMoreFiles && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAllFiles(!showAllFiles);
                    }}
                    className="self-start text-xs h-auto py-0.5 px-1 mt-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <ChevronDown
                      className={cn(
                        "w-3 h-3 mr-0.5 transition-transform",
                        showAllFiles && "rotate-180"
                      )}
                    />
                    {showAllFiles ? 'Show Less' : `+${files.length - maxFilesShown} more`}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </SpotlightCard>
    </div>
  );
};

// Loading skeleton - matches Library thread card style with files
const LoadingSkeleton = () => (
  <div className="space-y-3 px-3 py-4">
    {Array.from({ length: 8 }).map((_, index) => (
      <div key={`skeleton-${index}`} className="space-y-2">
        {/* Main thread card */}
        <div className="flex items-center gap-3 px-2 py-2.5">
          <div className="h-10 w-10 bg-muted/10 border-[1.5px] border-border rounded-2xl animate-pulse flex-shrink-0"></div>
          <div className="flex-1 space-y-1">
            <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
          </div>
          <div className="h-3 w-12 bg-muted rounded animate-pulse flex-shrink-0"></div>
          <div className="h-5 w-5 bg-muted rounded-full animate-pulse flex-shrink-0"></div>
        </div>

        {/* File items underneath */}
        <div className="ml-8 space-y-1">
          {Array.from({ length: 2 }).map((_, fileIdx) => (
            <div key={`file-${fileIdx}`} className="flex items-center gap-2 px-2 py-1">
              <div className="h-3 w-3 bg-muted/60 rounded animate-pulse flex-shrink-0"></div>
              <div className="h-3 bg-muted/60 rounded flex-1 animate-pulse"></div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

// Empty state
const EmptyState = () => (
  <div className="p-4 text-center text-muted-foreground">
    <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
    <p className="text-sm">No threads yet</p>
    <p className="text-xs mt-1">Create a new thread to see it here</p>
  </div>
);

// ============= MAIN COMPONENT =============

export function NavLibrary() {
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Fetch data
  const { data: threads = [], isLoading: threadsLoading } = useThreads();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();

  const initialDataLoading = threadsLoading || projectsLoading;

  // Pagination state
  const [displayedThreadCount, setDisplayedThreadCount] = useState(THREADS_PER_PAGE);

  // Favorite management
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Process threads with project info
  const threadsWithProjects = useMemo(() => {
    if (!threads.length || !projects.length) return [];
    return processThreadsWithProjects(threads, projects);
  }, [threads, projects]);

  // Group by date
  const groupedThreads = useMemo(() => {
    return groupThreadsByDate(threadsWithProjects);
  }, [threadsWithProjects]);

  // Get flat list of all threads
  const allThreads = useMemo(() => {
    return Object.values(groupedThreads).flat();
  }, [groupedThreads]);

  // Get paginated threads (only first N)
  const paginatedThreads = useMemo(() => {
    return allThreads.slice(0, displayedThreadCount);
  }, [allThreads, displayedThreadCount]);

  // Get paginated grouped threads
  const paginatedGroupedThreads = useMemo(() => {
    const result: typeof groupedThreads = {};
    paginatedThreads.forEach((thread) => {
      // Find which date group this thread belongs to
      Object.entries(groupedThreads).forEach(([dateGroup, threads]) => {
        if (threads.find(t => t.threadId === thread.threadId)) {
          if (!result[dateGroup]) result[dateGroup] = [];
          result[dateGroup].push(thread);
        }
      });
    });
    return result;
  }, [paginatedThreads, groupedThreads]);

  // Track file loading status for all displayed threads
  const [filesLoadingState, setFilesLoadingState] = useState<Map<string, boolean>>(new Map());
  const [forceShowContent, setForceShowContent] = useState(false);

  const updateFileLoading = useCallback((threadId: string, isLoading: boolean) => {
    setFilesLoadingState(prev => {
      const next = new Map(prev);
      next.set(threadId, isLoading);
      return next;
    });
  }, []);

  // Fallback timeout - show content after 2 seconds even if files aren't loaded
  useEffect(() => {
    if (!initialDataLoading && paginatedThreads.length > 0) {
      const timeout = setTimeout(() => {
        setForceShowContent(true);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [initialDataLoading, paginatedThreads.length]);

  // Check if all files are loaded
  const allFilesLoaded = useMemo(() => {
    // Force show after timeout
    if (forceShowContent) return true;

    // Wait for initial data
    if (initialDataLoading) return false;

    // If no threads, we're ready
    if (paginatedThreads.length === 0) return true;

    // Check if any displayed thread is actively loading files
    for (const thread of paginatedThreads) {
      const isLoading = filesLoadingState.get(thread.threadId);
      // Only wait if we know it's actively loading (true), not undefined
      if (isLoading === true) {
        return false;
      }
    }

    // Everything is loaded or queries are disabled
    return true;
  }, [paginatedThreads, initialDataLoading, filesLoadingState, forceShowContent]);

  // Handle scroll for pagination
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // When user scrolls near bottom (within 200px), load more threads
      if (scrollHeight - scrollTop - clientHeight < 200) {
        setDisplayedThreadCount(prev =>
          Math.min(prev + THREADS_PER_PAGE, allThreads.length)
        );
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [allThreads.length]);

  // Handle thread click
  const handleThreadClick = (threadId: string, url: string) => {
    router.push(url);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Handle favorite toggle
  const handleToggleFavorite = (threadId: string) => {
    setFavorites((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(threadId)) {
        newSet.delete(threadId);
      } else {
        newSet.add(threadId);
      }
      return newSet;
    });
  };

  // Detect active thread
  const isThreadActive = (thread: ThreadWithProject) => {
    return pathname?.includes(thread.threadId) ?? false;
  };

  // Render
  const dateGroups = Object.entries(paginatedGroupedThreads);

  return (
    <div
      ref={scrollContainerRef}
      className="overflow-y-auto max-h-[calc(100vh-280px)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] pb-32"
    >
      {!allFilesLoaded ? (
        <LoadingSkeleton />
      ) : dateGroups.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {dateGroups.map(([dateGroup, groupThreads]) => (
            <div key={dateGroup}>
              <DateGroupHeader dateGroup={dateGroup} count={groupThreads.length} />
              <div className="space-y-1">
                {groupThreads.map((thread) => (
                  <ThreadListItem
                    key={thread.threadId}
                    thread={thread}
                    isActive={isThreadActive(thread)}
                    isFavorite={favorites.has(thread.threadId)}
                    onThreadClick={handleThreadClick}
                    onToggleFavorite={handleToggleFavorite}
                    onFileLoadingChange={updateFileLoading}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
