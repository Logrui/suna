'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

type ViewMode = 'grid' | 'gallery' | 'list';

interface LibraryLoadingSkeletonProps {
  viewMode?: ViewMode;
  count?: number;
}

export const LibraryLoadingSkeleton = ({ viewMode = 'grid', count = 6 }: LibraryLoadingSkeletonProps) => {
  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: count }).map((_, index) => (
          <div key={`skeleton-${index}`} className="rounded-xl border border-border/30 overflow-hidden">
            {/* Thumbnail */}
            <div className="h-32 bg-muted/20 animate-pulse" />
            
            {/* Content */}
            <div className="p-4 space-y-3">
              {/* Title */}
              <Skeleton className="h-4 w-32" />
              
              {/* Metadata row */}
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-6 rounded-full" />
              </div>
              
              {/* File list skeleton */}
              <div className="space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (viewMode === 'gallery') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: count }).map((_, index) => (
          <div key={`skeleton-${index}`} className="space-y-2">
            {/* Large image thumbnail */}
            <div className="h-48 rounded-lg bg-muted/20 animate-pulse" />
            
            {/* Title and metadata */}
            <div className="space-y-2 px-2">
              <Skeleton className="h-4 w-24" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-5 w-5 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <div key={`skeleton-${index}`} className="rounded-lg border border-border/30 p-4">
          {/* Header row: title + timestamp + star */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <Skeleton className="h-4 w-40 flex-1" />
            <Skeleton className="h-3 w-16 flex-shrink-0" />
            <Skeleton className="h-6 w-6 rounded-full flex-shrink-0" />
          </div>
          
          {/* File list skeletons - 2-3 lines */}
          <div className="space-y-1 ml-2">
            {Array.from({ length: 2 }).map((_, fileIdx) => (
              <div key={`file-${fileIdx}`} className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-3.5 rounded flex-shrink-0" />
                <Skeleton className="h-3 w-32 flex-1" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
