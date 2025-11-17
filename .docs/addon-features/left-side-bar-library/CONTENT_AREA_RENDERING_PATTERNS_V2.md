# Sidebar Content Area Integration & Rendering Patterns (V2)

**File Location:** `frontend/src/components/sidebar/sidebar-left.tsx`  
**Associated Files:** `frontend/src/components/library/library-page.tsx`  
**Route:** `/library` (accessed via sidebar)  
**Last Updated:** November 3, 2025  
**Status:** ✅ Verified Against Source Code

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Sidebar Integration Structure](#sidebar-integration-structure)
3. [Active View State Management](#active-view-state-management)
4. [Content Area Rendering](#content-area-rendering)
5. [Routing & Navigation Flow](#routing--navigation-flow)
6. [Mobile Responsive Behavior](#mobile-responsive-behavior)
7. [Library Page Integration](#library-page-integration)

---

## Architecture Overview

### Current Sidebar Design

The sidebar uses a **view-based tabbed interface** where different content areas are rendered conditionally based on the active view:

```
┌────────────────────────────────────────┐
│         Sidebar Container              │
│     (fixed width, responsive)          │
├────────────────────────────────────────┤
│ HEADER                                 │
│ • Kortix Logo                          │
│ • Search Modal Trigger (CMD+K)         │
│ • Mobile Menu Close Button             │
├────────────────────────────────────────┤
│ NAVIGATION BUTTONS (Horizontal Grid)   │
│ ┌──────────┬──────────┬──────────────┐ │
│ │ Chats    │ Agents   │ Triggers     │ │
│ │ (active) │          │              │ │
│ ├──────────┼──────────┼──────────────┤ │
│ │ Library  │ Knowledge│ Inbox        │ │
│ │          │          │              │ │
│ └──────────┴──────────┴──────────────┘ │
├────────────────────────────────────────┤
│ CONTENT AREA (activeView-based)        │
│                                        │
│ If activeView === 'chats':             │
│   └─ <NavAgents />                     │
│                                        │
│ If activeView === 'library':           │
│   └─ <LibraryContent /> (PLANNED)      │
│                                        │
│ If activeView === 'triggers':          │
│   ├─ <NavGlobalConfig />               │
│   └─ <NavTriggerRuns />                │
│                                        │
├────────────────────────────────────────┤
│ FOOTER                                 │
│ • User Profile & Settings              │
│ • Plan Display                         │
└────────────────────────────────────────┘
```

---

## Sidebar Integration Structure

### Component Hierarchy

**File:** `frontend/src/components/sidebar/sidebar-left.tsx`

```tsx
export function SidebarLeft({...props}: React.ComponentProps<typeof Sidebar>) {
  // State management
  const [activeView, setActiveView] = useState<'chats' | 'agents' | 'triggers' | 'library' | 'knowledge' | 'inbox'>('chats');
  const [user, setUser] = useState<{...}>({...});

  // Layout rendered as:
  return (
    <Sidebar collapsible="icon" className="...">
      {/* Header section */}
      <SidebarHeader>
        <KortixLogo />
        <ThreadSearchModal />
        <FloatingMobileMenuButton />
      </SidebarHeader>

      {/* Content section (conditional views) */}
      <SidebarContent>
        {/* Navigation buttons grid */}
        <div className="flex gap-2 justify-center">
          {viewButtons.map(({ view, icon, label }) => (
            <Link href={routeMap[view]} key={view}>
              <button
                onClick={() => setActiveView(view)}
                className={cn(
                  activeView === view 
                    ? 'bg-card border-[1.5px] border-border'
                    : 'border-[1.5px] border-transparent'
                )}
              >
                <Icon className="!h-4 !w-4" />
                <span className="text-xs">{label}</span>
              </button>
            </Link>
          ))}
        </div>

        {/* Conditional content area */}
        <div className="px-6 flex-1 overflow-hidden">
          {activeView === 'chats' && <NavAgents />}
          {activeView === 'agents' && <NavAgentsView />}
          {activeView === 'triggers' && (<><NavGlobalConfig /><NavTriggerRuns /></>)}
          {activeView === 'library' && <LibraryPlaceholder />}  {/* PLANNED */}
          {activeView === 'knowledge' && <NavKnowledgeBase />}
          {activeView === 'inbox' && <InboxPlaceholder />}
        </div>
      </SidebarContent>

      {/* Footer section */}
      <SidebarFooter>
        <UserProfileSection user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
```

### Sidebar CSS Classes

| Class | Purpose | Behavior |
|-------|---------|----------|
| `collapsible="icon"` | Collapse mode | Shows only icons when collapsed |
| `border-r border-border/50` | Right border | Visual separation from content |
| `bg-background` | Background color | Matches main theme |
| `[&::-webkit-scrollbar]:hidden` | Scrollbar hiding | Custom webkit scrollbar |
| `[-ms-overflow-style:'none']` | IE/Edge scrollbar | Hides scrollbar |
| `[scrollbar-width:'none']` | Firefox scrollbar | Hides scrollbar |

---

## Active View State Management

### State Definition

**File:** `frontend/src/components/sidebar/sidebar-left.tsx` (line 187)

```typescript
const [activeView, setActiveView] = useState<'chats' | 'agents' | 'triggers' | 'library' | 'knowledge' | 'inbox'>('chats');
```

### View Buttons Configuration

**File:** `frontend/src/components/sidebar/sidebar-left.tsx` (lines 370-395)

```typescript
const viewButtons = [
  { view: 'chats' as const, icon: MessageCircle, label: 'Chats' },
  { view: 'agents' as const, icon: Bot, label: 'Agents' },
  { view: 'triggers' as const, icon: Zap, label: 'Triggers' },
  { view: 'library' as const, icon: Folder, label: 'Library' },
  { view: 'knowledge' as const, icon: Database, label: 'Knowledge' },
  { view: 'inbox' as const, icon: Bell, label: 'Inbox' },
];
```

### Button Click Behavior

```typescript
viewButtons.map(({ view, icon: Icon, label }) => (
  <Link href={routeMap[view]} key={view}>
    <button
      onClick={() => setActiveView(view)}
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 p-1.5 rounded-2xl cursor-pointer transition-colors w-[64px] h-[64px]",
        "hover:bg-muted/60 hover:border-[1.5px] hover:border-border",
        activeView === view 
          ? 'bg-card border-[1.5px] border-border'      // Active: filled with border
          : 'border-[1.5px] border-transparent'          // Inactive: transparent
      )}
    >
      <Icon className="!h-4 !w-4" />
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {label}
      </span>
    </button>
  </Link>
))}
```

### Route Mapping

**File:** `frontend/src/components/sidebar/sidebar-left.tsx` (lines 142-148)

```typescript
const routeMap: Record<string, string> = {
  '/chats': '/chats',
  '/agents': '/agents',
  '/triggers': '/triggers',
  '/library': '/library',
  '/knowledge': '/knowledge',
  '/inbox': '/inbox',
};
```

**Purpose:**
- Maps activeView state to route paths
- Allows sidebar navigation via URL (links wrap buttons)
- Enables direct navigation: clicking library button → navigate to `/library`

### Active View Logic

```typescript
// Navigation button is styled based on activeView state
{activeView === 'library' && (
  // ACTIVE: Show filled background and border
  <button className="bg-card border-[1.5px] border-border">
    <Folder className="!h-4 !w-4" />
    <span>Library</span>
  </button>
)}

{activeView !== 'library' && (
  // INACTIVE: Show transparent border only
  <button className="border-[1.5px] border-transparent hover:bg-muted/60">
    <Folder className="!h-4 !w-4" />
    <span>Library</span>
  </button>
)}
```

---

## Content Area Rendering

### Container Structure

**File:** `frontend/src/components/sidebar/sidebar-left.tsx` (lines 523-545)

```tsx
<div className="px-6 flex-1 overflow-hidden">
  {/* Conditional content renders here */}
</div>
```

### Container CSS

| Class | Purpose |
|-------|---------|
| `px-6` | Horizontal padding (24px left/right) |
| `flex-1` | Flex grow: takes all remaining vertical space |
| `overflow-hidden` | Prevents scrolling, crops overflow content |

---

## Rendering Patterns

### Pattern 1: Single Component

**Use Case:** View displays only one component

```typescript
{activeView === 'chats' && <NavAgents />}
{activeView === 'agents' && <NavAgentsView />}
{activeView === 'knowledge' && <NavKnowledgeBase />}
```

**When Used:**
- Chats → `<NavAgents />` (thread list)
- Agents → `<NavAgentsView />` (agents grid)
- Knowledge → `<NavKnowledgeBase />` (knowledge base UI)

**Characteristics:**
- Direct boolean check: `activeView === 'viewName'`
- Single component rendered
- Cleanest for simple views

---

### Pattern 2: Multiple Components with Fragment

**Use Case:** View displays multiple related components

```typescript
{activeView === 'triggers' && (
  <>
    <NavGlobalConfig />
    <NavTriggerRuns />
  </>
)}
```

**When Used:**
- Triggers → two stacked sections (global config + trigger runs)

**Why Fragment `<>...</>`:**
- No extra DOM wrapper `<div>`
- Multiple components as logical unit
- No layout interference
- Maintains flex stacking behavior

**Alternative (NOT used):**
```tsx
// DON'T do this - adds unnecessary DOM node
{activeView === 'triggers' && (
  <div>
    <NavGlobalConfig />
    <NavTriggerRuns />
  </div>
)}
```

---

### Pattern 3: Placeholder (Not Yet Implemented)

**Use Case:** Feature planned but not yet implemented

```typescript
{activeView === 'library' && (
  <div className="p-4 text-center text-muted-foreground">
    <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
    <p className="text-sm">Library placeholder</p>
  </div>
)}
```

**Current Status (as of Nov 3, 2025):**
- ❌ Library content NOT integrated into sidebar yet
- ✅ Library page exists at `/library` route
- ⏳ Pending: Display library content in sidebar when activeView === 'library'

**Placeholder CSS:**
| Class | Purpose |
|-------|---------|
| `p-4` | Padding around content |
| `text-center` | Center-aligned text |
| `text-muted-foreground` | Subdued text color |
| `h-8 w-8` | Icon size (32px) |
| `mx-auto` | Horizontally center icon |
| `mb-2` | Margin bottom between icon and text |
| `opacity-50` | Semi-transparent icon |

---

## Routing & Navigation Flow

### Navigation Entry Points

**Direct URL Navigation:**
```
1. User enters `/library` URL
2. Dashboard layout mounts (layout-content.tsx)
3. Route doesn't control sidebar view state
4. Sidebar shows placeholder until integrated
```

**Button Navigation:**
```
1. User clicks Library button in sidebar
2. Link navigates to `/library` (routeMap)
3. setActiveView('library') called
4. Content area renders library placeholder
5. (Future) Library sidebar content component renders
```

### Current Route Structure

**File:** `frontend/src/app/(dashboard)/`

```
(dashboard)/
├── layout.tsx                          [Main dashboard layout]
├── /library/
│   ├── page.tsx                        [/library route - LibraryPage component]
│   └── ...
├── /chats/
│   └── page.tsx                        [/chats route - ChatsPage]
├── /agents/
│   └── page.tsx                        [/agents route - AgentsPage]
├── /triggers/
│   └── page.tsx                        [/triggers route - TriggersPage]
├── /knowledge/
│   └── page.tsx                        [/knowledge route - KnowledgePage]
└── /inbox/
    └── page.tsx                        [/inbox route - InboxPage]
```

### Sidebar State vs Route

**Important:** Sidebar `activeView` state is independent of route.

```
Scenario 1: Direct URL navigation
├─ User navigates to /library
├─ Route loads LibraryPage component
├─ Sidebar activeView might still be 'chats'
└─ Result: Library page in main content, different view active in sidebar

Scenario 2: Button navigation
├─ User clicks Library button
├─ setActiveView('library') called
├─ Link navigates to /library
└─ Result: Sidebar shows library view, /library route loads LibraryPage
```

---

## Mobile Responsive Behavior

### Mobile Layout Changes

**File:** `frontend/src/components/sidebar/sidebar-left.tsx` (lines 154-168)

```typescript
// Mobile-only: Floating menu button
function FloatingMobileMenuButton() {
  const { setOpenMobile, openMobile, setOpen } = useSidebar();
  const isMobile = useIsMobile();

  if (!isMobile || openMobile) return null;

  return (
    <div className="fixed top-6 left-4 z-50">
      <Button
        onClick={() => {
          setOpen(true);
          setOpenMobile(true);
        }}
        size="icon"
        className="h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg"
      >
        <Menu className="h-5 w-5" />
      </Button>
    </div>
  );
}
```

### Mobile Sidebar Behavior

```typescript
useEffect(() => {
  if (isMobile) {
    setOpenMobile(false);  // Close sidebar on mobile after navigation
  }
}, [pathname, searchParams, isMobile, setOpenMobile]);
```

**Flow:**
1. Sidebar starts closed on mobile
2. User clicks floating menu button
3. Sidebar slides in (overlay)
4. User clicks a view button (e.g., Library)
5. Navigation occurs
6. Sidebar closes automatically

### Sidebar Collapse on Desktop

**File:** `frontend/src/components/sidebar/sidebar-left.tsx` (line 328)

```typescript
<Sidebar
  collapsible="icon"
  className="border-r border-border/50 bg-background ..."
>
```

**Behavior:**
- Desktop: Can collapse to show only icons
- Mobile: No collapse (slides in/out as overlay)
- Transition: Smooth animation with framer-motion

---

## Library Page Integration

### Current State (v1)

**Status:** ⏳ **In Progress**

The Library Page exists as a standalone route but is NOT yet integrated into the sidebar:

```
❌ CURRENT:
─ /library route (standalone page in main content area)
─ Sidebar shows "Library placeholder" when activeView === 'library'
─ No thread list in sidebar

✅ PLANNED:
─ /library route (main LibraryPage in main content area)
─ Sidebar shows thread list when activeView === 'library'
─ Thread list in sidebar matches LibraryPage functionality
```

### Integration Requirements

To fully integrate Library into sidebar, implement:

#### 1. Create `NavLibrary` Component

**File:** `frontend/src/components/sidebar/nav-library.tsx` (NEW)

```typescript
import { useProjects, useThreads } from '@/hooks/react-query/sidebar/use-sidebar';
import { groupThreadsByDate } from '@/hooks/react-query/sidebar/use-sidebar';
import { useRouter } from 'next/navigation';

export function NavLibrary() {
  const { data: threads = [] } = useThreads();
  const { data: projects = [] } = useProjects();
  const router = useRouter();

  // Process and group threads (reuse existing logic from use-sidebar)
  const threadsWithProjects = processThreadsWithProjects(threads, projects);
  const groupedThreads = groupThreadsByDate(threadsWithProjects);

  return (
    <div>
      {/* Thread list sections by date */}
      {Object.entries(groupedThreads).map(([dateGroup, threadList]) => (
        <div key={dateGroup}>
          <h3 className="text-xs font-semibold text-muted-foreground px-2 py-1">
            {dateGroup}
          </h3>
          {threadList.map(thread => (
            <button
              key={thread.threadId}
              onClick={() => router.push(thread.url)}
              className="w-full text-left px-2 py-2 rounded hover:bg-muted/50 truncate text-sm"
            >
              {thread.projectName}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
```

#### 2. Update Sidebar Content Area

**File:** `frontend/src/components/sidebar/sidebar-left.tsx` (modify)

```typescript
import { NavLibrary } from '@/components/sidebar/nav-library';

// Replace placeholder:
{activeView === 'library' && (
  <NavLibrary />  {/* NEW: actual library content */
)}
```

#### 3. Update Type Definition

**File:** `frontend/src/components/sidebar/sidebar-left.tsx` (modify line 187)

```typescript
// Already updated - 'library' is already in the union type
const [activeView, setActiveView] = useState<'chats' | 'agents' | 'triggers' | 'library' | 'knowledge' | 'inbox'>('chats');
```

### Reusable Data Processing

**File:** `frontend/src/hooks/react-query/sidebar/use-sidebar.ts` (existing)

These functions are already exported and can be used by NavLibrary:

```typescript
// Already available in use-sidebar.ts:
export type ThreadWithProject = {...};
export const processThreadsWithProjects = (threads, projects) => {...};
export const groupThreadsByDate = (threadsList) => {...};
export const sortThreads = (threadsList) => {...};
```

### Data Flow for Sidebar Library

```
┌─────────────────────────────────────────┐
│ NavLibrary Component                    │
├─────────────────────────────────────────┤
│ 1. useThreads() → Thread[]              │
│ 2. useProjects() → Project[]            │
├─────────────────────────────────────────┤
│ 3. processThreadsWithProjects()         │
│    → ThreadWithProject[] (sorted)       │
├─────────────────────────────────────────┤
│ 4. groupThreadsByDate()                 │
│    → GroupedThreads {                   │
│         'Today': [...],                 │
│         'Yesterday': [...],             │
│         'This Week': [...],             │
│         'This Month': [...],            │
│         'Last 3 Months': [...],         │
│         'Older': [...]                  │
│       }                                 │
├─────────────────────────────────────────┤
│ 5. Render grouped thread list           │
│    • Expandable sections by date        │
│    • Clickable threads → navigate       │
│    • Search capability (optional)       │
└─────────────────────────────────────────┘
```

---

## Related Files & Components

| File | Purpose |
|------|---------|
| `frontend/src/components/sidebar/sidebar-left.tsx` | Main sidebar component (601 lines) |
| `frontend/src/components/library/library-page.tsx` | Standalone library page (282 lines) |
| `frontend/src/hooks/react-query/sidebar/use-sidebar.ts` | Data fetching & processing (188 lines) |
| `frontend/src/app/(dashboard)/layout.tsx` | Dashboard layout wrapper |
| `frontend/src/components/dashboard/layout-content.tsx` | Layout content provider |

---

## Conditional Rendering Summary

| View | Component(s) | Status | Location |
|------|---|---|---|
| **chats** | `<NavAgents />` | ✅ Implemented | Sidebar |
| **agents** | `<NavAgentsView />` | ✅ Implemented | Sidebar |
| **triggers** | `<NavGlobalConfig />` + `<NavTriggerRuns />` | ✅ Implemented | Sidebar |
| **library** | Placeholder (soon NavLibrary) | ⏳ In Progress | Sidebar |
| **knowledge** | `<NavKnowledgeBase />` | ✅ Implemented | Sidebar |
| **inbox** | Placeholder | ⏳ Not Started | Sidebar |

---

## Keyboard Shortcuts

**File:** `frontend/src/components/sidebar/sidebar-left.tsx` (lines 250-274)

| Shortcut | Action |
|----------|--------|
| **Cmd+B** / **Ctrl+B** | Toggle sidebar collapse/expand |
| **Cmd+K** / **Ctrl+K** | Open thread search modal |
| **Cmd+J** / **Ctrl+J** | Create new chat (navigate to /dashboard) |

---

## Future Enhancements

### Phase 1: Basic Sidebar Integration
- [ ] Create `NavLibrary` component
- [ ] Replace placeholder with actual library content
- [ ] Reuse `processThreadsWithProjects` and `groupThreadsByDate` functions

### Phase 2: Enhanced Sidebar Library
- [ ] Add search within library threads
- [ ] Add favorites filter in sidebar
- [ ] Add thread action menu (delete, archive, etc.)

### Phase 3: Synchronized State
- [ ] Sync sidebar activeView with route parameter
- [ ] Remember last active view on page refresh
- [ ] Highlight current thread in sidebar

### Phase 4: Performance
- [ ] Virtual scroll for large thread lists (100+ threads)
- [ ] Lazy load sections by date
- [ ] Cancel requests when switching views

