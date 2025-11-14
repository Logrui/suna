'use client';

import React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { FolderIcon, FileIcon, ChevronRight, Database, Loader2 } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { useKnowledgeFolders, type Folder, type Entry } from '@/hooks/react-query/knowledge-base/use-folders';
import { cn } from '@/lib/utils';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { formatDateForList } from '@/lib/utils/date-formatting';
import { Badge } from '@/components/ui/badge';

// Section header component
const DateGroupHeader: React.FC<{ title: string; count?: number }> = ({ title, count }) => {
  return (
    <div className="py-2 mt-4 first:mt-2">
      <div className="text-xs font-medium text-muted-foreground pl-2.5">
        {title} {count !== undefined && count > 0 && `(${count})`}
      </div>
    </div>
  );
};

// Folder item component
const FolderItem: React.FC<{
  folder: Folder;
  isActive: boolean;
  onClick: () => void;
}> = ({ folder, isActive, onClick }) => {
  return (
    <SpotlightCard
      className={cn(
        "transition-colors cursor-pointer",
        isActive ? "bg-muted" : "bg-transparent"
      )}
    >
      <div className="flex items-center gap-3 p-2.5 text-sm" onClick={onClick}>
        <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-card border-[1.5px] border-border flex-shrink-0">
          <FolderIcon className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="flex-1 truncate">{folder.name}</span>
        {folder.entry_count > 0 && (
          <Badge variant="secondary" className="text-xs h-5 px-1.5">
            {folder.entry_count}
          </Badge>
        )}
      </div>
    </SpotlightCard>
  );
};

// File item component
const FileItem: React.FC<{
  file: Entry;
  isActive: boolean;
  onClick: () => void;
}> = ({ file, isActive, onClick }) => {
  return (
    <SpotlightCard
      className={cn(
        "transition-colors cursor-pointer",
        isActive ? "bg-muted" : "bg-transparent"
      )}
    >
      <div className="flex items-center gap-3 p-2.5 text-sm" onClick={onClick}>
        <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-card border-[1.5px] border-border flex-shrink-0">
          <FileIcon className="h-4 w-4 text-muted-foreground" />
        </div>
        <span className="flex-1 truncate">{file.filename}</span>
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {formatDateForList(file.created_at)}
        </span>
      </div>
    </SpotlightCard>
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
    <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
    <p className="text-sm">No folders yet</p>
    <p className="text-xs mt-1">Create folders in Knowledge Base</p>
  </div>
);

// Main component
export function NavKnowledgeBase() {
  const { isMobile, state, setOpenMobile } = useSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Fetch data - note: uses loading (not isLoading) due to hook implementation
  const { folders, recentFiles, loading } = useKnowledgeFolders();
  
  // Track active items from URL
  const activeFolderId = searchParams.get('folder');
  const activeFileId = searchParams.get('file');
  
  // Navigation handlers
  const handleBrowseAll = () => {
    router.push('/knowledge');
    if (isMobile) setOpenMobile(false);
  };
  
  const handleFolderClick = (folderId: string) => {
    router.push(`/knowledge?folder=${folderId}`);
    if (isMobile) setOpenMobile(false);
  };
  
  const handleFileClick = (entryId: string, folderId: string) => {
    router.push(`/knowledge?folder=${folderId}&file=${entryId}`);
    if (isMobile) setOpenMobile(false);
  };
  
  return (
    <div>
      <div className="overflow-y-auto max-h-[calc(100vh-280px)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] pb-32">
        {(state !== 'collapsed' || isMobile) && (
          <>
            {/* Section Header */}
            <DateGroupHeader title="Knowledge Base" count={folders.length} />
            
            {/* Browse All Link */}
            <SpotlightCard className="mb-2 transition-colors cursor-pointer hover:bg-muted/60">
              <div onClick={handleBrowseAll} className="flex items-center gap-3 p-2.5 text-sm">
                <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-card border-[1.5px] border-border flex-shrink-0">
                  <Database className="h-4 w-4 text-muted-foreground" />
                </div>
                <span className="flex-1">All Folders & Files</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            </SpotlightCard>
            
            {/* Loading State */}
            {loading && <LoadingSkeleton />}
            
            {/* Recent Files Section */}
{/*             {!loading && recentFiles.length > 0 && (
              <>
                <DateGroupHeader title="Recent Files" count={Math.min(recentFiles.length, 5)} />
                <div className="space-y-1">
                  {recentFiles.slice(0, 5).map((file) => (
                    <FileItem
                      key={file.entry_id}
                      file={file}
                      isActive={activeFileId === file.entry_id}
                      onClick={() => handleFileClick(file.entry_id, file.folder_id)}
                    />
                  ))}
                </div>
              </>
            )}
             */}

            {/* All Folders Section */}
            {!loading && folders.length > 0 && (
              <>
                <DateGroupHeader title="Folders" count={folders.length} />
                <div className="space-y-1">
                  {folders.map((folder) => (
                    <FolderItem
                      key={folder.folder_id}
                      folder={folder}
                      isActive={activeFolderId === folder.folder_id}
                      onClick={() => handleFolderClick(folder.folder_id)}
                    />
                  ))}
                </div>
              </>
            )}
            
            {/* Empty State */}
            {!loading && folders.length === 0 && <EmptyState />}
          </>
        )}
      </div>
    </div>
  );
}
