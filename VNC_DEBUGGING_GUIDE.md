# VNC Streaming Debugging Guide

## Overview

This guide explains how to debug VNC streaming issues using the comprehensive logging system implemented throughout the frontend and backend.

## Quick Diagnosis Checklist

### 1. Check Frontend Console Logs
```
Browser DevTools → Console → Filter: "VNC"
```

**Expected sequence:**
```
[VNC Debug] Constructing VNC connection
[VNC Preloader] Starting preload
[VNC Preloader] Adding iframe to DOM
✅ VNC preloaded successfully
[VNC Debug] Final VNC URL: https://...
```

### 2. Check Backend Logs
```bash
docker compose logs backend | grep "VNC WebSocket"
```

**Expected sequence:**
```
[VNC WebSocket] New connection request for sandbox=...
[VNC WebSocket] Access granted
[VNC WebSocket] Connection accepted
[VNC WebSocket] Got Daytona preview URL
[VNC WebSocket] Connecting to upstream VNC WebSocket
[VNC WebSocket] ✅ Successfully connected to upstream VNC
[VNC WebSocket] Starting bidirectional relay
[VNC WebSocket] Relayed binary message to client: X bytes
```

### 3. Check Network Tab
```
DevTools → Network → WS (WebSockets)
```

**Look for:**
- Connection to: `/api/sandboxes/{sandbox_id}/proxy/6080/websockify`
- Status: `101 Switching Protocols`
- Connection: `Upgrade`

## Common Issues & Solutions

### Issue 1: WebSocket Connects to Wrong Path

**Symptom:**
```
WebSocket connection to 'wss://kortix.syhc.dev/websockify' failed
```

**Diagnosis:**
Check frontend console for:
```javascript
[VNC Debug] Constructing VNC connection: {
  websocket_path: "/websockify"  // ❌ WRONG - should be full path
}
```

**Solution:**
Should see:
```javascript
[VNC Debug] Constructing VNC connection: {
  websocket_path: "/api/sandboxes/test-123/proxy/6080/websockify"  // ✅ CORRECT
}
```

**Fix:**
Update frontend code to construct full absolute path from `vnc_preview` URL.

---

### Issue 2: Backend Not Receiving WebSocket Connection

**Symptom:**
- Frontend shows "Connecting" indefinitely
- No backend logs for VNC WebSocket

**Diagnosis:**
```bash
# Check if backend is running
docker compose ps backend

# Check backend logs for errors
docker compose logs backend --tail=50
```

**Possible Causes:**
1. Backend not running
2. Route not registered
3. CORS blocking WebSocket upgrade
4. Firewall/proxy blocking WebSocket

**Solution:**
```bash
# Restart backend
docker compose restart backend

# Check route registration
docker compose logs backend | grep "websocket"
```

---

### Issue 3: Authentication Failure

**Symptom:**
```
[VNC WebSocket] HTTP error (auth/access): 401 - Authentication required
```

**Diagnosis:**
```bash
# Check auth logs
docker compose logs backend | grep -E "VNC WebSocket.*auth"
```

**Possible Causes:**
1. User not authenticated
2. Private project without auth token
3. User not member of project account

**Solution:**
- **Public projects:** Should work without auth
- **Private projects:** Check auth token in frontend console:
  ```javascript
  [VNC Debug] Added auth token to VNC URL
  ```

---

### Issue 4: Upstream Daytona Connection Failure

**Symptom:**
```
[VNC WebSocket] ❌ Failed to connect to upstream: Connection refused
```

**Diagnosis:**
```bash
# Check full error details
docker compose logs backend | grep -A 10 "Failed to connect to upstream"
```

**Possible Causes:**
1. Daytona sandbox not running
2. VNC server not started in sandbox
3. Invalid preview URL from Daytona
4. Network connectivity to Daytona

**Solution:**
```bash
# Check Daytona sandbox status
curl https://app.daytona.io/api/sandboxes/{sandbox_id}/status

# Check if VNC port is accessible
curl -I https://6080-{sandbox_id}.proxy.daytona.work
```

---

### Issue 5: Gray Screen After "Connecting"

**Symptom:**
- WebSocket connects successfully
- No messages relayed
- noVNC shows "Connecting" indefinitely

**Diagnosis:**
```bash
# Check message relay logs
docker compose logs backend | grep "Relayed.*message"
```

**If no messages:**
- VNC server not responding
- Incorrect VNC password
- VNC server not accepting connections

**If messages relaying:**
- Check browser console for noVNC errors
- Verify noVNC client is receiving data

---

### Issue 6: Protocol Mismatch (Mixed Content)

**Symptom:**
```
Mixed Content: The page at 'https://...' was loaded over HTTPS, but attempted to connect to 'ws://...'
```

**Diagnosis:**
Frontend console should show:
```javascript
[VNC Debug] Upgraded HTTP to HTTPS
```

**If not upgrading:**
- Check `window.location.protocol` in browser console
- Verify protocol upgrade logic in component

---

## Detailed Logging Reference

### Frontend Logging

#### HealthCheckedVncIframe Component

```javascript
// URL Construction
[VNC Debug] Constructing VNC connection: {
  vnc_preview: string,        // Original preview URL
  extracted_path: string,     // Pathname from URL
  websocket_path: string,     // Full WebSocket path
  sandbox_id: string          // Sandbox identifier
}

// Protocol Upgrade
[VNC Debug] Upgraded HTTP to HTTPS

// Auth Token
[VNC Debug] Added auth token to VNC URL

// Final URL
[VNC Debug] Final VNC URL: string
```

#### useVncPreloader Hook

```javascript
// Preload Start
[VNC Preloader] Starting preload: {
  url: string,                // Full VNC URL
  retryCount: number,         // Current retry attempt
  maxRetries: number,         // Maximum retries allowed
  timeoutMs: number           // Timeout duration
}

// Skipping Preload
[VNC Preloader] Skipping preload: {
  isRetrying: boolean,
  status: string
}

// DOM Operations
[VNC Preloader] Adding iframe to DOM

// Timeout
[VNC Preloader] Load timeout reached after X ms

// Retry
🔄 VNC preload failed, retrying in Xms (attempt Y/Z)

// Success
✅ VNC preloaded successfully

// Error
❌ VNC preload failed after X attempts
[VNC Preloader] iframe.onerror triggered: Event
```

### Backend Logging

#### WebSocket Proxy

```python
# Connection Request
[VNC WebSocket] New connection request for sandbox={id} port={port} user={user_id}

# Access Verification
[VNC WebSocket] Verifying access for sandbox={id} user={user_id}
[VNC WebSocket] Access granted for sandbox={id} user={user_id}

# Connection Acceptance
[VNC WebSocket] Connection accepted for sandbox={id} port={port}

# Sandbox Retrieval
[VNC WebSocket] Retrieving sandbox object for sandbox_id={id}

# Preview URL
[VNC WebSocket] Getting preview link for port={port}
[VNC WebSocket] Got Daytona preview URL: {url}

# Upstream Connection
[VNC WebSocket] Connecting to upstream VNC WebSocket: {ws_url}
[VNC WebSocket] ✅ Successfully connected to upstream VNC for sandbox {id}
[VNC WebSocket] ❌ Failed to connect to upstream: {error}

# Message Relay
[VNC WebSocket] Starting bidirectional relay for sandbox={id}
[VNC WebSocket] Starting client→upstream relay
[VNC WebSocket] Starting upstream→client relay
[VNC WebSocket] Relayed text message to upstream: X bytes (total: Y msgs, Z bytes)
[VNC WebSocket] Relayed binary message to client: X bytes (total: Y msgs, Z bytes)

# Disconnection
[VNC WebSocket] Client disconnected (sandbox={id})
[VNC WebSocket] Upstream disconnected: code={code} reason={reason}
[VNC WebSocket] Closed upstream connection from client relay
[VNC WebSocket] Closed client connection from upstream relay

# Session Complete
[VNC WebSocket] Session complete for sandbox={id}: X msgs (Y bytes) to upstream, A msgs (B bytes) to client

# Errors
[VNC WebSocket] HTTP error (auth/access): {status} - {detail}
[VNC WebSocket] WebSocket error: {type} - {message}
[VNC WebSocket] Unexpected error: {type} - {message}

# Cleanup
[VNC WebSocket] Final cleanup: closed upstream connection
[VNC WebSocket] Connection closed for sandbox={id}
```

## Debugging Tools

### 1. Enable Verbose Logging

**Backend:**
```python
# In backend/core/utils/logger.py
import logging
logging.basicConfig(level=logging.DEBUG)
```

**Frontend:**
```javascript
// All VNC logs already use console.log/console.error
// Use browser DevTools filter: "VNC"
```

### 2. Monitor WebSocket Traffic

**Browser DevTools:**
```
Network tab → WS filter → Click connection → Messages tab
```

Shows all WebSocket frames:
- Outgoing: Client → Backend
- Incoming: Backend → Client

### 3. Test WebSocket Endpoint Directly

```bash
# Install wscat
npm install -g wscat

# Connect to WebSocket
wscat -c "wss://kortix.syhc.dev/api/sandboxes/{sandbox_id}/proxy/6080/websockify" \
  -H "Authorization: Bearer {token}"
```

### 4. Inspect VNC URL Construction

**Browser Console:**
```javascript
// Get sandbox data
const sandbox = { ... };  // From React DevTools

// Manually construct URL
const vncPreviewUrl = new URL(sandbox.vnc_preview, window.location.origin);
const websocketPath = vncPreviewUrl.pathname.replace(/\/$/, '') + '/websockify';
console.log('WebSocket Path:', websocketPath);
```

### 5. Check WEBHOOK_BASE_URL Configuration

```bash
# In backend container
docker compose exec backend env | grep WEBHOOK_BASE_URL

# Should output:
# WEBHOOK_BASE_URL=https://kortix.syhc.dev
```

**If not set or incorrect:**
```bash
# Edit backend/.env
WEBHOOK_BASE_URL=https://kortix.syhc.dev

# Restart backend
docker compose restart backend
```

## Advanced Debugging

### Packet Capture

```bash
# Capture WebSocket traffic
tcpdump -i any -A 'tcp port 443' | grep -A 10 "websockify"
```

### Daytona Sandbox Inspection

```bash
# SSH into Daytona sandbox (if possible)
# Check VNC server status
ps aux | grep x11vnc

# Check websockify process
ps aux | grep websockify

# Test VNC locally
vncviewer localhost:5901
```

### Backend Connection Pool

```bash
# Check active WebSocket connections
docker compose exec backend python -c "
from core.sandbox.api import router
print('Active WebSocket connections:', len(router._websocket_connections))
"
```

## Performance Metrics

### Message Relay Statistics

Backend logs show:
```
[VNC WebSocket] Session complete for sandbox=xyz:
  123 msgs (456789 bytes) to upstream,
  234 msgs (567890 bytes) to client
```

**Interpretation:**
- **Low message count:** Connection issues or VNC not updating
- **High bytes to client:** VNC streaming working (frame data)
- **High bytes to upstream:** User interacting (keyboard/mouse)
- **Asymmetric:** Normal (more data from VNC server to client)

### Latency Monitoring

```javascript
// Add to frontend console
let startTime = Date.now();
websocket.addEventListener('message', () => {
  console.log('Latency:', Date.now() - startTime, 'ms');
  startTime = Date.now();
});
```

## Running Unit Tests

### Frontend Tests
```bash
cd frontend
npm test -- HealthCheckedVncIframe.test.tsx
npm test -- useVncPreloader.test.ts
```

### Backend Tests
```bash
cd backend
uv run pytest core/sandbox/tests/test_vnc_websocket_proxy.py -v
```

## Troubleshooting Checklist

- [ ] WEBHOOK_BASE_URL configured correctly in backend
- [ ] Backend WebSocket route registered in API
- [ ] Frontend constructing correct WebSocket path
- [ ] Daytona sandbox running and VNC server active
- [ ] Authentication token present for private projects
- [ ] No CORS errors in browser console
- [ ] WebSocket connection shows 101 status
- [ ] Backend logs show successful upstream connection
- [ ] Messages being relayed bidirectionally
- [ ] No firewall/proxy blocking WebSocket

## Getting Help

If issues persist after following this guide:

1. **Collect Logs:**
   ```bash
   # Frontend
   Browser Console → Right-click → Save as...

   # Backend
   docker compose logs backend > backend.log
   ```

2. **Check Network:**
   ```bash
   # DevTools → Network → Right-click connection → "Save all as HAR"
   ```

3. **Create Issue:**
   - Include frontend console logs
   - Include backend logs
   - Include HAR file (if possible)
   - Describe expected vs actual behavior
   - List steps to reproduce
