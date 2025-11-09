# Library Sidebar Implementation Plan

**Date:** November 4, 2025  
**Status:** 📋 Planning Phase  
**Target:** Implement Library view in left sidebar using list-based pattern from LibraryPage  
**Reference Docs:** ACTIVEVIEW_PATTERN.md, CONTENT_AREA_RENDERING_PATTERNS_V2.md, CONTENT_RENDERING_EXPLAINED.md

---

## Executive Summary

This document outlines the step-by-step plan to integrate the Library feature into the left sidebar's `activeView` pattern. The Library view will be rendered as a compact, list-based interface matching the styles and patterns of existing views (Agents, Knowledge, Triggers) while reusing data structures and processing logic from the full `LibraryPage` component.

**Goal:** When users click the "Library" button in the sidebar, they see a thread list view (not a placeholder) that displays threads grouped by date with the same visual design language as other sidebar views.

---

## Current State Analysis

### What Exists Today ✅

| Component | Location | Purpose | Status |
|-----------|----------|---------|--------|
| **sidebar-left.tsx** | `frontend/src/components/sidebar/sidebar-left.tsx` | Main sidebar container with activeView state management | ✅ Complete |
| **LibraryPage** | `frontend/src/components/library/library-page.tsx` | Full-page library view with grid/gallery/list modes | ✅ Complete |
| **ThreadCard** | `frontend/src/components/library/thread-card.tsx` | Detailed thread card with file preview | ✅ Complete |
| **NavAgents** | `frontend/src/components/sidebar/nav-agents.tsx` | Sidebar thread list (Chats view) | ✅ Complete |
| **NavAgentsView** | `frontend/src/components/sidebar/nav-agents-view.tsx` | Sidebar agents list (Workers view) | ✅ Complete |
| **NavGlobalConfig** | `frontend/src/components/sidebar/nav-global-config.tsx` | Sidebar triggers config (Triggers view) | ✅ Complete |
| **NavKnowledgeBase** | `frontend/src/components/sidebar/nav-knowledge-base.tsx` | Sidebar knowledge folders (Knowledge view) | ✅ Complete |
| **use-sidebar.ts** | `frontend/src/hooks/react-query/sidebar/use-sidebar.ts` | Data fetching & processing hooks | ✅ Complete |

### What's Missing ❌

| Component | Location | Purpose | Status |
|-----------|----------|---------|--------|
| **NavLibrary** | `frontend/src/components/sidebar/nav-library.tsx` | Sidebar library thread list (Library view) | ❌ **Not Created** |
| **Sidebar Integration** | `frontend/src/components/sidebar/sidebar-left.tsx` | Import & render NavLibrary component | ❌ **Not Updated** |
| **List-only format** | N/A | Create simplified thread list for sidebar | ❌ **Not Designed** |

### Current Placeholder

**File:** `sidebar-left.tsx` (lines 540-545)

```typescript
{activeView === 'library' && (
  <div className="p-4 text-center text-muted-foreground">
    <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
    <p className="text-sm">Library placeholder</p>
  </div>
)}
```

---

## Analysis of Existing Patterns

### Pattern 1: NavAgents (Thread List with Grouping) - **PRIMARY REFERENCE**

**File:** `frontend/src/components/sidebar/nav-agents.tsx` (704 lines)

**Key Characteristics:**
```
Purpose: Display threads (conversations) grouped by date
Data Flow: useThreads() → useProjects() → processThreadsWithProjects() 
           → groupThreadsByDate() → Render
Grouping: "Today", "Yesterday", "Last 7 Days", "Last 30 Days", etc.
Item Style: SpotlightCard with icon, name, timestamp
Features: 
  - Delete threads
  - Share threads
  - Multi-select checkbox mode
  - Active state styling
  - Overflow scrolling with hidden scrollbar
```

**Why it's the best reference:**
- Uses exact same data sources (threads + projects) as LibraryPage
- Already implements date grouping (reusable!)
- Compact list format (perfect for sidebar)
- Matches existing sidebar styling (SpotlightCard, date headers)
- Has overflow handling (`max-h-[calc(100vh-280px)]`)

**NOT copying from:**
- Delete functionality (library has its own deletion pattern)
- Multi-select mode (library doesn't need this in sidebar)
- Shared threads modal (library has its own sharing)

---

### Pattern 2: NavAgentsView (Simple Agent List) - **SECONDARY REFERENCE**

**File:** `frontend/src/components/sidebar/nav-agents-view.tsx` (149 lines)

**Key Characteristics:**
```
Purpose: Display agents in a simple list
Data Flow: useAgents() → Render
Item Style: SpotlightCard with avatar, name, timestamp
Features:
  - Clean, minimal UI
  - Loading skeleton
  - Active state detection
  - Mobile sidebar close on click
```

**Why reference this:**
- Simpler pattern (49 lines vs 704 lines)
- No complex multi-select/delete logic
- Good example of clean, focused component

---

### Pattern 3: NavKnowledgeBase (Folder/File List) - **TERTIARY REFERENCE**

**File:** `frontend/src/components/sidebar/nav-knowledge-base.tsx` (194 lines)

**Key Characteristics:**
```
Purpose: Display knowledge folders and files
Data Flow: useKnowledgeFolders() → Render with sections
Item Style: SpotlightCard with folder/file icon
Features:
  - Section headers with counts
  - Empty state
  - Loading skeleton
```

**Why reference this:**
- Good example of empty state handling
- Section header pattern (reusable for date groups)
- Badge display for counts

---

## Design: NavLibrary Component

### File Location
```
frontend/src/components/sidebar/nav-library.tsx
```

### Component Architecture

```typescript
export function NavLibrary() {
  // 1. Data Fetching
  const { data: threads = [] } = useThreads();
  const { data: projects = [] } = useProjects();

  // 2. Data Processing
  const threadsWithProjects = useMemo(() => {
    return processThreadsWithProjects(threads, projects);
  }, [threads, projects]);

  const groupedThreads = useMemo(() => {
    return groupThreadsByDate(threadsWithProjects);
  }, [threadsWithProjects]);

  // 3. Navigation & Mobile
  const router = useRouter();
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();

  // 4. Handlers
  const handleThreadClick = (threadId: string, url: string) => {
    router.push(url);
    if (isMobile) setOpenMobile(false);
  };

  // 5. Render
  return (
    <div className="overflow-y-auto max-h-[calc(100vh-280px)] [&::-webkit-scrollbar]:hidden">
      {groupedThreads.map(({ dateGroup, threads }) => (
        <div key={dateGroup}>
          <DateGroupHeader dateGroup={dateGroup} count={threads.length} />
          {threads.map(thread => (
            <ThreadListItem key={thread.threadId} thread={thread} />
          ))}
        </div>
      ))}
    </div>
  );
}
```

### Component Structure

#### 1. Main Container
```typescript
<div className="overflow-y-auto max-h-[calc(100vh-280px)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] pb-32">
  {/* Content here */}
</div>
```

**CSS Explanation:**
- `overflow-y-auto`: Allow vertical scrolling
- `max-h-[calc(100vh-280px)]`: Maximum height calculation (same as NavAgents)
- `[&::-webkit-scrollbar]:hidden`: Hide webkit scrollbar (Chrome, Safari, Edge)
- `[-ms-overflow-style:'none']`: Hide IE/Edge scrollbar
- `[scrollbar-width:'none']`: Hide Firefox scrollbar
- `pb-32`: Padding bottom to prevent content hiding under user profile

#### 2. Date Group Header Component
```typescript
const DateGroupHeader: React.FC<{ dateGroup: string; count: number }> = ({ dateGroup, count }) => {
  return (
    <div className="py-2 mt-4 first:mt-2">
      <div className="text-xs font-medium text-muted-foreground pl-2.5">
        {dateGroup}
      </div>
    </div>
  );
};
```

**Styling:**
- Reuse exact pattern from NavAgents
- `text-xs`: Small header text
- `text-muted-foreground`: Subtle color
- `pl-2.5`: Left padding alignment

#### 3. Thread List Item Component
```typescript
const ThreadListItem: React.FC<{
  thread: ThreadWithProject;
  isActive: boolean;
}> = ({ thread, isActive, onThreadClick }) => {
  return (
    <SpotlightCard
      className={cn(
        "transition-colors cursor-pointer",
        isActive ? "bg-muted" : "bg-transparent"
      )}
    >
      <Link href={thread.url} onClick={(e) => onThreadClick(e, thread.threadId, thread.url)}>
        <div className="flex items-center gap-3 p-2.5 text-sm">
          {/* Project Icon */}
          <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-card border-[1.5px] border-border flex-shrink-0">
            <ProjectIcon /* project icon from iconName */ />
          </div>

          {/* Thread Name & Timestamp */}
          <div className="flex-1 min-w-0">
            <div className="truncate font-medium">{thread.projectName}</div>
          </div>

          {/* Timestamp */}
          <span className="text-xs text-muted-foreground flex-shrink-0">
            {formatDateForList(thread.updatedAt)}
          </span>
        </div>
      </Link>
    </SpotlightCard>
  );
};
```

**Styling Details:**
- `SpotlightCard`: Reuse component wrapper (consistent look)
- `w-10 h-10 rounded-2xl`: Match NavAgents item icon size
- `bg-card border-[1.5px] border-border`: Match existing styling
- `gap-3 p-2.5`: Match NavAgents spacing
- `text-sm`: Match NavAgents text size
- `flex-shrink-0`: Prevent icon/timestamp from shrinking

#### 4. Active State Detection
```typescript
// Use pathname to detect if thread is currently open
const isThreadActive = pathname?.includes(`/projects/${thread.projectId}/thread/${thread.threadId}`);
```

#### 5. Loading State
```typescript
{isLoading ? (
  <div className="space-y-1">
    {Array.from({ length: 3 }).map((_, index) => (
      <div key={`skeleton-${index}`} className="flex items-center gap-3 px-2 py-2">
        <div className="h-10 w-10 bg-muted/10 border-[1.5px] border-border rounded-2xl animate-pulse"></div>
        <div className="h-4 bg-muted rounded flex-1 animate-pulse"></div>
        <div className="h-4 w-8 bg-muted rounded animate-pulse"></div>
      </div>
    ))}
  </div>
) : (
  // ... render grouped threads
)}
```

#### 6. Empty State
```typescript
{!isLoading && groupedThreads.length === 0 && (
  <div className="p-4 text-center text-muted-foreground">
    <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
    <p className="text-sm">No threads yet</p>
    <p className="text-xs mt-1">Create a new thread to see it here</p>
  </div>
)}
```

---

## Implementation Steps

### Phase 1: Create NavLibrary Component

#### Step 1.1: Create File
**File:** `frontend/src/components/sidebar/nav-library.tsx`

**Template:**
```typescript
'use client';

import { useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2, BookOpen } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { formatDateForList } from '@/lib/utils/date-formatting';
import { 
  ThreadWithProject, 
  processThreadsWithProjects, 
  groupThreadsByDate,
  useThreads,
  useProjects
} from '@/hooks/react-query/sidebar/use-sidebar';

// Copy DateGroupHeader and ThreadListItem from NavAgents (with modifications)
// ... component details from design section above
```

**Lines Estimate:** ~180 lines

#### Step 1.2: Import Necessary Types
From `use-sidebar.ts`:
```typescript
import { 
  ThreadWithProject, 
  GroupedThreads,
  processThreadsWithProjects,
  groupThreadsByDate,
  useThreads,
  useProjects 
} from '@/hooks/react-query/sidebar/use-sidebar';
```

#### Step 1.3: Import Components
```typescript
import { SpotlightCard } from '@/components/ui/spotlight-card';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useSidebar } from '@/components/ui/sidebar';
```

#### Step 1.4: Icon Integration
For project icons, reuse the same logic from NavAgents:
- Import ProjectIcon component (if exists)
- Or use generic folder icon as fallback
- Reference: `thread-icon.tsx` in NavAgents for icon handling

---

### Phase 2: Update sidebar-left.tsx

#### Step 2.1: Import NavLibrary
**File:** `frontend/src/components/sidebar/sidebar-left.tsx` (line ~13)

**Add Import:**
```typescript
import { NavLibrary } from '@/components/sidebar/nav-library';
```

#### Step 2.2: Replace Placeholder
**Location:** Lines 540-545

**Replace:**
```typescript
{activeView === 'library' && (
  <div className="p-4 text-center text-muted-foreground">
    <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
    <p className="text-sm">Library placeholder</p>
  </div>
)}
```

**With:**
```typescript
{activeView === 'library' && <NavLibrary />}
```

---

### Phase 3: Styling & Consistency Check

#### Step 3.1: Verify Color Consistency
- Check `SpotlightCard` styling matches NavAgents
- Verify `bg-muted` hover state
- Confirm `border-[1.5px] border-border` styling
- Check padding/margins alignment

#### Step 3.2: Responsive Testing
- Test on mobile (sidebar overlay mode)
- Test on tablet (collapsed/expanded states)
- Test overflow scrolling behavior
- Test click-to-close-sidebar on mobile

#### Step 3.3: Visual Polish
- Verify date group header spacing
- Check thread item padding/height
- Ensure active state styling is visible
- Test loading skeleton animation

---

## Data Flow Diagram

### From User Interaction to Rendered View

```
┌──────────────────────────────────────┐
│ User Clicks "Library" Button         │
└──────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ setActiveView('library')              │
└──────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ sidebar-left Re-renders              │
│ {activeView === 'library' && ...}    │
└──────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ <NavLibrary /> Component Mounts      │
└──────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 1. useThreads() Hook Executes        │
│    GET /api/threads                  │
│    React Query handles caching       │
└──────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 2. useProjects() Hook Executes       │
│    GET /api/projects                 │
│    Returns project metadata          │
└──────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 3. useMemo(() => {                   │
│   processThreadsWithProjects()       │
│   Joins threads with project info    │
│ })                                   │
└──────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 4. useMemo(() => {                   │
│   groupThreadsByDate()               │
│   Groups: Today, Yesterday, etc.     │
│ })                                   │
└──────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ 5. Render Grouped Thread List        │
│                                      │
│   Today                              │
│   ├─ 🔨 Project A (2 mins ago)      │
│   ├─ 🚀 Project B (5 mins ago)      │
│                                      │
│   Yesterday                          │
│   ├─ 📊 Project C (1 day ago)       │
│                                      │
│   Last 7 Days                        │
│   ├─ 🎨 Project D (3 days ago)      │
└──────────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────┐
│ User Can:                            │
│ • Click thread → Navigate to it      │
│ • See active thread highlighted      │
│ • On mobile: Sidebar closes          │
│ • Scroll if >3 visible items         │
└──────────────────────────────────────┘
```

---

## Reusable Hooks & Functions

All these already exist in `use-sidebar.ts` - NO NEW CODE needed:

```typescript
// ✅ Already available
export const useThreads = () => {...}
export const useProjects = () => {...}
export const processThreadsWithProjects = (threads, projects) => {...}
export const groupThreadsByDate = (threads) => {...}

// Type definitions
export type ThreadWithProject = {
  threadId: string;
  projectId: string;
  projectName: string;
  url: string;
  updatedAt: string;
  iconName?: string;
};

export type GroupedThreads = {
  dateGroup: string;
  threads: ThreadWithProject[];
}[];
```

**No changes required to use-sidebar.ts!**

---

## File Comparison Reference

### Size & Complexity

| Component | Lines | Complexity | Reference? |
|-----------|-------|-----------|-----------|
| **NavAgents** | 704 | ⭐⭐⭐⭐ (Complex: multi-select, delete, share) | 🟢 Primary |
| **NavAgentsView** | 149 | ⭐⭐ (Simple: list + load more) | 🟡 Secondary |
| **NavGlobalConfig** | 164 | ⭐⭐ (Config + creation dialog) | 🔴 Not applying |
| **NavKnowledgeBase** | 194 | ⭐⭐ (Folders + empty state) | 🟡 Secondary |
| **NavLibrary** | ~180 | ⭐⭐ (Simplified NavAgents) | 🆕 **New** |

**NavLibrary will be:**
- ~75% similar to NavAgents (same data structure)
- ~25% unique (no delete/multi-select, simplified UI)
- ~50% code reuse from existing components

---

## Testing Strategy

### Unit Tests

```typescript
// Tests for NavLibrary
describe('NavLibrary', () => {
  it('should render thread list when data loads', () => {...});
  it('should group threads by date correctly', () => {...});
  it('should show loading skeleton while fetching', () => {...});
  it('should show empty state when no threads', () => {...});
  it('should navigate to thread on click', () => {...});
  it('should highlight active thread', () => {...});
  it('should close mobile sidebar on thread click', () => {...});
});
```

### Integration Tests

```typescript
// Integration with sidebar
describe('Sidebar Library Integration', () => {
  it('should show NavLibrary when activeView === "library"', () => {...});
  it('should replace placeholder content', () => {...});
  it('should fetch data on mount', () => {...});
});
```

### Manual Testing Checklist

- [ ] Desktop: Click Library button, view opens with thread list
- [ ] Desktop: Click thread, navigates to `/projects/[id]/thread/[id]`
- [ ] Desktop: Thread currently viewing is highlighted
- [ ] Desktop: Scroll works with many threads (>10)
- [ ] Desktop: Empty state shows when no threads
- [ ] Desktop: Loading skeleton shows on first load
- [ ] Tablet: Sidebar works both expanded and collapsed
- [ ] Mobile: Click Library button, sidebar opens, shows thread list
- [ ] Mobile: Click thread, navigates and sidebar closes
- [ ] Mobile: Scrolling doesn't interfere with other UI
- [ ] Responsive: All text truncates properly (no overflow)
- [ ] Responsive: Icons stay aligned in all view modes

---

## Risk Assessment & Mitigation

### Potential Issues

| Issue | Risk | Mitigation |
|-------|------|-----------|
| Data already cached from LibraryPage | Low | React Query shares cache between components (feature, not bug!) |
| Performance with 100+ threads | Medium | Virtualization not needed for sidebar (max ~30 visible), use existing overflow scroll |
| Styling doesn't match NavAgents | Low | Copying exact CSS classes from NavAgents |
| Mobile sidebar doesn't close | Low | Using same `setOpenMobile(false)` pattern as other views |
| Project icon doesn't display | Low | Use fallback icon (e.g., Folder) if icon lookup fails |
| Date grouping inconsistent | Low | Using exact same `groupThreadsByDate()` function as LibraryPage |
| Active state detection broken | Medium | Use `pathname.includes()` pattern from other components |

---

## Success Criteria

✅ **Component Created:**
- [ ] `nav-library.tsx` file created with 150-200 lines
- [ ] All imports correct
- [ ] TypeScript compiles without errors
- [ ] No console errors on render

✅ **Integration Complete:**
- [ ] Import added to `sidebar-left.tsx`
- [ ] Placeholder replaced with `<NavLibrary />`
- [ ] Component renders without errors

✅ **Functionality Works:**
- [ ] Data fetches from API (threads + projects)
- [ ] Threads display in grouped list format
- [ ] Can click thread to navigate
- [ ] Active thread is highlighted
- [ ] Mobile sidebar closes on click

✅ **Styling Consistent:**
- [ ] Matches NavAgents visual design
- [ ] Padding/margins aligned
- [ ] Icons sized correctly
- [ ] Text colors match theme
- [ ] Hover states work

✅ **Edge Cases Handled:**
- [ ] Loading state shows skeleton
- [ ] Empty state shows message
- [ ] Error state handled gracefully
- [ ] Responsive on mobile/tablet
- [ ] Scrolling works smoothly

---

## Implementation Order

1. **Create NavLibrary Component** (Step 1)
   - Copy template from plan
   - Import necessary hooks/components
   - Implement main render logic

2. **Implement Sub-components** (Step 1)
   - DateGroupHeader
   - ThreadListItem
   - LoadingSkeleton
   - EmptyState

3. **Add Data Processing** (Step 1)
   - useThreads() hook
   - useProjects() hook
   - processThreadsWithProjects() useMemo
   - groupThreadsByDate() useMemo

4. **Add Navigation Logic** (Step 1)
   - Active state detection
   - Click handlers
   - Mobile close behavior

5. **Update sidebar-left.tsx** (Step 2)
   - Add import
   - Replace placeholder
   - Test render

6. **Test & Polish** (Step 3)
   - Manual testing on all devices
   - Fix styling issues
   - Verify all interactions

---

## Time Estimate

| Phase | Task | Time |
|-------|------|------|
| 1.1-1.4 | Create NavLibrary component | 45 mins |
| 2.1-2.2 | Update sidebar-left.tsx | 10 mins |
| 3.1-3.3 | Styling & testing | 30 mins |
| **TOTAL** | **Complete Implementation** | **~1.5 hours** |

---

## References & Resources

**Documentation:**
- `ACTIVEVIEW_PATTERN.md` - Pattern fundamentals
- `CONTENT_AREA_RENDERING_PATTERNS_V2.md` - Architecture overview
- `CONTENT_RENDERING_EXPLAINED.md` - Data flow explanation

**Reference Components:**
- `nav-agents.tsx` - Primary reference (thread list with grouping)
- `nav-agents-view.tsx` - Secondary reference (simple list)
- `nav-knowledge-base.tsx` - Tertiary reference (sections + empty state)

**Data Hooks:**
- `use-sidebar.ts` - Contains all data processing functions
- `formatDateForList()` - Utility for timestamp formatting
- `use-mobile.ts` - Mobile detection hook

**UI Components:**
- `SpotlightCard` - Card wrapper
- `Link` - Navigation
- `Loader2, BookOpen, Folder` - Icons

---

## Next Steps

1. ✅ **Read & Approve Plan** - Review this document
2. 📝 **Create NavLibrary** - Implement using steps from Phase 1
3. 🔗 **Update Sidebar** - Implement using steps from Phase 2
4. 🧪 **Test Implementation** - Manual testing checklist
5. 🎨 **Polish UI** - Styling consistency check
6. ✨ **Deploy** - Merge to feature branch

---

**Document Version:** 1.0  
**Last Updated:** November 4, 2025  
**Status:** Ready for Implementation  
**Approval:** ⏳ Pending
