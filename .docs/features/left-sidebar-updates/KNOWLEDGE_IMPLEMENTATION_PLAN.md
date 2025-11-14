# Implementation Plan: Knowledge Base Sidebar Component

**Date:** November 2, 2025  
**Target:** Implement `NavKnowledgeBase` component for sidebar  
**Pattern:** Follow existing sidebar component patterns (NavAgents, NavAgentsView, NavGlobalConfig)  

---

## 🎯 Executive Summary

Implement a mini knowledge base viewer in the sidebar that displays:
- **Folders** with entry counts (collapsible/expandable)
- **Recent files** from all folders
- Quick navigation to full `/knowledge` page
- Pattern matching existing sidebar components

---

## 📋 Current State Analysis

### What Exists

✅ **Full Knowledge Base Page:**
- Route: `/knowledge`
- Component: `KnowledgeBasePage` → `KnowledgeBaseManager`
- Features: Full folder tree, drag-drop, file management

✅ **Data Fetching Hook:**
- `useKnowledgeFolders()` in `use-folders.ts`
- Returns: `folders`, `recentFiles`, `loading`, `refetch`

✅ **Database Schema:**
```sql
knowledge_base_folders (
  folder_id UUID,
  name TEXT,
  description TEXT,
  created_at TIMESTAMP
)

knowledge_base_entries (
  entry_id UUID,
  filename TEXT,
  summary TEXT,
  file_size NUMBER,
  created_at TIMESTAMP,
  folder_id UUID REFERENCES knowledge_base_folders
)
```

### What's Missing

❌ **Sidebar Component:** `NavKnowledgeBase.tsx` doesn't exist
❌ **Integration:** Sidebar still shows placeholder
❌ **Navigation Logic:** No click handlers for folders/files

---

## 🏗️ Architecture Design

### Component Structure

```
NavKnowledgeBase (new component)
├─ Section Header: "Knowledge Base"
├─ Quick Navigation: "Browse All" link → /knowledge
├─ Folders List (collapsible)
│  ├─ Folder Item 1
│  │  ├─ Folder icon + name + count badge
│  │  └─ onClick → Navigate to /knowledge?folder=${folderId}
│  ├─ Folder Item 2
│  └─ ...
└─ Recent Files Section (optional)
   ├─ File Item 1
   │  ├─ File icon + filename + date
   │  └─ onClick → Navigate to /knowledge?file=${entryId}
   └─ ...
```

### Data Flow

```
NavKnowledgeBase Component
        ↓
useKnowledgeFolders() Hook
        ↓
Supabase Query (RLS protected)
        ↓
Returns: { folders, recentFiles, loading }
        ↓
Render folder list + recent files
        ↓
User clicks folder/file
        ↓
Navigate to /knowledge with query params
```

---

## 📝 Implementation Steps

### Step 1: Create NavKnowledgeBase Component

**File:** `frontend/src/components/sidebar/nav-knowledge-base.tsx`

**Imports:**
```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { FolderIcon, FileIcon, ChevronRight, Database, Loader2 } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { useKnowledgeFolders } from '@/hooks/react-query/knowledge-base/use-folders';
import { cn } from '@/lib/utils';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { formatDateForList } from '@/lib/utils/date-formatting';
import { Badge } from '@/components/ui/badge';
```

**Component Structure:**
```typescript
export function NavKnowledgeBase() {
  const { isMobile, state, setOpenMobile } = useSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Fetch data
  const { folders, recentFiles, loading } = useKnowledgeFolders();
  
  // Track which folder is active from URL
  const activeFolderId = searchParams.get('folder');
  const activeFileId = searchParams.get('file');
  
  // Handle navigation
  const handleFolderClick = (folderId: string) => {
    router.push(`/knowledge?tab=knowledge-base&folder=${folderId}`);
    if (isMobile) setOpenMobile(false);
  };
  
  const handleFileClick = (entryId: string, folderId: string) => {
    router.push(`/knowledge?tab=knowledge-base&folder=${folderId}&file=${entryId}`);
    if (isMobile) setOpenMobile(false);
  };
  
  const handleBrowseAll = () => {
    router.push('/knowledge?tab=knowledge-base');
    if (isMobile) setOpenMobile(false);
  };
  
  // ... render logic
}
```

**Render Structure:**
```typescript
return (
  <div>
    <div className="overflow-y-auto max-h-[calc(100vh-280px)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] pb-32">
      {(state !== 'collapsed' || isMobile) && (
        <>
          {/* Section Header */}
          <DateGroupHeader title="Knowledge Base" count={folders.length} />
          
          {/* Browse All Link */}
          <SpotlightCard className="mb-2">
            <div onClick={handleBrowseAll} className="flex items-center gap-3 p-2.5 text-sm cursor-pointer">
              <Database className="h-4 w-4" />
              <span className="flex-1">Browse All</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </SpotlightCard>
          
          {/* Loading State */}
          {loading && <LoadingSkeleton />}
          
          {/* Folders List */}
          {!loading && folders.length > 0 && (
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
          )}
          
          {/* Recent Files Section */}
          {!loading && recentFiles.length > 0 && (
            <>
              <DateGroupHeader title="Recent Files" count={recentFiles.length} />
              <div className="space-y-1">
                {recentFiles.map((file) => (
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
          
          {/* Empty State */}
          {!loading && folders.length === 0 && (
            <EmptyState />
          )}
        </>
      )}
    </div>
  </div>
);
```

---

### Step 2: Create Sub-Components

**DateGroupHeader (Reuse existing pattern):**
```typescript
const DateGroupHeader: React.FC<{ title: string; count: number }> = ({ title, count }) => {
  return (
    <div className="py-2 mt-4 first:mt-2">
      <div className="text-xs font-medium text-muted-foreground pl-2.5">
        {title} {count > 0 && `(${count})`}
      </div>
    </div>
  );
};
```

**FolderItem:**
```typescript
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
        <Badge variant="secondary" className="text-xs">
          {folder.entry_count}
        </Badge>
      </div>
    </SpotlightCard>
  );
};
```

**FileItem:**
```typescript
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
```

**LoadingSkeleton:**
```typescript
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
```

**EmptyState:**
```typescript
const EmptyState = () => (
  <div className="p-4 text-center text-muted-foreground">
    <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
    <p className="text-sm">No folders yet</p>
    <p className="text-xs mt-1">Create folders in Knowledge Base</p>
  </div>
);
```

---

### Step 3: Update sidebar-left.tsx

**File:** `frontend/src/components/sidebar/sidebar-left.tsx`

**Changes:**

1. **Add Import:**
```typescript
// Line ~12, add to imports
import { NavKnowledgeBase } from '@/components/sidebar/nav-knowledge-base';
```

2. **Update Content Rendering:**
```typescript
// Replace placeholder (lines 532-537)
// OLD:
{activeView === 'knowledge' && (
  <div className="p-4 text-center text-muted-foreground">
    <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
    <p className="text-sm">Knowledge Base placeholder</p>
  </div>
)}

// NEW:
{activeView === 'knowledge' && <NavKnowledgeBase />}
```

3. **Update URL Sync (Optional but Recommended):**
```typescript
// Line 207-210, update to handle /knowledge independently
useEffect(() => {
  if (pathname?.includes('/triggers')) {
    setActiveView('starred');
  } else if (pathname?.includes('/knowledge')) {
    setActiveView('knowledge');  // Set to knowledge view when on /knowledge route
  }
}, [pathname]);
```

---

### Step 4: Update Knowledge Page to Handle Query Params

**File:** `frontend/src/components/knowledge-base/knowledge-base-manager.tsx`

**Add Effect to Handle URL Params:**
```typescript
// Add to component (around line 100+)
useEffect(() => {
  const folderIdFromUrl = searchParams.get('folder');
  const fileIdFromUrl = searchParams.get('file');
  
  if (folderIdFromUrl) {
    // Expand folder and highlight it
    // (Implementation depends on existing state management)
  }
  
  if (fileIdFromUrl) {
    // Open file preview modal
    // (Implementation depends on existing modal logic)
  }
}, [searchParams]);
```

---

## 🎨 UI/UX Specifications

### Visual Design

**Folder Item:**
- Icon: `FolderIcon` (Lucide) - 16x16px
- Container: 40x40px rounded-2xl with border
- Badge: Small, shows entry count (e.g., "12")
- Hover: bg-muted/60
- Active: bg-muted

**File Item:**
- Icon: `FileIcon` (Lucide) - 16x16px
- Container: 40x40px rounded-2xl with border
- Timestamp: Right-aligned, muted text
- Truncate filename if too long

**Section Headers:**
- Text: text-xs, font-medium, text-muted-foreground
- Show count: "(5 folders)" or "(3 files)"
- Padding: py-2, pl-2.5

### Interaction Patterns

**Click Behavior:**
1. **Folder Click:**
   - Navigate to: `/knowledge?tab=knowledge-base&folder=${folderId}`
   - Close mobile sidebar (if mobile)
   - Highlight folder in sidebar

2. **File Click:**
   - Navigate to: `/knowledge?tab=knowledge-base&folder=${folderId}&file=${entryId}`
   - Close mobile sidebar (if mobile)
   - Open file preview (handled by main page)

3. **Browse All Click:**
   - Navigate to: `/knowledge?tab=knowledge-base`
   - Close mobile sidebar (if mobile)

---

## 📊 Data Structure

### Folder Type
```typescript
interface Folder {
  folder_id: string;      // UUID
  name: string;           // "Documentation", "API Specs"
  description?: string;   // Optional description
  entry_count: number;    // Count of files (computed)
  created_at: string;     // ISO timestamp
}
```

### Entry Type
```typescript
interface Entry {
  entry_id: string;       // UUID
  filename: string;       // "api-guide.md"
  summary: string;        // Auto-generated summary
  file_size: number;      // Bytes
  created_at: string;     // ISO timestamp
  folder_id: string;      // Parent folder UUID
}
```

---

## 🔄 State Management

### Component State

```typescript
// From hook
const { folders, recentFiles, loading } = useKnowledgeFolders();

// From URL
const activeFolderId = searchParams.get('folder');
const activeFileId = searchParams.get('file');

// No local state needed (stateless component)
```

### React Query Cache

```typescript
// useKnowledgeFolders uses raw useEffect + useState
// Not using React Query (different from other sidebar components)

// Future improvement: Convert to React Query
export const useKnowledgeFolders = createQueryHook(
  knowledgeBaseKeys.folders(),
  async () => { /* fetch logic */ },
  { staleTime: 5 * 60 * 1000 }
);
```

---

## 🧪 Testing Checklist

### Unit Tests

- [ ] Component renders without crashing
- [ ] Shows loading skeleton while `loading === true`
- [ ] Renders folders when data available
- [ ] Renders recent files when available
- [ ] Shows empty state when no folders
- [ ] Highlights active folder based on URL
- [ ] Highlights active file based on URL
- [ ] Calls router.push on folder click
- [ ] Calls router.push on file click
- [ ] Closes mobile sidebar on navigation (mobile only)

### Integration Tests

- [ ] Clicking folder navigates to `/knowledge?folder=${id}`
- [ ] Clicking file navigates to `/knowledge?folder=${id}&file=${id}`
- [ ] "Browse All" navigates to `/knowledge`
- [ ] Active states match URL params
- [ ] Data fetches from Supabase correctly
- [ ] Respects RLS (Row Level Security) policies

### Visual Tests

- [ ] Folder icons display correctly
- [ ] File icons display correctly
- [ ] Badge counts are readable
- [ ] Timestamps format correctly
- [ ] Long filenames truncate properly
- [ ] Active states visible
- [ ] Hover states work
- [ ] Skeleton loaders animate

---

## 📦 File Structure

```
frontend/src/components/sidebar/
├── nav-knowledge-base.tsx       (NEW - Main component)
├── sidebar-left.tsx             (MODIFY - Add NavKnowledgeBase)
├── nav-agents.tsx               (REFERENCE - Similar pattern)
├── nav-agents-view.tsx          (REFERENCE - Similar pattern)
└── nav-global-config.tsx        (REFERENCE - Similar pattern)

frontend/src/hooks/react-query/knowledge-base/
├── use-folders.ts               (EXISTS - Data hook)
├── use-knowledge-base-queries.ts (EXISTS - Other queries)
└── keys.ts                      (EXISTS - Query keys)
```

---

## 🚀 Performance Considerations

### Data Fetching

**Current Implementation:**
- `useKnowledgeFolders()` uses `useEffect` + `useState`
- Fetches on component mount
- No caching between mounts
- **Issue:** Re-fetches every time sidebar switches views

**Recommended Improvement:**
```typescript
// Convert to React Query in use-folders.ts
export const useKnowledgeFolders = createQueryHook(
  knowledgeBaseKeys.folders(),
  async () => {
    const supabase = createClient();
    // ... existing fetch logic
    return { folders: foldersWithCounts, recentFiles };
  },
  {
    staleTime: 5 * 60 * 1000,      // Cache for 5 minutes
    refetchOnWindowFocus: false,    // Don't refetch on tab focus
  }
);
```

### Rendering Optimization

**Limit Displayed Items:**
```typescript
// Only show first 5 folders
const displayedFolders = folders.slice(0, 5);

// Only show 6 recent files (already limited by hook)
const displayedFiles = recentFiles.slice(0, 6);
```

**Memoization (if needed):**
```typescript
const folderItems = useMemo(() => 
  folders.map(folder => <FolderItem key={folder.folder_id} {...} />),
  [folders, activeFolderId]
);
```

---

## 🔗 Integration Points

### With Existing Components

1. **NavAgents Pattern:**
   - Use same `SpotlightCard` wrapper
   - Use same date group header style
   - Use same loading skeleton pattern

2. **NavAgentsView Pattern:**
   - Use same navigation logic
   - Use same mobile sidebar close behavior
   - Use same active state highlighting

3. **NavGlobalConfig Pattern:**
   - Use same "Browse All" link style
   - Use same icon container styling
   - Use same onClick handlers

### With Knowledge Base Page

**URL Params Contract:**
```
/knowledge?tab=knowledge-base              → Main view
/knowledge?tab=knowledge-base&folder=123   → Folder selected
/knowledge?tab=knowledge-base&folder=123&file=456  → File opened
```

**Expected Behavior:**
1. Sidebar passes `folder` and `file` params
2. Main page reads params and:
   - Expands correct folder in tree
   - Scrolls to folder/file
   - Opens file preview modal (if `file` param present)

---

## 📋 Implementation Checklist

### Phase 1: Core Component (2-3 hours)

- [ ] Create `nav-knowledge-base.tsx` file
- [ ] Implement component skeleton with TypeScript types
- [ ] Add folder list rendering
- [ ] Add recent files rendering
- [ ] Add loading states
- [ ] Add empty states
- [ ] Add click handlers
- [ ] Test component in isolation

### Phase 2: Integration (1-2 hours)

- [ ] Import `NavKnowledgeBase` in `sidebar-left.tsx`
- [ ] Replace placeholder with `<NavKnowledgeBase />`
- [ ] Update URL sync logic for `/knowledge` route
- [ ] Test sidebar navigation
- [ ] Test mobile behavior
- [ ] Test active states

### Phase 3: Knowledge Page Updates (1-2 hours)

- [ ] Add URL param handling in `KnowledgeBaseManager`
- [ ] Implement folder expansion from URL
- [ ] Implement file preview from URL
- [ ] Test deep linking
- [ ] Test navigation flow

### Phase 4: Polish & Testing (1-2 hours)

- [ ] Add proper TypeScript types
- [ ] Add error handling
- [ ] Add accessibility attributes (ARIA labels)
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Test with real data
- [ ] Test edge cases (empty folders, long names, etc.)

### Phase 5: Performance Optimization (Optional, 1 hour)

- [ ] Convert `useKnowledgeFolders` to React Query
- [ ] Add memoization if needed
- [ ] Optimize re-renders
- [ ] Add pagination/virtual scrolling (if many folders)

---

## 🎯 Success Criteria

### Must Have (MVP)

✅ Displays list of folders with entry counts  
✅ Displays recent files (last 6)  
✅ Navigate to knowledge page on click  
✅ Shows loading state  
✅ Shows empty state  
✅ Follows existing sidebar patterns  
✅ Mobile responsive  

### Should Have

✅ Highlights active folder from URL  
✅ Highlights active file from URL  
✅ "Browse All" quick navigation link  
✅ React Query caching  
✅ Proper error handling  

### Nice to Have

⭐ Collapse/expand folders inline in sidebar  
⭐ Search/filter folders  
⭐ Show file type icons (PDF, MD, TXT)  
⭐ Drag-drop file to assign to agent  
⭐ Right-click context menu  

---

## 🐛 Potential Issues & Solutions

### Issue 1: Too Many Folders/Files

**Problem:** Sidebar becomes scrollable and hard to navigate

**Solutions:**
- Limit to first 5-10 folders
- Add "Show more" button
- Add search/filter input
- Use virtual scrolling for large lists

### Issue 2: Long Folder/File Names

**Problem:** Names overflow container

**Solutions:**
- Use `truncate` class on names
- Add tooltip on hover with full name
- Use ellipsis (...) for long names

### Issue 3: Stale Data

**Problem:** Folder counts don't update after adding/deleting files

**Solutions:**
- Convert to React Query with proper cache invalidation
- Add `refetch` call after mutations
- Use optimistic updates

### Issue 4: URL Sync Conflicts

**Problem:** `/knowledge` route sets `activeView` to `'starred'`

**Solution:**
- Update useEffect to handle `/knowledge` separately:
```typescript
useEffect(() => {
  if (pathname?.includes('/triggers')) {
    setActiveView('starred');
  } else if (pathname?.includes('/knowledge')) {
    setActiveView('knowledge');
  }
}, [pathname]);
```

---

## 📚 Reference Files

### To Study Before Implementation

1. **Pattern Reference:**
   - `nav-agents.tsx` (thread list pattern)
   - `nav-agents-view.tsx` (agent list pattern)
   - `nav-global-config.tsx` (navigation link pattern)

2. **Data Fetching:**
   - `use-folders.ts` (existing hook)
   - `use-sidebar.ts` (React Query pattern)

3. **Styling:**
   - `SpotlightCard` component
   - `Badge` component
   - Date formatting utils

### Documentation to Review

- `ACTIVEVIEW_PATTERN.md` (state machine pattern)
- `CONTENT_RENDERING_EXPLAINED.md` (data flow)
- `SUMMARY.md` (sidebar overview)

---

## 🚦 Implementation Order

```
1. Create nav-knowledge-base.tsx skeleton
   ↓
2. Implement data fetching (use existing hook)
   ↓
3. Build folder list UI
   ↓
4. Build recent files UI
   ↓
5. Add click handlers and navigation
   ↓
6. Integrate into sidebar-left.tsx
   ↓
7. Update URL sync logic
   ↓
8. Test navigation flow
   ↓
9. Update knowledge page for deep linking
   ↓
10. Polish and optimize
```

---

## 📝 Code Template to Start

**File:** `frontend/src/components/sidebar/nav-knowledge-base.tsx`

```typescript
'use client';

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
  
  // Fetch data
  const { folders, recentFiles, loading } = useKnowledgeFolders();
  
  // Track active items from URL
  const activeFolderId = searchParams.get('folder');
  const activeFileId = searchParams.get('file');
  
  // Navigation handlers
  const handleFolderClick = (folderId: string) => {
    router.push(`/knowledge?tab=knowledge-base&folder=${folderId}`);
    if (isMobile) setOpenMobile(false);
  };
  
  const handleFileClick = (entryId: string, folderId: string) => {
    router.push(`/knowledge?tab=knowledge-base&folder=${folderId}&file=${entryId}`);
    if (isMobile) setOpenMobile(false);
  };
  
  const handleBrowseAll = () => {
    router.push('/knowledge?tab=knowledge-base');
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
                <span className="flex-1">Browse All</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            </SpotlightCard>
            
            {/* Loading State */}
            {loading && <LoadingSkeleton />}
            
            {/* Folders List */}
            {!loading && folders.length > 0 && (
              <div className="space-y-1 mt-2">
                {folders.slice(0, 10).map((folder) => (
                  <FolderItem
                    key={folder.folder_id}
                    folder={folder}
                    isActive={activeFolderId === folder.folder_id}
                    onClick={() => handleFolderClick(folder.folder_id)}
                  />
                ))}
              </div>
            )}
            
            {/* Recent Files Section */}
            {!loading && recentFiles.length > 0 && (
              <>
                <DateGroupHeader title="Recent Files" count={recentFiles.length} />
                <div className="space-y-1">
                  {recentFiles.map((file) => (
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
            
            {/* Empty State */}
            {!loading && folders.length === 0 && <EmptyState />}
          </>
        )}
      </div>
    </div>
  );
}
```

---

**Estimated Total Implementation Time:** 6-10 hours  
**Complexity:** ⭐⭐ (Moderate - follows existing patterns)  
**Priority:** High (completes sidebar navigation trio)  
**Dependencies:** None (all infrastructure exists)  

---

**Ready to implement!** 🚀
