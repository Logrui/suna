# VNC Streaming Architecture - Before vs After Fix

## ❌ BEFORE FIX (Broken - WebSocket Fails)

```
┌──────────────────────────────────────────────────────────────────┐
│ CLIENT BROWSER (https://kortix.syhc.dev)                         │
│                                                                   │
│  Main Page with VNC iframe:                                      │
│  <iframe src="https://kortix.syhc.dev/api/.../vnc_lite.html">   │
│      ↓                                                            │
│  noVNC Client Loads                                               │
│      ↓                                                            │
│  Attempts WebSocket Connection:                                  │
│  wss://kortix.syhc.dev/api/sandboxes/.../websockify             │
└──────────────────────────────────────────────────────────────────┘
                    │
                    │ WebSocket Upgrade Request
                    │ Headers:
                    │   Upgrade: websocket
                    │   Connection: Upgrade
                    │   Sec-WebSocket-Key: ...
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│ CLOUDFLARE TUNNEL (kortix.syhc.dev)                              │
│                                                                   │
│  Terminates TLS: wss:// → ws://                                  │
│  Routes to: http://localhost:9990                                │
└──────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│ NEXT.JS FRONTEND SERVER (localhost:9990)                         │
│                                                                   │
│  Receives: GET /api/sandboxes/.../websockify                     │
│                                                                   │
│  next.config.ts rewrites():                                      │
│  {                                                                │
│    source: '/api/:path*',                                        │
│    destination: 'http://backend:8000/api/:path*'                 │
│  }                                                                │
│      ↓                                                            │
│  Attempts to rewrite request to backend                          │
│                                                                   │
│  ❌ PROBLEM: Next.js rewrites don't support WebSocket!           │
│  ❌ Upgrade headers are lost or not properly forwarded            │
│  ❌ Backend receives malformed request or nothing at all         │
└──────────────────────────────────────────────────────────────────┘
                    │
                    │ ❌ Broken WebSocket request
                    │ (or request never arrives)
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│ BACKEND API (backend:8000) - NOT ACCESSIBLE FROM OUTSIDE         │
│                                                                   │
│  WebSocket endpoint:                                              │
│  /api/sandboxes/{id}/proxy/{port}/websockify                     │
│                                                                   │
│  ❌ NO LOGS - Request never reaches here                         │
│  ❌ WebSocket handler never executes                             │
└──────────────────────────────────────────────────────────────────┘

RESULT: ❌ Gray screen, connection closes after 1-2 seconds


═══════════════════════════════════════════════════════════════════


## ✅ AFTER FIX (Working - WebSocket Succeeds)

```
┌──────────────────────────────────────────────────────────────────┐
│ CLIENT BROWSER (https://kortix.syhc.dev)                         │
│                                                                   │
│  Main Page with VNC iframe:                                      │
│  <iframe src="https://kortix.syhc.dev/api/.../vnc_lite.html">   │
│      ↓                                                            │
│  noVNC Client Loads                                               │
│      ↓                                                            │
│  Attempts WebSocket Connection:                                  │
│  wss://kortix.syhc.dev/api/sandboxes/.../websockify             │
└──────────────────────────────────────────────────────────────────┘
                    │
                    │ WebSocket Upgrade Request
                    │ Headers:
                    │   Upgrade: websocket
                    │   Connection: Upgrade
                    │   Sec-WebSocket-Key: ...
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│ CLOUDFLARE TUNNEL (kortix.syhc.dev)                              │
│                                                                   │
│  NEW ROUTING CONFIGURATION:                                      │
│                                                                   │
│  Route 1: /api/* → http://localhost:8000 (Backend)              │
│  Route 2: /*     → http://localhost:9990 (Frontend)             │
│                                                                   │
│  Terminates TLS: wss:// → ws://                                  │
│  Routes /api/* to: http://localhost:8000  ✅                     │
└──────────────────────────────────────────────────────────────────┘
                    │
                    │ ✅ WebSocket request goes DIRECTLY to backend
                    │    (Bypasses Next.js entirely!)
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│ BACKEND API (localhost:8000) - NOW EXPOSED ON PORT 8000          │
│                                                                   │
│  Receives: GET /api/sandboxes/.../websockify                     │
│  Headers:                                                         │
│    Upgrade: websocket ✅                                          │
│    Connection: Upgrade ✅                                         │
│    Sec-WebSocket-Key: ... ✅                                      │
│                                                                   │
│  WebSocket endpoint handler executes:                            │
│  @app.websocket("/api/sandboxes/{id}/proxy/{port}/{path:path}")  │
│                                                                   │
│  ✅ LOGS APPEAR:                                                  │
│     [VNC WebSocket] New connection request                       │
│     [VNC WebSocket] Access verified                              │
│     [VNC WebSocket] Connecting to upstream                       │
│                                                                   │
│  WebSocket handshake succeeds:                                   │
│  HTTP/1.1 101 Switching Protocols ✅                             │
└──────────────────────────────────────────────────────────────────┘
                    │
                    │ ✅ Backend proxies to Daytona
                    │    Bidirectional WebSocket relay
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│ DAYTONA SANDBOX                                                   │
│                                                                   │
│  WebSocket URL:                                                   │
│  wss://6080-{sandbox-id}.proxy.daytona.works/websockify         │
│                                                                   │
│  VNC Server (port 6080)                                          │
│  websockify protocol bridge                                      │
│                                                                   │
│  ✅ Streams desktop/browser frames to backend                    │
└──────────────────────────────────────────────────────────────────┘
                    │
                    │ ✅ Backend relays frames to client browser
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│ CLIENT BROWSER                                                    │
│                                                                   │
│  ✅ Receives continuous VNC stream                               │
│  ✅ Displays live browser/desktop                                │
│  ✅ Mouse/keyboard input works                                   │
│  ✅ No gray screen, no freezing                                  │
└──────────────────────────────────────────────────────────────────┘

RESULT: ✅ Live VNC streaming works continuously


═══════════════════════════════════════════════════════════════════


## 🔍 DIRECT URL ACCESS (Why It Works Even When Broken)

When you manually navigate to:
`https://kortix.syhc.dev/api/sandboxes/.../vnc_lite.html`

```
Browser → Cloudflare Tunnel → localhost:9990 (Next.js)
    ↓
Next.js rewrites /api/* to backend ✅ (HTTP works fine)
    ↓
Backend serves vnc_lite.html ✅
    ↓
noVNC loads in browser
    ↓
noVNC tries WebSocket to same URL origin
    ↓
But since you're NOT in an iframe,
the WebSocket goes to Cloudflare Tunnel different route ✅
(Cloudflare routing is more flexible for direct requests)
    ↓
Eventually reaches backend ✅
```

**Why iframe fails but direct doesn't:**
- **iframe**: Strict WebSocket routing through Next.js rewrite
- **direct**: Browser handles WebSocket differently, may use alternative paths

**After fix:** Both iframe and direct access work because `/api/*` bypasses Next.js entirely.


═══════════════════════════════════════════════════════════════════


## 📊 ROUTING COMPARISON

### BEFORE FIX:

| Request Type | Path | Cloudflare Routes To | Next.js Handles | Backend Receives |
|--------------|------|----------------------|-----------------|------------------|
| HTTP (HTML)  | `/api/.../vnc_lite.html` | localhost:9990 | ✅ Rewrites | ✅ Success |
| WebSocket    | `/api/.../websockify` | localhost:9990 | ❌ Rewrite fails | ❌ Nothing |

### AFTER FIX:

| Request Type | Path | Cloudflare Routes To | Next.js Handles | Backend Receives |
|--------------|------|----------------------|-----------------|------------------|
| HTTP (HTML)  | `/api/.../vnc_lite.html` | localhost:8000 | ⏭️ Bypassed | ✅ Success |
| WebSocket    | `/api/.../websockify` | localhost:8000 | ⏭️ Bypassed | ✅ Success |

**Key Change:** All `/api/*` requests go DIRECTLY to backend (port 8000), bypassing Next.js entirely.


═══════════════════════════════════════════════════════════════════


## 🎯 TECHNICAL ROOT CAUSE EXPLAINED

### Why Next.js Rewrites Break WebSocket

**HTTP Request (works fine):**
```
Client → Next.js Server
Next.js reads request
Next.js makes NEW request to backend
Backend responds
Next.js forwards response to client
```

**WebSocket Request (broken):**
```
Client → Next.js Server
Client sends: Upgrade: websocket, Connection: Upgrade
Next.js tries to rewrite...
❌ But WebSocket requires PERSISTENT connection!
❌ Next.js can't "rewrite" a connection upgrade
❌ Backend needs to respond: HTTP 101 Switching Protocols
❌ Next.js can't maintain bidirectional relay
Connection fails
```

**WebSocket requires:**
1. Single persistent TCP connection
2. Protocol upgrade handshake (HTTP → WebSocket)
3. Bidirectional message relay (client ↔ server)

**Next.js rewrites provide:**
1. ✅ Request forwarding
2. ❌ NO protocol upgrade support
3. ❌ NO persistent connection relay

**Solution:** Bypass Next.js for WebSocket requests entirely.


═══════════════════════════════════════════════════════════════════


## 🔧 IMPLEMENTATION CHECKLIST

### Step 1: Docker Configuration ✅

```yaml
# docker-compose.yaml
services:
  backend:
    ports:
      - "8000:8000"  # Expose backend directly
```

### Step 2: Next.js Configuration ✅

```typescript
// frontend/next.config.ts
async rewrites() {
  return [
    // ❌ REMOVE THIS:
    // {
    //   source: '/api/:path*',
    //   destination: `${backendUrl}/:path*`,
    // },

    // ✅ KEEP Supabase rewrites (no WebSocket issues)
    { source: '/auth/v1/:path*', destination: `${supabaseUrl}/auth/v1/:path*` },
    { source: '/rest/v1/:path*', destination: `${supabaseUrl}/rest/v1/:path*` },
    // ... etc
  ]
}
```

### Step 3: Cloudflare Tunnel Configuration ✅

**Option A: Path-based (simpler)**
```yaml
ingress:
  - hostname: kortix.syhc.dev
    path: /api/.*
    service: http://localhost:8000
  - hostname: kortix.syhc.dev
    service: http://localhost:9990
```

**Option B: Subdomain (recommended)**
```yaml
ingress:
  - hostname: api.kortix.syhc.dev
    service: http://localhost:8000
  - hostname: kortix.syhc.dev
    service: http://localhost:9990
```

### Step 4: Environment Variables (if using subdomain) ✅

```env
# frontend/.env.production
NEXT_PUBLIC_BACKEND_URL=https://api.kortix.syhc.dev/api
```

### Step 5: Rebuild and Test ✅

```powershell
docker compose down
docker compose up -d --build
systemctl restart cloudflared  # or restart your tunnel
```

### Step 6: Verify Logs ✅

```powershell
# Should see WebSocket logs when VNC connects:
docker compose logs backend --tail=50 -f

# Expected output:
[VNC WebSocket] New connection request for sandbox=...
[VNC WebSocket] Access granted
[VNC WebSocket] ✅ Successfully connected to upstream
```

═══════════════════════════════════════════════════════════════════


## ✅ SUCCESS INDICATORS

After implementing the fix, you should observe:

### Browser DevTools (Network Tab - WS Filter):
```
Name: websockify
Status: 101 Switching Protocols ✅
Type: websocket
Size: (pending)
Time: (ongoing connection)
```

### Backend Logs:
```
[VNC WebSocket] New connection request ✅
[VNC WebSocket] Access granted ✅
[VNC WebSocket] Successfully connected to upstream ✅
[VNC WebSocket] Relayed binary to client: 1024 bytes ✅
```

### Frontend Console:
```
[VNC Preloader] ✅ VNC preloaded successfully
[VNC Component] ✅ iframe onLoad event fired
```

### Visual Confirmation:
```
✅ VNC displays immediately (no gray screen)
✅ Live browser view streams continuously
✅ No freezing or disconnections
✅ Mouse/keyboard input responsive
✅ Works in both iframe and direct access
```

═══════════════════════════════════════════════════════════════════

## 🎉 EXPECTED OUTCOME

**Before:** Gray screen, WebSocket fails, no backend logs
**After:** Live VNC stream, stable WebSocket, full backend logging

**Root Cause:** Next.js rewrites incompatible with WebSocket protocol
**Solution:** Route `/api/*` directly to backend, bypassing Next.js
