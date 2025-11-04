'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Star, FileText, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { listSandboxFiles, getProjects, getSandboxFileContent } from '@/lib/api';
import { FileViewerModal } from '@/components/thread/file-viewer-modal';
import { FileIcon } from '@/components/library/file-icons';
import { MarkdownPreview } from '@/components/library/markdown-preview';
import { FileCard } from '@/components/library/file-card';
import { getFileType, FILE_ICONS } from '@/lib/utils/fileTypeDetector';
import type { ThreadWithProject } from '@/hooks/react-query/sidebar/use-sidebar';

interface ThreadCardProps {
  thread: ThreadWithProject;
  isFavorite: boolean;
  onToggleFavorite: (threadId: string) => void;
  viewMode: 'grid' | 'gallery' | 'list';
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

  console.log('🔧 Project/Sandbox Debug:', {
    threadName: thread.projectName,
    projectId: thread.projectId,
    projectFound: !!project,
    sandboxId,
    sandboxObject: project?.sandbox,
  });
  
  // Fetch files for this thread's project sandbox - fetch immediately for visible threads
  const { data: files = [], isLoading: filesLoading, error: filesError } = useQuery({
    queryKey: ['sandbox-files', sandboxId],
    queryFn: async () => {
      if (!sandboxId) {
        return [];
      }
      try {
        const fileList = await listSandboxFiles(sandboxId, '/workspace');
        // Filter out directories, only show files, and sort by modification time (newest first)
        const filtered = fileList
          .filter((file: any) => !file.is_dir)
          .sort((a: any, b: any) => {
            const aTime = new Date(a.mod_time).getTime();
            const bTime = new Date(b.mod_time).getTime();
            return bTime - aTime; // Newest first
          });
        return filtered;
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

  // Find the first markdown file for preview
  const firstMarkdownFile = files.find((file: any) => file.name?.endsWith('.md'));

  // Find the first image file for gallery view preview
  const firstImageFile = files.find((file: any) => {
    const fileName = file.name?.toLowerCase() || '';
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].some(ext => fileName.endsWith(`.${ext}`));
  });

  // Fetch image preview content (only when first image file exists)
  const { data: imagePreviewUrl = '', isLoading: imageLoading } = useQuery({
    queryKey: ['image-preview', sandboxId, firstImageFile?.path],
    queryFn: async () => {
      if (!sandboxId || !firstImageFile?.path) return '';
      try {
        const content = await getSandboxFileContent(sandboxId, firstImageFile.path);
        
        // Convert to blob URL
        let blob: Blob;
        if (content instanceof Blob) {
          blob = content;
        } else if (typeof content === 'string') {
          blob = new Blob([content], { type: 'application/octet-stream' });
        } else {
          return '';
        }
        
        // Create object URL for the blob
        const url = URL.createObjectURL(blob);
        return url;
      } catch (error) {
        console.error('Failed to fetch image preview:', error);
        return '';
      }
    },
    enabled: !!sandboxId && !!firstImageFile?.path,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    retry: false,
  });

  // Fetch markdown preview content (only when first markdown file exists)
  const { data: markdownContent = '', isLoading: markdownLoading, error: markdownError } = useQuery({
    queryKey: ['markdown-preview', sandboxId, firstMarkdownFile?.path],
    queryFn: async () => {
      if (!sandboxId || !firstMarkdownFile?.path) return '';
      try {
        const content = await getSandboxFileContent(sandboxId, firstMarkdownFile.path);
        
        // Handle both string and Blob responses
        let contentStr = '';
        if (typeof content === 'string') {
          contentStr = content;
        } else if (content instanceof Blob) {
          contentStr = await content.text();
        }
        
        return contentStr;
      } catch (error) {
        console.error('Failed to fetch markdown preview:', error);
        return '';
      }
    },
    enabled: !!sandboxId && !!firstMarkdownFile?.path,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    retry: false,
  });

  // Debug markdown state
  console.log('📝 Markdown Preview State:', {
    threadName,
    hasFirstMarkdownFile: !!firstMarkdownFile,
    markdownContentLength: markdownContent?.length || 0,
    markdownLoading,
    markdownError,
    willShowPreview: !!(firstMarkdownFile && markdownContent),
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

  // Manus-style layout: Thread header + grid of file cards
  return (
    <>
      {viewMode === 'grid' ? (
        // GRID VIEW - Horizontal card layout with files
        <div className="flex flex-col gap-3">
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

          {/* File Cards Grid - Grid View */}
          {filesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground/60 py-2">
              <FileText className="w-4 h-4 animate-pulse" />
              <span className="italic">Loading files...</span>
            </div>
          ) : files.length > 0 ? (
            <>
              <div className="grid gap-4 items-start grid-cols-1 md:grid-cols-3">
                {files.slice(0, showAllFiles ? files.length : 6).map((file: any) => {
                  const fileType = getFileType(file.name || '');
                  const IconComponent = FILE_ICONS[fileType];
                  const isMarkdown = file.name?.endsWith('.md');
                  
                  return (
                    <FileCard
                      key={file.path}
                      file={file}
                      IconComponent={IconComponent}
                      isMarkdown={isMarkdown}
                      sandboxId={sandboxId || ''}
                      onFileClick={handleFileClick}
                    />
                  );
                })}
              </div>

              {/* Show More Button */}
              {files.length > 6 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExpandFiles}
                  className="self-start text-sm h-auto py-1 px-2"
                >
                  <ChevronDown 
                    className={cn(
                      "w-3 h-3 mr-1 transition-transform",
                      showAllFiles && "rotate-180"
                    )} 
                  />
                  {showAllFiles ? 'Show less' : `+${files.length - 6} more file${files.length - 6 > 1 ? 's' : ''}`}
                </Button>
              )}
            </>
          ) : (
            <div className="text-sm text-muted-foreground/60 py-2">
              No files associated with this thread
            </div>
          )}
        </div>
      ) : viewMode === 'gallery' ? (
        // GALLERY VIEW - Image-first tile layout
        <div className="relative flex flex-col gap-3 border border-border/50 rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-card">
          {/* Favorite Button - Top Right */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFavoriteClick}
            className="absolute top-2 right-2 z-10 hover:bg-background/80"
          >
            <Star
              className={cn(
                'w-5 h-5',
                isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground hover:text-foreground'
              )}
            />
          </Button>

          {/* Clickable Thumbnail Area */}
          <div 
            className="aspect-square md:aspect-[3/2] overflow-hidden bg-muted cursor-pointer group relative"
            onClick={handleCardClick}
          >
            {imageLoading ? (
              // Loading State
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : imagePreviewUrl ? (
              // Image Preview
              <img 
                src={imagePreviewUrl} 
                alt={threadName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
            ) : files.length > 0 ? (
              // Fallback: File Icon Grid (2x2)
              <div className="w-full h-full bg-muted p-4 flex items-center justify-center">
                <div className="grid grid-cols-2 gap-3">
                  {files.slice(0, 4).map((file: any, index: number) => {
                    const fileType = getFileType(file.name || '');
                    const IconComponent = FILE_ICONS[fileType];
                    return (
                      <div 
                        key={index}
                        className="flex items-center justify-center"
                      >
                        <IconComponent className="w-16 h-16 opacity-50 group-hover:opacity-70 transition-opacity" />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              // Empty State
              <div className="w-full h-full flex items-center justify-center">
                <FileText className="w-12 h-12 opacity-20" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-3 flex flex-col gap-2">
            {/* Title */}
            <h3 
              className="font-medium text-base truncate cursor-pointer hover:underline group"
              onClick={handleCardClick}
            >
              {threadName}
            </h3>

            {/* Meta Info */}
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{files.length} file{files.length !== 1 ? 's' : ''}</span>
              <span>{getRelativeDate()}</span>
            </div>
          </div>
        </div>
      ) : (
        // LIST VIEW - Thread header + compact file list
        <div className="flex flex-col gap-2">
          {/* Header Row: Title + Date */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-muted/30 transition-colors rounded-lg">
            <h3 
              className="font-medium text-base cursor-pointer hover:underline flex-1 min-w-0 truncate"
              onClick={handleCardClick}
            >
              {threadName}
            </h3>
            
            <span className="text-sm text-muted-foreground flex-shrink-0 whitespace-nowrap">
              {getRelativeDate()}
            </span>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleFavoriteClick}
              className="h-8 w-8 flex-shrink-0"
            >
              <Star
                className={cn(
                  'w-4 h-4',
                  isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
                )}
              />
            </Button>
          </div>

          {/* Files List */}
          {filesLoading ? (
            <div className="flex items-center gap-2 text-base text-muted-foreground/60 px-4 py-2">
              <FileText className="w-5 h-5 animate-pulse" />
              <span className="italic">Loading files...</span>
            </div>
          ) : files.length > 0 ? (
            <div className="flex flex-col gap-1.5 px-4">
              {files.slice(0, showAllFiles ? files.length : 6).map((file: any) => {
                const fileType = getFileType(file.name || '');
                const IconComponent = FILE_ICONS[fileType];
                const isMarkdown = file.name?.endsWith('.md');
                
                return (
                  <div
                    key={file.path}
                    className="flex items-center gap-3 py-2 px-3 hover:bg-muted/30 transition-colors cursor-pointer group rounded border-b border-border/60"
                    onClick={(e) => handleFileClick(e, file.path)}
                  >
                    <IconComponent className="w-6 h-6 flex-shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" />
                    <span className="text-base truncate text-muted-foreground group-hover:text-foreground transition-colors">
                      {file.name || 'Untitled File'}
                    </span>
                  </div>
                );
              })}

              {/* Show More Button */}
              {files.length > 6 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExpandFiles}
                  className="self-start text-xs h-auto py-1 px-2 mt-1"
                >
                  <ChevronDown 
                    className={cn(
                      "w-3 h-3 mr-1 transition-transform",
                      showAllFiles && "rotate-180"
                    )} 
                  />
                  {showAllFiles ? 'Show less' : `+${files.length - 6} more file${files.length - 6 > 1 ? 's' : ''}`}
                </Button>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground/60 px-4 py-2">
              No files associated with this thread
            </div>
          )}
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
    </>
  );
}
