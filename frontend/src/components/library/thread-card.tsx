'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Star, FileText, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { listSandboxFiles, getProjects } from '@/lib/api';
import { FileViewerModal } from '@/components/thread/file-viewer-modal';
import type { ThreadWithProject } from '@/hooks/react-query/sidebar/use-sidebar';

interface ThreadCardProps {
  thread: ThreadWithProject;
  isFavorite: boolean;
  onToggleFavorite: (threadId: string) => void;
  viewMode: 'grid' | 'list';
}

export function ThreadCard({ thread, isFavorite, onToggleFavorite, viewMode }: ThreadCardProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  
  // Get thread name from projectName
  const threadName = thread.projectName;
  
  // Fetch project details to get sandboxId
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getProjects(),
  });

  const project = projects.find(p => p.id === thread.projectId);
  const sandboxId = project?.sandbox?.id;
  
  // Fetch files for this thread's project sandbox - fetch immediately for visible threads
  const { data: files = [], isLoading: filesLoading, error: filesError } = useQuery({
    queryKey: ['sandbox-files', sandboxId],
    queryFn: async () => {
      if (!sandboxId) return [];
      try {
        const fileList = await listSandboxFiles(sandboxId, '/workspace');
        // Filter out directories, only show files, and sort by modification time (newest first)
        return fileList
          .filter((file: any) => !file.is_dir)
          .sort((a: any, b: any) => {
            const aTime = new Date(a.mod_time).getTime();
            const bTime = new Date(b.mod_time).getTime();
            return bTime - aTime; // Newest first
          });
      } catch (error: any) {
        // Sandbox might not exist yet (404/500) - this is normal for new threads
        console.error('Failed to fetch files:', error);
        return [];
      }
    },
    enabled: !!sandboxId, // Fetch immediately when sandboxId is available
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: false, // Don't retry if sandbox doesn't exist
  });
  
  // Format date
  const getRelativeDate = () => {
    if (!thread.updatedAt) return '';
    
    const date = new Date(thread.updatedAt);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
    if (diffDays < 30) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleCardClick = () => {
    router.push(thread.url);
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(thread.threadId);
  };

  const handleExpandFiles = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowAllFiles(!showAllFiles);
  };

  const handleFileClick = (e: React.MouseEvent, filePath: string) => {
    e.stopPropagation();
    setSelectedFilePath(filePath);
    setFileViewerOpen(true);
  };

  const displayedFiles = showAllFiles ? files : files.slice(0, 3);
  const remainingCount = files.length - 3;

  // Manus-style vertical list layout (always use this, ignore viewMode for now)
  return (
    <div className="flex flex-col pb-6 px-6 gap-3">
      {/* Header Row: Title + Date + Favorite */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h3 
            className="font-medium text-base md:text-lg truncate cursor-pointer hover:underline"
            onClick={handleCardClick}
          >
            {threadName}
          </h3>
        </div>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {getRelativeDate()}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleFavoriteClick}
            className="h-8 w-8"
          >
            <Star
              className={cn(
                'w-4 h-4',
                isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
              )}
            />
          </Button>
        </div>
      </div>

      {/* Files Section - Expandable List */}
      {filesLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground/60 py-2">
          <FileText className="w-4 h-4 animate-pulse" />
          <span className="italic">Loading files...</span>
        </div>
      ) : files.length > 0 ? (
        <div className="flex flex-col gap-2">
          {displayedFiles.map((file: any, index: number) => (
            <div
              key={file.path || index}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer group"
              onClick={(e) => handleFileClick(e, file.path)}
            >
              <FileText className="w-4 h-4 flex-shrink-0" />
              <span className="truncate group-hover:underline">{file.name || 'Untitled File'}</span>
              <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
          
          {remainingCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExpandFiles}
              className="self-start text-sm h-auto py-1 px-2 -ml-2"
            >
              <ChevronDown 
                className={cn(
                  "w-3 h-3 mr-1 transition-transform",
                  showAllFiles && "rotate-180"
                )} 
              />
              {showAllFiles ? 'Show less' : `+${remainingCount} more file${remainingCount > 1 ? 's' : ''}`}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground/60 py-2">
          <FileText className="w-4 h-4" />
          <span className="italic">No files associated with this thread</span>
        </div>
      )}

      {/* File Viewer Modal */}
      {sandboxId && (
        <FileViewerModal
          open={fileViewerOpen}
          onOpenChange={setFileViewerOpen}
          sandboxId={sandboxId}
          initialFilePath={selectedFilePath}
          project={project}
        />
      )}
    </div>
  );
}
