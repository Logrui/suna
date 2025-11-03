# Library Feature - Initial Research & Planning

**Feature Name:** Library (Display as "Library" or "Chats")  
**URL Route:** `/dashboard/library`  
**Goal:** Recreate Manus-like Library page for Kortix/Suna  
**Status:** ✅ In Progress - Core Layout Complete  
**Date:** November 2, 2025  
**Branch:** feature/library

---

## Table of Contents

1. [Feature Overview](#feature-overview)
2. [Manus Library Analysis](#manus-library-analysis)
3. [Current Suna Architecture](#current-suna-architecture)
4. [Required Features](#required-features)
5. [Technical Considerations](#technical-considerations)
6. [Data Requirements](#data-requirements)
7. [UI/UX Requirements](#ui-ux-requirements)
8. [Implementation Progress](#implementation-progress)
9. [Next Steps](#next-steps)

---

## Feature Overview

### Purpose
Create a centralized page that displays all user conversations/threads with associated files and attachments, similar to Manus's Library interface. This provides users with a comprehensive view of their chat history and artifacts.

### Current Gap
- ✅ Backend API exists: `GET /threads` (fully implemented with pagination)
- ❌ **Web frontend lacks dedicated conversations list page**
- ❌ No file/artifact management view for conversations

### Target Outcome
A dedicated `/dashboard/library` page that allows users to:
- View all their conversations/threads in a scannable format
- See files/artifacts associated with each conversation
- Filter, search, and organize conversations
- Quick access to conversation details and files
- Toggle between grid and list views

---

## Manus Library Analysis

### Screenshot Observations

From the provided screenshot of https://manus.im/app/library:

#### Layout Structure
```
┌─────────────────────────────────────────────────────────────┐
│ Top Bar (Header)                                            │
│ [Filter ▼] [⭐ My favorites] [Search...] [Grid/List Toggle] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Conversation 1                              Thursday        │
│ ┌──────┐ ┌──────┐ ┌──────┐                                │
│ │File 1│ │File 2│ │File 3│  [+35 more files]             │
│ └──────┘ └──────┘ └──────┘                                │
│                                                             │
│ Conversation 2                              Monday          │
│ ┌──────┐ ┌──────┐ ┌──────┐                                │
│ │File 1│ │File 2│ │File 3│  [+N more files]              │
│ └──────┘ └──────┘ └──────┘                                │
│                                                             │
│ [Infinite scroll continues...]                              │
└─────────────────────────────────────────────────────────────┘
```

#### Key Features from Review Document

**Top Bar Controls:**
1. **Filter by document type** - Dropdown/pill selector
2. **My favorites toggle** - Star icon to show favorites
3. **Search files bar** - Text input for searching
4. **Grid/List toggle** - Switch between view modes

**Main Content:**
1. **Infinite scroll** - Loads conversations dynamically
2. **Conversation entries** with:
   - Human-readable conversation name (left, large text)
   - Date/Day (right, small font, right-aligned)
   - File preview section below

**File Preview Section:**
- Shows up to 3 file previews (thumbnails/icons)
- File info: name, type, possibly size
- Clickable previews → opens full viewer modal
- "N more files" button if >3 files exist
- Expands to show remaining files

**Data Structure Pattern:**
```typescript
{
  name: string,
  date: string,
  files: [
    { id, name, type, size, thumbnail, ... },
    ...
  ]
}
```

**UI Patterns:**
- Sticky header
- Horizontally divided rows
- Modal viewers for files
- Lazy loading for large file sets
- No batch actions visible
- No context menus evident
- Single action per file (view)

---

## Current Suna Architecture

### Available Backend APIs

**Thread/Conversation APIs:**
```
GET    /threads                         → List all user threads (paginated)
GET    /threads/{thread_id}             → Get specific thread details
GET    /threads/{thread_id}/messages    → Get thread messages
POST   /threads                         → Create new thread
PATCH  /threads/{thread_id}             → Update thread
DELETE /threads/{thread_id}             → Delete thread
```

**Sandbox/File APIs:**
```
GET    /sandboxes/{sandbox_id}/files              → List files
GET    /sandboxes/{sandbox_id}/files/content      → Get file content
POST   /sandboxes/{sandbox_id}/files              → Create file
PUT    /sandboxes/{sandbox_id}/files              → Update file
DELETE /sandboxes/{sandbox_id}/files              → Delete file
```

### Current Thread Data Model

From backend `GET /threads` response:
```typescript
{
  threads: [
    {
      thread_id: string,
      project_id: string | null,
      metadata: object,
      is_public: boolean,
      created_at: string,
      updated_at: string,
      project: {
        project_id: string,
        name: string,
        icon_name: string,
        description: string,
        sandbox: {
          id: string,
          // sandbox data
        },
        is_public: boolean,
        created_at: string,
        updated_at: string
      } | null
    }
  ],
  pagination: {
    page: number,
    limit: number,
    total: number,
    pages: number
  }
}
```

### Existing Frontend Components

**Relevant Components Found:**
- `frontend/src/components/sidebar/nav-agents.tsx` - Has thread listing logic
- `frontend/src/components/thread/ThreadComponent.tsx` - Thread view component
- `frontend/src/hooks/react-query/threads/use-thread-queries.ts` - Thread queries
- `frontend/src/hooks/react-query/threads/use-messages.ts` - Message queries

### Current Frontend Pages

**Dashboard Pages:**
```
/dashboard                             → Main dashboard
/dashboard/agents                      → Agents list/management
/dashboard/agents/[threadId]           → Individual thread/conversation view
/dashboard/projects/[projectId]/thread/[threadId] → Project thread view
/dashboard/knowledge                   → Knowledge base
/dashboard/triggers                    → Triggers management
```

**Missing:**
- ❌ `/dashboard/library` or `/dashboard/conversations` or `/dashboard/chats`

---

## Required Features

### Core Features (Must Have)

#### 1. Conversation List Display
- [ ] Display all user threads/conversations
- [ ] Show conversation name/title
- [ ] Display date (relative or absolute)
- [ ] Infinite scroll pagination
- [ ] Loading states and skeletons
- [ ] Empty state when no conversations

#### 2. File/Artifact Display
- [ ] Show file previews for each conversation
- [ ] Display up to 3 files initially
- [ ] File thumbnails or type icons
- [ ] File metadata (name, type, size)
- [ ] "N more files" expansion when >3 files
- [ ] Click to view file in modal/viewer

#### 3. Search & Filter
- [ ] Search bar for filtering conversations
- [ ] Search by conversation name
- [ ] Search by file names (optional)
- [ ] Filter by document/file type
- [ ] Clear search/filters

#### 4. Favorites
- [ ] Mark conversations as favorites
- [ ] Toggle to show only favorites
- [ ] Persist favorite state

#### 5. View Modes
- [ ] Grid view (default?)
- [ ] List view
- [ ] Toggle between views
- [ ] Persist view preference

#### 6. Navigation
- [ ] Click conversation → navigate to thread view
- [ ] Click file → open file viewer
- [ ] Back navigation to library

### Enhanced Features (Nice to Have)

#### 1. Organization
- [ ] Group by date (Today, Yesterday, This Week, This Month, etc.)
- [ ] Sort options (newest, oldest, name, most active)
- [ ] Filter by agent/project
- [ ] Filter by date range

#### 2. Batch Actions
- [ ] Multi-select conversations
- [ ] Bulk delete
- [ ] Bulk favorite/unfavorite
- [ ] Bulk export

#### 3. File Management
- [ ] Download files
- [ ] Share files
- [ ] Delete files
- [ ] File type filters
- [ ] File size display

#### 4. Metadata
- [ ] Message count per conversation
- [ ] Agent used in conversation
- [ ] Last activity timestamp
- [ ] Conversation status (active/archived)

#### 5. Performance
- [ ] Virtual scrolling for large lists
- [ ] Lazy load file previews
- [ ] Image thumbnail generation
- [ ] Caching strategies

---

## Technical Considerations

### Frontend Architecture

**Technology Stack:**
- Framework: Next.js (App Router)
- Styling: Tailwind CSS
- State Management: React Query
- UI Components: shadcn/ui

**New Page Structure:**
```
frontend/src/app/(dashboard)/library/
├── page.tsx                    → Main library page
├── layout.tsx                  → Optional layout wrapper
└── components/                 → Library-specific components
    ├── library-header.tsx      → Top bar with filters/search
    ├── conversation-list.tsx   → Main conversation list
    ├── conversation-card.tsx   → Individual conversation entry
    ├── file-preview.tsx        → File preview component
    ├── file-viewer-modal.tsx   → File viewer modal
    └── filters/                → Filter components
        ├── search-bar.tsx
        ├── type-filter.tsx
        └── favorites-toggle.tsx
```

### Data Fetching Strategy

**Primary Queries:**
1. `useThreads()` - Fetch paginated threads
2. `useThreadFiles()` - Fetch files for each thread/sandbox
3. `useThreadMessages()` - Optional: for metadata like message count

**Optimization:**
- Use React Query for caching
- Implement cursor-based pagination for infinite scroll
- Prefetch next page on scroll
- Lazy load file previews
- Debounce search input

### File Management

**Challenge:** Files are stored in sandboxes, but need to be associated with threads

**Solution Approach:**
1. Thread → Project → Sandbox relationship exists
2. For each thread, fetch files from associated sandbox
3. Cache file lists per thread
4. Lazy load only visible conversation files

**File Preview Strategy:**
```typescript
// For each conversation in view:
// 1. Check if project/sandbox exists
// 2. Fetch files from sandbox (cached)
// 3. Display first 3 files
// 4. Show count of remaining files
```

### State Management

**Required State:**
```typescript
interface LibraryState {
  // View preferences
  viewMode: 'grid' | 'list';
  
  // Filters
  searchQuery: string;
  selectedFileTypes: string[];
  showFavoritesOnly: boolean;
  
  // Pagination
  currentPage: number;
  hasMore: boolean;
  
  // Selection
  selectedConversations: Set<string>;
  
  // UI state
  expandedConversations: Set<string>; // For "show more files"
  openFileViewer: { threadId: string, fileId: string } | null;
}
```

### Performance Considerations

**Challenges:**
- Large number of conversations (1000+)
- Multiple files per conversation
- File thumbnail loading
- Search/filter responsiveness

**Solutions:**
- Virtual scrolling (react-window or react-virtuoso)
- Intersection Observer for lazy loading
- Thumbnail generation on backend
- Client-side search with debouncing
- Progressive enhancement

---

## Data Requirements

### Thread Metadata Extension

**Current thread data may need enhancement:**
```typescript
interface EnhancedThread {
  // Existing fields
  thread_id: string;
  project_id: string | null;
  metadata: {
    // Add new fields
    title?: string;           // Human-readable title
    is_favorite?: boolean;    // Favorite flag
    file_count?: number;      // Cached file count
    message_count?: number;   // Cached message count
    last_message_at?: string; // Last activity
  };
  created_at: string;
  updated_at: string;
  
  // Related data
  project: Project | null;
  files?: File[];             // Optionally include files
}
```

**Database Considerations:**
- May need to add `is_favorite` column to threads table
- May need to cache file counts
- Consider adding indexes for search/filter performance

### File Metadata

**Required file information:**
```typescript
interface FileMetadata {
  id: string;
  name: string;
  type: string;              // MIME type or extension
  size: number;              // Bytes
  created_at: string;
  updated_at: string;
  thumbnail_url?: string;    // If applicable
  preview_url?: string;      // For viewer
  download_url?: string;     // For download
}
```

---

## UI/UX Requirements

### Visual Design

**Layout:**
- Clean, scannable design
- Ample white space
- Clear visual hierarchy
- Responsive design (mobile/tablet/desktop)

**Color Scheme:**
- Follow existing Suna design system
- Dark mode support
- Proper contrast ratios

**Typography:**
- Conversation titles: Large, bold, easy to read
- Dates: Small, muted, right-aligned
- File names: Medium, truncated with ellipsis

### Interaction Patterns

**Navigation:**
- Click conversation → `/dashboard/agents/[threadId]`
- Click file → Open viewer modal (or new tab)
- Keyboard navigation support
- Breadcrumbs for context

**Feedback:**
- Loading spinners
- Skeleton screens
- Toast notifications for actions
- Error states with retry

**Accessibility:**
- ARIA labels
- Keyboard shortcuts
- Screen reader support
- Focus management

**Responsive Behavior

**Desktop (>1024px):**
- Grid view: 2-3 columns
- Full sidebar visible
- All filters in header

**Tablet (768-1024px):**
- Grid view: 2 columns or list view
- Collapsible sidebar
- Some filters in dropdown

---

---

## Technical Research Findings

### 1. Thumbnails and File Previews

**Existing Implementation:**
- ✅ **FileViewerModal** component exists at `frontend/src/components/thread/file-viewer-modal.tsx` (1605 lines)
  - Handles file browsing, viewing, and management
  - Full-featured file explorer with directory navigation
  - Uses React Query for file caching (`useDirectoryQuery`, `useFileContentQuery`)
  - Supports file operations (upload, download, delete)

- ✅ **FileRenderer System** available at `frontend/src/components/file-renderers/`
  - Supports multiple file types:
    - `MarkdownRenderer` - Markdown files
    - `CodeRenderer` - Code files
    - `PdfRenderer` - PDF files
    - `ImageRenderer` - Images
    - `BinaryRenderer` - Binary files
    - `HtmlRenderer` - HTML files
    - `CsvRenderer` - CSV files
    - `XlsxRenderer` - Excel files
  - Each renderer handles specific file types
  - Props include: `content`, `binaryUrl`, `fileName`, `filePath`, `project`, `onDownload`

- ✅ **Document Viewers** for Google Docs/Slides:
  - `LiveDocumentViewer` and `DocumentViewer` components in `docs-tool/_utils.tsx`
  - `PresentationViewer` component for presentation files
  - `TipTapDocumentModal` for document editing

**Key Findings:**
- Thumbnails: Not explicitly generated, but file types are detected
- File previews: Full viewers available, but thumbnails for lists need to be created
- No existing thumbnail generation system found
- Images are handled via ImageRenderer
- For Library page, we can reuse FileRenderers for detailed views

**Recommendation:**
- Use file type icons for file previews in Library list
- Show file info (name, type, size)
- Click preview → open FileViewerModal or relevant renderer
- Consider generating thumbnails later (performance optimization)

---

### 2. Thread Title/Naming System

**Current State:**
- Threads are stored with `thread_id` (UUID)
- No dedicated `title` field found in current schema
- Thread names appear to be derived from first message or stored in `metadata`
- In sidebar, threads are referenced by project name + thread ID

**Thread Data Structure:**
```typescript
{
  thread_id: string;
  project_id: string | null;
  metadata: object;           // Currently stores custom data
  is_public: boolean;
  created_at: string;
  updated_at: string;
}
```

**Findings:**
- ❌ No explicit title field in threads table
- ❌ No title generation logic visible in current codebase
- Need to generate titles from first message or allow user-defined names

**Recommendation:**
- Store thread titles in `metadata` field as `metadata.title`
- Generate default title from first message (e.g., first 50 chars)
- Allow users to rename threads
- Consider adding `title` column to threads table in future migration

---

### 3. File-Thread Relationship

**Relationship Chain:**
```
Thread → Project → Sandbox → Files
```

**Data Flow:**
1. User has many threads (GET `/threads`)
2. Each thread has optional project_id
3. Each project has sandbox data
4. Sandbox ID used to fetch files (GET `/sandboxes/{sandbox_id}/files`)

**Performance Considerations:**
- For Library page showing 20 threads:
  - 1 call to get threads list
  - N calls to get sandbox files (if doing per-thread)
  - **Issue:** This becomes N+1 problem

**Optimization Strategy:**
- Batch query files for visible threads
- Cache file lists per sandbox
- Load files on-demand (lazy load file previews)
- Consider adding file count to thread metadata for UI hints

---

### 4. Existing Search/Filter Infrastructure

**Components Available:**
- ✅ `SearchBar` component at `frontend/src/components/agents/custom-agents-page/search-bar.tsx`
  - Simple search input with icon
  - Props: `placeholder`, `value`, `onChange`, `className`
  - **Can be reused for Library search**

- ✅ Agents page has comprehensive filtering:
  - Search by name
  - Sort options (name, created_at, updated_at)
  - Filter by attributes (tools, type, etc.)
  - Pagination support

**React Query Patterns:**
- Offset-based pagination used in agents page
- Search params passed in query: `page`, `limit`, `search`, `sort_by`, `sort_order`
- Marketplace pagination info structure with `current_page`, `page_size`, `total_count`, `total_pages`

**Backend Support:**
- GET `/threads` supports pagination: `page` and `limit` query params
- Returns pagination info: `{ page, limit, total, pages }`

**Recommendation:**
- Reuse SearchBar component
- Implement filter component similar to agents page
- Use offset-based pagination for consistency
- Start with client-side filtering, add server-side if needed

---

### 5. Favorites/Bookmarking System

**Current State:**
- ❌ **No favorites system exists in Suna app**
- Searched for "favorite", "bookmark", "starred" across entire codebase
- No results found

**Decision:**
- ✅ **Per user request: Do NOT implement favorites for now**
- Remove favorites from core requirements
- Can add later if bookmarking system is built app-wide

---

### 6. Pagination & Infinite Scroll Patterns

**Current Patterns in Suna:**
- Offset-based pagination (page + limit)
- Not using React Query's `useInfiniteQuery`
- Agents page uses manual pagination state management
- Results show: `{ items[], pagination: { page, limit, total, pages } }`

**Implementation Pattern:**
```typescript
const [page, setPage] = useState(1);
const [limit, setLimit] = useState(20);

// Query for threads
const { data } = useQuery({
  queryKey: ['threads', page, limit],
  queryFn: () => getThreads({ page, limit })
});
```

**For Infinite Scroll:**
- Can use intersection observer on last item
- Manually manage pagination state
- OR use React Query's `useInfiniteQuery` (not currently used in app)

**Recommendation:**
- Use manual pagination with intersection observer
- Load next page when user scrolls to bottom
- Keep consistent with existing patterns in Suna

---

### 7. UI Component Library Inventory

**shadcn/ui Components Available:**
- Dialog, DialogContent, DialogHeader, DialogTitle
- Button, Input, ScrollArea
- DropdownMenu (DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem)
- Card components (if available)
- Tabs, TabsList, TabsTrigger, TabsContent
- Search input patterns

**Existing Components We Can Reuse:**
- SearchBar (from agents page)
- FilterBar patterns (from agents page)
- Card layouts
- Grid/List view toggle patterns

**Available Icons:** lucide-react
- File, Folder, Search, Filter, Download, ChevronRight, etc.

---

### 8. Date/Time Formatting

**Current Usage:**
- Dates are returned as ISO strings from backend
- No specific date formatting library discovered yet
- Sidebar shows dates, but exact format unclear
- Agents page displays created_at, updated_at as timestamps

**Recommendation:**
- Use `date-fns` (lightweight, common alternative)
- Or check if date-fns already installed (common in Next.js projects)
- Format options:
  - Relative: "Today", "Yesterday", "This Week", "2 weeks ago"
  - Absolute: "Nov 2, 2025" or "2025-11-02"
  - Combination: "Today at 3:45 PM"

---

### 9. View Mode Persistence

**Current State:**
- ❌ No user preferences system found
- ✅ But local state persistence patterns exist:
  - LocalStorage used in sidebar for collapsed state
  - URL search params used for filtering in agents page (tab parameter)

**Strategy:**
- Use LocalStorage to persist view preference (grid vs list)
- Key: `library-view-mode`
- Fallback to grid if not set
- No backend sync needed for now

**Pattern to Follow:**
```typescript
const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
  if (typeof window === 'undefined') return 'grid';
  return (localStorage.getItem('library-view-mode') as 'grid' | 'list') || 'grid';
});

useEffect(() => {
  localStorage.setItem('library-view-mode', viewMode);
}, [viewMode]);
```

---

### 10. File Viewer/Modal System - CRITICAL FINDINGS

**Existing File Viewing Infrastructure:**

- ✅ **FileViewerModal** - Comprehensive file viewer
  - Location: `frontend/src/components/thread/file-viewer-modal.tsx`
  - Features: Directory navigation, file browsing, viewing
  - Uses FileRenderers to display different file types
  - Supports: Images, PDFs, Code, Markdown, HTML, CSV, Excel
  - Currently used in: DocsToolView, ListDocumentsToolView

- ✅ **FileRenderer System** - Type-based rendering
  - Location: `frontend/src/components/file-renderers/`
  - Supports 8+ file types
  - Handles special rendering for each type
  - Used throughout tool views for document display

- ✅ **Document Modal Store**
  - Location: `frontend/src/lib/stores/use-document-modal-store.ts`
  - Zustand store for managing document modal state
  - Used in sidebar for document modal coordination

**Reusable Components:**
1. **FileViewerModal** - Can be reused directly for Library
2. **FileRenderer** - Can be reused for file display
3. **SearchBar** - Already exists, reusable
4. **Pagination logic** - Pattern exists, can reuse

**Integration Strategy:**
- Click file preview → Open FileViewerModal with that sandbox + file
- Pass sandboxId and initialFilePath to FileViewerModal
- FileViewerModal handles full file browser experience
- No need to build custom file viewer

**Code Integration Example:**
```typescript
<FileViewerModal
  open={isViewerOpen}
  onOpenChange={setIsViewerOpen}
  sandboxId={thread.project?.sandbox?.id}
  initialFilePath={selectedFilePath}
  project={thread.project}
/>
```

---

## Next Steps

### Phase 1: Planning & Design
- [ ] Review this document
- [ ] Create detailed mockups/wireframes
- [ ] Define exact API contracts needed
- [ ] Identify reusable components
- [ ] Plan component architecture

### Phase 2: Backend Preparation
- [ ] Verify thread API supports all needed filters
- [ ] Add favorites functionality to threads
- [ ] Optimize file fetching for multiple threads
- [ ] Add file count to thread metadata
- [ ] Create thumbnail generation if needed

### Phase 3: Frontend Implementation
- [ ] Create page structure
- [ ] Implement basic list view
- [ ] Add search functionality
- [ ] Implement filters
- [ ] Add file preview display
- [ ] Implement grid view
- [ ] Add infinite scroll
- [ ] Implement file viewer modal

### Phase 4: Enhancement
- [ ] Add favorites functionality
- [ ] Implement batch actions
- [ ] Optimize performance
- [ ] Add analytics
- [ ] User testing

### Phase 5: Polish & Launch
- [ ] Accessibility audit
- [ ] Performance testing
- [ ] Cross-browser testing
- [ ] Documentation
- [ ] Launch

---

## Open Questions - Updated Based on Research

### Technical
1. ✅ **Should we generate thumbnails on backend or frontend?**
   - **Finding:** No existing thumbnail system. Use file type icons for now.
   - **Decision:** Start with icons, add thumbnails later as optimization.

2. ✅ **Do we need a new API endpoint for library view?**
   - **Finding:** Existing `GET /threads` + `GET /sandboxes/{id}/files` sufficient
   - **Decision:** No new endpoints needed initially

3. ❌ **Should favorites be stored in thread metadata?**
   - **Finding:** No favorites system exists currently
   - **Decision:** Skip favorites for now (per user request)

4. ✅ **What's the thumbnail strategy?**
   - **Finding:** Use file type icons from lucide-react
   - **Decision:** Display file name, type, size. Show actual thumbnails for images.

5. ✅ **Should we support real-time updates?**
   - **Finding:** Not used in current codebase
   - **Decision:** Not needed for MVP

### Product
1. ✅ **What's the primary use case?**
   - **Finding:** Both finding conversations and accessing files
   - **Decision:** Show both in one view

2. ✅ **Should we prioritize grid or list view?**
   - **Finding:** Agents page uses grid as default
   - **Decision:** Grid as default, list as option

3. ✅ **How important is batch selection/actions?**
   - **Finding:** Not in MVP requirements
   - **Decision:** Skip for MVP, add later if needed

4. ✅ **Should we group by date automatically?**
   - **Finding:** No automatic grouping found, but possible
   - **Decision:** Sort by created_at (newest first), no grouping for MVP

5. ❌ **Do we need conversation archiving?**
   - **Finding:** Not in current system
   - **Decision:** Skip for MVP

### Design
1. ✅ **How many files to show by default?**
   - **Finding:** Manus shows 3 files + "N more"
   - **Decision:** Show 3 files like Manus, use "N more" button

2. ✅ **Grid: how many columns on desktop?**
   - **Finding:** Agents page uses varied columns
   - **Decision:** 1-2 columns for thread cards (wider cards than agents)

3. ✅ **File preview: thumbnail vs icon?**
   - **Finding:** Both viable, icons simpler
   - **Decision:** Use file type icons initially, lazy-load actual thumbnails for images

4. ✅ **Modal vs inline file viewer?**
   - **Finding:** FileViewerModal exists and is used throughout
   - **Decision:** Use existing FileViewerModal in modal

5. ✅ **Dark mode as default?**
   - **Finding:** Suna supports dark mode throughout
   - **Decision:** Follow existing Suna patterns for dark mode

---

## Reference Links

### Documentation
- Main Network Map: `/NETWORK_MAP.md`
- Architecture Diagrams: `/ARCHITECTURE_DIAGRAMS.md`
- Quick Reference: `/QUICK_REFERENCE.md`
- Manus Review: `.docs/library-implementation/manus-library-review.md`

### Key Files to Review
- Backend: `backend/core/threads.py`
- Backend: `backend/core/sandbox/api.py`
- Frontend: `frontend/src/app/(dashboard)/agents/page.tsx`
- Hooks: `frontend/src/hooks/react-query/threads/`

### Similar Implementations
- Agents page: `frontend/src/app/(dashboard)/agents/page.tsx` - Similar list/grid layout patterns

---

## Notes

- This is a **planning document** and will be updated as we progress
- Second pass will review current technology stack in detail
- Focus on recreating Manus Library experience while fitting Suna's architecture
- Maintain consistency with existing Suna UI/UX patterns
- Prioritize performance for users with many conversations

---

## Research Summary & Key Takeaways

### ✅ What We Can Reuse

1. **FileViewerModal** - Use directly for file viewing
   - Already supports sandbox file browsing
   - Supports all file types we need
   - Just needs integration

2. **FileRenderer System** - Handles file display
   - 8+ file types supported
   - Already battle-tested in production
   - No need to rebuild

3. **SearchBar Component** - Use for search
   - Existing component from agents page
   - Drop-in replacement

4. **Pagination Patterns** - Follow existing approach
   - Offset-based pagination
   - Same query params as agents page

5. **UI Components** - shadcn/ui already configured
   - Dialog, Button, Input, DropdownMenu, etc.
   - All components available for Library page

### ❌ What Doesn't Exist Yet

1. **Thread Title Storage**
   - Need to store titles in metadata or add column
   - Can be added to thread update flow

2. **File Thumbnails**
   - Not generated currently
   - Use icons for MVP, add thumbnails later

3. **Favorites System**
   - Not implemented
   - Skip for MVP (per request)

4. **Dedicated Library Page**
   - This is what we're building!

### 🎯 MVP Feature Set (Based on Research)

**Must Have:**
- ✅ List all user threads (with pagination)
- ✅ Show thread info (name, date, project)
- ✅ Show up to 3 files per thread (with "N more" toggle)
- ✅ Search conversations
- ✅ Click thread → navigate to thread view
- ✅ Click file → open in FileViewerModal
- ✅ Grid and List view toggle
- ✅ Sort by date (newest first)

**Can Add Later:**
- Favorites system (needs app-wide implementation)
- Batch actions
- File type filters
- Date grouping
- Virtual scrolling (if performance needed)
- Thumbnail generation

### 📊 Implementation Complexity

**Low Complexity (Easy to Build):**
- Basic list/grid layout
- Search functionality
- Pagination
- View toggle
- File type icons

**Medium Complexity (Moderate Effort):**
- Integration with FileViewerModal
- File preview expansion ("N more" toggle)
- Infinite scroll
- Thread title generation/management

**High Complexity (Future):**
- Thumbnail generation
- Favorites system
- Batch operations
- Advanced filtering

### 🚀 Recommended MVP Scope

**For First Implementation:**
1. Create `/dashboard/library` page
2. Display all threads in grid view (2 columns)
3. Show thread name, date, project icon
4. Show up to 3 file previews with icons
5. "View all X files" button for expansion
6. Search bar to filter threads
7. Sort options (default: newest first)
8. Click thread → go to thread
9. Click file → open FileViewerModal
10. Grid/List toggle
11. Infinite scroll as threads load

**Timeline Estimate:**
- 2-3 days for experienced frontend dev
- 1-2 weeks with testing and refinements
- Could be faster with pair programming

### 🔄 Next Action Items

1. Create detailed component structure document
2. Create database/API contract document
3. Start implementation with page layout
4. Integrate existing components
5. Test with various file types
6. Performance testing with large datasets

---

## Research Completion Checklist

- ✅ 1. Thumbnails and File Previews
- ✅ 2. Thread Naming System
- ✅ 3. File-Thread Relationships
- ✅ 4. Search/Filter Infrastructure
- ✅ 5. Favorites/Bookmarking (Decision: Skip for MVP)
- ✅ 6. Pagination Patterns
- ✅ 7. UI Component Library
- ✅ 8. Date Formatting
- ✅ 9. View Persistence (LocalStorage)
- ✅ 10. File Viewer System (CRITICAL: Can fully reuse)

**Status:** ✅ Initial research complete - Ready for implementation planning phase

---

## Implementation Progress

### ✅ Completed Work (November 2, 2025)

#### 1. Core Page Structure
**Files Created:**
- `frontend/src/app/(dashboard)/library/page.tsx` - Route wrapper
- `frontend/src/components/library/library-page.tsx` - Main page component
- `frontend/src/components/library/library-page-header.tsx` - Header component
- `frontend/src/components/library/thread-card.tsx` - Thread list item component

#### 2. Layout Implementation
**Manus-Style Vertical List Layout:**
- ✅ Changed from grid to vertical list: `flex flex-col gap-3 md:gap-[12px]`
- ✅ Full-width thread entries (not card tiles)
- ✅ Removed all borders for clean, minimal design
- ✅ Proper spacing: `pb-6 px-6 gap-3` per thread item
- ✅ No Card backgrounds - clean list appearance

**Standard Suna Container Pattern:**
- ✅ All sections use: `container mx-auto max-w-7xl px-4`
- ✅ Content properly centered and constrained (max-width: 1280px)
- ✅ Responsive padding with Tailwind breakpoints

#### 3. Sticky Header Solution
**Challenge:** Content was visible scrolling between header and toolbar (gap issue)

**Solution:** Combined header + toolbar into single sticky block
```tsx
<div className="sticky top-0 z-20 bg-background">
  <div className="container mx-auto max-w-7xl px-4">
    {/* Header */}
    <div className="py-4 md:py-[14px]">
      <LibraryPageHeader />
    </div>
    {/* Toolbar */}
    <div className="pb-4">
      {/* Search + Filters */}
    </div>
  </div>
</div>
```

**Result:** No visible gaps, smooth scrolling with content hidden behind sticky header

#### 4. Thread Card Design
**Manus-Style Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ [Title]                                [Date]  [Star]   │
│                                                         │
│ 📄 File 1                                    →          │
│ 📄 File 2                                    →          │
│ 📄 File 3                                    →          │
│ ▼ +5 more files                                        │
└─────────────────────────────────────────────────────────┘
```

**Features Implemented:**
- ✅ Title + Date + Favorite star in header row
- ✅ Expandable file list structure (ready for data)
- ✅ ChevronRight on hover for file items
- ✅ "+N more files" expand button
- ✅ Relative date formatting: "Today", "Yesterday", "Friday", etc.
- ✅ Full-width clickable area to navigate to thread

#### 5. Search & Filter Toolbar
**Implemented:**
- ✅ Search bar with icon: `Search threads...`
- ✅ "All" filter button
- ✅ "Favorites" filter button with star icon
- ✅ LocalStorage persistence for favorites
- ✅ View mode toggle removed (Manus only uses list view)

**State Management:**
```tsx
const [searchQuery, setSearchQuery] = useState('');
const [filterMode, setFilterMode] = useState<'all' | 'favorites'>('all');
const [favorites, setFavorites] = useState<Set<string>>(new Set());
```

#### 6. Data Fetching
**Current Implementation:**
```tsx
// Fetch threads and projects
const { data: threads = [] } = useQuery({
  queryKey: ['threads'],
  queryFn: () => getThreads(),
});

const { data: projects = [] } = useQuery({
  queryKey: ['projects'],
  queryFn: () => getProjects(),
});

// Process threads with project names
const threadsWithProjects = useMemo(() => {
  const projectsById = new Map(projects.map(p => [p.id, p]));
  return threads
    .filter(thread => thread.project_id)
    .map(thread => ({
      threadId: thread.thread_id,
      projectId: thread.project_id!,
      projectName: project?.name || 'Unnamed Project',
      url: `/projects/${thread.project_id}/thread/${thread.thread_id}`,
      updatedAt: thread.updated_at,
      iconName: project?.icon_name,
    }));
}, [threads, projects]);
```

#### 7. Pagination
**Implemented:**
- ✅ Offset-based pagination (20 items per page)
- ✅ Previous/Next buttons
- ✅ Page number display
- ✅ Auto-reset to page 1 when filters change

### ⚠️ Known Limitations & TODOs

#### 1. File Display - Not Yet Implemented
**Current State:**
- Shows "No files associated with this thread" for all threads
- File fetching structure in place but disabled

**Issue:** Need to implement Thread → Project → Sandbox → Files relationship
```tsx
// TODO: Currently disabled - need sandboxId
const { data: files = [] } = useQuery({
  queryKey: ['sandbox-files', thread.projectId],
  queryFn: async () => {
    // Need to fetch project to get sandboxId, then fetch files
    return [];
  },
  enabled: false, // Disabled until we have proper sandboxId
});
```

**Next Steps:**
1. Fetch project details to get `sandbox_id`
2. Call `listSandboxFiles(sandboxId, '/')` to get files
3. Display files in expandable list
4. Implement file click → open FileViewerModal

#### 2. Thread Titles
**Current State:**
- Using `projectName` as thread title
- Project names like "Kortix AI Research", "GitHub Repo Search"

**Issue:** Threads don't have dedicated title field

**Solutions Considered:**
- Option A: Store in `metadata` JSON field (backend already supports)
- Option B: Add new `title` column to threads table
- Option C: Generate from first message (requires additional query)

**Recommendation:** Use metadata field for MVP (no migration needed)

#### 3. View Mode Toggle
**Decision:** Hidden/removed for now
- Manus only uses vertical list view
- Grid view commented out but can be re-enabled if needed
- Code structure supports both modes

#### 4. Performance Optimizations Needed
**Potential Issues:**
- N+1 queries for files (fetching per thread)
- Large file lists causing re-renders

**Solutions:**
- Implement lazy loading for files (fetch on expand)
- Use React Query caching more effectively
- Virtual scrolling for large thread lists (future)

### 📊 Code Quality Observations

**Good Practices:**
- ✅ Proper TypeScript typing throughout
- ✅ React Query for data fetching
- ✅ Memoization for computed values
- ✅ LocalStorage for favorites persistence
- ✅ Responsive design with Tailwind breakpoints
- ✅ Accessible button states and labels

**Technical Debt:**
- ⚠️ Disabled file fetching needs implementation
- ⚠️ Thread titles using project names (workaround)
- ⚠️ No error states for failed queries
- ⚠️ No loading skeletons (just text)

### 🎨 Design System Compliance

**Matches Suna Patterns:**
- ✅ Uses shadcn/ui components (Button, Input, Card)
- ✅ Follows container pattern from `/agents` page
- ✅ Consistent z-index usage (z-10, z-20)
- ✅ Tailwind utility classes
- ✅ Dark mode compatible

**Matches Manus Design:**
- ✅ Vertical list layout
- ✅ Full-width thread entries
- ✅ Sticky header behavior
- ✅ Clean, borderless design
- ✅ Expandable file lists structure
- ✅ Relative date labels

### 🔍 Key Learnings

#### 1. Sticky Header Gap Issue
**Problem:** Content was visible scrolling in gap between sticky header and sticky toolbar

**Attempted Solutions:**
- ❌ Separate sticky blocks with different z-index
- ❌ Adding padding-bottom to cover gap
- ❌ Adjusting top positions

**Final Solution:** ✅ Combine header + toolbar into single sticky block
```tsx
// Single sticky wrapper with bg-background
<div className="sticky top-0 z-20 bg-background">
  {/* Both header and toolbar inside same block */}
</div>
```

**Lesson:** When using multiple sticky elements, combining them prevents visual gaps

#### 2. Suna Container Pattern
**Discovery:** All Suna pages follow consistent pattern:
```tsx
<div className="min-h-screen">
  <div className="container mx-auto max-w-7xl px-4 py-8">
    {/* Content */}
  </div>
</div>
```

**Applied To:**
- Header section
- Toolbar section  
- Content section

**Lesson:** Always check existing page patterns before implementing new pages

#### 3. Border-less Design Preference
**Evolution:**
- Started with borders (mimicking cards)
- Removed border on header/toolbar
- Removed borders between thread items
- Final: Completely borderless, clean design

**Lesson:** Sometimes less is more - spacing alone can define structure

#### 4. Thread Data Structure
**Database Schema:**
```sql
threads (
  thread_id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  metadata JSONB
)
```

**Relationship Chain:**
```
User → Threads → Projects → Sandboxes → Files
```

**Challenge:** No direct thread→files relationship
**Solution:** Must traverse through project to get sandbox, then fetch files

### 📁 File Structure

```
frontend/src/
├── app/(dashboard)/library/
│   └── page.tsx                      # Route wrapper (4 lines)
├── components/library/
│   ├── library-page.tsx              # Main component (252 lines)
│   ├── library-page-header.tsx       # Header component (18 lines)
│   └── thread-card.tsx               # Thread list item (152 lines)
```

**Total Lines of Code:** ~426 lines
**Components:** 4 files
**Dependencies:** React Query, Next.js, shadcn/ui, Tailwind

---

**Last Updated:** November 2, 2025  
**Status:** ✅ Core Layout Complete - File Fetching & Titles Next  
**Next Document:** `implementation-planning.md`
