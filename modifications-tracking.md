# Notifications System - Modifications Tracking

## Overview
This document tracks all manual modifications needed to integrate the notifications system from upstream branch `2025-10-31-vr4n-bc257` into `feature/notifications-system`.

## Status Legend
- ⏳ Pending
- 🔄 In Progress
- ✅ Completed
- ⚠️ Requires Decision

---

## Backend Modifications

### 1. backend/core/admin/admin_api.py ⏳

**Changes Required:**

#### Change 1: Update RPC function call (Line ~70-75)
```python
# FROM:
oauth_result = await client.rpc('get_user_account_by_email', {'email_input': email}).execute()
account_id = oauth_result.data['id']

# TO:
oauth_result = await client.rpc('get_account_by_email', {'search_email': email}).execute()
account_id = oauth_result.data
```

#### Change 2: Remove admin authentication from environment endpoints
```python
# FROM:
async def get_env_vars(admin: dict = Depends(require_admin)) -> Dict[str, str]:
    """Get environment variables (local mode only, admin only)."""

# TO:
def get_env_vars() -> Dict[str, str]:
    """Get environment variables (local mode only)."""

# FROM:
async def save_env_vars(request: Dict[str, str], admin: dict = Depends(require_admin)) -> Dict[str, str]:
    """Save environment variables (local mode only, admin only)."""

# TO:
def save_env_vars(request: Dict[str, str]) -> Dict[str, str]:
    """Save environment variables (local mode only)."""
```

**Reason:** API compatibility updates and simplified auth for environment variable management

---

## Frontend Modifications

### 2. frontend/src/lib/api.ts ⏳

**Changes Required:**

#### Add Notification Interfaces (After existing interfaces)
```typescript
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

#### Add Notification API Functions (Before export statements)
```typescript
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

**Reason:** Add notification API functionality

---

### 3. frontend/src/components/dashboard/layout-content.tsx ⚠️

**Note:** This file has significant refactoring changes. These changes are NOT directly related to notifications but involve:
- Import path updates (hooks refactoring)
- Context API migration (from stores to Context providers)
- Removal of admin bypass for maintenance mode

**Decision Required:** Should we apply these refactoring changes or skip them to minimize conflicts?

**Recommendation:** SKIP these changes for now unless they're required for notifications to work. Focus on notification-specific integration.

---

### 4. frontend/src/components/sidebar/sidebar-left.tsx ⚠️

**Important Discovery:** The upstream branch is REMOVING the Bell/Inbox icon and notification UI from the sidebar, not adding it!

**Changes in Upstream:**
- Removes Bell icon from imports
- Removes 'inbox' view from sidebar navigation
- Removes NavKnowledgeBase and NavLibrary imports
- Simplifies navigation to just: chats, agents, and starred (triggers)

**Decision Required:** This contradicts the goal of implementing notifications system!

**Options:**
1. **Skip these changes** - Keep the notification UI since we're implementing notifications
2. **Apply these changes** - Follow upstream and use a different notification UI pattern (perhaps a dropdown or modal instead of sidebar view)
3. **Investigate further** - Check if notifications are displayed differently in the upstream

**Recommendation:** SKIP the sidebar removal changes. Keep the notification bell if the new notification components expect it, or adapt the new notification components to work without sidebar integration.

---

## Summary

### Files Requiring Changes:
1. ✅ backend/core/admin/admin_api.py - Minor API compatibility updates
2. ✅ frontend/src/lib/api.ts - Add notification API functions
3. ⚠️ frontend/src/components/dashboard/layout-content.tsx - Refactoring (recommend skipping)
4. ⚠️ frontend/src/components/sidebar/sidebar-left.tsx - Removes notifications UI (recommend skipping)

### New Files Already Copied: 28 files
- Backend: 5 files
- Documentation: 4 files
- Frontend: 19 files

### Implementation Strategy:
1. Apply backend changes (admin_api.py)
2. Apply frontend API changes (api.ts)
3. Skip conflicting refactoring changes
4. Test the notification system with existing files
5. Make minimal adjustments as needed

---

## Next Steps:
1. ✅ Review this document
2. ⏳ Apply backend/core/admin/admin_api.py changes
3. ⏳ Apply frontend/src/lib/api.ts changes
4. ⏳ Test integration
5. ⏳ Commit changes
