'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getThreads, getProjects } from '@/lib/api';
import { LibraryPageHeader } from './library-page-header';
import { ThreadCard } from './thread-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, List, Search, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ThreadWithProject } from '@/hooks/react-query/sidebar/use-sidebar';

type ViewMode = 'grid' | 'list';
type FilterMode = 'all' | 'favorites';

const ITEMS_PER_PAGE = 20;
const FAVORITES_KEY = 'library-favorites';

export function LibraryPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

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

  // Pagination
  const totalPages = Math.ceil(filteredThreads.length / ITEMS_PER_PAGE);
  const paginatedThreads = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredThreads.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredThreads, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterMode, searchQuery]);

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

          {/* Filters */}
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

        {/* View Mode Toggle - Hidden for now, Manus only uses list view */}
        {/* <div className="flex items-center gap-1 border rounded-md">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="rounded-r-none"
          >
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="rounded-l-none"
          >
            <List className="w-4 h-4" />
          </Button>
        </div> */}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto max-w-7xl px-4 py-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Loading threads...</p>
          </div>
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
            {/* Thread List - Manus Style */}
            <div className="flex flex-col gap-3 md:gap-[12px]">
              {paginatedThreads.map((thread) => (
                <ThreadCard
                  key={thread.threadId}
                  thread={thread}
                  isFavorite={favorites.has(thread.threadId)}
                  onToggleFavorite={toggleFavorite}
                  viewMode={viewMode}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
