# Notifications System UI Integration Plan

## Overview
Implement notifications across 3 UI touchpoints:
1. **Header** - NotificationBell dropdown with scrollable list
2. **Sidebar** - Inbox view with live badge + dedicated content area
3. **User Menu** - Simple link to notifications page

---

## Research Findings

### Sidebar Pattern Analysis

**ActiveView State Pattern:**
```typescript
const [activeView, setActiveView] = useState<'chats' | 'agents' | 'triggers' | 'library' | 'knowledge' | 'inbox'>('chats');
```

**View Button Pattern:**
```typescript
{ view: 'inbox' as const, icon: Bell, label: 'Inbox' }
// On click: setActiveView(view)
```

**Content Rendering Pattern:**
```typescript
{activeView === 'chats' && <NavAgents />}
{activeView === 'agents' && <NavAgentsView />}
{activeView === 'library' && <NavLibrary />}
{activeView === 'inbox' && <NavInbox />}  // Need to create this
```

**Current Inbox Placeholder:**
```typescript
{activeView === 'inbox' && (
  <div className="p-4 text-center text-muted-foreground">
    <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
    <p className="text-sm">Inbox placeholder</p>
  </div>
)}
```

### Nav Component Pattern

**Structure from nav-library.tsx and nav-agents.tsx:**
1. Use React Query hooks for data fetching
2. Implement date grouping (Today, Yesterday, Last 7 days, etc.)
3. Use SpotlightCard for list items
4. Include loading states (Loader2)
5. Handle empty states with messaging
6. Implement pagination if needed
7. Use SidebarGroup, SidebarMenu components

---

## Implementation Tasks

### Task 1: Create Dashboard Header Component ✅

**File:** `frontend/src/components/dashboard/dashboard-header.tsx`

**Purpose:** Add NotificationBell dropdown to top of dashboard

**Features:**
- NotificationBell component with live badge
- Dropdown with scrollable notification list
- Positioned in top-right of dashboard layout

**Location:** Render above SidebarInset content in layout-content.tsx

---

### Task 2: Create NavInbox Component ✅

**File:** `frontend/src/components/sidebar/nav-inbox.tsx`

**Purpose:** Sidebar content area for inbox view

**Features:**
- Fetch notifications using useNotifications hook
- Group by date (Today, Yesterday, etc.)
- Display notification items in list
- Mark as read functionality
- Link to full notifications page
- Loading and empty states

**Pattern:** Follow nav-library.tsx structure

---

### Task 3: Update Sidebar Bell Icon with Live Badge ✅

**File:** `frontend/src/components/sidebar/sidebar-left.tsx`

**Changes:**
- Replace static Bell icon with dynamic component
- Show unread count badge
- Keep existing click behavior (setActiveView)
- NO dropdown in sidebar (only in header)

**Implementation:**
```typescript
// Custom component for inbox button with badge
const InboxButton = ({ unreadCount }: { unreadCount: number }) => (
  <div className="relative">
    <Bell className="!h-4 !w-4" />
    {unreadCount > 0 && (
      <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 text-[8px] text-white flex items-center justify-center">
        {unreadCount > 9 ? '9+' : unreadCount}
      </span>
    )}
  </div>
);
```

---

### Task 4: Add Notifications Link to User Menu ✅

**File:** `frontend/src/components/sidebar/nav-user-with-teams.tsx`

**Changes:**
- Add MenuItem with Bell icon + "Notifications" text
- Link to `/notifications` page
- Place below "Settings" menu item

**Code:**
```typescript
<DropdownMenuItem asChild>
  <Link href="/notifications" className="gap-2 p-2">
    <Bell className="h-4 w-4" />
    <span>Notifications</span>
  </Link>
</DropdownMenuItem>
```

---

### Task 5: Integrate Header into Layout ✅

**File:** `frontend/src/components/dashboard/layout-content.tsx`

**Changes:**
- Import DashboardHeader component
- Add header inside SidebarInset, above children
- Ensure proper styling/spacing

---

## Detailed Implementation Steps

### Step 1: Create DashboardHeader Component

**Priority:** High
**Complexity:** Low

```typescript
'use client';

import { NotificationBell } from '@/components/notifications/notification-bell';

export function DashboardHeader() {
  return (
    <div className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4">
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <NotificationBell />
      </div>
    </div>
  );
}
```

---

### Step 2: Create NavInbox Component

**Priority:** High
**Complexity:** Medium

**Template Structure:**
```typescript
'use client';

import { useNotifications } from '@/hooks/react-query/notifications/use-notifications';
import { NotificationItem } from '@/components/notifications/notification-item';
import { Loader2, Bell, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { formatDateForList } from '@/lib/utils/date-formatting';

// Date grouping helper
function groupNotificationsByDate(notifications) {
  // Group by Today, Yesterday, Last 7 days, etc.
  // Similar pattern to nav-library.tsx
}

export function NavInbox() {
  const { data, isLoading } = useNotifications({
    page: 1,
    page_size: 50
  });

  if (isLoading) {
    return <LoadingState />;
  }

  if (!data?.notifications?.length) {
    return <EmptyState />;
  }

  const grouped = groupNotificationsByDate(data.notifications);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-2.5 py-3 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Inbox</h3>
          <Link href="/notifications">
            <Button variant="ghost" size="sm">
              View All <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
        {data.unread_count > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {data.unread_count} unread
          </p>
        )}
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto">
        {Object.entries(grouped).map(([dateGroup, notifications]) => (
          <div key={dateGroup}>
            <DateGroupHeader dateGroup={dateGroup} count={notifications.length} />
            {notifications.map((notification) => (
              <NotificationListItem
                key={notification.id}
                notification={notification}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### Step 3: Update Sidebar with Live Badge

**Priority:** Medium
**Complexity:** Low

**Changes in sidebar-left.tsx:**

1. Import useNotifications hook
2. Fetch unread count
3. Create InboxButton component with badge
4. Replace static Bell icon

```typescript
// At component level
const { data: notificationData } = useNotifications({
  page: 1,
  page_size: 1,
  is_read: false
});
const unreadCount = notificationData?.unread_count || 0;

// In button mapping
{
  view: 'inbox' as const,
  icon: () => <InboxButton unreadCount={unreadCount} />,
  label: 'Inbox'
}
```

---

### Step 4: Add User Menu Link

**Priority:** Low
**Complexity:** Very Low

**Location:** After Settings menu item in nav-user-with-teams.tsx

```typescript
<DropdownMenuItem asChild>
  <Link href="/notifications" className="gap-2 p-2">
    <Bell className="h-4 w-4" />
    <span>Notifications</span>
  </Link>
</DropdownMenuItem>
```

---

### Step 5: Integrate Header into Layout

**Priority:** High
**Complexity:** Low

**Changes in layout-content.tsx:**

```typescript
import { DashboardHeader } from '@/components/dashboard/dashboard-header';

// Inside return statement
<SidebarInset>
  <DashboardHeader />
  {mantenanceBanner}
  <div className="bg-background">{children}</div>
</SidebarInset>
```

---

## File Structure Summary

### New Files to Create (2):
1. `frontend/src/components/dashboard/dashboard-header.tsx` - Header with NotificationBell
2. `frontend/src/components/sidebar/nav-inbox.tsx` - Sidebar inbox content

### Files to Modify (3):
1. `frontend/src/components/sidebar/sidebar-left.tsx` - Add live badge to inbox button
2. `frontend/src/components/sidebar/nav-user-with-teams.tsx` - Add notifications menu link
3. `frontend/src/components/dashboard/layout-content.tsx` - Integrate header

### Existing Files to Use (3):
1. `frontend/src/components/notifications/notification-bell.tsx` - Header dropdown
2. `frontend/src/components/notifications/notification-item.tsx` - List item
3. `frontend/src/hooks/react-query/notifications/use-notifications.ts` - Data fetching

---

## UI/UX Flow

### Flow 1: Header Bell (Quick Access)
1. User sees notification bell in header with badge (e.g., "3")
2. User clicks bell → Dropdown opens
3. User sees recent 10-20 notifications scrollable
4. User can mark as read or click notification
5. "View All" link goes to `/notifications` page

### Flow 2: Sidebar Inbox (Dedicated View)
1. User clicks "Inbox" button in sidebar
2. Sidebar content changes to NavInbox component
3. User sees full list of notifications grouped by date
4. User can scroll through all notifications
5. "View All" button goes to `/notifications` page

### Flow 3: User Menu Link (Alternative Access)
1. User clicks avatar/name in sidebar
2. Dropdown menu opens
3. User sees "Notifications" menu item
4. Clicks to navigate to `/notifications` page

---

## Implementation Order

### Phase 1: Basic Integration (30-45 min)
1. ✅ Create DashboardHeader component (5 min)
2. ✅ Integrate header into layout-content.tsx (5 min)
3. ✅ Add notifications link to user menu (5 min)
4. ✅ Test header bell dropdown works (5 min)

### Phase 2: Sidebar Content (45-60 min)
5. ✅ Create NavInbox component skeleton (10 min)
6. ✅ Implement data fetching and grouping (15 min)
7. ✅ Add notification list rendering (15 min)
8. ✅ Add loading and empty states (5 min)
9. ✅ Test sidebar inbox view (10 min)

### Phase 3: Live Badge Integration (30 min)
10. ✅ Create InboxButton component with badge (10 min)
11. ✅ Update sidebar-left.tsx to use InboxButton (10 min)
12. ✅ Test badge updates with unread count (10 min)

### Phase 4: Polish & Testing (30 min)
13. ✅ Test all 3 touchpoints work together
14. ✅ Test mark as read functionality
15. ✅ Test navigation between views
16. ✅ Verify responsive behavior
17. ✅ Check accessibility (keyboard navigation, screen reader)

---

## Testing Checklist

- [ ] Header bell shows correct unread count
- [ ] Header bell dropdown displays notifications
- [ ] Sidebar inbox button shows unread badge
- [ ] Sidebar inbox view displays notifications
- [ ] User menu link navigates to notifications page
- [ ] Mark as read updates badge count in real-time
- [ ] Clicking notification navigates to related content
- [ ] Empty state displays when no notifications
- [ ] Loading state displays while fetching
- [ ] Mobile responsive behavior works
- [ ] Keyboard navigation works (tab, enter, esc)
- [ ] Screen reader announces unread count

---

## Technical Considerations

### Performance
- Use React Query caching to avoid duplicate API calls
- Share unread count between header and sidebar
- Implement optimistic updates for mark as read

### Accessibility
- Ensure badge has aria-label (e.g., "3 unread notifications")
- Keyboard navigation for dropdown and list
- Focus management when opening/closing dropdown
- Screen reader announcements for updates

### Responsive Design
- Header bell collapses on mobile (FloatingMobileMenuButton)
- Sidebar automatically collapses on mobile
- Dropdown positioning adapts to viewport

### State Management
- Use React Query for data fetching
- Share query cache between components
- Invalidate queries on mark as read

---

## Success Criteria

✅ **Functional:**
- All 3 touchpoints display notifications correctly
- Unread badges update in real-time
- Mark as read functionality works
- Navigation flows work as expected

✅ **UX:**
- Quick access via header bell
- Dedicated view via sidebar inbox
- Alternative access via user menu
- Smooth transitions and loading states

✅ **Code Quality:**
- Follows existing patterns (nav components)
- Type-safe with TypeScript
- Reuses existing components
- Well-documented code

✅ **Performance:**
- Minimal API calls (React Query caching)
- Fast load times (<100ms for cached data)
- Smooth animations (<16ms frame time)

---

## Next Steps

1. Start with Phase 1 (Basic Integration)
2. Test incrementally after each step
3. Commit changes in logical chunks
4. Document any issues or deviations from plan

Ready to implement! 🚀
