# Library Sidebar Implementation - Quick Reference

**Date:** November 4, 2025  
**Status:** 📋 Implementation Guide  
**Complexity:** ⭐⭐ Moderate (copy patterns, minimal new logic)

---

## The Big Picture

```
BEFORE (Current):
├─ Click "Library" button
└─ Placeholder shows: "Library placeholder"

AFTER (Goal):
├─ Click "Library" button
└─ Shows: Thread list grouped by date (like NavAgents, but simpler)
   ├─ Today
   │  ├─ 📊 Project A (2 mins ago)
   │  └─ 🎯 Project B (5 mins ago)
   ├─ Yesterday
   │  └─ 📈 Project C (1 day ago)
   └─ Last 7 Days
      └─ 🔧 Project D (3 days ago)
```

---

## Files to Create/Modify

| File | Action | Lines | Priority |
|------|--------|-------|----------|
| `frontend/src/components/sidebar/nav-library.tsx` | **CREATE** | 150-200 | 🔴 Critical |
| `frontend/src/components/sidebar/sidebar-left.tsx` | **MODIFY** | 2 lines replaced | 🟢 Easy |

---

## Quick Copy-Paste Sections

### 1️⃣ NavLibrary Template (Copy this into nav-library.tsx)

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

// ============= SUB-COMPONENTS =============

// Date group header
const DateGroupHeader: React.FC<{ dateGroup: string; count: number }> = ({ dateGroup, count }) => {
  return (
    <div className="py-2 mt-4 first:mt-2">
      <div className="text-xs font-medium text-muted-foreground pl-2.5">
        {dateGroup}
      </div>
    </div>
  );
};

// Thread list item
const ThreadListItem: React.FC<{
  thread: ThreadWithProject;
  isActive: boolean;
  onThreadClick: (threadId: string, url: string) => void;
}> = ({ thread, isActive, onThreadClick }) => {
  return (
    <SpotlightCard
      className={cn(
        "transition-colors cursor-pointer",
        isActive ? "bg-muted" : "bg-transparent"
      )}
    >
      <button
        onClick={() => onThreadClick(thread.threadId, thread.url)}
        className="w-full text-left"
      >
        <div className="flex items-center gap-3 p-2.5 text-sm">
          {/* Icon placeholder - replace with project icon if available */}
          <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-card border-[1.5px] border-border flex-shrink-0">
            {/* TODO: Import and use actual project icon component */}
            <span className="text-xs text-muted-foreground">📁</span>
          </div>

          {/* Thread name */}
          <div className="flex-1 min-w-0">
            <div className="truncate font-medium text-foreground">
              {thread.projectName}
            </div>
          </div>

          {/* Timestamp */}
          <span className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
            {formatDateForList(thread.updatedAt)}
          </span>
        </div>
      </button>
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
    <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
    <p className="text-sm">No threads yet</p>
    <p className="text-xs mt-1">Create a new thread to see it here</p>
  </div>
);

// ============= MAIN COMPONENT =============

export function NavLibrary() {
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  // Fetch data
  const { data: threads = [], isLoading: threadsLoading } = useThreads();
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  
  const isLoading = threadsLoading || projectsLoading;

  // Process threads with project info
  const threadsWithProjects = useMemo(() => {
    if (!threads.length || !projects.length) return [];
    return processThreadsWithProjects(threads, projects);
  }, [threads, projects]);

  // Group by date
  const groupedThreads = useMemo(() => {
    return groupThreadsByDate(threadsWithProjects);
  }, [threadsWithProjects]);

  // Handle thread click
  const handleThreadClick = (threadId: string, url: string) => {
    router.push(url);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Detect active thread
  const isThreadActive = (thread: ThreadWithProject) => {
    return pathname?.includes(thread.threadId) ?? false;
  };

  // Render
  return (
    <div className="overflow-y-auto max-h-[calc(100vh-280px)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] pb-32">
      {isLoading ? (
        <LoadingSkeleton />
      ) : groupedThreads.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {groupedThreads.map(({ dateGroup, threads: groupThreads }) => (
            <div key={dateGroup}>
              <DateGroupHeader dateGroup={dateGroup} count={groupThreads.length} />
              <div className="space-y-1">
                {groupThreads.map((thread) => (
                  <ThreadListItem
                    key={thread.threadId}
                    thread={thread}
                    isActive={isThreadActive(thread)}
                    onThreadClick={handleThreadClick}
                  />
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
```

### 2️⃣ Update sidebar-left.tsx (Find and Replace)

**Location:** Lines 540-545

**FIND:**
```typescript
{activeView === 'library' && (
  <div className="p-4 text-center text-muted-foreground">
    <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
    <p className="text-sm">Library placeholder</p>
  </div>
)}
```

**REPLACE WITH:**
```typescript
{activeView === 'library' && <NavLibrary />}
```

### 3️⃣ Add Import to sidebar-left.tsx (Top of file)

**Location:** After line 13 (after other imports like NavAgents, etc.)

**ADD:**
```typescript
import { NavLibrary } from '@/components/sidebar/nav-library';
```

---

## Key Styling Classes Reference

| Class | Purpose | Example |
|-------|---------|---------|
| `overflow-y-auto` | Allow scrolling | `<div className="overflow-y-auto">` |
| `max-h-[calc(100vh-280px)]` | Max height with buffer | Prevents content overlap |
| `[&::-webkit-scrollbar]:hidden` | Hide scrollbar (Chrome/Safari) | Applied to container |
| `[-ms-overflow-style:'none']` | Hide scrollbar (IE/Edge) | Applied to container |
| `[scrollbar-width:'none']` | Hide scrollbar (Firefox) | Applied to container |
| `pb-32` | Padding bottom | `padding-bottom: 128px` |
| `space-y-1` | Vertical spacing between items | Between thread items |
| `p-2.5` | Item padding | Inside SpotlightCard |
| `gap-3` | Gap between icon/name/time | Horizontal spacing |
| `text-xs` | Header text size | Date group headers |
| `text-muted-foreground` | Subtle text color | Headers, timestamps |
| `flex-shrink-0` | Prevent shrinking | Icon and timestamp |
| `truncate` | Ellipsis on overflow | Thread name |

---

## Data Flow Summary

```
useThreads() [API: GET /api/threads]
    ↓
useProjects() [API: GET /api/projects]
    ↓
processThreadsWithProjects(threads, projects)
    ↓ [Joins thread data with project metadata]
    ↓
groupThreadsByDate(threadsWithProjects)
    ↓ [Creates: { "Today": [...], "Yesterday": [...] }]
    ↓
Render DateGroupHeader + ThreadListItem for each group
    ↓
User sees organized thread list
```

---

## Common Issues & Fixes

### Issue: Import error for NavLibrary

**Error:** `Cannot find module './nav-library'`

**Fix:** Make sure file is saved at exact location:
```
frontend/src/components/sidebar/nav-library.tsx
```

---

### Issue: Threads not showing

**Possibilities:**
1. API not returning data - Check Network tab
2. useThreads() hook not working - Verify import
3. Data processing failing - Add console.log() to debug

**Debug:**
```typescript
console.log('Threads:', threads);
console.log('Projects:', projects);
console.log('Processed:', threadsWithProjects);
console.log('Grouped:', groupedThreads);
```

---

### Issue: Styling looks wrong

**Check:**
1. Is `SpotlightCard` imported correctly?
2. Are class names spelled correctly?
3. Does navbar have active state highlight?

**Compare with:**
- `nav-agents.tsx` (exact same SpotlightCard usage)
- `nav-agents-view.tsx` (similar pattern)

---

### Issue: Mobile sidebar doesn't close

**Fix:** Verify this line is in handleThreadClick:
```typescript
if (isMobile) {
  setOpenMobile(false);
}
```

---

### Issue: Active state not highlighting

**Fix:** Check pathname detection:
```typescript
const isThreadActive = (thread: ThreadWithProject) => {
  console.log('Checking:', pathname, 'against:', thread.threadId);
  return pathname?.includes(thread.threadId) ?? false;
};
```

---

## Testing Checklist

**Quick Manual Test:**
- [ ] NavLibrary file created (no errors in IDE)
- [ ] sidebar-left.tsx imports NavLibrary (no red squiggly)
- [ ] Placeholder line replaced
- [ ] Run dev server: `npm run dev`
- [ ] Navigate to dashboard
- [ ] Click Library button in sidebar
- [ ] Thread list appears (not placeholder)
- [ ] Can click thread (navigates)
- [ ] Date grouping shows correctly

---

## Reference Comparison

### This Component vs. NavAgents

| Feature | NavAgents | NavLibrary | Decision |
|---------|-----------|-----------|----------|
| **Data source** | threads + projects | threads + projects | ✅ Same |
| **Grouping** | By date | By date | ✅ Reuse |
| **Item style** | SpotlightCard | SpotlightCard | ✅ Same |
| **Delete** | ✅ Yes | ❌ No | Simplify |
| **Multi-select** | ✅ Yes | ❌ No | Simplify |
| **Share** | ✅ Yes | ❌ No | Simplify |
| **Active state** | ✅ Yes | ✅ Yes | ✅ Keep |
| **Mobile close** | ✅ Yes | ✅ Yes | ✅ Keep |
| **Loading state** | ✅ Yes | ✅ Yes | ✅ Keep |

**Result:** ~50% code reuse, 50% simplified

---

## Size Estimate

- **NavLibrary component:** ~150-180 lines (vs 704 for NavAgents)
- **sidebar-left.tsx changes:** 2 lines (1 import + 1 replacement)
- **Time to implement:** ~1.5 hours
- **Complexity:** Moderate (copying patterns, not inventing new ones)

---

## Success Indicators

✅ After implementation, you should see:

1. **Sidebar Library button works**
   - Clicks expand/collapse sidebar
   - Shows thread list instead of placeholder

2. **Thread list displays correctly**
   - Grouped by date (Today, Yesterday, etc.)
   - Shows project name + timestamp
   - Shows icons (folder icon as fallback)

3. **Navigation works**
   - Click thread → navigates to `/projects/[id]/thread/[id]`
   - Active thread highlighted with `bg-muted`
   - Mobile sidebar closes after click

4. **Loading states work**
   - Shows skeleton on first load
   - Shows empty state when no threads
   - Shows grouped list when data loads

5. **Styling matches**
   - Looks like NavAgents (same styling)
   - Fonts, colors, spacing consistent
   - Hover effects work

---

## Next File to Review

After implementation, check:
- `frontend/src/components/library/library-page.tsx` - Reference for full page version
- `frontend/src/hooks/react-query/sidebar/use-sidebar.ts` - Data functions used
- `frontend/src/lib/utils/date-formatting.ts` - Date formatting utility

---

**Version:** 1.0  
**Type:** Quick Reference  
**Difficulty:** ⭐⭐ Moderate  
**Status:** Ready for Implementation
