'use client';

import { useMemo, useState } from 'react';
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

// Thread list item with file list
const ThreadListItem: React.FC<{
  thread: ThreadWithProject;
  isActive: boolean;
  isFavorite: boolean;
  onThreadClick: (threadId: string, url: string) => void;
  onToggleFavorite: (threadId: string) => void;
}> = ({ thread, isActive, isFavorite, onThreadClick, onToggleFavorite }) => {
  const [showAllFiles, setShowAllFiles] = useState(false);
  const router = useRouter();

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

  const maxFilesShown = 3;
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
                      onClick={() => router.push(thread.url)}
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

// Loading skeleton
const LoadingSkeleton = () => (
  <div className="space-y-1">
    {Array.from({ length: 3 }).map((_, index) => (
      <div key={`skeleton-${index}`} className="flex items-center gap-3 px-2 py-2">
        <div className="h-10 w-10 bg-muted/10 border-[1.5px] border-border rounded-2xl animate-pulse"></div>
        <div className="h-4 bg-muted rounded flex-1 animate-pulse"></div>
        <div className="h-4 w-8 bg-muted rounded animate-pulse"></div>
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

  // Fetch data
  const { data: threads = [], isLoading: threadsLoading } = useThreads();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  
  const isLoading = threadsLoading || projectsLoading;

  // Process threads with project info
  const threadsWithProjects = useMemo(() => {
    if (!threads.length || !projects.length) return [];
    return processThreadsWithProjects(threads, projects);
  }, [threads, projects]);

  // Group by date
  const groupedThreads = useMemo(() => {
    return groupThreadsByDate(threadsWithProjects);
  }, [threadsWithProjects]);

  // Favorite management
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

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
  const dateGroups = Object.entries(groupedThreads);
  
  return (
    <div className="overflow-y-auto max-h-[calc(100vh-280px)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] pb-32">
      {isLoading ? (
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
