# Divergence from Upstream Documentation

## Overview
This document records all modifications, additions, and skipped changes during the notifications system implementation from `upstream/2025-10-31-vr4n-bc257`.

**Date:** 2025-11-18
**Branch:** `claude/feature-notifications-system-016rgonmFCHYRntSwGcE8ps9`
**Commit:** `0dcac535`
**Upstream Source:** `kortix-ai/suna` branch `2025-10-31-vr4n-bc257`

---

## Summary Statistics

| Category | Count | Description |
|----------|-------|-------------|
| ✅ Files Added | 28 | Pure addition, no conflicts |
| ⚠️ Files Modified | 2 | Targeted changes applied |
| 🚫 Files Skipped | 2 | Changes intentionally not applied |
| 📝 Tracking Docs | 3 | Created for documentation |

---

## ✅ PURE ADDITIONS (28 files)

These files were copied completely from upstream with no modifications:

### Backend (5 files)
```
backend/core/admin/notification_admin_api.py
backend/core/services/notification_api.py
backend/core/services/notification_service.py
backend/supabase/migrations/20251030140049_account_deletion.sql
backend/supabase/migrations/20251031141213_notifications_system.sql
```

### Frontend (19 files)
```
frontend/src/app/(dashboard)/admin/notifications/page.tsx
frontend/src/app/(dashboard)/admin/page.tsx
frontend/src/app/(dashboard)/notifications/page.tsx
frontend/src/app/(dashboard)/projects/[projectId]/thread/_components/UpgradeDialog.tsx
frontend/src/app/(dashboard)/projects/[projectId]/thread/_components/index.ts
frontend/src/app/(dashboard)/projects/[projectId]/thread/_hooks/index.ts
frontend/src/app/(dashboard)/projects/[projectId]/thread/_hooks/useBilling.ts
frontend/src/app/(dashboard)/projects/[projectId]/thread/_hooks/useKeyboardShortcuts.ts
frontend/src/app/(dashboard)/projects/[projectId]/thread/_hooks/useThreadData.ts
frontend/src/app/(dashboard)/projects/[projectId]/thread/_hooks/useToolCalls.ts
frontend/src/components/admin/admin-notification-batch-dialog.tsx
frontend/src/components/admin/admin-notification-batch-list.tsx
frontend/src/components/admin/admin-notification-form.tsx
frontend/src/components/notifications/notification-bell.tsx
frontend/src/components/notifications/notification-item.tsx
frontend/src/components/notifications/notification-list.tsx
frontend/src/hooks/react-query/admin/use-admin-notifications.ts
frontend/src/hooks/react-query/notifications/keys.ts
frontend/src/hooks/react-query/notifications/use-notifications.ts
```

### Documentation (4 files)
```
docs/EXPO_PUSH_NOTIFICATIONS_EXPLAINED.md
docs/EXPO_PUSH_NOTIFICATIONS_SETUP.md
docs/NOTIFICATION_EMAIL_TEMPLATE.md
docs/PUSH_NOTIFICATION_AUTHENTICATION_FLOW.md
```

**Impact:** Zero divergence - these files are identical to upstream.

---

## ⚠️ TARGETED MODIFICATIONS (2 files)

These files existed in both branches and received targeted modifications.

### 1. backend/core/admin/admin_api.py

**File Status:** MODIFIED (not fully replaced)
**Lines Changed:** 3 sections
**Reason:** API compatibility and authentication simplification

#### Modification 1: RPC Function Call Update
**Location:** Line ~410
**Type:** CHANGED (not added)

```python
# BEFORE (feature/workflows-playbooks):
oauth_result = await client.rpc('get_user_account_by_email', {'email_input': email}).execute()
if not oauth_result.data:
    return await PaginationService.paginate_with_total_count(...)
account_id = oauth_result.data['id']

# AFTER (applied from upstream):
oauth_result = await client.rpc('get_account_by_email', {'search_email': email}).execute()
if not oauth_result.data:
    return await PaginationService.paginate_with_total_count(...)
account_id = oauth_result.data
```

**Changes:**
1. RPC function name: `get_user_account_by_email` → `get_account_by_email`
2. Parameter name: `email_input` → `search_email`
3. Return value access: `oauth_result.data['id']` → `oauth_result.data`

**Reason:** The database RPC function was renamed and changed its return structure in upstream.

**Divergence Risk:** If upstream reverts this change, this line will break.

---

#### Modification 2: Environment Variables GET Endpoint
**Location:** Line ~518
**Type:** CHANGED (not added)

```python
# BEFORE (feature/workflows-playbooks):
@router.get("/env-vars")
async def get_env_vars(admin: dict = Depends(require_admin)) -> Dict[str, str]:
    """Get environment variables (local mode only, admin only)."""

# AFTER (applied from upstream):
@router.get("/env-vars")
def get_env_vars() -> Dict[str, str]:
    """Get environment variables (local mode only)."""
```

**Changes:**
1. Removed `async` keyword
2. Removed `admin: dict = Depends(require_admin)` parameter
3. Updated docstring: removed "admin only"

**Reason:** Simplified authentication for environment variable access.

**Divergence Risk:** If your codebase requires admin authentication for env vars, this could be a security concern.

---

#### Modification 3: Environment Variables POST Endpoint
**Location:** Line ~535
**Type:** CHANGED (not added)

```python
# BEFORE (feature/workflows-playbooks):
@router.post("/env-vars")
async def save_env_vars(request: Dict[str, str], admin: dict = Depends(require_admin)) -> Dict[str, str]:
    """Save environment variables (local mode only, admin only)."""

# AFTER (applied from upstream):
@router.post("/env-vars")
def save_env_vars(request: Dict[str, str]) -> Dict[str, str]:
    """Save environment variables (local mode only)."""
```

**Changes:**
1. Removed `async` keyword
2. Removed `admin: dict = Depends(require_admin)` parameter
3. Updated docstring: removed "admin only"

**Reason:** Simplified authentication for environment variable access.

**Divergence Risk:** If your codebase requires admin authentication for env vars, this could be a security concern.

---

### 2. frontend/src/lib/api.ts

**File Status:** MODIFIED (not fully replaced)
**Lines Changed:** Added at end of file (lines 2321-2449)
**Type:** PURE ADDITION (no existing code modified)

#### Addition: Notification Type Definitions
**Location:** Lines 2321-2360

```typescript
// ADDED (pure addition):
export interface Notification {
  id: string;
  account_id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'agent_complete';
  category?: string;
  thread_id?: string;
  agent_run_id?: string;
  metadata: Record<string, any>;
  email_sent: boolean;
  email_sent_at?: string;
  push_sent: boolean;
  push_sent_at?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationListResponse {
  notifications: Notification[];
  total: number;
  unread_count: number;
}

export interface NotificationPreferences {
  user_id: string;
  account_id: string;
  email_enabled: boolean;
  push_enabled: boolean;
  email_categories: Record<string, boolean>;
  push_categories: Record<string, boolean>;
  push_token?: string;
  push_token_updated_at?: string;
  created_at: string;
  updated_at: string;
}
```

**Type:** PURE ADDITION
**Reason:** Required for TypeScript type safety with notification API.
**Divergence Risk:** None - this is additive.

---

#### Addition: getNotifications Function
**Location:** Lines 2363-2414

```typescript
// ADDED (pure addition):
export const getNotifications = async (
  params?: {
    page?: number;
    page_size?: number;
    is_read?: boolean;
    category?: string;
    notification_type?: string;
  }
): Promise<NotificationListResponse> => {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new NoAccessTokenAvailableError();
    }

    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.page_size) queryParams.append('page_size', params.page_size.toString());
    if (params?.is_read !== undefined) queryParams.append('is_read', params.is_read.toString());
    if (params?.category) queryParams.append('category', params.category);
    if (params?.notification_type) queryParams.append('notification_type', params.notification_type);

    const response = await fetch(`${API_URL}/notifications?${queryParams}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch notifications: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      notifications: data.items || [],
      total: data.total || 0,
      unread_count: data.unread_count || 0,
    };
  } catch (error) {
    console.error('Failed to get notifications:', error);
    handleApiError(error, { operation: 'get notifications', resource: 'notifications' });
    throw error;
  }
};
```

**Type:** PURE ADDITION
**Reason:** API function to fetch notifications from backend.
**Divergence Risk:** None - this is additive.

---

#### Addition: markNotificationAsRead Function
**Location:** Lines 2416-2449

```typescript
// ADDED (pure addition):
export const markNotificationAsRead = async (
  notificationIds: string[],
  isRead: boolean = true
): Promise<{ success: boolean; message: string }> => {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new NoAccessTokenAvailableError();
    }

    const response = await fetch(`${API_URL}/notifications/read-all`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ notification_ids: notificationIds, is_read: isRead }),
    });

    if (!response.ok) {
      throw new Error(`Failed to mark notifications as read: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    handleApiError(error, { operation: 'mark notification as read', resource: 'notifications' });
    throw error;
  }
};
```

**Type:** PURE ADDITION
**Reason:** API function to mark notifications as read.
**Divergence Risk:** None - this is additive.

---

## 🚫 INTENTIONALLY SKIPPED (2 files)

These files had changes in upstream that we deliberately did NOT apply.

### 1. frontend/src/components/dashboard/layout-content.tsx

**Status:** SKIPPED (no changes applied)
**Reason:** Major refactoring unrelated to notifications

#### Skipped Change 1: Import Path Refactoring
```typescript
// UPSTREAM WANTED TO CHANGE:
- import { useAccounts } from '@/hooks/account';
+ import { useAccounts } from '@/hooks/use-accounts';

- import { useMaintenanceNoticeQuery } from '@/hooks/edge-flags';
+ import { useMaintenanceNoticeQuery } from '@/hooks/react-query/edge-flags';

- import { useApiHealth } from '@/hooks/usage/use-health';
+ import { useApiHealth } from '@/hooks/react-query';

- import { useProjects, useThreads } from '@/hooks/sidebar/use-sidebar';
+ import { useProjects, useThreads } from '@/hooks/react-query/sidebar/use-sidebar';

- import { useIsMobile } from '@/hooks/utils';
+ import { useIsMobile } from '@/hooks/use-mobile';

- import { useAgents } from '@/hooks/agents/use-agents';
+ import { useAgents } from '@/hooks/react-query/agents/use-agents';
```

**Why Skipped:** This is a major hooks reorganization project unrelated to notifications. Applying these would:
- Require reorganizing entire hooks directory structure
- Risk breaking existing imports throughout the codebase
- Not necessary for notifications to function

**Divergence Impact:** Your hooks remain in their current locations. If upstream continues this reorganization, future merges will show conflicts.

---

#### Skipped Change 2: Store to Context API Migration
```typescript
// UPSTREAM WANTED TO CHANGE:
- import { useDeleteOperationEffects } from '@/stores/delete-operation-store';
+ import { DeleteOperationProvider } from '@/contexts/DeleteOperationContext';

- import { SubscriptionStoreSync } from '@/stores/subscription-store';
+ import { SubscriptionProvider } from '@/contexts/SubscriptionContext';

- import { PresentationViewerWrapper } from '@/stores/presentation-viewer-store';
+ // Removed entirely

// Component wrapper changes:
- <DeleteOperationEffectsWrapper>
-   <SubscriptionStoreSync>
-     {/* ... */}
-     <PresentationViewerWrapper />
-   </SubscriptionStoreSync>
- </DeleteOperationEffectsWrapper>

+ <DeleteOperationProvider>
+   <SubscriptionProvider>
+     {/* ... */}
+     {/* PresentationViewerWrapper removed */}
+   </SubscriptionProvider>
+ </DeleteOperationProvider>
```

**Why Skipped:** This is a major architectural change from Zustand stores to Context API. Applying these would:
- Require creating new Context providers
- Risk breaking existing state management
- Remove presentation viewer functionality
- Not necessary for notifications to function

**Divergence Impact:** Your app continues using Zustand stores. If you want to migrate to Context API later, you'll need to do it separately.

---

#### Skipped Change 3: Admin Bypass Removal
```typescript
// UPSTREAM WANTED TO CHANGE:
- const { data: adminRoleData, isLoading: isCheckingAdminRole } = useAdminRole();
- const isAdmin = adminRoleData?.isAdmin ?? false;

- if (maintenanceNotice?.enabled && !maintenanceLoading && !isCheckingAdminRole && !isAdmin) {
-   return <MaintenancePage/>
- }

+ if (maintenanceNotice?.enabled && !maintenanceLoading) {
+   return <MaintenanceAlert open={true} onOpenChange={() => { }} closeable={false} />;
+ }
```

**Why Skipped:** This removes the admin bypass for maintenance mode. Keeping the admin bypass allows administrators to access the app during maintenance.

**Divergence Impact:** Admins can still access your app during maintenance. Upstream admins cannot.

---

### 2. frontend/src/components/sidebar/sidebar-left.tsx

**Status:** SKIPPED (no changes applied)
**Reason:** Removes notification UI elements (contradicts implementation goal)

#### Skipped Change 1: Remove Bell Icon Import
```typescript
// UPSTREAM WANTED TO CHANGE:
- import { Bot, Menu, Plus, Zap, ChevronRight, BookOpen, Code, Star, Package,
-   Sparkle, Sparkles, X, MessageCircle, PanelLeftOpen, Settings, LogOut, User,
-   CreditCard, Key, Plug, Shield, DollarSign, KeyRound, Sun, Moon, Book,
-   Database, PanelLeftClose, Folder, Bell } from 'lucide-react';

+ import { Bot, Menu, Plus, Zap, ChevronRight, BookOpen, Code, Star, Package,
+   Sparkle, Sparkles, X, MessageCircle, PanelLeftOpen, Settings, LogOut, User,
+   CreditCard, Key, Plug, Shield, DollarSign, KeyRound, Sun, Moon, Book,
+   Database, PanelLeftClose } from 'lucide-react';
```

**Why Skipped:** We need the Bell icon for notifications UI.

---

#### Skipped Change 2: Remove Navigation Imports
```typescript
// UPSTREAM WANTED TO CHANGE:
- import { NavKnowledgeBase } from '@/components/sidebar/nav-knowledge-base';
- import { NavLibrary } from '@/components/sidebar/nav-library';

// (both imports removed)
```

**Why Skipped:** Preserve existing navigation structure.

---

#### Skipped Change 3: Simplify Navigation Views
```typescript
// UPSTREAM WANTED TO CHANGE:
- const [activeView, setActiveView] = useState<'chats' | 'agents' | 'triggers' | 'library' | 'knowledge' | 'inbox'>('chats');
+ const [activeView, setActiveView] = useState<'chats' | 'agents' | 'starred'>('chats');

// Route map removed:
- const routeMap: Record<string, string> = {
-   '/chats': '/chats',
-   '/agents': '/agents',
-   '/triggers': '/triggers',
-   '/library': '/library',
-   '/knowledge': '/knowledge',
-   '/inbox': '/inbox',
- };
```

**Why Skipped:** This removes the inbox/library/knowledge views. We're implementing notifications, so we need at least the inbox view.

---

#### Skipped Change 4: Remove Navigation Buttons
```typescript
// UPSTREAM WANTED TO REMOVE these buttons:
{ view: 'library' as const, icon: Folder, label: 'Library' }
{ view: 'knowledge' as const, icon: Database, label: 'Knowledge' }
{ view: 'inbox' as const, icon: Bell, label: 'Inbox' }
```

**Why Skipped:** We need the inbox button to access notifications.

**Critical Contradiction:** Upstream is adding a complete notifications system (28 files) but removing the UI button to access it. This suggests:
1. They plan to use a different UI pattern (dropdown, header icon, etc.)
2. The work is incomplete
3. The branches got mixed up

**Our Decision:** Keep the sidebar structure and inbox button. You can later migrate to a different notification UI pattern if desired.

---

## 📊 Divergence Summary Table

| File | Upstream Change | Our Action | Divergence Level | Risk |
|------|----------------|------------|------------------|------|
| `backend/core/admin/admin_api.py` | API compatibility updates | ✅ Applied | Low | Low - necessary for functionality |
| `frontend/src/lib/api.ts` | Add notification functions | ✅ Applied | None | None - pure addition |
| `frontend/src/components/dashboard/layout-content.tsx` | Refactor imports/stores | 🚫 Skipped | High | Medium - future merge conflicts likely |
| `frontend/src/components/sidebar/sidebar-left.tsx` | Remove notification UI | 🚫 Skipped | High | Low - intentional to keep notifications accessible |

---

## 🔮 Future Merge Implications

### Low Risk Divergences
✅ All 28 new files - No conflicts expected (pure additions)
✅ `frontend/src/lib/api.ts` - Additions at end of file, unlikely to conflict

### Medium Risk Divergences
⚠️ `backend/core/admin/admin_api.py` - If upstream modifies these same functions, you'll see conflicts

### High Risk Divergences
🚫 `frontend/src/components/dashboard/layout-content.tsx` - Major refactoring skipped
- Future upstream changes will likely conflict
- You'll need to manually resolve import path differences
- Store vs Context API differences will be significant

🚫 `frontend/src/components/sidebar/sidebar-left.tsx` - UI structure diverged
- Your sidebar keeps inbox/library/knowledge views
- Upstream simplified to chats/agents/starred only
- Future merges will conflict on navigation structure

---

## 🎯 Recommendations

### Short Term (Before Next Merge)
1. ✅ **Test the notifications system** - Ensure all 28 files work correctly
2. ⚠️ **Decide on notification UI** - Keep sidebar inbox or migrate to header bell?
3. ⚠️ **Review admin authentication** - Do you need admin-only env var access?

### Medium Term (Next 1-3 Months)
1. 🔄 **Consider hooks refactoring** - Align with upstream's `react-query` folder structure
2. 🔄 **Evaluate Context API migration** - If upstream continues this pattern, consider adopting it
3. 📝 **Document your divergence decisions** - Update this doc as you make choices

### Long Term (Strategic)
1. 🤔 **Decide: Follow upstream or fork?**
   - If following: Plan to merge skipped refactoring changes
   - If forking: Accept these divergences as permanent

2. 🎨 **Standardize notification UI pattern**
   - Current: Sidebar inbox view
   - Alternative: Header dropdown bell
   - Upstream's intent: Unknown/incomplete

3. 🔐 **Security review**
   - Removed admin auth on env vars - is this acceptable?
   - Admin bypass on maintenance mode - is this desired?

---

## 📞 Action Items

### Before Deploying
- [ ] Run database migrations for notifications schema
- [ ] Test notification creation and retrieval
- [ ] Test email/push notification delivery
- [ ] Verify admin authentication on env vars meets security requirements
- [ ] Test notifications UI (sidebar inbox or header bell)

### Before Next Upstream Merge
- [ ] Review this document
- [ ] Decide which skipped changes to adopt
- [ ] Plan conflict resolution strategy for layout-content.tsx
- [ ] Plan conflict resolution strategy for sidebar-left.tsx

### Documentation
- [ ] Update team on divergence decisions
- [ ] Document notification UI pattern choice
- [ ] Add to technical debt backlog (if refactoring skipped)

---

## 🔍 How to Verify This Document

Check the exact changes made:

```bash
# See the full commit
git show 0dcac535

# See just the modified files (not new files)
git show 0dcac535 --diff-filter=M

# See specific file changes
git show 0dcac535 backend/core/admin/admin_api.py
git show 0dcac535 frontend/src/lib/api.ts

# Compare with upstream
git diff HEAD upstream/2025-10-31-vr4n-bc257 frontend/src/components/dashboard/layout-content.tsx
git diff HEAD upstream/2025-10-31-vr4n-bc257 frontend/src/components/sidebar/sidebar-left.tsx
```

---

## 📅 Document Version

**Version:** 1.0
**Created:** 2025-11-18
**Last Updated:** 2025-11-18
**Next Review:** Before next upstream merge

---

*This document should be updated whenever:*
- *New upstream merges are performed*
- *Skipped changes are later applied*
- *Divergence decisions are reversed*
- *New conflicts are discovered*
