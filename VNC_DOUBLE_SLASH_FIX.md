# VNC Double Slash Fix - Root Cause Resolution

## Issue Identified

**Console Error:**
```
WebSocket connection to 'wss://kortix.syhc.dev//api/sandboxes/69af50df-a9e2-4d1c-831f-cde437e898a4/proxy/6080/websockify' failed
                                           ^^
                                    DOUBLE SLASH!
```

**Root Cause:** noVNC was unable to establish WebSocket connection due to TWO separate double-slash issues:

### Issue #1: Double Slash in WebSocket Path ❌

**Problem:**
- noVNC `path` parameter was: `/api/sandboxes/.../websockify` (starts with `/`)
- noVNC automatically prepends `/` when constructing WebSocket URL
- Result: `wss://kortix.syhc.dev//api/...` (double slash)

**Fix:**
```typescript
// BEFORE (WRONG):
const websocketPath = vncPreviewUrl.pathname.replace(/\/$/, '') + '/websockify';
// Result: "/api/sandboxes/.../websockify" (starts with /)

// AFTER (FIXED):
const websocketPath = (vncPreviewUrl.pathname.replace(/\/$/, '') + '/websockify').substring(1);
// Result: "api/sandboxes/.../websockify" (no leading /)
```

**Why:** noVNC's `path` parameter is relative and should NOT start with `/` because noVNC adds it automatically when constructing the WebSocket URL.

### Issue #2: Double Slash in HTML URL ❌

**Problem:**
- Backend generates `vnc_preview` with trailing slash: `https://kortix.syhc.dev/api/sandboxes/.../proxy/6080/`
- Frontend appends `/vnc_lite.html`
- Result: `.../6080//vnc_lite.html` (double slash)

**Fix:**
```typescript
// BEFORE (WRONG):
let vncUrl = `${sandbox.vnc_preview}/vnc_lite.html?...`;
// Result: .../6080//vnc_lite.html

// AFTER (FIXED):
const baseUrl = sandbox.vnc_preview.replace(/\/$/, '');
let vncUrl = `${baseUrl}/vnc_lite.html?...`;
// Result: .../6080/vnc_lite.html
```

## Files Modified

### 1. `frontend/src/components/thread/HealthCheckedVncIframe.tsx`

**Changes:**
- Remove leading `/` from WebSocket path parameter (line 133)
- Strip trailing `/` from vnc_preview before appending `/vnc_lite.html` (lines 142-144)

**Impact:**
- WebSocket will now connect to: `wss://kortix.syhc.dev/api/sandboxes/.../websockify` ✅
- HTML will load from: `.../6080/vnc_lite.html` (single slash) ✅

### 2. `frontend/src/hooks/files/useVncPreloader.ts`

**Changes:**
- Strip trailing `/` from vnc_preview in preloader (lines 163-164)
- Strip trailing `/` from vnc_preview in retry function (lines 133-135)

**Impact:**
- Preload requests will use correct URL without double slash ✅

## Expected Behavior After Fix

### Frontend Console Logs:
```javascript
[VNC Preloader] Constructed preload URL:
https://kortix.syhc.dev/api/sandboxes/69af50df-a9e2-4d1c-831f-cde437e898a4/proxy/6080/vnc_lite.html
// ✅ Single slash between 6080 and vnc_lite.html

[VNC Debug] websocket_path: api/sandboxes/69af50df-a9e2-4d1c-831f-cde437e898a4/proxy/6080/websockify
// ✅ No leading slash

WebSocket connection to 'wss://kortix.syhc.dev/api/sandboxes/69af50df-a9e2-4d1c-831f-cde437e898a4/proxy/6080/websockify' succeeded
// ✅ Single slash after domain
```

### Backend Logs (NOW Expected):
```
[VNC WebSocket] New connection request for sandbox=69af50df-a9e2-4d1c-831f-cde437e898a4 port=6080 path=websockify
[VNC WebSocket] Connection accepted for sandbox=69af50df-a9e2-4d1c-831f-cde437e898a4
[VNC WebSocket] Verifying access for sandbox=69af50df-a9e2-4d1c-831f-cde437e898a4 user=dd9dcdcd-e305-42d5-8831-c6be38058724
[VNC WebSocket] Access granted for sandbox=69af50df-a9e2-4d1c-831f-cde437e898a4
[VNC WebSocket] Connecting to upstream WebSocket: wss://6080-69af50df-a9e2-4d1c-831f-cde437e898a4.proxy.daytona.works/websockify
[VNC WebSocket] ✅ Successfully connected to upstream for sandbox 69af50df-a9e2-4d1c-831f-cde437e898a4
[VNC WebSocket] Starting bidirectional relay for sandbox=69af50df-a9e2-4d1c-831f-cde437e898a4
[VNC WebSocket] Relayed binary to client: 1024 bytes (total: 1 msgs, 1024 bytes)
...
```

## Why Backend Logs Were Empty Before

The WebSocket proxy endpoint at `/api/sandboxes/{sandbox_id}/proxy/{port}/{path:path}` requires the path to match the route pattern.

**Before fix:**
- noVNC tried: `//api/sandboxes/.../websockify` (double slash)
- FastAPI route didn't match due to malformed path
- No backend logs because request never reached the WebSocket endpoint

**After fix:**
- noVNC will try: `/api/sandboxes/.../websockify` (single slash)
- FastAPI route will match correctly
- Backend will log WebSocket connection and relay messages

## Testing the Fix

1. **Clear browser cache** (important - old noVNC client might be cached)
2. **Reload the page** with VNC streaming
3. **Check frontend console** for:
   - ✅ No double slashes in URLs
   - ✅ `websocket_path` without leading `/`
   - ✅ WebSocket connection succeeded (not failed)
4. **Check backend logs** for:
   - ✅ `[VNC WebSocket] New connection request`
   - ✅ `[VNC WebSocket] Successfully connected to upstream`
   - ✅ Message relay statistics

## Additional Note

The backend's URL generation in `preview_urls.py` still returns URLs with trailing slashes (e.g., `.../6080/`). This is intentional for the API endpoint pattern, but frontend must handle it properly by stripping the trailing slash before appending paths.

**Backend:**
```python
# Returns: https://kortix.syhc.dev/api/sandboxes/{id}/proxy/6080/
return f"{base_url}/api/sandboxes/{sandbox_id}/proxy/{port}{path}"
```

**Frontend:**
```typescript
// Strips trailing slash before use
const baseUrl = sandbox.vnc_preview.replace(/\/$/, '');
```

This is the correct pattern - backend provides consistent URL format, frontend handles edge cases.

## Expected Outcome

🎯 **VNC streaming should now work!**

Users will see:
1. ✅ Loading spinner while preloading
2. ✅ "Loading VNC client..." while iframe initializes
3. ✅ WebSocket connects successfully
4. ✅ VNC desktop appears (no more gray screen!)
5. ✅ Real-time browser view in the VNC viewer

## Rollback Plan (if needed)

If this introduces any issues, revert with:
```bash
git revert HEAD
```

The previous URLs with double slashes were failing, so any change is improvement. However, if there are unexpected edge cases, we can revert and investigate further.
