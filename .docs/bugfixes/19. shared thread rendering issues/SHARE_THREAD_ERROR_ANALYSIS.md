# Shared Thread Feature Error Analysis & Fixes

## Error Summary

The shared thread feature is failing with:
```
SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

This indicates the API is returning HTML (likely a 404 or error page) instead of JSON.

## Issues Found & Fixed

### Issue #1: Backend Endpoint Requires Authentication (CRITICAL) ✅ FIXED

**File:** `backend/core/threads.py` (line 326)

**Problem:**
The `/threads/{thread_id}/messages` endpoint required JWT authentication:
```python
@router.get("/threads/{thread_id}/messages", operation_id="get_thread_messages")
async def get_thread_messages(
    thread_id: str,
    user_id: str = Depends(verify_and_get_user_id_from_jwt),  # ❌ Required auth
    order: str = Query("desc", description="...")
):
    await verify_and_authorize_thread_access(client, thread_id, user_id)
```

When an unauthenticated user (viewing a shared thread) calls this endpoint, it fails and returns HTML instead of JSON.

**Fix Applied:**
Changed to use `require_thread_access` dependency, which handles both authenticated and public thread access:
```python
@router.get("/threads/{thread_id}/messages", operation_id="get_thread_messages")
async def get_thread_messages(
    thread_id: str,
    auth: AuthorizedThreadAccess = Depends(require_thread_access),  # ✅ Supports public
    order: str = Query("desc", description="Order by created_at: 'asc' or 'desc'")
):
    """Get all messages for a thread, fetching in batches of 1000 from the DB to avoid large queries.
    Supports both authenticated and anonymous access (for public threads)."""
    logger.debug(f"Fetching all messages for thread: {thread_id}, order={order}")
    client = await utils.db.client
    # Access already verified by require_thread_access dependency
```

### Issue #2: Outdated Frontend Imports (HIGH PRIORITY) ✅ FIXED

**File:** `frontend/src/app/share/[threadId]/_hooks/useShareThreadData.ts` (line 3-9)

**Problem:**
Your fork was importing from the **old monolithic API structure**, while upstream uses **modular API**:

```typescript
// ❌ YOUR FORK - OLD
import {
  getMessages,
  getProject,
  getThread,
  Project,
  Message as BaseApiMessageType,
} from '@/lib/api';  // Monolithic old API
```

```typescript
// ✅ UPSTREAM - NEW
import {
  getMessages,
  Message as BaseApiMessageType,
} from '@/lib/api/threads';
import { getProject, Project } from '@/lib/api/projects';
import { getThread } from '@/lib/api/threads';  // Modular structure
```

**Why It Matters:**
The old monolithic API might be using different authentication logic or might not have been updated to support public thread access. The newer modular API in upstream has the correct authentication handling.

**Fix Applied:**
Updated imports to use the new modular API structure matching upstream main.

### Issue #3: Inadequate Frontend Error Handling (MEDIUM) ✅ FIXED

**File:** `frontend/src/lib/api/threads.ts` (line 273-281)

**Problem:**
When the API returns HTML instead of JSON, the error message wasn't clear:
```typescript
if (!response.ok) {
  const errorText = await response.text().catch(() => 'Unknown error');
  console.error('Error fetching messages:', errorText);
  handleApiError(new Error(errorText), { operation: 'load messages', ... });
  throw new Error(`Error getting messages: ${errorText}`);
}

const data = await response.json();  // ❌ Throws SyntaxError if HTML received
```

**Fix Applied:**
Added HTML detection and better error handling:
```typescript
if (!response.ok) {
  const errorText = await response.text().catch(() => 'Unknown error');
  
  // Detect if we got HTML instead of JSON (404, 403, or redirect error pages)
  if (errorText.includes('<!DOCTYPE') || errorText.includes('<html') || errorText.startsWith('<')) {
    const statusMessage = response.status === 404 
      ? 'Thread not found. It may have been deleted or you do not have access to it.'
      : response.status === 403
      ? 'You do not have permission to access this thread.'
      : `Server error (${response.status})`;
    console.error('Received HTML error page instead of JSON:', { status: response.status, statusText: response.statusText });
    handleApiError(new Error(statusMessage), { operation: 'load messages', resource: `messages for thread ${threadId}` });
    throw new Error(`Error getting messages: ${statusMessage}`);
  }
  
  console.error('Error fetching messages:', errorText);
  handleApiError(new Error(errorText), { operation: 'load messages', resource: `messages for thread ${threadId}` });
  throw new Error(`Error getting messages: ${errorText}`);
}

let data;
try {
  data = await response.json();
} catch (parseError) {
  const responseText = await response.text().catch(() => 'unknown');
  console.error('Failed to parse response as JSON:', { error: parseError, responsePreview: responseText.substring(0, 100) });
  handleApiError(new Error('Invalid response format from server'), { operation: 'parse messages', resource: `messages for thread ${threadId}` });
  throw new Error(`Error parsing messages response: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`);
}
```

## How the Share Thread Feature Works (Architecture)

### Flow Diagram
```
User visits: /share/[threadId]
    ↓
ShareThreadPage Component
    ↓
useShareThreadData Hook (NEW - share-specific)
    ↓
Promise.all([
  getThread(threadId),           // From @/lib/api/threads
  getMessages(threadId),         // From @/lib/api/threads (FIXED)
  getProject(projectId)          // From @/lib/api/projects
])
    ↓
API Calls (NO AUTH COOKIE - public access)
    ↓
Backend Endpoints:
  • GET /threads/{id}               - Uses require_thread_access ✅
  • GET /threads/{id}/messages      - NOW uses require_thread_access ✅ (WAS broken)
  • GET /projects/{id}              - Uses require_thread_access ✅
    ↓
Response includes:
  • Thread data
  • Messages (now works for public threads!)
  • Project info (sandbox, name, etc.)
    ↓
DisplayThread Content
```

### Key Differences: Share vs Authenticated Pages

| Feature | Share Page | Authenticated Page |
|---------|-----------|------------------|
| **Auth Required** | ❌ No | ✅ Yes |
| **Access Control** | Public threads only | All user's threads |
| **Backend Dependency** | `require_thread_access` | `verify_and_get_user_id_from_jwt` |
| **Can Edit Messages** | ❌ No | ✅ Yes |
| **Can Run Agents** | ❌ No | ✅ Yes |
| **Show Playback Controls** | ✅ Yes (readonly) | ✅ Yes (edit) |

## Testing the Fix

1. **Share a thread:**
   - Open Suna app
   - Start/view a conversation
   - Click "Share" button
   - Make thread public

2. **Test shared link (incognito mode):**
   ```bash
   # Open in new incognito/private window (no auth cookies)
   https://kortix.syhc.dev/share/[threadId]
   ```

3. **Verify:**
   - ✅ Messages load without errors
   - ✅ No HTML error page
   - ✅ No SyntaxError in console
   - ✅ Project name and sandbox visible
   - ✅ Playback controls work

## Files Modified

1. ✅ `backend/core/threads.py` - Fixed endpoint authentication
2. ✅ `frontend/src/app/share/[threadId]/_hooks/useShareThreadData.ts` - Fixed imports
3. ✅ `frontend/src/lib/api/threads.ts` - Improved error handling

## Root Cause

There's a **critical authentication mismatch** between the backend endpoint and the frontend client:

### Backend Endpoint (`threads.py` line 326)
```python
@router.get("/threads/{thread_id}/messages", operation_id="get_thread_messages")
async def get_thread_messages(
    thread_id: str,
    user_id: str = Depends(verify_and_get_user_id_from_jwt),  # ⚠️ REQUIRES JWT AUTH
    order: str = Query("desc", description="...")
):
```

**The endpoint REQUIRES authentication** via `verify_and_get_user_id_from_jwt` dependency.

### Additional Problem: Outdated Frontend Imports

**Your Current Fork's useShareThreadData Hook:**
```typescript
// ❌ WRONG - Importing from old monolithic API
import {
  getMessages,
  getProject,
  getThread,
  Project,
  Message as BaseApiMessageType,
} from '@/lib/api';
```

**Upstream Main's useShareThreadData Hook:**
```typescript
// ✅ CORRECT - Using modular API structure
import {
  getMessages,
  Message as BaseApiMessageType,
} from '@/lib/api/threads';
import { getProject, Project } from '@/lib/api/projects';
import { getThread } from '@/lib/api/threads';
```

Your fork is importing from the **old monolithic `@/lib/api`** instead of the newer **modular structure** (`@/lib/api/threads`, `@/lib/api/projects`). This means your share hook might be using outdated versions of these functions with incorrect authentication handling.

### Frontend Client (`frontend/src/lib/api/threads.ts` line 261)
```typescript
// Build headers with optional auth token
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
};

if (session?.access_token) {
  headers['Authorization'] = `Bearer ${session.access_token}`;
}

// Use backend API endpoint
const response = await fetch(`${API_URL}/threads/{threadId}/messages?order=asc`, {
  headers,
  cache: 'no-store',
});
```

**The frontend sends auth ONLY IF the user is logged in**.

## The Problem: Unauthenticated Shared Thread Access

When accessing a **shared thread via the `/share/[threadId]` page**:
1. The user is NOT authenticated (they're viewing a public link)
2. No `Authorization` header is sent
3. Backend endpoint requires JWT authentication
4. Request is rejected/redirected
5. Browser receives HTML error page (404, 403, or redirect HTML)
6. Frontend tries to `JSON.parse()` the HTML
7. **SyntaxError: Unexpected token '<'** ❌

## Additional Issues Found

### Issue 1: Thread Access Control Inconsistency

The `/threads/{thread_id}/messages` endpoint **requires authentication**, but there's another endpoint that should handle **public thread access**:

**Current Backend:**
- ✅ `get_thread()` - Uses `require_thread_access` (handles both auth + public)
- ❌ `get_thread_messages()` - Uses `verify_and_get_user_id_from_jwt` (requires auth ONLY)

Looking at `get_thread()` in line 130 of threads.py:
```python
@router.get("/threads/{thread_id}", operation_id="get_thread")
async def get_thread(
    thread_id: str,
    auth: AuthorizedThreadAccess = Depends(require_thread_access)  # ✅ CORRECT
):
```

This uses `require_thread_access` which properly handles:
- Authenticated user verification
- Public thread access for anonymous users

### Issue 2: useShareThreadData Hook Imports Wrong Function

In `frontend/src/app/share/[threadId]/_hooks/useShareThreadData.ts`:
```typescript
import {
  getMessages,
  Message as BaseApiMessageType,
} from '@/lib/api/threads';
import { getProject, Project } from '@/lib/api/projects';
import { getThread } from '@/lib/api/threads';
```

But it calls from `@/lib/api` (the OLD monolithic api.ts), not the organized API structure.

Looking at the hook (line 68):
```typescript
const [threadData, messagesData] = await Promise.all([
  getThread(threadId).catch((err) => {...}),
  getMessages(threadId).catch((err) => {...}),  // Uses getMessages from @/lib/api
]);
```

## Solution

### Fix 1: Update Backend Endpoint to Support Public Threads

**File:** `backend/core/threads.py` (line 326)

Change from:
```python
@router.get("/threads/{thread_id}/messages", operation_id="get_thread_messages")
async def get_thread_messages(
    thread_id: str,
    user_id: str = Depends(verify_and_get_user_id_from_jwt),  # ❌ Requires auth
    order: str = Query("desc", description="...")
):
    logger.debug(f"Fetching all messages for thread: {thread_id}, order={order}")
    client = await utils.db.client
    await verify_and_authorize_thread_access(client, thread_id, user_id)
```

To:
```python
@router.get("/threads/{thread_id}/messages", operation_id="get_thread_messages")
async def get_thread_messages(
    thread_id: str,
    auth: AuthorizedThreadAccess = Depends(require_thread_access),  # ✅ Supports public
    order: str = Query("desc", description="...")
):
    logger.debug(f"Fetching all messages for thread: {thread_id}, order={order}")
    client = await utils.db.client
    # Already verified access via require_thread_access
```

**Why:** The `require_thread_access` dependency (used in `get_thread()`) properly handles:
- Authenticated access for owners
- Anonymous access for public threads
- Returns thread access info including user_id/is_public status

### Fix 2: Verify Thread Access Endpoint

The `get_thread()` endpoint already works for shared threads. Check what it uses:

```python
@router.get("/threads/{thread_id}", operation_id="get_thread")
async def get_thread(
    thread_id: str,
    auth: AuthorizedThreadAccess = Depends(require_thread_access)
):
```

This is the **correct pattern** to apply to messages endpoint.

### Fix 3: Frontend Error Handling

In `frontend/src/lib/api/threads.ts`, add better error detection:

```typescript
export const getMessages = async (threadId: string): Promise<Message[]> => {
  try {
    // ...existing code...
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      
      // ✅ IMPROVED: Detect HTML errors
      if (errorText.includes('<!DOCTYPE') || errorText.includes('<html')) {
        console.error('Received HTML instead of JSON - likely 404/403 error');
        throw new Error(
          `API Error: ${response.status} ${response.statusText}. ` +
          `Thread may not exist, be deleted, or you may not have access.`
        );
      }
      
      console.error('Error fetching messages:', errorText);
      throw new Error(`Error getting messages: ${errorText}`);
    }
```

## Testing the Fix

1. **Share a thread** (make it public)
2. **Copy share URL**: `https://kortix.syhc.dev/share/[threadId]`
3. **Open in incognito/private mode** (no auth cookies)
4. **Verify messages load** without errors

## Additional Recommendations

1. **Add endpoint-specific tests** for shared thread access
2. **Log access attempts** - Add logging to see which endpoints are called
3. **Consider rate limiting** on public thread endpoints
4. **Document the access pattern** - Share pages should use different auth flow than authenticated pages
5. **Add monitoring** - Track failed message fetch requests to catch issues early
