# VNC WebSocket - Immediate Fix (Simpler Solution)

## 🎯 ROOT CAUSE (Confirmed)

**Next.js rewrites in `next.config.ts` do NOT support WebSocket protocol upgrades**

```typescript
// frontend/next.config.ts lines 38-41
{
  source: '/api/:path*',
  destination: `${backendUrl}/:path*`,  // This breaks WebSocket!
}
```

## ✅ IMMEDIATE FIX (3 Steps)

### Step 1: Remove `/api/` Rewrite from Next.js Config

**Edit:** `frontend/next.config.ts`

**Change:**
```typescript
async rewrites() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:8888'
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://backend:8000/api'

  return [
    // ❌ REMOVE THIS - it breaks WebSocket
    // {
    //   source: '/api/:path*',
    //   destination: `${backendUrl}/:path*`,
    // },

    // ✅ KEEP Supabase rewrites (they work fine)
    {
      source: '/auth/v1/:path*',
      destination: `${supabaseUrl}/auth/v1/:path*`,
    },
    {
      source: '/rest/v1/:path*',
      destination: `${supabaseUrl}/rest/v1/:path*`,
    },
    {
      source: '/storage/v1/:path*',
      destination: `${supabaseUrl}/storage/v1/:path*`,
    },
    {
      source: '/realtime/v1/:path*',
      destination: `${supabaseUrl}/realtime/v1/:path*`,
    },

    // PostHog analytics proxying (keep as is)
    {
      source: '/ingest/static/:path*',
      destination: 'https://eu-assets.i.posthog.com/static/:path*',
    },
    {
      source: '/ingest/:path*',
      destination: 'https://eu.i.posthog.com/:path*',
    },
  ]
},
```

### Step 2: Expose Backend Port in Docker

**Edit:** `docker-compose.yaml`

**Change:**
```yaml
services:
  backend:
    # ... existing config ...
    ports:
      - "8000:8000"  # Add this line to expose backend directly
```

### Step 3: Configure Cloudflare Tunnel to Route `/api/` to Backend

**Your Cloudflare Tunnel needs to route two destinations:**

**Option A: Path-based routing (if supported)**

```yaml
# ~/.cloudflared/config.yml
tunnel: <your-tunnel-id>
credentials-file: /path/to/credentials.json

ingress:
  # Route /api/* directly to backend (bypassing Next.js)
  - hostname: kortix.syhc.dev
    path: /api/.*
    service: http://localhost:8000

  # Route everything else to Next.js frontend
  - hostname: kortix.syhc.dev
    service: http://localhost:9990

  # Catch-all
  - service: http_status:404
```

**Option B: Subdomain routing (more reliable)**

Use `api.kortix.syhc.dev` for backend:

```yaml
# ~/.cloudflared/config.yml
tunnel: <your-tunnel-id>
credentials-file: /path/to/credentials.json

ingress:
  # Backend API on subdomain
  - hostname: api.kortix.syhc.dev
    service: http://localhost:8000

  # Frontend on main domain
  - hostname: kortix.syhc.dev
    service: http://localhost:9990

  # Catch-all
  - service: http_status:404
```

Then update frontend to use subdomain:

```env
# frontend/.env.local (local)
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000/api

# frontend/.env.production (Cloudflare)
NEXT_PUBLIC_BACKEND_URL=https://api.kortix.syhc.dev/api
```

**Restart Cloudflare Tunnel:**

```powershell
# Find and restart cloudflared process
# or if using systemd:
sudo systemctl restart cloudflared
```

### Step 4: Rebuild Frontend

```powershell
cd /home/user/suna
docker compose down
docker compose up -d --build
```

---

## 🧪 TESTING THE FIX

### Test 1: Verify Backend Direct Access

```powershell
# Should return backend health status
curl http://localhost:8000/api/health
```

Expected response:
```json
{"status": "healthy"}
```

### Test 2: Test Through Cloudflare Tunnel

```powershell
# Should return backend health status through tunnel
curl https://kortix.syhc.dev/api/health
# or
curl https://api.kortix.syhc.dev/api/health
```

### Test 3: Check Browser Network Tab

1. Open Kortix in browser: `https://kortix.syhc.dev`
2. Navigate to VNC view
3. Open DevTools → Network tab → Filter: WS
4. Look for `websockify` connection

**Expected (success):**
```
Name: websockify
Status: 101 Switching Protocols
Type: websocket
Initiator: vnc_lite.html
```

**Previous (failure):**
```
Name: websockify
Status: 502 Bad Gateway
or
Status: (failed)
```

### Test 4: Check Backend Logs

```powershell
docker compose logs backend --tail=50 -f
```

**Expected logs when VNC connects:**
```
[VNC WebSocket] New connection request for sandbox=... port=6080 path=websockify
[VNC WebSocket] Connection accepted
[VNC WebSocket] Verifying access for sandbox=...
[VNC WebSocket] Access granted
[VNC WebSocket] Connecting to upstream WebSocket: wss://6080-...-proxy.daytona.works/websockify
[VNC WebSocket] ✅ Successfully connected to upstream
[VNC WebSocket] Starting bidirectional relay for sandbox=...
[VNC WebSocket] Relayed binary to client: 1024 bytes (total: 1 msgs, 1024 bytes)
```

---

## 🎯 WHY THIS WORKS

### Before (Broken):

```
Browser → wss://kortix.syhc.dev/api/sandboxes/.../websockify
    ↓
Cloudflare Tunnel → http://localhost:9990/api/...
    ↓
Next.js Server (port 9990)
    ↓
Next.js rewrites() tries to proxy to backend
    ↓
❌ WebSocket upgrade fails (rewrites don't support protocol switching)
    ↓
No backend logs, gray screen
```

### After (Fixed):

```
Browser → wss://kortix.syhc.dev/api/sandboxes/.../websockify
    ↓
Cloudflare Tunnel → http://localhost:8000/api/...
    ↓
Backend FastAPI (port 8000) directly
    ↓
WebSocket endpoint: /api/sandboxes/{id}/proxy/{port}/websockify
    ↓
✅ WebSocket upgrade succeeds
    ↓
Backend logs appear, VNC streams continuously
```

**Key difference:** `/api/` requests now **bypass Next.js entirely**, going straight from Cloudflare to backend.

---

## 📋 CHANGES SUMMARY

### Files Modified:

1. **`frontend/next.config.ts`**
   - Removed: `/api/:path*` rewrite rule
   - Reason: Next.js rewrites break WebSocket

2. **`docker-compose.yaml`**
   - Added: `ports: ["8000:8000"]` to backend service
   - Reason: Expose backend for direct access

3. **Cloudflare Tunnel Config**
   - Added: Route for `/api/*` or `api.kortix.syhc.dev` to `localhost:8000`
   - Reason: Direct backend access for API and WebSocket

### Environment Variables (if using subdomain):

```env
# frontend/.env.production
NEXT_PUBLIC_BACKEND_URL=https://api.kortix.syhc.dev/api
```

---

## 🔄 ROLLBACK PLAN

If this causes issues:

### Revert Next.js Config:

```typescript
// frontend/next.config.ts
{
  source: '/api/:path*',
  destination: `${backendUrl}/:path*`,
},
```

### Remove Backend Port Exposure:

```yaml
# docker-compose.yaml
services:
  backend:
    # Remove or comment out:
    # ports:
    #   - "8000:8000"
```

### Revert Cloudflare Tunnel Config:

```yaml
# Single route to Next.js
ingress:
  - hostname: kortix.syhc.dev
    service: http://localhost:9990
  - service: http_status:404
```

### Rebuild:

```powershell
docker compose down
docker compose up -d --build
```

---

## 🚀 PRODUCTION DEPLOYMENT NOTES

### For Cloudflare Tunnel:

**Option 1: Path-based routing** (simpler, but may not support WebSocket well)
- Keep `kortix.syhc.dev` for both
- Route `/api/*` to backend
- Route everything else to frontend

**Option 2: Subdomain routing** (recommended, more reliable)
- `api.kortix.syhc.dev` → backend (port 8000)
- `kortix.syhc.dev` → frontend (port 9990)
- Update `NEXT_PUBLIC_BACKEND_URL` environment variable

### CORS Configuration:

If using subdomain, you may need to update CORS in backend:

```python
# backend/api.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:9990",
        "https://kortix.syhc.dev",
        "https://api.kortix.syhc.dev",  # Add this
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## ✅ SUCCESS CRITERIA

After implementing this fix, you should see:

1. ✅ VNC connects immediately (no gray screen)
2. ✅ Backend WebSocket logs appear
3. ✅ Browser DevTools shows `101 Switching Protocols`
4. ✅ Continuous live stream (no freezing)
5. ✅ Mouse and keyboard input work in VNC
6. ✅ Direct URL access still works
7. ✅ iframe embedded access now works too

**This fix addresses the root cause:** Next.js rewrites cannot handle WebSocket protocol upgrades. By routing `/api/` directly to backend (bypassing Next.js), WebSocket connections work properly.
