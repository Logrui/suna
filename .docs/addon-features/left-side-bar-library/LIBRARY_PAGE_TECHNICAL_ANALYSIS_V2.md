# Library Page Technical Architecture & Implementation Guide (V2)

**File Location:** `frontend/src/components/library/library-page.tsx`  
**Route:** `/library`  
**Last Updated:** November 3, 2025  
**Status:** ✅ Verified Against Source Code

---

## Table of Contents

1. [Page Overview](#page-overview)
2. [Component Architecture](#component-architecture)
3. [Data Flow & State Management](#data-flow--state-management)
4. [UI Layout & Structure](#ui-layout--structure)
5. [Feature Implementation Details](#feature-implementation-details)
6. [Complete Reconstruction Guide](#complete-reconstruction-guide)

---

## Page Overview

### Purpose

The Library Page provides users with a browsable, searchable, and filterable interface to access all conversation threads. Each thread displays inline file previews from its associated Daytona sandbox, including markdown preview support. The page uses infinite scroll for progressive loading and localStorage for favorites persistence.

### Key Features

✅ **Infinite Scroll Loading** - Starts with 5 threads, loads 5 more on scroll trigger
✅ **File Previews** - Shows up to 6 files per thread in 3-column grid with "Show More" button
✅ **Markdown Preview** - First markdown file shows preview with truncation (20 lines, 1600 chars max)
✅ **Search Functionality** - Filters threads by project name (case-insensitive, partial match)
✅ **Favorites System** - Star/unstar threads, persisted to localStorage as `library-favorites`
✅ **Filter Modes** - "All" threads vs. "Favorites" only
✅ **Sticky Header** - Search, filters stay visible while scrolling
✅ **Responsive Design** - Uses `container mx-auto max-w-7xl` for centered layout
✅ **File Viewer Modal** - Click files to open in dedicated viewer

### Display Metrics

| Metric | Value |
|--------|-------|
| Initial threads shown | 5 |
| Load increment on scroll | 5 threads |
| Files shown per thread | 6 (expandable to all) |
| File grid columns | 1 (mobile), 3 (tablet+) |
| Markdown preview max lines | 20 |
| Markdown preview max chars | 1600 |
| Sorting order | Updated date (newest first) |
| Cache duration (files) | 5 minutes |
| Cache duration (markdown) | 10 minutes |

---

## Component Architecture

### Component Hierarchy

```
LibraryPage (main container, infinite scroll logic)
├── LibraryPageHeader (title + description, sticky)
├── Sticky Toolbar (search input, filters, view toggle)
├── Content Area (container mx-auto max-w-7xl)
│   ├── Loading State OR
│   ├── Empty State OR
│   ├── Thread List (flex flex-col gap-3)
│   │   └── ThreadCard[] (repeated for each displayed thread)
│   │       ├── Header (title, date, favorite star)
│   │       ├── File Loading Indicator (if filesLoading)
│   │       ├── File Grid (3-column)
│   │       │   └── FileCard[] (up to 6 files showing)
│   │       │       ├── File Icon (type-specific)
│   │       │       ├── File Name
│   │       │       ├── Markdown Preview (if .md file)
│   │       │       └── File Metadata
│   │       └── "Show More" Button (if > 6 files)
│   └── Infinite Scroll Trigger (with loading spinner)
```

### File Structure

```
frontend/src/components/library/
├── library-page.tsx                              [Main page component]
├── library-page-header.tsx                       [Header with title/description]
├── thread-card.tsx                               [Thread with files grid]
├── file-card.tsx                                 [Individual file preview card]
├── markdown-preview/
│   └── MarkdownPreview.tsx                       [Markdown renderer]
├── file-icons/
│   ├── FileIcon.tsx                              [Icon wrapper]
│   └── icons/
│       ├── CodeIcon.tsx
│       ├── DocumentIcon.tsx
│       ├── PdfIcon.tsx
│       ├── SpreadsheetIcon.tsx
│       ├── ArchiveIcon.tsx
│       └── DefaultIcon.tsx
└── file-viewer-modal.tsx                         [File viewer modal]
```

---

## Data Flow & State Management

### State Variables in LibraryPage

```typescript
// View mode (currently disabled, always 'grid')
const [viewMode, setViewMode] = useState<ViewMode>('grid');  // 'grid' | 'list'

// Filter mode
const [filterMode, setFilterMode] = useState<FilterMode>('all');  // 'all' | 'favorites'

// Search query
const [searchQuery, setSearchQuery] = useState('');

// Favorites tracking (persisted to localStorage)
const [favorites, setFavorites] = useState<Set<string>>(new Set());

// Infinite scroll state
const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);  // Starts at 5
const [isLoadingMore, setIsLoadingMore] = useState(false);  // Loading indicator
const loadMoreRef = useRef<HTMLDivElement>(null);  // IntersectionObserver anchor
```

### Data Processing Pipeline

```
┌─────────────────────────────────────────┐
│ 1. FETCH DATA (React Query)             │
├─────────────────────────────────────────┤
│ Query 1: getThreads()                   │
│   ↓ Returns: Thread[] {thread_id, ...}  │
│                                          │
│ Query 2: getProjects()                  │
│   ↓ Returns: Project[] {id, name, ...}  │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 2. COMBINE THREADS + PROJECTS (useMemo) │
├─────────────────────────────────────────┤
│ • Create ProjectsById map               │
│ • For each thread, find project         │
│ • Map to ThreadWithProject type         │
│ • SORT by updated_at (newest first)     │
│ Dependencies: [threads, projects]       │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 3. FILTER THREADS (useMemo)             │
├─────────────────────────────────────────┤
│ • IF filterMode === 'favorites'         │
│   ↓ Filter by favorites Set             │
│ • IF searchQuery.trim()                 │
│   ↓ Filter by projectName.includes()    │
│ Dependencies: [threadsWithProjects,     │
│    filterMode, favorites, searchQuery]  │
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 4. PROGRESSIVE LOADING (useMemo)        │
├─────────────────────────────────────────┤
│ • displayedThreads = filteredThreads    │
│                     .slice(0, displayCount)
│ • hasMore = filteredThreads.length      │
│             > displayCount              │
│ Dependencies: [filteredThreads, displayCount]
└─────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────┐
│ 5. RENDER                               │
├─────────────────────────────────────────┤
│ • Map displayedThreads → ThreadCard[]   │
│ • Each ThreadCard fetches files +       │
│   markdown content (via React Query)    │
│ • IntersectionObserver triggers loadMore│
│   when visible & hasMore === true       │
└─────────────────────────────────────────┘
```

### Data Processing Code

#### Step 1: Combine Threads with Projects & Sort

```typescript
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
      // CRITICAL: Sort by updated_at descending (newest first)
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
}, [threads, projects]);
```

**Return Type:**
```typescript
type ThreadWithProject = {
  threadId: string;           // UUID from threads table
  projectId: string;          // UUID from projects table
  projectName: string;        // Display name
  url: string;                // Navigation URL
  updatedAt: string;          // ISO 8601 timestamp
  iconName?: string | null;   // Project icon identifier
};
```

#### Step 2: Filter Threads

```typescript
const filteredThreads = useMemo(() => {
  let result = threadsWithProjects;

  // Apply favorites filter
  if (filterMode === 'favorites') {
    result = result.filter((thread) => favorites.has(thread.threadId));
  }

  // Apply search filter (searches projectName case-insensitive)
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    result = result.filter((thread) => {
      return thread.projectName.toLowerCase().includes(query);
    });
  }

  return result;
}, [threadsWithProjects, filterMode, favorites, searchQuery]);
```

#### Step 3: Progressive Loading (Infinite Scroll)

```typescript
// Slice threads for display
const displayedThreads = useMemo(() => {
  return filteredThreads.slice(0, displayCount);
}, [filteredThreads, displayCount]);

// Check if more content available
const hasMore = filteredThreads.length > displayCount;

// Reset on filter/search change
useEffect(() => {
  setDisplayCount(ITEMS_PER_PAGE);  // Reset to 5
}, [filterMode, searchQuery]);

// Load more handler
const loadMore = useCallback(() => {
  if (isLoadingMore || !hasMore) return;
  
  setIsLoadingMore(true);
  setTimeout(() => {
    setDisplayCount(prev => prev + ITEMS_PER_PAGE);  // Add 5 more
    setIsLoadingMore(false);
  }, 300);  // 300ms delay for smooth UX
}, [isLoadingMore, hasMore]);

// Intersection Observer
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
  if (currentRef) observer.observe(currentRef);

  return () => {
    if (currentRef) observer.unobserve(currentRef);
  };
}, [hasMore, isLoadingMore, loadMore]);
```

### Side Effects

#### Initialize Favorites from localStorage
```typescript
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
}, []);  // Runs only on mount
```

#### Reset Pagination on Filter/Search Change
```typescript
useEffect(() => {
  setDisplayCount(ITEMS_PER_PAGE);  // Reset to 5
}, [filterMode, searchQuery]);  // Runs when either changes
```

---

## UI Layout & Structure

### Overall Layout Structure

```tsx
<div className="min-h-screen">
  {/* Sticky Header + Toolbar */}
  <div className="sticky top-0 z-20 bg-background">
    <div className="container mx-auto max-w-7xl px-4">
      {/* Header Section */}
      <div className="py-4 md:py-[14px]">
        <LibraryPageHeader />
      </div>

      {/* Toolbar Section */}
      <div className="pb-4">
        <div className="flex items-center gap-4">
          {/* Search Input */}
          {/* Filter Buttons */}
          {/* View Mode Toggle (DISABLED/COMMENTED) */}
        </div>
      </div>
    </div>
  </div>

  {/* Main Content Area */}
  <div className="container mx-auto max-w-7xl px-4 py-2">
    {isLoading ? (
      <LoadingState />
    ) : filteredThreads.length === 0 ? (
      <EmptyState />
    ) : (
      <>
        {/* Thread List */}
        <div className="flex flex-col gap-3 md:gap-[12px]">
          {displayedThreads.map((thread) => (
            <ThreadCard ... />
          ))}
        </div>

        {/* Infinite Scroll Trigger */}
        {hasMore && (
          <div ref={loadMoreRef} className="flex items-center justify-center mt-8 py-4">
            {isLoadingMore && <Loader2 className="animate-spin" />}
          </div>
        )}
      </>
    )}
  </div>
</div>
```

### CSS Classes & Tailwind Usage

| Component | Classes | Purpose |
|-----------|---------|---------|
| **Container** | `min-h-screen` | Full viewport height minimum |
| **Sticky Header** | `sticky top-0 z-20 bg-background` | Remains visible on scroll |
| **Max Width** | `container mx-auto max-w-7xl px-4` | Max 80rem, centered, responsive padding |
| **Thread List** | `flex flex-col gap-3 md:gap-[12px]` | Vertical stack, responsive gaps |
| **Thread List Mobile** | `gap-3` | 12px gap on mobile |
| **Thread List Tablet+** | `md:gap-[12px]` | 12px gap on tablets and up |
| **Scroll Trigger** | `flex items-center justify-center mt-8 py-4` | Centered loading indicator |

### Responsive Breakpoints

- **Mobile (< 768px):** 1-column file grid, larger padding
- **Tablet (768px - 1024px):** 3-column file grid
- **Desktop (> 1024px):** Full-width 3-column file grid, max-w-7xl constraint

---

## Feature Implementation Details

### 1. Infinite Scroll Loading

**How It Works:**

1. Page starts with `displayCount = 5` threads
2. User scrolls down and enters trigger zone
3. `IntersectionObserver` detects `loadMoreRef` element in viewport
4. Calls `loadMore()` → `setDisplayCount(prev => prev + 5)`
5. UI re-renders with 10 threads
6. Process repeats until all filtered threads shown

**Code Flow:**

```typescript
const loadMore = useCallback(() => {
  if (isLoadingMore || !hasMore) return;  // Guard clauses
  
  setIsLoadingMore(true);
  setTimeout(() => {
    setDisplayCount(prev => prev + ITEMS_PER_PAGE);
    setIsLoadingMore(false);
  }, 300);  // 300ms delay
}, [isLoadingMore, hasMore]);
```

**Performance Benefits:**

- ✅ Only renders visible threads (5 at a time)
- ✅ No additional API calls needed (uses already-fetched data)
- ✅ Smooth scrolling experience
- ✅ Better mobile performance (reduced initial render)

---

### 2. Search Feature

**UI:**
```tsx
<div className="relative flex-1 max-w-md">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" />
  <Input
    placeholder="Search threads..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="pl-9"
  />
</div>
```

**Logic:**
- Searches `projectName` field (case-insensitive)
- Partial matching with `.includes()`
- Resets `displayCount` to 5 on search change
- Trigger recompute of `filteredThreads` via `useMemo`

**Example:**
- Input: "api"
- Matches: "API Configuration", "REST API Testing", "GraphQL API"
- Non-matches: "data processing", "user management"

---

### 3. Filter Buttons (All / Favorites)

**UI:**
```tsx
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
```

**Logic:**
```typescript
if (filterMode === 'favorites') {
  result = result.filter((thread) => favorites.has(thread.threadId));
}
```

**Visual Feedback:**
- Active button: `variant="default"` (filled background)
- Inactive button: `variant="outline"` (hollow, border only)

---

### 4. Favorites System

**Toggle Favorite:**
```typescript
const toggleFavorite = (threadId: string) => {
  setFavorites((prev) => {
    const next = new Set(prev);
    if (next.has(threadId)) {
      next.delete(threadId);  // Remove from favorites
    } else {
      next.add(threadId);     // Add to favorites
    }
    // Persist to localStorage
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
    return next;
  });
};
```

**Star Icon Styling:**
```tsx
<Star
  className={cn(
    'w-4 h-4',
    isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
  )}
/>
```

**Storage Details:**
- **Key:** `library-favorites`
- **Format:** JSON array of thread IDs: `["uuid1", "uuid2", "uuid3"]`
- **Scope:** Per-browser localStorage (domain-scoped)
- **Persistence:** Survives browser restarts, only cleared with localStorage reset

---

### 5. View Mode Toggle (DISABLED)

**Status:** ❌ Currently disabled (commented out in code)

The view mode toggle UI exists but is commented out. The design currently uses only list/card view (Manus design system requirement). To re-enable:

1. Uncomment lines 205-220 in `library-page.tsx`
2. Update ThreadCard to support `viewMode` prop
3. Implement grid layout in ThreadCard

---

### 6. Loading & Empty States

**Loading State:**
```tsx
{isLoading ? (
  <div className="flex items-center justify-center h-64">
    <p className="text-muted-foreground">Loading threads...</p>
  </div>
)}
```

**Empty State (No Results):**
```tsx
{filteredThreads.length === 0 ? (
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
)}
```

---

## Complete Reconstruction Guide

### Prerequisites

**Required Dependencies:**
- `@tanstack/react-query` - Data fetching & caching
- `lucide-react` - Icons
- `next/navigation` - Router
- UI component library (Button, Input, etc.)

**Required API Functions:**
```typescript
import { getThreads, getProjects, listSandboxFiles, getSandboxFileContent } from '@/lib/api';
```

**Required Types:**
```typescript
import type { ThreadWithProject } from '@/hooks/react-query/sidebar/use-sidebar';
```

---

### Step 1: Create Route File

**File:** `frontend/src/app/(dashboard)/library/page.tsx`

```typescript
import { LibraryPage } from '@/components/library/library-page';

export default function LibraryRoute() {
  return <LibraryPage />;
}
```

---

### Step 2: Create LibraryPageHeader Component

**File:** `frontend/src/components/library/library-page-header.tsx`

```tsx
'use client';

import { BookOpen } from 'lucide-react';

export function LibraryPageHeader() {
  return (
    <div>
      <div className="flex items-center gap-2">
        <BookOpen className="w-6 h-6" />
        <h1 className="text-2xl font-bold">Library</h1>
      </div>
      <p className="text-sm text-muted-foreground mt-1">
        Browse and manage your conversation threads
      </p>
    </div>
  );
}
```

---

### Step 3: Create Main LibraryPage Component

**File:** `frontend/src/components/library/library-page.tsx`

This is the main component containing:
- State management (displayCount, filterMode, searchQuery, favorites, isLoadingMore)
- React Query hooks (useQuery for threads & projects)
- useMemo for data processing (combine, filter, slice)
- useEffect for scroll behavior (IntersectionObserver setup)
- useCallback for loadMore function
- Render logic with sticky header, toolbar, thread list, and infinite scroll trigger

See actual file for complete implementation: `frontend/src/components/library/library-page.tsx`

---

### Step 4: Create ThreadCard Component

**File:** `frontend/src/components/library/thread-card.tsx`

The ThreadCard component:
1. Receives thread, isFavorite, onToggleFavorite, viewMode props
2. Fetches projects to get sandboxId
3. Uses useQuery to fetch files from sandbox
4. Shows up to 6 files in 3-column grid
5. Has "Show More" button if > 6 files
6. Renders FileCard for each file
7. Opens FileViewerModal on file click

See actual file for complete implementation: `frontend/src/components/library/thread-card.tsx`

---

### Step 5: Create FileCard Component

**File:** `frontend/src/components/library/file-card.tsx`

The FileCard component:
1. Displays individual file with icon
2. If markdown, fetches content via useQuery
3. Shows MarkdownPreview for markdown files
4. Shows large icon for non-markdown files
5. Has metadata (size, date)
6. Opens FileViewerModal on click

---

### Step 6: Create MarkdownPreview Component

**File:** `frontend/src/components/library/markdown-preview/MarkdownPreview.tsx`

The MarkdownPreview component:
1. Uses `react-markdown` library
2. Accepts markdown prop
3. Truncates to maxLines and maxChars
4. Custom renderers for code, headings, lists, etc.
5. Uses remark-gfm for GitHub flavored markdown

---

### Step 7: Set Up Type Definitions

**File:** `frontend/src/hooks/react-query/sidebar/use-sidebar.ts` (append)

```typescript
export type ThreadWithProject = {
  threadId: string;
  projectId: string;
  projectName: string;
  url: string;
  updatedAt: string;
  iconName?: string | null;
};
```

---

### Step 8: Verify All Imports

**Core Imports in LibraryPage:**
```typescript
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getThreads, getProjects } from '@/lib/api';
import { LibraryPageHeader } from './library-page-header';
import { ThreadCard } from './thread-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { LayoutGrid, List, Search, Star, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ThreadWithProject } from '@/hooks/react-query/sidebar/use-sidebar';
```

---

## Constants

```typescript
const ITEMS_PER_PAGE = 5;              // Load increment
const FAVORITES_KEY = 'library-favorites';  // localStorage key
```

---

## Error Handling

**Graceful Degradation:**

1. **No threads/projects:** Shows empty state
2. **Search returns nothing:** Shows "No threads found" message
3. **Favorites corrupted:** Catches JSON parse error, starts fresh
4. **IntersectionObserver not supported:** Component still works (just no infinite scroll)

---

## Performance Characteristics

| Aspect | Performance |
|--------|-------------|
| **Initial Load** | ~5 threads rendered |
| **Memory Usage** | O(displayCount) threads in DOM |
| **Search Performance** | O(n) where n = total threads |
| **Sort Performance** | O(n log n) on initial load |
| **Scroll Performance** | ~60fps with 100+ threads |
| **API Calls** | 2 on mount (getThreads, getProjects) |

---

## Known Limitations

1. ⚠️ **View Mode Toggle Disabled** - Grid/List mode commented out
2. ⚠️ **No Virtual Scrolling** - Renders all visible threads (OK for < 1000)
3. ⚠️ **Favorites Not Synced** - Only localStorage, no server sync
4. ⚠️ **No Real-time Updates** - Manual refresh required for new threads

---

## Testing Checklist

- [ ] Load page with 20+ threads
- [ ] Search for thread by project name
- [ ] Star/unstar threads
- [ ] Filter by "Favorites"
- [ ] Scroll to bottom and verify infinite scroll triggers
- [ ] Clear favorites from localStorage and verify reset
- [ ] Test on mobile (responsive layout)
- [ ] Test with no threads
- [ ] Test with zero search results

---

## Related Documentation

- **Data Flow:** `LIBRARY_DATA_FLOW.md`
- **Sidebar Integration:** `CONTENT_AREA_RENDERING_PATTERNS.md`
- **API Reference:** `frontend/src/lib/api.ts`
- **File Preview System:** `LIBRARY_DATA_FLOW.md#file-preview-data-flow`
