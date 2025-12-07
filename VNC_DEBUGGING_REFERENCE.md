# VNC Streaming Debugging Reference

## Overview

This document describes the comprehensive debugging added to diagnose the **gray screen issue** where VNC streaming shows no content after the blue "connecting" bar disappears.

## Commit: `666da3c - feat: Add comprehensive debugging to entire VNC streaming flow`

---

## Backend Debugging

### 1. Preview URL Generation (`backend/core/utils/preview_urls.py`)

**Log Prefix:** `[Preview URL]` and `[VNC Preview URL]`

```python
# When generating any proxy URL
logger.debug(f"[Preview URL] Generated proxy URL: {result_url} (sandbox={sandbox_id}, port={port}, path={path})")

# When generating VNC-specific URL
logger.info(f"[VNC Preview URL] Generating VNC preview URL for sandbox={sandbox_id} on port={config.DAYTONA_VNC_PORT}")
```

**What to check:**
- ✅ Verify `WEBHOOK_BASE_URL` is set correctly (should match frontend domain)
- ✅ Verify VNC port is 6080
- ✅ Verify URL format: `{base_url}/api/sandboxes/{sandbox_id}/proxy/6080/`

**Expected logs:**
```
[VNC Preview URL] Generating VNC preview URL for sandbox=abc-123 on port=6080
[Preview URL] Generated proxy URL: https://kortix.syhc.dev/api/sandboxes/abc-123/proxy/6080/ (sandbox=abc-123, port=6080, path=/)
```

---

### 2. Sandbox Setup (`backend/core/agent_runs.py`)

**Log Prefix:** `[Sandbox Setup]`

```python
# When creating sandbox and generating URLs
logger.info(f"[Sandbox Setup] Generating preview URLs for sandbox={sandbox_id}")
logger.info(f"[Sandbox Setup] Generated VNC URL: {vnc_url}")
logger.info(f"[Sandbox Setup] Generated Website URL: {website_url}")

# When fetching Daytona preview link
logger.debug(f"[Sandbox Setup] Fetching Daytona preview link for port 6080")
logger.debug(f"[Sandbox Setup] Daytona preview link response: {vnc_link}")

# Token extraction
logger.debug(f"[Sandbox Setup] Extracted token from attribute: {token}")
logger.warning(f"[Sandbox Setup] No token found in preview link response")

# Database update
logger.info(f"[Sandbox Setup] Updating project {project_id} with sandbox data: {sandbox_data}")
logger.info(f"[Sandbox Setup] ✅ Successfully configured sandbox {sandbox_id} for project {project_id}")
```

**What to check:**
- ✅ VNC URL matches expected format
- ✅ Token is extracted successfully (or warning if missing)
- ✅ Sandbox data structure is complete with all fields (id, pass, vnc_preview, sandbox_url, token)
- ✅ Database update succeeds

**Expected logs:**
```
[Sandbox Setup] Generating preview URLs for sandbox=abc-123
[VNC Preview URL] Generating VNC preview URL for sandbox=abc-123 on port=6080
[Preview URL] Generated proxy URL: https://kortix.syhc.dev/api/sandboxes/abc-123/proxy/6080/
[Sandbox Setup] Generated VNC URL: https://kortix.syhc.dev/api/sandboxes/abc-123/proxy/6080/
[Sandbox Setup] Generated Website URL: https://kortix.syhc.dev/api/sandboxes/abc-123/proxy/8080/
[Sandbox Setup] Fetching Daytona preview link for port 6080
[Sandbox Setup] Daytona preview link response: PreviewLink(url='https://abc-123-6080.daytona.app', token='xyz-token')
[Sandbox Setup] Extracted token from attribute: xyz-token
[Sandbox Setup] Updating project proj-456 with sandbox data: {'id': 'abc-123', 'pass': 'pass-789', 'vnc_preview': 'https://kortix.syhc.dev/api/sandboxes/abc-123/proxy/6080/', 'sandbox_url': 'https://kortix.syhc.dev/api/sandboxes/abc-123/proxy/8080/', 'token': 'xyz-token'}
[Sandbox Setup] ✅ Successfully configured sandbox abc-123 for project proj-456
```

---

### 3. HTTP Proxy for VNC Client (`backend/core/sandbox/api.py`)

**Log Prefix:** `[VNC HTTP Proxy]` (for VNC requests) or `[HTTP Proxy]` (for other requests)

```python
# Request received
logger.info(f"{log_prefix} Incoming request: sandbox={sandbox_id} port={port} path={path}")
logger.debug(f"{log_prefix} Full request URL: {request.url}")
logger.debug(f"{log_prefix} Request headers: {dict(request.headers)}")

# Access verification
logger.debug(f"{log_prefix} Verifying sandbox access for user={user_id}")
logger.debug(f"{log_prefix} Access verified")

# Sandbox retrieval
logger.debug(f"{log_prefix} Retrieving sandbox object from database")
logger.debug(f"{log_prefix} Sandbox retrieved successfully")

# Daytona preview link
logger.debug(f"{log_prefix} Fetching Daytona preview link for port {port}")
logger.info(f"{log_prefix} Got Daytona preview URL: {base_target_url}")

# Final URL
logger.info(f"{log_prefix} Final upstream target URL: {target_url}")
```

**What to check:**
- ✅ Request path should be `/vnc_lite.html` for VNC client HTML
- ✅ Access is verified (no auth errors)
- ✅ Sandbox is retrieved from database successfully
- ✅ Daytona preview URL is fetched successfully
- ✅ Final upstream URL is correct

**Expected logs when loading VNC client:**
```
[VNC HTTP Proxy] Incoming request: sandbox=abc-123 port=6080 path=/vnc_lite.html
[VNC HTTP Proxy] Full request URL: https://kortix.syhc.dev/api/sandboxes/abc-123/proxy/6080/vnc_lite.html?password=pass-789&autoconnect=true&scale=local&path=%2Fapi%2Fsandboxes%2Fabc-123%2Fproxy%2F6080%2Fwebsockify
[VNC HTTP Proxy] Verifying sandbox access for user=user-456
[VNC HTTP Proxy] Access verified
[VNC HTTP Proxy] Retrieving sandbox object from database
[VNC HTTP Proxy] Sandbox retrieved successfully
[VNC HTTP Proxy] Fetching Daytona preview link for port 6080
[VNC HTTP Proxy] Got Daytona preview URL: https://abc-123-6080.daytona.app
[VNC HTTP Proxy] Final upstream target URL: https://abc-123-6080.daytona.app/vnc_lite.html?password=pass-789&autoconnect=true&scale=local&path=%2Fapi%2Fsandboxes%2Fabc-123%2Fproxy%2F6080%2Fwebsockify
```

---

### 4. WebSocket Proxy (`backend/core/sandbox/api.py`)

**Log Prefix:** `[VNC WebSocket]`

This was already comprehensive from previous commits, but key logs:

```python
logger.info(f"[VNC WebSocket] New connection request for sandbox={sandbox_id} port={port} path={path}")
logger.info(f"[VNC WebSocket] Connection accepted for sandbox={sandbox_id}")
logger.info(f"[VNC WebSocket] ✅ Successfully connected to upstream for sandbox {sandbox_id}")
logger.info(f"[VNC WebSocket] Starting bidirectional relay for sandbox={sandbox_id}")
logger.debug(f"[VNC WebSocket] Relayed binary to client: {msg_size} bytes (total: {messages_to_client} msgs, {bytes_to_client} bytes)")
logger.info(f"[VNC WebSocket] Session complete for sandbox={sandbox_id}: X msgs (Y bytes) to upstream, Z msgs (W bytes) to client")
```

**What to check:**
- ✅ WebSocket connection is accepted
- ✅ Upstream connection succeeds
- ✅ Bidirectional relay starts
- ✅ Messages are being relayed (should see byte counts increasing)
- ✅ Session completes with statistics

**Expected logs:**
```
[VNC WebSocket] New connection request for sandbox=abc-123 port=6080 path=/websockify
[VNC WebSocket] Connection accepted for sandbox=abc-123
[VNC WebSocket] Verifying access for sandbox=abc-123 user=user-456
[VNC WebSocket] Access granted for sandbox=abc-123 user=user-456
[VNC WebSocket] Connecting to upstream WebSocket: wss://abc-123-6080.daytona.app/websockify
[VNC WebSocket] ✅ Successfully connected to upstream for sandbox abc-123
[VNC WebSocket] Starting bidirectional relay for sandbox=abc-123
[VNC WebSocket] Relayed binary to client: 1024 bytes (total: 1 msgs, 1024 bytes)
[VNC WebSocket] Relayed binary to upstream: 512 bytes (total: 1 msgs, 512 bytes)
...
[VNC WebSocket] Session complete for sandbox=abc-123: 45 msgs (23040 bytes) to upstream, 234 msgs (456789 bytes) to client
```

---

## Frontend Debugging

### 1. VNC Component (`frontend/src/components/thread/HealthCheckedVncIframe.tsx`)

**Log Prefix:** `[VNC Component]` and `[VNC Debug]`

```javascript
// Component render
console.log('[VNC Component] Rendering with sandbox:', {
  id: sandbox.id,
  vnc_preview: sandbox.vnc_preview,
  has_pass: !!sandbox.pass
});

// Hook status
console.log('[VNC Component] Hook status:', {
  status,
  retryCount,
  isPreloaded,
  has_accessToken: !!accessToken
});

// iframe rendering
console.log('[VNC Component] Rendering iframe (preload complete)');

// iframe events
console.log('[VNC Component] ✅ iframe onLoad event fired');
console.error('[VNC Component] ❌ iframe onError event fired:', e);

// URL construction
console.log('[VNC Debug] Constructing VNC connection:', {...});
console.log('[VNC Debug] ✅ Final VNC URL:', vncUrl);
console.log('[VNC Debug] URL breakdown:', {
  base: sandbox.vnc_preview,
  path: '/vnc_lite.html',
  password: '***',
  autoconnect: true,
  scale: 'local',
  websocket_path: websocketPath,
  has_token: !!accessToken
});
```

**What to check:**
- ✅ Sandbox has `vnc_preview` and `pass` fields
- ✅ Hook status transitions from `loading` → `ready`
- ✅ `isPreloaded` becomes true
- ✅ iframe `onLoad` event fires (indicates HTML loaded)
- ✅ WebSocket path is correct: `/api/sandboxes/{id}/proxy/6080/websockify`
- ✅ No `onError` events

**Expected console logs:**
```
[VNC Component] Rendering with sandbox: {id: 'abc-123', vnc_preview: 'https://kortix.syhc.dev/api/sandboxes/abc-123/proxy/6080/', has_pass: true}
[VNC Component] Hook status: {status: 'loading', retryCount: 0, isPreloaded: false, has_accessToken: true}
[VNC Preloader] Effect triggered with sandbox: {...}
[VNC Preloader] Constructed preload URL: https://kortix.syhc.dev/api/sandboxes/abc-123/proxy/6080/vnc_lite.html?password=***&autoconnect=true&scale=local
[VNC Preloader] Starting preload: {...}
[VNC Preloader] Adding iframe to DOM
[VNC Preloader] ✅ VNC preloaded successfully
[VNC Component] Hook status: {status: 'ready', retryCount: 0, isPreloaded: true, has_accessToken: true}
[VNC Component] Rendering iframe (preload complete)
[VNC Debug] Constructing VNC connection: {...}
[VNC Debug] ✅ Final VNC URL: https://kortix.syhc.dev/api/sandboxes/abc-123/proxy/6080/vnc_lite.html?password=***&autoconnect=true&scale=local&path=%2Fapi%2Fsandboxes%2Fabc-123%2Fproxy%2F6080%2Fwebsockify&token=***
[VNC Debug] URL breakdown: {base: '...', path: '/vnc_lite.html', ...}
[VNC Component] ✅ iframe onLoad event fired
```

---

### 2. VNC Preloader Hook (`frontend/src/hooks/files/useVncPreloader.ts`)

**Log Prefix:** `[VNC Preloader]`

```javascript
// Effect triggered
console.log('[VNC Preloader] Effect triggered with sandbox:', {
  has_vnc_preview: !!sandbox?.vnc_preview,
  vnc_preview: sandbox?.vnc_preview,
  has_pass: !!sandbox?.pass,
  current_status: status
});

// Preload start
console.log('[VNC Preloader] Constructed preload URL:', vncUrl);
console.log('[VNC Preloader] Starting preload:', {...});

// Preload events
console.log('[VNC Preloader] Adding iframe to DOM');
console.log('✅ VNC preloaded successfully');
console.log('[VNC Preloader] Load timeout reached after', timeoutMs, 'ms');
console.error('[VNC Preloader] iframe.onerror triggered:', event);

// Auth token
console.log('[VNC Preloader] Fetching auth token...');
console.log('[VNC Preloader] ✅ Got auth token');
console.log('[VNC Preloader] No auth session found (public access mode)');
```

**What to check:**
- ✅ Sandbox has `vnc_preview` and `pass`
- ✅ Preload URL is constructed correctly
- ✅ iframe is added to DOM
- ✅ Preload succeeds (no timeout, no onerror)
- ✅ Auth token is fetched (or public access mode)

**Expected console logs:**
```
[VNC Preloader] Fetching auth token...
[VNC Preloader] ✅ Got auth token
[VNC Preloader] Effect triggered with sandbox: {has_vnc_preview: true, vnc_preview: 'https://...', has_pass: true, current_status: 'idle'}
[VNC Preloader] Constructed preload URL: https://kortix.syhc.dev/api/sandboxes/abc-123/proxy/6080/vnc_lite.html?password=***&autoconnect=true&scale=local
[VNC Preloader] Starting preload: {url: '...', retryCount: 0, maxRetries: 5, timeoutMs: 5000}
[VNC Preloader] Adding iframe to DOM
✅ VNC preloaded successfully
```

---

## Visual Debugging Features

### 1. Loading Indicator

While the iframe is loading (after preload completes), a loading spinner appears:

```jsx
{!iframeLoaded && (
  <div className="absolute inset-0 flex items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin" />
    <p className="text-xs">Loading VNC client...</p>
  </div>
)}
```

**User sees:** Gray background with spinner and "Loading VNC client..." text

**When it should disappear:** When iframe fires `onLoad` event

---

### 2. Error Banner

If iframe fails to load, a red banner appears at the top:

```jsx
{iframeError && (
  <div className="absolute top-0 left-0 right-0 bg-red-500 text-white">
    ⚠️ iframe error: {iframeError}
  </div>
)}
```

**User sees:** Red banner with error message

**When it appears:** When iframe fires `onError` event

---

## Diagnosing the Gray Screen Issue

### Scenario 1: Gray Screen with "Loading VNC client..." spinner

**What it means:** iframe HTML loaded successfully (preload worked), but iframe itself hasn't finished loading

**Check:**
1. Frontend console: Look for `[VNC Component] ✅ iframe onLoad event fired`
   - If missing: iframe never loaded → check browser network tab for failed requests
   - If present: iframe loaded but VNC client isn't initializing → check browser console for noVNC errors

2. Backend logs: Look for `[VNC HTTP Proxy]` logs showing request for `/vnc_lite.html`
   - If missing: Request never reached backend → check network/CORS issues
   - If present: Backend served the file → check response status code

---

### Scenario 2: Gray Screen with NO spinner, NO error banner

**What it means:** Preload completed, iframe loaded, but nothing is displaying

**This is the current issue!**

**Check:**
1. Frontend console:
   - ✅ `[VNC Preloader] ✅ VNC preloaded successfully`
   - ✅ `[VNC Component] ✅ iframe onLoad event fired`
   - ❓ Are there any errors from noVNC itself? (Look for errors from within the iframe)

2. Backend logs:
   - ✅ `[VNC HTTP Proxy]` logs for `/vnc_lite.html` request
   - ❓ `[VNC WebSocket]` logs - **This is critical!**
     - Look for: `[VNC WebSocket] New connection request`
     - If missing: noVNC isn't attempting WebSocket connection
     - If present but fails: Connection is being attempted but failing

3. Browser DevTools → Network tab:
   - Filter by "WS" (WebSockets)
   - Look for connection to `/api/sandboxes/{id}/proxy/6080/websockify`
   - Check status: Should be "101 Switching Protocols"
   - Check frames: Should see binary frames being sent/received

4. Browser DevTools → Console tab (look inside iframe):
   - Open iframe in DevTools (right-click → inspect element → switch to iframe context)
   - Look for noVNC errors about WebSocket connection

---

### Scenario 3: Red error banner appears

**What it means:** iframe completely failed to load

**Check:**
1. Frontend console: `[VNC Component] ❌ iframe onError event fired`
2. Backend logs: Check for errors in `[VNC HTTP Proxy]` logs
3. Browser network tab: Check HTTP status code for `/vnc_lite.html` request

---

## Quick Diagnostic Checklist

When gray screen appears, check in this order:

### ✅ Backend Logs

```bash
docker compose logs backend | grep -E "\[VNC|Preview URL|Sandbox Setup\]"
```

Look for:
1. ✅ Preview URLs are generated correctly
2. ✅ Sandbox setup completes successfully
3. ✅ HTTP proxy serves `/vnc_lite.html`
4. ❓ **WebSocket proxy receives connection** ← Most likely issue
5. ❓ **WebSocket upstream connection succeeds**
6. ❓ **Messages are being relayed**

### ✅ Frontend Console

Look for:
1. ✅ `[VNC Preloader] ✅ VNC preloaded successfully`
2. ✅ `[VNC Component] ✅ iframe onLoad event fired`
3. ❓ **WebSocket path is correct**: `/api/sandboxes/{id}/proxy/6080/websockify`
4. ❓ **Any noVNC errors** (may be in iframe context)

### ✅ Browser Network Tab

1. Check `/vnc_lite.html` request:
   - Status should be 200
   - Content-Type should be `text/html`

2. Check WebSocket request to `/websockify`:
   - Status should be 101
   - Should have "Upgrade: websocket" header
   - Should show binary frames in "Frames" tab

---

## Most Likely Root Causes

Based on symptoms (gray screen, no spinner, no error):

1. **WebSocket path is wrong** (frontend constructs incorrect path)
   - Check: `[VNC Debug] URL breakdown` → `websocket_path` field
   - Should be: `/api/sandboxes/{id}/proxy/6080/websockify` (absolute from root)
   - Common mistake: `websockify` or `/websockify` (missing full path)

2. **WebSocket connection fails silently** (backend doesn't receive connection)
   - Check: Backend logs for `[VNC WebSocket] New connection request`
   - If missing: Frontend isn't connecting (path wrong or noVNC bug)
   - If present: Connection is being attempted

3. **WebSocket upstream connection fails** (backend can't connect to Daytona)
   - Check: Backend logs for `[VNC WebSocket] ✅ Successfully connected to upstream`
   - If missing: Daytona isn't responding (sandbox down, network issue)

4. **VNC server not running in sandbox** (Daytona issue)
   - Check: Daytona dashboard - is VNC service running?
   - Check: Can you access VNC directly via Daytona preview URL?

5. **noVNC client JavaScript error** (client-side issue)
   - Check: Browser console in iframe context
   - Look for JavaScript errors from noVNC

---

## Next Steps After Reviewing Logs

Please provide:

1. **Backend logs** filtered for VNC:
   ```bash
   docker compose logs backend --tail=500 | grep -E "\[VNC|Preview URL|Sandbox Setup\]"
   ```

2. **Frontend console logs** (copy all `[VNC` prefixed logs)

3. **Browser Network tab screenshot** showing:
   - `/vnc_lite.html` request
   - `/websockify` WebSocket request (if present)

4. **Current behavior description:**
   - Does loading spinner appear? For how long?
   - Does it disappear?
   - Gray screen color (light or dark)?
   - Any error banner?
   - Any errors in console?

This will help pinpoint the exact issue!
