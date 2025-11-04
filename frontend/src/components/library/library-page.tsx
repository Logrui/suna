'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getThreads, getProjects } from '@/lib/api';
import { LibraryPageHeader } from './library-page-header';
import { ThreadCard } from './thread-card';
import { LibraryLoadingSkeleton } from './library-loading-skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, List, Search, Star, Loader2, Images } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ThreadWithProject } from '@/hooks/react-query/sidebar/use-sidebar';

type ViewMode = 'grid' | 'gallery' | 'list';
type FilterMode = 'all' | 'favorites';

const ITEMS_PER_PAGE = 5; // Load 5 threads at a time
const FAVORITES_KEY = 'library-favorites';

export function LibraryPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE); // Show 5 initially
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Load favorites from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setFavorites(new Set(parsed));
      } catch (e) {
        console.error('Failed to parse favorites:', e);
      }
    }
  }, []);

  // Fetch threads and projects
  const { data: threads = [], isLoading: threadsLoading } = useQuery({
    queryKey: ['threads'],
    queryFn: () => getThreads(),
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getProjects(),
  });

  const isLoading = threadsLoading || projectsLoading;

  // Process threads with project names
  const threadsWithProjects: ThreadWithProject[] = useMemo(() => {
    if (!threads.length || !projects.length) return [];

    const projectsById = new Map(projects.map(p => [p.id, p]));
    
    return threads
      .filter(thread => thread.project_id)
      .map(thread => {
        const project = projectsById.get(thread.project_id!);
        return {
          threadId: thread.thread_id,
          projectId: thread.project_id!,
          projectName: project?.name || 'Unnamed Project',
          url: `/projects/${thread.project_id}/thread/${thread.thread_id}`,
          updatedAt: thread.updated_at,
          iconName: project?.icon_name,
        };
      })
      .sort((a, b) => {
        // Sort by updated_at descending (newest first)
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [threads, projects]);

  // Toggle favorite
  const toggleFavorite = (threadId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) {
        next.delete(threadId);
      } else {
        next.add(threadId);
      }
      // Persist to localStorage
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  // Filter and search threads
  const filteredThreads = useMemo(() => {
    let result = threadsWithProjects;

    // Apply favorites filter
    if (filterMode === 'favorites') {
      result = result.filter((thread) => favorites.has(thread.threadId));
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((thread) => {
        return thread.projectName.toLowerCase().includes(query);
      });
    }

    return result;
  }, [threadsWithProjects, filterMode, favorites, searchQuery]);

  // Display limited threads (for progressive loading)
  const displayedThreads = useMemo(() => {
    return filteredThreads.slice(0, displayCount);
  }, [filteredThreads, displayCount]);

  const hasMore = filteredThreads.length > displayCount;

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(ITEMS_PER_PAGE);
  }, [filterMode, searchQuery]);

  // Load more function
  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    // Simulate slight delay for smooth UX
    setTimeout(() => {
      setDisplayCount(prev => prev + ITEMS_PER_PAGE);
      setIsLoadingMore(false);
    }, 300);
  }, [isLoadingMore, hasMore]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [hasMore, isLoadingMore, loadMore]);

  return (
    <div className="min-h-screen">
      {/* Combined Sticky Header + Toolbar */}
      <div className="sticky top-0 z-20 bg-background">
        <div className="container mx-auto max-w-7xl px-4">
          {/* Header */}
          <div className="py-4 md:py-[14px]">
            <LibraryPageHeader />
          </div>

          {/* Toolbar */}
          <div className="pb-4">
            <div className="flex items-center justify-between gap-4">
              {/* Filters - LEFT ALIGNED */}
              <div className="flex items-center gap-2">
                <Button
                  variant={filterMode === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterMode('all')}
                >
                  All
                </Button>
                <Button
                  variant={filterMode === 'favorites' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilterMode('favorites')}
                >
                  <Star className="w-4 h-4 mr-1" />
                  Favorites
                </Button>
              </div>

              {/* Search + View Toggle - RIGHT ALIGNED */}
              <div className="flex items-center gap-4">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search threads..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* View Mode Toggle - Icon-Only Segmented Control (SELECTED) */}
                <div className="flex items-center gap-0.5 bg-card border border-border/50 rounded-xl p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      "rounded-lg transition-all",
                      viewMode === 'grid' && "bg-muted text-foreground"
                    )}
                    title="Grid view"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode('gallery')}
                    className={cn(
                      "rounded-lg transition-all",
                      viewMode === 'gallery' && "bg-muted text-foreground"
                    )}
                    title="Gallery view"
                  >
                    <Images className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className={cn(
                      "rounded-lg transition-all",
                      viewMode === 'list' && "bg-muted text-foreground"
                    )}
                    title="List view"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto max-w-7xl px-4 py-2">
        {isLoading ? (
          <LibraryLoadingSkeleton viewMode={viewMode} count={displayCount} />
        ) : filteredThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-muted-foreground mb-2">
              {filterMode === 'favorites'
                ? 'No favorite threads yet'
                : searchQuery
                ? 'No threads found matching your search'
                : 'No threads available'}
            </p>
            {filterMode === 'favorites' && (
              <p className="text-sm text-muted-foreground">
                Click the star icon on threads to add them to favorites
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Thread List - Grid, Gallery, or List based on viewMode */}
            {viewMode === 'list' ? (
              // LIST VIEW - Vertical stack (minimal metadata)
              <div className="flex flex-col gap-2">
                {displayedThreads.map((thread) => (
                  <ThreadCard
                    key={thread.threadId}
                    thread={thread}
                    isFavorite={favorites.has(thread.threadId)}
                    onToggleFavorite={toggleFavorite}
                    viewMode={viewMode}
                  />
                ))}
              </div>
            ) : viewMode === 'gallery' ? (
              // GALLERY VIEW - Responsive tile grid
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {displayedThreads.map((thread) => (
                  <ThreadCard
                    key={thread.threadId}
                    thread={thread}
                    isFavorite={favorites.has(thread.threadId)}
                    onToggleFavorite={toggleFavorite}
                    viewMode={viewMode}
                  />
                ))}
              </div>
            ) : (
              // GRID VIEW - Horizontal cards with files
              <div className="flex flex-col gap-3 md:gap-[12px]">
                {displayedThreads.map((thread) => (
                  <ThreadCard
                    key={thread.threadId}
                    thread={thread}
                    isFavorite={favorites.has(thread.threadId)}
                    onToggleFavorite={toggleFavorite}
                    viewMode={viewMode}
                  />
                ))}
              </div>
            )}

            {/* Infinite Scroll Trigger & Loading Spinner */}
            {hasMore && (
              <div 
                ref={loadMoreRef}
                className="flex items-center justify-center mt-8 py-4"
              >
                {isLoadingMore && (
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
