# Realtime Client Fix - API Migration Production Issue

**Date**: November 16, 2025  
**Status**: ✅ FIXED  
**Branch**: `001-stable-rendering-phase1-track-production`  
**Commit**: `12a546f2`

---

## Problem Summary

After merging the production API restructuring, WebSocket realtime connections were failing with the error:

```
wss://kortix.syhc.dev/realtime/v1/websocket failed
```

**Expected URL**:
```
wss://kong.kortix.syhc.dev/realtime/v1/websocket
```

The `kong.` subdomain was missing, causing the WebSocket connection to fail.

---

## Root Cause

During the API migration/restructuring, two realtime hooks were incorrectly updated to use the **wrong Supabase client**:

### Files Affected:
1. `frontend/src/hooks/threads/useProjectRealtime.ts`
2. `frontend/src/hooks/integrations/useVapiCallRealtime.ts`

### The Issue:

These hooks were using `createClient()` instead of `createRealtimeClient()`:

```typescript
// ❌ WRONG - Uses window.location.origin
import { createClient } from '@/lib/supabase/client';
const supabase = createClient();
```

### Why This Caused the Error:

**`createClient()`**:
- Uses `window.location.origin` as the base URL
- In browser: `https://kortix.syhc.dev`
- WebSocket becomes: `wss://kortix.syhc.dev/realtime/v1/websocket` ❌

**`createRealtimeClient()`**:
- Uses `NEXT_PUBLIC_REALTIME_URL` environment variable
- Configured as: `https://kong.kortix.syhc.dev/`
- WebSocket becomes: `wss://kong.kortix.syhc.dev/realtime/v1/websocket` ✅

---

## The Fix

Changed both files to use the dedicated realtime client:

```typescript
// ✅ CORRECT - Uses NEXT_PUBLIC_REALTIME_URL
import { createRealtimeClient } from '@/lib/supabase/client';
const supabase = createRealtimeClient();
```

### Files Modified:

1. **`frontend/src/hooks/threads/useProjectRealtime.ts`**
   - Line 5: Changed import from `createClient` to `createRealtimeClient`
   - Line 20: Changed instantiation from `createClient()` to `createRealtimeClient()`

2. **`frontend/src/hooks/integrations/useVapiCallRealtime.ts`**
   - Line 5: Changed import from `createClient` to `createRealtimeClient`
   - Line 26: Changed instantiation from `createClient()` to `createRealtimeClient()`

---

## Verification

### Hooks Already Using Correct Client (No Changes Needed):

✅ `frontend/src/hooks/useProjectRealtime.ts` - Already using `createRealtimeClient()`  
✅ `frontend/src/hooks/useVapiCallRealtime.ts` - Already using `createRealtimeClient()`

### Environment Configuration (Already Correct):

**`docker-compose.yaml`** (lines 103, 111):
```yaml
NEXT_PUBLIC_REALTIME_URL=https://kong.kortix.syhc.dev/
```

**`frontend/src/lib/supabase/client.ts`** (lines 69-72):
```typescript
const realtimeUrl = 
  process.env.NEXT_PUBLIC_REALTIME_URL ||      // ✅ https://kong.kortix.syhc.dev/
  process.env.NEXT_PUBLIC_SUPABASE_URL ||      // Fallback
  'http://localhost:8888'                       // Default
```

---

## Testing

### Before Fix:
```
Browser Console Error:
WebSocket connection to 'wss://kortix.syhc.dev/realtime/v1/websocket' failed
```

### After Fix:
```
Browser Console (Success):
[createRealtimeClient] Configuration: {
  NEXT_PUBLIC_REALTIME_URL: "https://kong.kortix.syhc.dev/",
  realtimeUrl: "https://kong.kortix.syhc.dev/",
  note: "WebSocket will attempt to upgrade at: https://kong.kortix.syhc.dev/realtime/v1/websocket"
}

Network Tab:
wss://kong.kortix.syhc.dev/realtime/v1/websocket
Status: 101 Switching Protocols ✅
```

---

## Deployment Steps

```bash
# Rebuild frontend with fix
docker compose build --no-cache frontend
docker compose up -d frontend

# Verify environment variable in container
docker compose exec frontend env | grep NEXT_PUBLIC_REALTIME_URL
# Output: NEXT_PUBLIC_REALTIME_URL=https://kong.kortix.syhc.dev/

# Check browser console for successful WebSocket connection
# Network tab should show: wss://kong.kortix.syhc.dev/realtime/v1/websocket
```

---

## Related Documentation

- **Bugfix #9**: Supabase Realtime Fix (`.docs/bugfixes/9. supabase-realtime fix/`)
  - Original realtime setup and Cloudflare configuration
  - WebSocket WSS troubleshooting guide
  
- **Bugfix #10**: HTTPS Cloudflare and WebSocket (`.docs/bugfixes/10. https cloudflare and websocket/`)
  - Complete guide for WebSocket over HTTPS
  - Environment variable setup and Docker configuration

---

## Key Learnings

### 1. **Separate Clients for Different Purposes**

The codebase maintains two distinct Supabase clients:

- **`createClient()`**: For auth and regular database operations
  - Uses `window.location.origin` (same-origin for auth cookies)
  - Used in: Auth flows, database queries, mutations
  
- **`createRealtimeClient()`**: For WebSocket realtime subscriptions
  - Uses `NEXT_PUBLIC_REALTIME_URL` (direct Kong connection)
  - Used in: All realtime subscription hooks

### 2. **Why We Need the Kong Subdomain**

The `kong.kortix.syhc.dev` subdomain is critical because:

1. **Cloudflare Tunnel Routing**: 
   - `kortix.syhc.dev` → Frontend (Next.js)
   - `kong.kortix.syhc.dev` → Kong Gateway (Supabase services)

2. **WebSocket Upgrade Requirements**:
   - Kong handles WebSocket protocol upgrades
   - Direct connection to Kong required for realtime
   - Cannot proxy through Next.js frontend

3. **SSL/TLS Configuration**:
   - Cloudflare Total TLS enabled for multi-level subdomains
   - Kong configured with mkcert certificates
   - Cloudflared tunnel with "No TLS Verify" enabled

### 3. **API Migration Checklist**

When restructuring API code, always verify:

- [ ] Realtime hooks use `createRealtimeClient()`, not `createClient()`
- [ ] Auth operations use `createClient()`, not `createRealtimeClient()`
- [ ] Environment variables are correctly passed to Docker containers
- [ ] Frontend rebuild includes `--no-cache` flag to bake in env vars
- [ ] Browser console shows correct WebSocket URL in debug logs

---

## Prevention

To prevent this issue in future API migrations:

### 1. **Code Review Checklist**

When reviewing realtime-related code changes:
- ✅ Verify `createRealtimeClient()` is used in all subscription hooks
- ✅ Check imports match the client being instantiated
- ✅ Confirm no accidental replacements during refactoring

### 2. **Automated Testing**

Consider adding integration tests:
```typescript
describe('Realtime Hooks', () => {
  it('should use createRealtimeClient for subscriptions', () => {
    // Verify hooks import and use correct client
  });
  
  it('should connect to kong subdomain', () => {
    // Verify WebSocket URL includes kong.kortix.syhc.dev
  });
});
```

### 3. **Documentation**

Maintain clear separation in docs:
- `createClient()` → Auth & Database
- `createRealtimeClient()` → WebSocket Subscriptions

---

## Success Criteria

- [x] WebSocket connects to `wss://kong.kortix.syhc.dev/realtime/v1/websocket`
- [x] No console errors about failed WebSocket connections
- [x] Realtime updates work for:
  - [x] Project sandbox changes (`useProjectRealtime`)
  - [x] Vapi call monitoring (`useVapiCallRealtime`)
- [x] Browser Network tab shows `101 Switching Protocols` for WebSocket
- [x] All four realtime hooks use `createRealtimeClient()`

---

## Files Changed

```
frontend/src/hooks/threads/useProjectRealtime.ts
frontend/src/hooks/integrations/useVapiCallRealtime.ts
```

**Git Commit**: `12a546f2` - "fixed realtime for new api"

---

## Conclusion

The issue was a simple but critical mistake during the API restructuring - two realtime hooks were using the wrong Supabase client. By ensuring all realtime subscription hooks use `createRealtimeClient()` instead of `createClient()`, the WebSocket connections now correctly route through the Kong subdomain and establish successful realtime connections.

**Time to Fix**: ~20 minutes  
**Impact**: Critical - Realtime features completely non-functional  
**Difficulty**: Easy - Simple import/instantiation change  
**Lesson**: Always verify client usage when refactoring API code
