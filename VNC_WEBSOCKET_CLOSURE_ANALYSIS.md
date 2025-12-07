# VNC WebSocket Intermittent Closure - Root Cause Analysis

## Issue Summary

**Symptoms:**
- ✅ VNC briefly displays actual browser content after page load
- ❌ Connection freezes after 1-2 seconds, returns to gray screen
- ✅ Direct URL navigation works perfectly: `https://kortix.syhc.dev/api/sandboxes/{id}/proxy/6080/vnc_lite.html?...`
- ❌ iframe embedding fails intermittently
- ❌ No backend WebSocket logs (connection not reaching FastAPI proxy)

**Critical Observation:** Direct browser access succeeds, iframe context fails → **This is NOT a backend routing issue**

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CLIENT BROWSER (https://kortix.syhc.dev)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────┐            │
│  │ Main Page (Next.js App)                                     │            │
│  │  - HealthCheckedVncIframe component                         │            │
│  │  - iframe sandbox="allow-same-origin allow-scripts ..."     │            │
│  └────────────────────────────────────────────────────────────┘            │
│                            │                                                 │
│                            │ HTTP Request for iframe src                    │
│                            ▼                                                 │
│  ┌────────────────────────────────────────────────────────────┐            │
│  │ Embedded iframe Context                                     │            │
│  │  - Loads: .../6080/vnc_lite.html?path=...&password=...      │            │
│  │  - noVNC JavaScript client executes                         │            │
│  │  - Attempts WebSocket: wss://kortix.syhc.dev/api/...        │            │
│  └────────────────────────────────────────────────────────────┘            │
│                            │                                                 │
└────────────────────────────┼─────────────────────────────────────────────────┘
                             │
                             │ WebSocket Upgrade Request
                             │ wss://kortix.syhc.dev/api/sandboxes/{id}/proxy/6080/websockify
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ CLOUDFLARE TUNNEL (kortix.syhc.dev)                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  - Terminates TLS (wss:// → ws://)                                          │
│  - Forwards to: http://localhost:9990                                       │
│  - **WebSocket support may require special configuration**                  │
│  - Default timeout: 100 seconds (Cloudflare default)                        │
│  - May drop idle WebSocket connections                                      │
└────────────────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ FRONTEND SERVER (Next.js - suna-frontend:9990)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Serves static vnc_lite.html (public asset or rewrite?)                  │
│  2. **Does NOT handle WebSocket** - Next.js middleware rewrites to backend  │
│  3. Rewrites /api/* → http://backend:8000/api                               │
└────────────────────────────────────────────────────────────────────────────┘
                             │
                             │ HTTP Rewrite
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ BACKEND API (FastAPI - suna-backend:8000)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Endpoint: /api/sandboxes/{sandbox_id}/proxy/{port}/{path:path}            │
│                                                                              │
│  1. HTTP Requests (vnc_lite.html, CSS, JS):                                 │
│     - Handled by HTTP proxy in core/sandbox/api.py                          │
│     - Logs: [VNC HTTP Proxy]                                                │
│     - Forwards to Daytona preview URL                                       │
│                                                                              │
│  2. WebSocket Requests (websockify):                                        │
│     - **SHOULD be handled by WebSocket proxy**                              │
│     - Logs: [VNC WebSocket] ← **NEVER APPEARING**                           │
│     - **Connection NOT reaching this handler**                              │
└────────────────────────────────────────────────────────────────────────────┘
                             │
                             │ (If WebSocket reached backend)
                             ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ DAYTONA SANDBOX (wss://6080-{sandbox_id}.proxy.daytona.works/websockify)   │
├─────────────────────────────────────────────────────────────────────────────┤
│  - VNC server running on port 6080                                          │
│  - websockify protocol bridge                                               │
│  - **Works perfectly when accessed directly**                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Root Cause Analysis

### 🔴 PRIMARY SUSPECT: Cloudflare Tunnel WebSocket Configuration

**Evidence:**
1. ✅ Direct access to `https://kortix.syhc.dev/api/...` works perfectly
2. ❌ iframe embedded access fails intermittently
3. ❌ No backend WebSocket logs → connection never reaches FastAPI
4. ⚠️ WebSocket closes after 1-2 seconds → timeout/policy issue

**Hypothesis:** Cloudflare Tunnel may be dropping WebSocket connections from iframe context due to:

#### Issue 1: Missing WebSocket Configuration in Cloudflare Tunnel
Cloudflare tunnels require explicit WebSocket support. Default HTTP tunnels may not properly upgrade WebSocket connections.

**Required Configuration:**
```yaml
# cloudflared tunnel config
ingress:
  - hostname: kortix.syhc.dev
    service: http://localhost:9990
    originRequest:
      noTLSVerify: false
      connectTimeout: 30s
      # CRITICAL: Enable WebSocket support
      httpHostHeader: kortix.syhc.dev
```

**Check if configured:** Run `cloudflared tunnel info` or review tunnel configuration file.

#### Issue 2: Cloudflare WebSocket Timeout (100 seconds default)
Cloudflare has a 100-second timeout for WebSocket connections. However, this doesn't explain the **immediate** closure (1-2 seconds).

More likely: **Connection upgrade is failing** entirely, not timing out.

#### Issue 3: CSP (Content Security Policy) Headers
Cloudflare or Next.js may be setting CSP headers that block WebSocket connections from iframe context.

**Check browser console for:**
```
Refused to connect to 'wss://...' because it violates the following Content Security Policy directive: "connect-src 'self'"
```

---

### 🟡 SECONDARY SUSPECT: Next.js Middleware WebSocket Handling

**Evidence:**
- Next.js middleware rewrites `/api/*` to backend
- WebSocket upgrade requires special handling (HTTP/1.1 → WebSocket protocol switch)
- Standard HTTP rewrites may not preserve WebSocket upgrade headers

**Problem:** Next.js middleware in `frontend/src/middleware.ts` may not be properly forwarding WebSocket upgrade requests.

**WebSocket Upgrade Headers Required:**
```http
GET /api/sandboxes/.../websockify HTTP/1.1
Host: kortix.syhc.dev
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: ...
Sec-WebSocket-Version: 13
```

**If Next.js strips these headers during rewrite** → Backend receives normal HTTP request → WebSocket handshake fails

**Test:** Check browser Network tab → WebSocket request → Headers → Verify `Upgrade: websocket` is present

---

### 🟡 TERTIARY SUSPECT: iframe sandbox Restrictions

**Current iframe attributes:**
```tsx
<iframe
  sandbox="allow-same-origin allow-scripts allow-forms allow-modals"
  src={vncUrl}
/>
```

**Missing permission:** May need to add WebSocket-specific permissions (though not standard sandbox attribute)

**However:** This doesn't explain why connection works briefly then closes. If sandbox blocked WebSocket, it would fail immediately.

**More likely:** iframe `allow-same-origin` is required for WebSocket, and it's present → **Not the root cause**

---

### 🟢 UNLIKELY: Backend WebSocket Proxy Code

**Evidence:**
- No backend logs at all → **Request never reaches backend**
- Backend code exists in `core/sandbox/api.py` but never executes
- Direct URL access works → **Backend is functional**

**Conclusion:** Backend code is fine. Issue is **upstream** (Cloudflare or Next.js middleware).

---

### 🟢 UNLIKELY: Daytona Connection Issues

**Evidence:**
- Direct access works perfectly
- Daytona WebSocket is stable when accessed directly
- Issue only occurs in iframe context

**Conclusion:** Daytona is not the problem.

---

## Diagnostic Steps

### Step 1: Check Browser WebSocket Connection Details

**Open Browser DevTools:**
1. Network tab → Filter: WS (WebSocket)
2. Find `websockify` connection
3. Check:
   - **Status:** 101 Switching Protocols (success) or 400/502 (failure)
   - **Headers:** Verify `Upgrade: websocket`, `Connection: Upgrade` present
   - **Timing:** Note when connection closes (immediate vs. after timeout)
   - **Messages:** Any error messages in WebSocket frames

**Expected if working:**
```
Status: 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
```

**If broken:**
```
Status: 502 Bad Gateway
or
Status: 400 Bad Request
```

### Step 2: Test WebSocket Through Cloudflare Tunnel Directly

**Bypass Next.js to isolate issue:**

Create a simple test HTML page and host it on backend:

```python
# backend/api.py - add test endpoint
@app.get("/test-websocket")
async def test_websocket_page():
    return HTMLResponse("""
    <html>
    <body>
        <h1>WebSocket Test</h1>
        <pre id="log"></pre>
        <script>
            const log = document.getElementById('log');
            const ws = new WebSocket('wss://kortix.syhc.dev/api/sandboxes/69af50df-a9e2-4d1c-831f-cde437e898a4/proxy/6080/websockify');

            ws.onopen = () => log.textContent += 'WebSocket OPEN\\n';
            ws.onerror = (e) => log.textContent += 'WebSocket ERROR: ' + JSON.stringify(e) + '\\n';
            ws.onclose = (e) => log.textContent += 'WebSocket CLOSE: ' + e.code + ' ' + e.reason + '\\n';
            ws.onmessage = (e) => log.textContent += 'WebSocket MESSAGE: ' + e.data + '\\n';
        </script>
    </body>
    </html>
    """)
```

Access: `https://kortix.syhc.dev/api/test-websocket`

**If this works:** Next.js middleware is the problem
**If this fails:** Cloudflare Tunnel configuration is the problem

### Step 3: Check Next.js Middleware Rewrite Configuration

**File:** `frontend/src/middleware.ts`

**Check if rewrites preserve WebSocket upgrade:**

```typescript
// Does the rewrite configuration look like this?
export const config = {
  matcher: '/api/:path*',
}

export function middleware(request: NextRequest) {
  // This may not properly forward WebSocket upgrade headers
  return NextResponse.rewrite(new URL(request.url.replace('/api', 'http://backend:8000/api')))
}
```

**Problem:** `NextResponse.rewrite()` is designed for HTTP, not WebSocket protocol switching.

**Solution:** May need to configure Next.js to NOT rewrite WebSocket requests, letting them pass through to backend directly.

### Step 4: Review Cloudflare Tunnel Configuration

**If using cloudflared:**

```bash
# Check current configuration
cat ~/.cloudflared/config.yml

# or if running as service
systemctl cat cloudflared
```

**Required configuration for WebSocket:**

```yaml
tunnel: <tunnel-id>
credentials-file: /path/to/credentials.json

ingress:
  - hostname: kortix.syhc.dev
    service: http://localhost:9990
    originRequest:
      noTLSVerify: false
      # Ensure HTTP/2 is disabled (WebSocket requires HTTP/1.1)
      disableChunkedEncoding: false
      # Increase timeout if needed
      connectTimeout: 30s
      tlsTimeout: 10s
      # Critical for WebSocket
      httpHostHeader: kortix.syhc.dev
  - service: http_status:404
```

**Restart cloudflared after changes:**
```bash
systemctl restart cloudflared
# or
cloudflared tunnel run <tunnel-name>
```

---

## Recommended Fix Priority

### 🔴 HIGH PRIORITY: Fix Cloudflare Tunnel WebSocket Support

**Action:**
1. Review Cloudflare Tunnel configuration file
2. Ensure WebSocket upgrade is supported
3. Test WebSocket connection with browser DevTools
4. Check for CSP headers blocking WebSocket

### 🟡 MEDIUM PRIORITY: Verify Next.js Middleware

**Action:**
1. Check `frontend/src/middleware.ts` for WebSocket handling
2. Test if rewrite preserves `Upgrade: websocket` header
3. Consider excluding `/api/.../websockify` from rewrites

### 🟢 LOW PRIORITY: iframe sandbox Attributes

**Action:**
1. Try removing `sandbox` attribute entirely as test
2. Check if WebSocket connects without restrictions
3. If yes, add back permissions one-by-one

---

## Expected Behavior After Fix

### Browser DevTools Network Tab:
```
Name: websockify
Status: 101 Switching Protocols
Type: websocket
Initiator: vnc_lite.html
Size: (pending)
Time: (ongoing)

Headers:
  Request:
    Upgrade: websocket
    Connection: Upgrade
    Sec-WebSocket-Key: ...

  Response:
    HTTP/1.1 101 Switching Protocols
    Upgrade: websocket
    Connection: Upgrade
    Sec-WebSocket-Accept: ...
```

### Backend Logs (will appear once WebSocket reaches FastAPI):
```
[VNC WebSocket] New connection request for sandbox=69af50df-a9e2-4d1c-831f-cde437e898a4 port=6080 path=websockify
[VNC WebSocket] Connection accepted for sandbox=69af50df-a9e2-4d1c-831f-cde437e898a4
[VNC WebSocket] Verifying access for sandbox=69af50df-a9e2-4d1c-831f-cde437e898a4
[VNC WebSocket] Access granted for sandbox=69af50df-a9e2-4d1c-831f-cde437e898a4
[VNC WebSocket] Connecting to upstream WebSocket: wss://6080-69af50df-a9e2-4d1c-831f-cde437e898a4.proxy.daytona.works/websockify
[VNC WebSocket] ✅ Successfully connected to upstream for sandbox 69af50df-a9e2-4d1c-831f-cde437e898a4
[VNC WebSocket] Starting bidirectional relay for sandbox=69af50df-a9e2-4d1c-831f-cde437e898a4
```

### Frontend Console:
```
[VNC Preloader] ✅ VNC preloaded successfully
[VNC Component] ✅ iframe onLoad event fired
[VNC Debug] WebSocket connection established
```

### VNC Display:
- ✅ Continuous live browser view
- ✅ No freezing or gray screen
- ✅ Mouse/keyboard input works
- ✅ Stable connection for duration of session

---

## Conclusion

**Primary Diagnosis:** Cloudflare Tunnel is likely NOT configured to support WebSocket protocol upgrades, causing connections to fail before reaching the backend.

**Supporting Evidence:**
1. No backend logs → Connection blocked upstream
2. Direct URL works → Backend and Daytona are functional
3. iframe fails → Environment-specific restriction (Cloudflare/Next.js)
4. Immediate closure → Not a timeout, but a handshake failure

**Recommended Action:** Investigate Cloudflare Tunnel configuration and Next.js middleware WebSocket handling as top priorities.
