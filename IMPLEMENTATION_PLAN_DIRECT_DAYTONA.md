# VNC Direct Daytona Connection - Implementation Plan

## Overview

Create a simple Daytona preview client following the same pattern as `realtime-client.ts` to provide direct WebSocket connections to Daytona, bypassing Next.js rewrites entirely.

---

## Implementation Steps

### Step 1: Create `frontend/src/lib/daytona/preview-client.ts`

**Purpose:** Utility functions to construct direct Daytona URLs (similar to realtime-client pattern)

**File Structure:**
```typescript
/**
 * Daytona Preview Client
 *
 * Provides direct URLs to Daytona preview services (VNC, web apps)
 * Bypasses Next.js HTTP proxy for WebSocket connections
 *
 * Pattern: Similar to realtime-client.ts
 */

export interface DaytonaSandbox {
  id: string;
  pass: string;
  token?: string;
}

/**
 * Get direct Daytona VNC URL (port 6080)
 * Returns: https://6080-{sandbox-id}.proxy.daytona.works/
 */
export function getDaytonaVncUrl(sandbox: DaytonaSandbox): string {
  return `https://6080-${sandbox.id}.proxy.daytona.works/`;
}

/**
 * Get direct Daytona web preview URL (port 8080)
 * Returns: https://8080-{sandbox-id}.proxy.daytona.works/
 */
export function getDaytonaWebUrl(sandbox: DaytonaSandbox): string {
  return `https://8080-${sandbox.id}.proxy.daytona.works/`;
}

/**
 * Get direct Daytona URL for any port
 */
export function getDaytonaPortUrl(sandbox: DaytonaSandbox, port: number): string {
  return `https://${port}-${sandbox.id}.proxy.daytona.works/`;
}

/**
 * Construct complete VNC URL with noVNC parameters
 * This is the full URL to load in the iframe
 */
export function getVncLiteUrl(sandbox: DaytonaSandbox): string {
  const baseUrl = getDaytonaVncUrl(sandbox);

  const params = new URLSearchParams({
    password: sandbox.pass,
    autoconnect: 'true',
    scale: 'local',
    path: 'websockify',  // Relative path for noVNC WebSocket
  });

  // Add token if available (Daytona authentication)
  if (sandbox.token) {
    params.set('token', sandbox.token);
  }

  return `${baseUrl}vnc_lite.html?${params.toString()}`;
}

/**
 * Get WebSocket URL that noVNC will connect to
 * (For logging/debugging purposes)
 */
export function getVncWebSocketUrl(sandbox: DaytonaSandbox): string {
  return `wss://6080-${sandbox.id}.proxy.daytona.works/websockify`;
}
```

**Key Features:**
- ✅ Direct Daytona URLs (no backend proxy)
- ✅ Bypasses Next.js rewrites
- ✅ Simple utility functions (no complex state management)
- ✅ Type-safe with TypeScript
- ✅ Easy to test and debug

---

### Step 2: Update `frontend/src/components/thread/HealthCheckedVncIframe.tsx`

**Current Code (lines 131-144):**
```typescript
const vncPreviewUrl = new URL(sandbox.vnc_preview, window.location.origin);
const websocketPath = (vncPreviewUrl.pathname.replace(/\/$/, '') + '/websockify').substring(1);
const baseUrl = sandbox.vnc_preview.replace(/\/$/, '');

let vncUrl = `${baseUrl}/vnc_lite.html?password=${sandbox.pass}&autoconnect=true&scale=local&path=${encodeURIComponent(websocketPath)}`;
```

**New Code:**
```typescript
import { getVncLiteUrl, getVncWebSocketUrl } from '@/lib/daytona/preview-client';

// Use direct Daytona connection (bypasses Next.js rewrites)
const vncUrl = getVncLiteUrl(sandbox);

// Log for debugging
console.log('[VNC Component] Using direct Daytona connection');
console.log('[VNC Component] VNC URL:', vncUrl);
console.log('[VNC Component] WebSocket will connect to:', getVncWebSocketUrl(sandbox));
```

**Benefits:**
- ✅ 3 lines instead of 10+
- ✅ Clean separation of concerns
- ✅ Easy to understand and maintain
- ✅ All URL logic in one place

---

### Step 3: Update `frontend/src/hooks/files/useVncPreloader.ts`

**Current Code (lines 163-167):**
```typescript
const baseUrl = sandbox.vnc_preview.replace(/\/$/, '');
const vncUrl = `${baseUrl}/vnc_lite.html?password=${sandbox.pass}&autoconnect=true&scale=local`;
console.log('[VNC Preloader] Constructed preload URL:', vncUrl);
```

**New Code:**
```typescript
import { getVncLiteUrl } from '@/lib/daytona/preview-client';

const vncUrl = getVncLiteUrl(sandbox);
console.log('[VNC Preloader] Constructed preload URL:', vncUrl);
console.log('[VNC Preloader] Using direct Daytona connection');
```

**Also update retry function (lines 133-135):**
```typescript
const retry = useCallback(() => {
  if (sandbox?.id && sandbox?.pass) {
    const vncUrl = getVncLiteUrl(sandbox);
    setRetryCount(0);
    setStatus('idle');
    startPreloading(vncUrl);
  }
}, [sandbox?.id, sandbox?.pass, sandbox?.token, startPreloading]);
```

---

### Step 4: Update TypeScript Types (Optional)

**File:** Check if `Sandbox` type needs updating

**Current type probably has:**
```typescript
interface Sandbox {
  id: string;
  pass: string;
  vnc_preview: string;  // Proxy URL (legacy)
  sandbox_url: string;
  token?: string;
}
```

**No changes needed!** Backend already provides all required fields:
- `id` ✅
- `pass` ✅
- `token` ✅

The `preview-client.ts` constructs Daytona URLs from these fields.

---

### Step 5: Testing Plan

#### 5.1 Local Testing

```powershell
# Rebuild frontend
cd /home/user/suna
docker compose up -d --build frontend

# Or dev server
cd frontend
npm run dev
```

#### 5.2 Verify Console Logs

**Expected in browser console:**
```
[VNC Component] Using direct Daytona connection
[VNC Component] VNC URL: https://6080-{sandbox-id}.proxy.daytona.works/vnc_lite.html?password=...&autoconnect=true&scale=local&path=websockify&token=...
[VNC Component] WebSocket will connect to: wss://6080-{sandbox-id}.proxy.daytona.works/websockify
[VNC Preloader] Constructed preload URL: https://6080-{sandbox-id}.proxy.daytona.works/vnc_lite.html?...
[VNC Preloader] Using direct Daytona connection
```

#### 5.3 Verify Network Tab

**Open DevTools → Network → WS filter:**

**Expected:**
```
Name: websockify
URL: wss://6080-{sandbox-id}.proxy.daytona.works/websockify
Status: 101 Switching Protocols ✅
Type: websocket
```

**Important:** URL should point to `proxy.daytona.works`, NOT `kortix.syhc.dev`

#### 5.4 Verify VNC Display

- ✅ VNC connects immediately (no gray screen)
- ✅ Live browser view streams continuously
- ✅ No freezing or disconnections
- ✅ Mouse/keyboard input works

#### 5.5 Backend Logs Check

```powershell
docker compose logs backend --tail=50 -f
```

**Expected:** **NO WebSocket logs** (that's good! Connection is direct to Daytona, bypassing backend)

You should ONLY see:
```
[VNC Preview URL] Generating VNC preview URL for sandbox=...
[Sandbox Setup] ✅ Successfully configured sandbox
```

But NOT:
```
[VNC WebSocket] New connection request  ← Should NOT appear
```

---

## File Changes Summary

### New Files:
1. **`frontend/src/lib/daytona/preview-client.ts`** - Direct Daytona URL utilities

### Modified Files:
1. **`frontend/src/components/thread/HealthCheckedVncIframe.tsx`** - Use direct URLs
2. **`frontend/src/hooks/files/useVncPreloader.ts`** - Use direct URLs

### No Changes Needed:
- ❌ `backend/*` - No backend changes
- ❌ `docker-compose.yaml` - No infrastructure changes
- ❌ `frontend/next.config.ts` - No rewrite changes
- ❌ Cloudflare Tunnel - No configuration changes

---

## Rollback Plan

If direct connection doesn't work:

```powershell
# Revert all changes
git checkout frontend/src/lib/daytona/preview-client.ts
git checkout frontend/src/components/thread/HealthCheckedVncIframe.tsx
git checkout frontend/src/hooks/files/useVncPreloader.ts

# Rebuild
docker compose up -d --build frontend
```

---

## Success Criteria

✅ VNC connects without gray screen
✅ WebSocket connects to `proxy.daytona.works` directly
✅ No Next.js rewrite errors
✅ Continuous streaming without freezing
✅ Works in both localhost and Cloudflare Tunnel
✅ No backend WebSocket logs (direct connection confirmed)

---

## Why This Works

### Problem (Before):
```
Browser → wss://kortix.syhc.dev/api/.../websockify
    ↓
Next.js rewrites /api/* → backend
    ↓
❌ WebSocket upgrade fails (rewrites don't support protocol switching)
```

### Solution (After):
```
Browser → wss://6080-{sandbox-id}.proxy.daytona.works/websockify
    ↓
Daytona directly (no Next.js, no backend, no rewrites)
    ↓
✅ WebSocket works (direct connection)
```

**Key Insight:** Same pattern as Supabase Realtime - bypass Next.js for WebSocket connections.

---

## Next Steps

1. Create `frontend/src/lib/daytona/preview-client.ts`
2. Update `HealthCheckedVncIframe.tsx`
3. Update `useVncPreloader.ts`
4. Rebuild frontend
5. Test VNC streaming
6. Commit all changes

Ready to implement?
