'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Star, FileText, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import type { ThreadWithProject } from '@/hooks/react-query/sidebar/use-sidebar';

interface ThreadCardProps {
  thread: ThreadWithProject;
  isFavorite: boolean;
  onToggleFavorite: (threadId: string) => void;
  viewMode: 'grid' | 'list';
}

export function ThreadCard({ thread, isFavorite, onToggleFavorite, viewMode }: ThreadCardProps) {
  const router = useRouter();
  
  // Get thread name from projectName
  const threadName = thread.projectName;
  
  // Format date
  const getRelativeDate = () => {
    if (!thread.updatedAt) return '';
    
    const date = new Date(thread.updatedAt);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleCardClick = () => {
    router.push(thread.url);
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite(thread.threadId);
  };

  if (viewMode === 'list') {
    return (
      <Card
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={handleCardClick}
      >
        <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{threadName}</h3>
        </div>
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {getRelativeDate()}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleFavoriteClick}
          className="flex-shrink-0"
        >
          <Star
            className={cn(
              'w-4 h-4',
              isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
            )}
          />
        </Button>
        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      </Card>
    );
  }

  return (
    <Card
      className="flex flex-col p-4 cursor-pointer hover:bg-accent/50 transition-colors h-full"
      onClick={handleCardClick}
    >
      {/* Header with title and favorite button */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-medium line-clamp-2 flex-1">{threadName}</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleFavoriteClick}
          className="flex-shrink-0 -mt-1"
        >
          <Star
            className={cn(
              'w-4 h-4',
              isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
            )}
          />
        </Button>
      </div>

      {/* File preview area - placeholder for now */}
      <div className="flex-1 flex flex-col items-center justify-center py-6 px-4 bg-muted/30 rounded-md border border-dashed mb-3">
        <FileText className="w-8 h-8 text-muted-foreground mb-2" />
        <p className="text-xs text-muted-foreground text-center">Associated files</p>
        <p className="text-xs text-muted-foreground/70 text-center mt-1">
          Files will be shown when viewing the thread
        </p>
      </div>

      {/* Footer with date */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{getRelativeDate()}</span>
        <ChevronRight className="w-4 h-4" />
      </div>
    </Card>
  );
}
