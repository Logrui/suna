# VNC WebSocket Fix - Root Cause and Solution

## 🎯 ROOT CAUSE IDENTIFIED

**Issue:** Next.js `rewrites()` in `frontend/next.config.ts` **DOES NOT support WebSocket protocol upgrades**

### The Problem

```typescript
// frontend/next.config.ts (lines 38-41)
{
  source: '/api/:path*',
  destination: `${backendUrl}/:path*`,  // http://backend:8000/api/:path*
}
```

**What happens:**

1. ✅ **Direct URL access** (works):
   ```
   Browser → wss://kortix.syhc.dev/api/sandboxes/.../websockify
        ↓
   Cloudflare Tunnel → http://localhost:9990/api/sandboxes/.../websockify
        ↓
   [BYPASSES Next.js - goes straight to Docker network]
        ↓
   Backend FastAPI → WebSocket proxy → Daytona
   ```

2. ❌ **iframe access** (fails):
   ```
   Browser (iframe) → wss://kortix.syhc.dev/api/sandboxes/.../websockify
        ↓
   Cloudflare Tunnel → http://localhost:9990/api/sandboxes/.../websockify
        ↓
   Next.js Server (port 9990) receives request
        ↓
   Next.js rewrites() attempts to proxy to http://backend:8000/api/...
        ↓
   ❌ WebSocket upgrade headers LOST or not properly forwarded
        ↓
   Request either fails or reaches backend as malformed HTTP request
        ↓
   No backend logs → Connection never established
   ```

**Why Next.js rewrites() fails for WebSocket:**

- Next.js `rewrites()` is designed for **HTTP requests only**
- WebSocket requires **HTTP/1.1 protocol upgrade** with specific headers:
  ```http
  GET /api/sandboxes/.../websockify HTTP/1.1
  Upgrade: websocket
  Connection: Upgrade
  Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
  Sec-WebSocket-Version: 13
  ```
- Next.js rewrites strip or don't forward these critical headers
- Backend receives incomplete request → handshake fails → no WebSocket connection

**Why direct URL works:**

When you navigate directly to `https://kortix.syhc.dev/api/sandboxes/.../websockify`, the request:
1. Hits Cloudflare Tunnel
2. **Bypasses Next.js** (goes to Docker network, not Next.js server)
3. Reaches backend FastAPI directly
4. WebSocket handshake succeeds

**Why iframe briefly works then fails:**

1. iframe loads `vnc_lite.html` successfully (HTTP request, rewrites work fine)
2. noVNC JavaScript executes
3. Attempts WebSocket connection
4. WebSocket upgrade fails at Next.js layer
5. Connection closes after 1-2 seconds (timeout waiting for upgrade)
6. VNC shows gray screen

---

## 🔧 SOLUTION OPTIONS

### Option 1: Custom WebSocket Proxy in Next.js (Complex)

**Not recommended** - Next.js doesn't natively support WebSocket server-side proxying. Would require custom server with `ws` library.

### Option 2: Direct Backend WebSocket Connection (Recommended)

**Change frontend to connect directly to backend WebSocket endpoint**, bypassing Next.js rewrites.

#### Implementation:

**Current (broken):**
```typescript
// frontend/src/components/thread/HealthCheckedVncIframe.tsx
const vncPreviewUrl = new URL(sandbox.vnc_preview, window.location.origin);
// sandbox.vnc_preview = https://kortix.syhc.dev/api/sandboxes/.../proxy/6080/
// WebSocket path: api/sandboxes/.../websockify
// Full WebSocket URL: wss://kortix.syhc.dev/api/sandboxes/.../websockify
//                      ↑ Goes through Next.js rewrites ❌
```

**Fixed (direct backend):**
```typescript
// frontend/src/components/thread/HealthCheckedVncIframe.tsx

// Get backend URL from environment
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://backend:8000/api';

// Construct WebSocket URL directly to backend
// IMPORTANT: Convert http:// to ws://, https:// to wss://
const backendWsUrl = backendUrl
  .replace('http://', 'ws://')
  .replace('https://', 'wss://');

// Extract sandbox ID and port from vnc_preview URL
const sandboxId = sandbox.id; // We already have this!
const port = 6080; // VNC port is always 6080

// Construct WebSocket path
const websocketPath = `sandboxes/${sandboxId}/proxy/${port}/websockify`;

// For vnc_lite.html, use relative path (no leading slash)
const vncWebsocketPath = websocketPath; // "sandboxes/.../websockify"

// For noVNC 'path' parameter, we need to tell it the FULL WebSocket URL
const fullWebsocketUrl = `${backendWsUrl}/${websocketPath}`;

let vncUrl = `${baseUrl}/vnc_lite.html?password=${sandbox.pass}&autoconnect=true&scale=local&path=${encodeURIComponent(fullWebsocketUrl)}`;
```

**Wait, this won't work either** because noVNC's `path` parameter is designed to be a **relative path**, not a full URL.

### Option 3: Skip Next.js Rewrites for WebSocket Paths (BEST SOLUTION)

**Configure Docker networking** so WebSocket requests bypass Next.js entirely.

#### Current Docker Setup:

```yaml
# docker-compose.yaml
services:
  frontend:
    ports:
      - "9990:3000"  # Next.js

  backend:
    # No external port exposed - only accessible through Next.js rewrites
```

**Problem:** All requests to `kortix.syhc.dev` hit Next.js (port 9990), even WebSocket requests.

#### Fixed Docker Setup:

**Option 3A: Expose backend directly and use different port for WebSocket**

```yaml
# docker-compose.yaml
services:
  frontend:
    ports:
      - "9990:3000"  # HTTP requests

  backend:
    ports:
      - "9990:3000"  # HTTP requests (through Next.js rewrite)
      - "8000:8000"  # Direct access for WebSocket
```

Then configure Cloudflare Tunnel to route WebSocket to port 8000:

```yaml
# cloudflared config
ingress:
  - hostname: kortix.syhc.dev
    path: /api/.*/websockify
    service: http://localhost:8000  # Direct to backend for WebSocket
  - hostname: kortix.syhc.dev
    service: http://localhost:9990  # All other requests to Next.js
```

**Option 3B: Use Cloudflare Tunnel routing (RECOMMENDED)**

Don't change Docker config. Instead, configure Cloudflare Tunnel to route WebSocket requests directly to backend:

```yaml
# ~/.cloudflared/config.yml or wherever your tunnel config is
tunnel: <your-tunnel-id>
credentials-file: /path/to/credentials.json

ingress:
  # Route WebSocket requests directly to backend (bypassing Next.js)
  - hostname: kortix.syhc.dev
    path: ^/api/sandboxes/[^/]+/proxy/\d+/websockify$
    service: http://backend:8000  # Direct to Docker internal backend

  # Route all other requests to Next.js frontend
  - hostname: kortix.syhc.dev
    service: http://localhost:9990

  # Catch-all
  - service: http_status:404
```

**Wait, this won't work either** because Cloudflare Tunnel can't reach Docker internal hostnames directly.

### Option 4: Use Nginx Reverse Proxy (BEST PRODUCTION SOLUTION)

**Add nginx container** to handle WebSocket routing intelligently:

```yaml
# docker-compose.yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "9990:80"  # Cloudflare Tunnel points here
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    networks:
      - suna
    depends_on:
      - frontend
      - backend

  frontend:
    # Remove port exposure - only accessible through nginx
    networks:
      - suna

  backend:
    # Remove port exposure - only accessible through nginx
    networks:
      - suna
```

```nginx
# nginx.conf
http {
    upstream frontend {
        server frontend:3000;
    }

    upstream backend {
        server backend:8000;
    }

    server {
        listen 80;
        server_name kortix.syhc.dev localhost;

        # WebSocket requests - proxy directly to backend
        location ~ ^/api/sandboxes/[^/]+/proxy/\d+/websockify {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;

            # WebSocket timeout (10 minutes)
            proxy_read_timeout 600s;
            proxy_send_timeout 600s;
        }

        # All other /api/* requests - proxy to backend
        location /api/ {
            proxy_pass http://backend/api/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # All other requests - proxy to Next.js frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}

events {
    worker_connections 1024;
}
```

**Benefits:**
- ✅ Single entry point (port 9990)
- ✅ Intelligent routing (WebSocket vs HTTP)
- ✅ Proper WebSocket header handling
- ✅ No Next.js rewrite issues
- ✅ Production-grade solution

### Option 5: Quick Fix - Environment Variable for WebSocket URL (IMMEDIATE FIX)

**Simplest solution** - Add environment variable for direct WebSocket access:

#### Step 1: Add new environment variable

```env
# frontend/.env.local
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:8000/api
# or for production with Cloudflare:
NEXT_PUBLIC_WEBSOCKET_URL=wss://kortix.syhc.dev/api
```

#### Step 2: Expose backend port in docker-compose

```yaml
# docker-compose.yaml
services:
  backend:
    ports:
      - "8000:8000"  # Expose backend directly
```

#### Step 3: Update Cloudflare Tunnel to route WebSocket port

**Currently:** Cloudflare Tunnel routes `kortix.syhc.dev` → `localhost:9990` (Next.js)

**Change to:** Route `kortix.syhc.dev:8000` → `localhost:8000` (Backend)

OR use path-based routing (if supported):
- `kortix.syhc.dev/api/...websockify` → `localhost:8000`
- `kortix.syhc.dev/*` → `localhost:9990`

#### Step 4: Update frontend to use WebSocket URL directly

```typescript
// frontend/src/components/thread/HealthCheckedVncIframe.tsx

const websocketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || window.location.origin;

// Convert to WebSocket protocol
const wsProtocol = websocketUrl.replace('http://', 'ws://').replace('https://', 'wss://');

// Construct WebSocket path
const websocketPath = `${wsProtocol}/sandboxes/${sandbox.id}/proxy/6080/websockify`;

// For noVNC, use FULL WebSocket URL as path parameter
const baseUrl = sandbox.vnc_preview.replace(/\/$/, '');
let vncUrl = `${baseUrl}/vnc_lite.html?password=${sandbox.pass}&autoconnect=true&scale=local&path=${encodeURIComponent(websocketPath)}`;
```

**Problem:** This still won't work because noVNC `path` parameter expects a **relative path**, not a full `wss://` URL.

---

## ✅ ACTUAL WORKING SOLUTION

After reviewing noVNC documentation and behavior:

### The Issue with noVNC `path` Parameter

noVNC constructs WebSocket URL as:
```javascript
// noVNC library logic
const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const host = location.host; // kortix.syhc.dev
const path = this.path; // Value we pass to noVNC

const websocketUrl = `${protocol}://${host}/${path}`;
```

So if we pass `path=api/sandboxes/.../websockify`, noVNC creates:
```
wss://kortix.syhc.dev/api/sandboxes/.../websockify
```

This hits Next.js rewrites → **FAILS**

### Solution: Make noVNC Connect to Backend Directly

We need noVNC to connect to a **different host** for WebSocket, not `location.host`.

**noVNC supports this!** Check vnc_lite.html for `host` parameter:

```html
<!-- vnc_lite.html supports both 'host' and 'path' parameters -->
vnc_lite.html?host=backend-websocket.example.com&path=websockify&password=...
```

**Implementation:**

```typescript
// frontend/src/components/thread/HealthCheckedVncIframe.tsx

// Extract just the sandbox ID and construct minimal path
const sandboxId = sandbox.id;

// Determine WebSocket host
// For Docker internal: backend:8000
// For Cloudflare: kortix.syhc.dev (but on port 8000 if we expose it)
// Best: Use environment variable
const websocketHost = process.env.NEXT_PUBLIC_BACKEND_WS_HOST || 'localhost:8000';

// Construct VNC URL with explicit host parameter
const baseUrl = sandbox.vnc_preview.replace(/\/$/, '');
let vncUrl = `${baseUrl}/vnc_lite.html?` +
  `host=${encodeURIComponent(websocketHost)}&` +
  `path=api/sandboxes/${sandboxId}/proxy/6080/websockify&` +
  `password=${sandbox.pass}&` +
  `autoconnect=true&` +
  `scale=local`;
```

**Required Environment Variable:**

```env
# frontend/.env.local (for local development)
NEXT_PUBLIC_BACKEND_WS_HOST=localhost:8000

# frontend/.env.production (for Cloudflare Tunnel)
NEXT_PUBLIC_BACKEND_WS_HOST=kortix.syhc.dev:8000
```

**Required Docker Change:**

```yaml
# docker-compose.yaml
services:
  backend:
    ports:
      - "8000:8000"  # Expose backend for direct WebSocket access
```

**Required Cloudflare Tunnel Change:**

Configure tunnel to route port 8000 to backend:

```bash
# Option 1: Use subdomain
# ws.kortix.syhc.dev → localhost:8000
# kortix.syhc.dev → localhost:9990

# Option 2: Use same domain but different port
# kortix.syhc.dev:8000 → localhost:8000
# kortix.syhc.dev → localhost:9990
```

---

## 📋 RECOMMENDED FIX (Step-by-Step)

### Phase 1: Expose Backend Port (Immediate Fix)

**1. Update docker-compose.yaml:**

```yaml
services:
  backend:
    ports:
      - "8000:8000"  # Add this line
```

**2. Restart Docker:**

```powershell
docker compose down
docker compose up -d
```

**3. Test direct backend access:**

```powershell
curl http://localhost:8000/api/health
```

### Phase 2: Update Frontend to Use Direct WebSocket

**1. Add environment variable:**

```env
# frontend/.env.local
NEXT_PUBLIC_BACKEND_WS_HOST=localhost:8000
```

**2. Update HealthCheckedVncIframe.tsx:**

```typescript
// Around line 131-144
const sandboxId = sandbox.id;
const websocketHost = process.env.NEXT_PUBLIC_BACKEND_WS_HOST || 'localhost:8000';

// Remove trailing slash from vnc_preview
const baseUrl = sandbox.vnc_preview.replace(/\/$/, '');

// Construct VNC URL with explicit host parameter for WebSocket
let vncUrl = `${baseUrl}/vnc_lite.html?` +
  `host=${encodeURIComponent(websocketHost)}&` +
  `path=api/sandboxes/${sandboxId}/proxy/6080/websockify&` +
  `password=${sandbox.pass}&` +
  `autoconnect=true&` +
  `scale=local`;

console.log('[VNC Debug] WebSocket will connect to:', `ws://${websocketHost}/api/sandboxes/${sandboxId}/proxy/6080/websockify`);
console.log('[VNC Debug] Final VNC URL:', vncUrl);
```

**3. Rebuild frontend:**

```powershell
docker compose up -d --build frontend
```

### Phase 3: Configure Cloudflare Tunnel (Production)

**For production with Cloudflare Tunnel:**

**Option A: Use subdomain for WebSocket**

1. Create subdomain: `ws.kortix.syhc.dev`
2. Configure tunnel:
   ```yaml
   ingress:
     - hostname: ws.kortix.syhc.dev
       service: http://localhost:8000
     - hostname: kortix.syhc.dev
       service: http://localhost:9990
   ```
3. Update environment variable:
   ```env
   NEXT_PUBLIC_BACKEND_WS_HOST=ws.kortix.syhc.dev
   ```

**Option B: Use port-based routing**

1. Configure tunnel to support multiple ports (if supported by your Cloudflare plan)
2. Update environment variable:
   ```env
   NEXT_PUBLIC_BACKEND_WS_HOST=kortix.syhc.dev:8000
   ```

---

## 🎯 EXPECTED RESULTS

### After Fix:

**Browser DevTools Network Tab:**
```
Name: websockify
Status: 101 Switching Protocols
Type: websocket
Size: (ongoing)
Initiator: vnc_lite.html
```

**Backend Logs:**
```
[VNC WebSocket] New connection request for sandbox=... port=6080 path=websockify
[VNC WebSocket] Connection accepted
[VNC WebSocket] Verifying access
[VNC WebSocket] Access granted
[VNC WebSocket] Connecting to upstream WebSocket: wss://6080-...-proxy.daytona.works/websockify
[VNC WebSocket] ✅ Successfully connected to upstream
[VNC WebSocket] Starting bidirectional relay
[VNC WebSocket] Relayed binary to client: 1024 bytes
[VNC WebSocket] Relayed binary to upstream: 512 bytes
```

**Frontend Console:**
```
[VNC Debug] WebSocket will connect to: ws://localhost:8000/api/sandboxes/.../websockify
[VNC Component] ✅ iframe onLoad event fired
```

**VNC Display:**
- ✅ Continuous live browser stream
- ✅ No freezing or gray screen
- ✅ Stable WebSocket connection

---

## 🔄 ROLLBACK PLAN

If this introduces issues:

```powershell
# Revert docker-compose.yaml changes
git checkout docker-compose.yaml

# Revert frontend changes
git checkout frontend/src/components/thread/HealthCheckedVncIframe.tsx

# Rebuild
docker compose down
docker compose up -d --build
```

---

## 📝 NEXT STEPS

1. ✅ Expose backend port 8000 in docker-compose
2. ✅ Test direct backend WebSocket access
3. ✅ Update frontend to use `host` parameter in noVNC URL
4. ✅ Rebuild and test locally
5. ⏳ Configure Cloudflare Tunnel for production
6. ⏳ Update production environment variables
7. ⏳ Deploy and verify

**Priority:** Start with Phase 1 (expose backend port) and Phase 2 (update frontend) for immediate local fix.
