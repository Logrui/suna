# Library Page Technical Architecture & Implementation Guide

**File Location:** `frontend/src/components/library/library-page.tsx`  
**Route:** `/library`  
**Date:** November 3, 2025 (Updated: Latest Restored Version from ec3bfa013)

---

## Table of Contents

1. [Page Overview](#page-overview)
2. [Component Architecture](#component-architecture)
3. [Data Flow & State Management](#data-flow--state-management)
4. [UI Layout & Structure](#ui-layout--structure)
5. [Infinite Scroll Implementation](#infinite-scroll-implementation)
6. [File Preview System](#file-preview-system)
7. [Feature Implementation Details](#feature-implementation-details)
8. [Complete Reconstruction Guide](#complete-reconstruction-guide)

---

## Page Overview

### Purpose
The Library Page provides users with a browsable, searchable, and filterable interface to access all conversation threads with **inline file previews** from their associated Daytona sandboxes. It serves as a centralized hub for managing and navigating thread history with rich preview capabilities.

### Display Features
- **Infinite Scroll Loading** - Progressive loading with Intersection Observer (5 threads at a time)
- **File Previews** - Inline markdown and file preview cards within each thread
- **File Type Icons** - Visual indicators for different file types (code, documents, archives, etc.)
- **Search Functionality** - Full-text search across thread names (by project name)
- **Favorites System** - Star/bookmark threads with localStorage persistence
- **Filter Modes** - All threads vs. Favorites only
- **Sticky Header** - Search and filters remain visible while scrolling
- **Responsive Design** - Adapts layouts with `container mx-auto max-w-7xl` wrapper

### Key Metrics
- **Initial Load:** 5 threads
- **Load More Increment:** 5 threads per scroll trigger
- **Storage:** Favorites stored in browser localStorage
- **Key:** `library-favorites`
- **Sorting:** Threads sorted by `updated_at` descending (newest first)

---

## Component Architecture

### Component Hierarchy

```
LibraryPage (main container, state management, infinite scroll)
├── LibraryPageHeader (title & description)
├── Sticky Toolbar (search, filters)
└── Content Area (container mx-auto max-w-7xl)
    ├── LoadingState (loading indicator)
    ├── EmptyState (no results messaging)
    └── ThreadList (flex flex-col gap-3)
        └── ThreadCard[] (repeated for each displayed thread)
            ├── Project info, updated date, favorite toggle
            ├── FileCard[] (files from sandbox)
            │   ├── FileIcon (type-specific icon)
            │   ├── MarkdownPreview (if markdown file)
            │   └── File metadata
            └── Show More/Less toggle for files
    └── Infinite Scroll Trigger (IntersectionObserver ref)
        └── Loading spinner (if more content available)
```

### Component Files

| Component | File Path | Purpose |
|-----------|-----------|---------|
| **LibraryPage** | `library-page.tsx` | Main container, infinite scroll, state management |
| **LibraryPageHeader** | `library-page-header.tsx` | Header with title & description |
| **ThreadCard** | `thread-card.tsx` | Individual thread with file previews |
| **FileCard** | `file-card.tsx` | Individual file preview card with markdown rendering |
| **MarkdownPreview** | `markdown-preview/MarkdownPreview.tsx` | Renders markdown content with code highlighting |
| **FileIcon** | `file-icons/FileIcon.tsx` | Maps file type to icon component |
| **File Type Icons** | `file-icons/icons/*.tsx` | Individual icon components (CodeIcon, DocumentIcon, PdfIcon, etc.) |

---

## Data Flow & State Management

### State Variables

```typescript
// View preferences
const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
const [filterMode, setFilterMode] = useState<'all' | 'favorites'>('all');
const [searchQuery, setSearchQuery] = useState('');

// Favorites persistence
const [favorites, setFavorites] = useState<Set<string>>(new Set());

// Infinite scroll
const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE); // Show 5 initially
const [isLoadingMore, setIsLoadingMore] = useState(false);
const loadMoreRef = useRef<HTMLDivElement>(null);
```

**Key Changes from Old Version:**
- ❌ Removed: `currentPage` (pagination)
- ❌ Removed: Grid/List view toggle (commented out, only list view)
- ✅ Added: `displayCount` for progressive loading
- ✅ Added: `isLoadingMore` for loading state during scroll
- ✅ Added: `loadMoreRef` for IntersectionObserver anchor

### Data Fetching

#### Query 1: Fetch Threads
```typescript
const { data: threads = [], isLoading: threadsLoading } = useQuery({
  queryKey: ['threads'],
  queryFn: () => getThreads(),
});
```
- **Source:** `lib/api.ts` → `getThreads()`
- **Authentication:** Uses current user's account_id
- **Returns:** `Thread[]` with fields: `thread_id`, `project_id`, `created_at`, `updated_at`, `metadata`
- **Filtering:** Only threads belonging to current user

#### Query 2: Fetch Projects
```typescript
const { data: projects = [], isLoading: projectsLoading } = useQuery({
  queryKey: ['projects'],
  queryFn: () => getProjects(),
});
```
- **Source:** `lib/api.ts` → `getProjects()`
- **Authentication:** Uses current user's account_id
- **Returns:** `Project[]` with fields: `id`, `name`, `description`, `created_at`, `updated_at`, `sandbox`, `icon_name`
- **Filtering:** Only projects belonging to current user

### Data Processing

#### Step 1: Combine Threads with Project Data & Sort
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
      // Sort by updated_at descending (newest first)
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
}, [threads, projects]);
```

**Key Changes:**
- ✅ Added: Sort by `updated_at` descending (newest threads first)
- ✅ Ensures consistent ordering regardless of API response order

**Type: `ThreadWithProject`**
```typescript
type ThreadWithProject = {
  threadId: string;
  projectId: string;
  projectName: string;
  url: string;
  updatedAt: string;
  iconName?: string | null;
};
```

#### Step 2: Filter Threads (Favorites & Search)
```typescript
const filteredThreads = useMemo(() => {
  let result = threadsWithProjects;

  // Apply favorites filter
  if (filterMode === 'favorites') {
    result = result.filter((thread) => favorites.has(thread.threadId));
  }

  // Apply search filter (searches projectName)
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
// Display limited threads (for progressive loading)
const displayedThreads = useMemo(() => {
  return filteredThreads.slice(0, displayCount);
}, [filteredThreads, displayCount]);

const hasMore = filteredThreads.length > displayCount;

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
```

**How It Works:**
1. `displayedThreads` - Slice of `filteredThreads` up to `displayCount`
2. `loadMore()` - Increments `displayCount` by 5 (ITEMS_PER_PAGE)
3. `IntersectionObserver` - Watches `loadMoreRef` element at bottom
4. When element becomes visible (`threshold: 0.1`) - triggers `loadMore()`
5. 300ms delay prevents rapid successive loads
6. Spinner shows while loading

**Key Changes:**
- ✅ Replaced pagination (`currentPage`) with progressive loading (`displayCount`)
- ✅ Uses IntersectionObserver instead of "Next" button
- ✅ Smoother UX - no page jumps, continuous scroll
- ✅ More performant - only renders visible threads

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
}, []);
```

#### Reset Display Count on Filter/Search Change
```typescript
useEffect(() => {
  setDisplayCount(ITEMS_PER_PAGE);
}, [filterMode, searchQuery]);
```

**Purpose:** When user changes filter or search, reset to showing only first 5 threads

---

## UI Layout & Structure

### Overall Layout
```typescript
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
          {/* Search, Filters */}
        </div>
      </div>
    </div>
  </div>

  {/* Content */}
  <div className="container mx-auto max-w-7xl px-4 py-2">
    {/* Loading State | Empty State | Thread List */}
    <div className="flex flex-col gap-3 md:gap-[12px]">
      {displayedThreads.map((thread) => (
        <ThreadCard ... />
      ))}
    </div>

    {/* Infinite Scroll Trigger & Loading Spinner */}
    {hasMore && (
      <div ref={loadMoreRef} className="flex items-center justify-center mt-8 py-4">
        {isLoadingMore && (
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        )}
      </div>
    )}
  </div>
</div>
```

### CSS Classes Used

| Area | Class | Purpose |
|------|-------|---------|
| Container | `min-h-screen` | Full viewport height minimum |
| Sticky Header | `sticky top-0 z-20 bg-background` | Stays at top while scrolling |
| Width Constraint | `container mx-auto max-w-7xl px-4` | Max 80rem width, centered, responsive padding |
| Content | `flex flex-col gap-3 md:gap-[12px]` | Vertical list, 3px mobile gap / 12px tablet+ |
| Thread Grid | `flex flex-col gap-3 md:gap-[12px]` | Stacked vertical layout (Manus design) |
| Scroll Trigger | `flex items-center justify-center mt-8 py-4` | Centered loader at bottom |

**Key Changes:**
- ✅ Changed from `h-full w-full` to `min-h-screen`
- ✅ Sticky header with `top-0 z-20`
- ✅ `container mx-auto max-w-7xl` wrapper (max width, centered)
- ✅ Only list view (grid view toggle is commented out)
- ✅ Dynamic gap: `gap-3 md:gap-[12px]` (Manus design system)

---

## Infinite Scroll Implementation

### How It Works

1. **Initial State**: `displayCount = 5` (ITEMS_PER_PAGE)
2. **User Scrolls**: Page content loads, user scrolls to bottom
3. **Trigger Element**: `<div ref={loadMoreRef}>` at bottom becomes visible
4. **IntersectionObserver**: Detects element in viewport (threshold: 0.1)
5. **Load More**: Increments `displayCount` by 5
6. **Re-render**: `displayedThreads` now shows more items
7. **Repeat**: Cycle continues until all filtered threads are shown

### Code Flow

```typescript
// 1. Set initial display count
const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE); // 5

// 2. Slice threads for display
const displayedThreads = useMemo(() => {
  return filteredThreads.slice(0, displayCount);
}, [filteredThreads, displayCount]);

// 3. Check if more content available
const hasMore = filteredThreads.length > displayCount;

// 4. Load more function with delay
const loadMore = useCallback(() => {
  if (isLoadingMore || !hasMore) return;
  setIsLoadingMore(true);
  setTimeout(() => {
    setDisplayCount(prev => prev + ITEMS_PER_PAGE); // Add 5 more
    setIsLoadingMore(false);
  }, 300);
}, [isLoadingMore, hasMore]);

// 5. Observe scroll trigger element
useEffect(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
        loadMore();
      }
    },
    { threshold: 0.1 }
  );
  // ... observe loadMoreRef
}, [hasMore, isLoadingMore, loadMore]);
```

### Performance Benefits

| Aspect | Benefit |
|--------|---------|
| **Memory** | Only renders visible threads, not all 100+ |
| **Network** | No additional API calls - uses already-fetched data |
| **UX** | Smooth scrolling, no page jumps, continuous experience |
| **Mobile** | Reduces initial load time, better for low-bandwidth |

---

## File Preview System

### Overview

Each ThreadCard now displays **inline file previews** from the associated Daytona sandbox:

```
ThreadCard
├── Project Info (name, date, star button)
├── FileCard[] (up to 3 shown, expandable)
│   ├── File Icon (type-specific)
│   ├── File Name
│   ├── MarkdownPreview (if .md file)
│   └── File Size / Type
└── "Show More / Show Less" toggle
```

### Data Flow

```typescript
// In ThreadCard
const sandboxId = project?.sandbox?.id;

// Fetch files from sandbox
const { data: files = [] } = useQuery({
  queryKey: ['sandbox-files', sandboxId, '/workspace'],
  queryFn: () => listSandboxFiles(sandboxId!, '/workspace'),
  enabled: !!sandboxId && !!project,
});

// Render each file with FileCard
{files.map((file) => (
  <FileCard
    key={file.path}
    file={file}
    IconComponent={getFileType(file.path).icon}
    isMarkdown={getFileType(file.path).type === 'markdown'}
    sandboxId={sandboxId!}
  />
))}
```

### FileCard Component

Located: `frontend/src/components/library/file-card.tsx`

**Features:**
- ✅ Fetches markdown content via `getSandboxFileContent()`
- ✅ Renders markdown with syntax highlighting
- ✅ Shows file icon, name, and metadata
- ✅ Expandable/collapsible preview
- ✅ Handles various file types

### MarkdownPreview Component

Located: `frontend/src/components/library/markdown-preview/MarkdownPreview.tsx`

**Features:**
- ✅ Uses `react-markdown` library
- ✅ Code syntax highlighting via `CodeRenderer`
- ✅ Custom component rendering
- ✅ Safe HTML rendering

### File Type Detection

Located: `frontend/src/lib/utils/fileTypeDetector.ts`

**Exports:**
```typescript
const FILE_ICONS = {
  'code': CodeIcon,
  'document': DocumentIcon,
  'pdf': PdfIcon,
  'spreadsheet': SpreadsheetIcon,
  'archive': ArchiveIcon,
  'default': DefaultIcon,
};

function getFileType(path: string): { type: string; icon: Component }
```

**Supported File Types:**
- Code: `.ts`, `.js`, `.py`, `.java`, `.go`, `.rs`, `.jsx`, `.tsx`
- Document: `.doc`, `.docx`, `.txt`, `.md`
- PDF: `.pdf`
- Spreadsheet: `.xls`, `.xlsx`, `.csv`
- Archive: `.zip`, `.tar`, `.gz`, `.7z`
- Default: anything else

---

## Feature Implementation Details

### 1. Search Feature

**UI Component:**
```typescript
<div className="relative flex-1 max-w-md">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
  <Input
    placeholder="Search threads..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="pl-9"
  />
</div>
```

**Search Logic:**
- Searches across `projectName` field (case-insensitive)
- Partial matching (contains, not exact)
- Triggers filter recalculation via `useMemo`
- Resets display to first 5 items (`displayCount = ITEMS_PER_PAGE`)
- Infinite scroll triggers again as user scrolls

**Example:**
- Search: "api"
- Matches: "API Tester", "GraphQL API", "REST API Client"

---

### 2. Filter System

**All / Favorites Toggle:**
```typescript
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

**Filter Logic:**
```typescript
if (filterMode === 'favorites') {
  result = result.filter((thread) => favorites.has(thread.threadId));
}
```

**Visual Feedback:**
- Active button shows `variant="default"` (filled)
- Inactive button shows `variant="outline"` (hollow)

---

### 3. View Mode Toggle (DEPRECATED)

**Status:** ❌ **DISABLED/COMMENTED OUT**

The view mode toggle (Grid/List) has been disabled in the current design. Only list view is used (Manus design system requirement).

```typescript
{/* View Mode Toggle - Hidden for now, Manus only uses list view */}
{/* <div className="flex items-center gap-1 border rounded-md">
  ... grid/list buttons ...
</div> */}
```

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

**Storage:**
- **Key:** `library-favorites`
- **Format:** JSON stringified array of threadIds
- **Scope:** Per-browser (localStorage is domain-scoped)

**UI Indicator:**
```typescript
<Star
  className={cn(
    'w-4 h-4',
    isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
  )}
/>
```

---

### 5. Infinite Scroll Loading Indicator

**Display:**
```typescript
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
```

**How It Works:**
1. `hasMore` - True if `filteredThreads.length > displayCount`
2. `loadMoreRef` - Div element that triggers IntersectionObserver
3. When ref becomes visible → `loadMore()` fires → `displayCount` increases
4. Spinner animates while `isLoadingMore` is true
5. 300ms delay prevents rapid successive loads

---

### 6. Empty States

**No Results:**
```typescript
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
)
```

---

## ThreadCard Component Details

### Grid View Card Structure

```
┌─────────────────────────┐
│ Title          ⭐      │  (Favorite button, top-right)
├─────────────────────────┤
│                         │
│   📄 Associated files   │  (Placeholder content area)
│   Files will be shown   │
│   when viewing thread   │
│                         │
├─────────────────────────┤
│ Updated Date    →      │  (Footer with date & arrow)
└─────────────────────────┘
```

**Code:**
```typescript
if (viewMode === 'grid') {
  return (
    <Card
      className="flex flex-col p-4 cursor-pointer hover:bg-accent/50 transition-colors h-full"
      onClick={handleCardClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-medium line-clamp-2 flex-1">{threadName}</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleFavoriteClick}
          className="flex-shrink-0 -mt-1"
        >
          <Star className={cn(
            'w-4 h-4',
            isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
          )} />
        </Button>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center py-6 px-4 bg-muted/30 rounded-md border border-dashed mb-3">
        <FileText className="w-8 h-8 text-muted-foreground mb-2" />
        <p className="text-xs text-muted-foreground text-center">Associated files</p>
        <p className="text-xs text-muted-foreground/70 text-center mt-1">
          Files will be shown when viewing the thread
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{getRelativeDate()}</span>
        <ChevronRight className="w-4 h-4" />
      </div>
    </Card>
  );
}
```

### List View Card Structure

```
📄  Thread Name               Jun 15  ⭐  →
```

**Code:**
```typescript
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
        <Star className={cn(
          'w-4 h-4',
          isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
        )} />
      </Button>
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
    </Card>
  );
}
```

### Date Formatting

```typescript
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
```

**Examples:**
- Today: "Today"
- 1 day ago: "Yesterday"
- 3 days ago: "Wed"
- 2 weeks ago: "Jun 15"

### Navigation

```typescript
const handleCardClick = () => {
  router.push(thread.url);  // Navigate to: /projects/{projectId}/thread/{threadId}
};
```

---

## Complete Reconstruction Guide

### Step 1: Create Page Route File

**File:** `frontend/src/app/(dashboard)/library/page.tsx`

```typescript
import { LibraryPage } from '@/components/library/library-page';

export default function LibraryRoute() {
  return <LibraryPage />;
}
```

### Step 2: Create Main LibraryPage Component

**File:** `frontend/src/components/library/library-page.tsx`

```typescript
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
  // State management
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  // Load favorites from localStorage
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

  // Data fetching
  const { data: threads = [], isLoading: threadsLoading } = useQuery({
    queryKey: ['threads'],
    queryFn: () => getThreads(),
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => getProjects(),
  });

  const isLoading = threadsLoading || projectsLoading;

  // Process threads with projects
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
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  // Filter threads
  const filteredThreads = useMemo(() => {
    let result = threadsWithProjects;

    if (filterMode === 'favorites') {
      result = result.filter((thread) => favorites.has(thread.threadId));
    }

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

  useEffect(() => {
    setCurrentPage(1);
  }, [filterMode, searchQuery]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <LibraryPageHeader />

      {/* Toolbar */}
      <div className="flex items-center gap-4 px-6 py-4 border-b">
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

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 border rounded-md">
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
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-4">
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
            {/* Thread Grid/List */}
            <div
              className={cn(
                viewMode === 'grid'
                  ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                  : 'flex flex-col gap-2'
              )}
            >
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
```

### Step 3: Create LibraryPageHeader Component

**File:** `frontend/src/components/library/library-page-header.tsx`

```typescript
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

### Step 4: Create ThreadCard Component

**File:** `frontend/src/components/library/thread-card.tsx`

```typescript
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
  const threadName = thread.projectName;

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

  // Grid view
  return (
    <Card
      className="flex flex-col p-4 cursor-pointer hover:bg-accent/50 transition-colors h-full"
      onClick={handleCardClick}
    >
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

      <div className="flex-1 flex flex-col items-center justify-center py-6 px-4 bg-muted/30 rounded-md border border-dashed mb-3">
        <FileText className="w-8 h-8 text-muted-foreground mb-2" />
        <p className="text-xs text-muted-foreground text-center">Associated files</p>
        <p className="text-xs text-muted-foreground/70 text-center mt-1">
          Files will be shown when viewing the thread
        </p>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{getRelativeDate()}</span>
        <ChevronRight className="w-4 h-4" />
      </div>
    </Card>
  );
}
```

### Step 5: Add Types

**File:** `frontend/src/hooks/react-query/sidebar/use-sidebar.ts` (append to existing file)

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

### Step 6: Verify Dependencies

**Required UI Components:**
- `@/components/ui/card` - Card component
- `@/components/ui/input` - Input field
- `@/components/ui/button` - Button component

**Required Libraries:**
- `@tanstack/react-query` - Data fetching
- `lucide-react` - Icons (Search, Star, LayoutGrid, List, BookOpen, FileText, ChevronRight)
- `next/navigation` - useRouter hook
- `@/lib/utils` - cn() function

**Required API Functions:**
- `@/lib/api` → `getThreads()`
- `@/lib/api` → `getProjects()`

---

## Performance Optimizations

### Memoization
- `threadsWithProjects` - Recalculates only when threads or projects change
- `filteredThreads` - Recalculates only when filters or search change
- `paginatedThreads` - Recalculates only when pagination changes

### Data Fetching
- React Query caches API responses
- `isSingleton: true` in Supabase client prevents duplicate queries

### Rendering
- Only visible threads on current page render
- ThreadCard components only re-render when data changes

---

## Browser Storage

### localStorage Keys
- **`library-favorites`**: Stores array of favorite thread IDs
- **Format:** `["threadId1", "threadId2", ...]`
- **Persistence:** Across browser sessions

---

## Related Documentation

- **Sidebar Integration:** `/left-side-bar-library/SIDEBAR_INTEGRATION.md`
- **Content Area Pattern:** `/left-side-bar-library/CONTENT_AREA_RENDERING_PATTERNS.md`
- **API Reference:** `frontend/src/lib/api.ts`

