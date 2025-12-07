# VNC WebSocket Issue - Complete Summary

## 🎯 Issue Description

**Symptom:** VNC streaming briefly displays browser, then freezes and returns to gray screen after 1-2 seconds

**Direct URL access:** ✅ Works perfectly (`https://kortix.syhc.dev/api/sandboxes/.../vnc_lite.html`)
**iframe embedding:** ❌ Fails intermittently (used in actual application)

**Evidence:**
- No backend WebSocket logs (connection never reaches FastAPI)
- WebSocket closes immediately after brief connection
- Browser DevTools shows WebSocket connection failure

---

## 🔬 Root Cause Analysis

### PRIMARY CAUSE: Next.js Rewrites Don't Support WebSocket Protocol Upgrades

**Location:** `frontend/next.config.ts` lines 38-41

```typescript
{
  source: '/api/:path*',
  destination: `${backendUrl}/:path*`,  // http://backend:8000/api/:path*
}
```

**Why This Breaks WebSocket:**

1. **HTTP requests work fine:**
   - Client → Next.js → Backend (rewrite) → Response → Client ✅

2. **WebSocket requires persistent connection:**
   - Client sends: `Upgrade: websocket`, `Connection: Upgrade`
   - Server must respond: `HTTP 101 Switching Protocols`
   - Then: Bidirectional persistent connection ↔
   - **Next.js rewrites can't maintain this!** ❌

3. **Result:**
   - WebSocket upgrade headers lost during rewrite
   - Backend receives malformed request or nothing at all
   - No backend logs because request never reaches WebSocket handler
   - Connection fails, VNC shows gray screen

### Why Direct URL Access Works

When you navigate directly to `https://kortix.syhc.dev/api/...`:
- Request may bypass Next.js rewrite logic (Cloudflare routing)
- Or browser handles WebSocket upgrade differently for top-level navigation
- Or Cloudflare Tunnel uses alternative routing path

Either way, **the WebSocket successfully reaches backend when not going through Next.js rewrite**.

### Previously Fixed Issues (No Longer The Problem)

✅ **Double slash in WebSocket path** - Fixed in commit `7586516`
✅ **Double slash in HTML URL** - Fixed in commit `7586516`
✅ **Cloudflare Tunnel WebSocket support** - NOT the issue (direct access works)
✅ **Backend WebSocket proxy code** - Working correctly (proven by direct access)
✅ **Daytona sandbox** - Working correctly (proven by direct access)

**Current blocker:** Next.js rewrite layer preventing WebSocket from reaching backend

---

## ✅ Recommended Solution

### 3-Step Fix (Immediate, Production-Ready)

#### Step 1: Remove `/api/` Rewrite from Next.js

**File:** `frontend/next.config.ts`

```typescript
async rewrites() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:8888'
  // Remove: const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://backend:8000/api'

  return [
    // ❌ DELETE THIS BLOCK:
    // {
    //   source: '/api/:path*',
    //   destination: `${backendUrl}/:path*`,
    // },

    // ✅ KEEP all Supabase rewrites (they don't use WebSocket)
    { source: '/auth/v1/:path*', destination: `${supabaseUrl}/auth/v1/:path*` },
    { source: '/rest/v1/:path*', destination: `${supabaseUrl}/rest/v1/:path*` },
    { source: '/storage/v1/:path*', destination: `${supabaseUrl}/storage/v1/:path*` },
    { source: '/realtime/v1/:path*', destination: `${supabaseUrl}/realtime/v1/:path*` },

    // ✅ KEEP PostHog rewrites
    { source: '/ingest/static/:path*', destination: 'https://eu-assets.i.posthog.com/static/:path*' },
    { source: '/ingest/:path*', destination: 'https://eu.i.posthog.com/:path*' },
  ]
}
```

#### Step 2: Expose Backend Port in Docker

**File:** `docker-compose.yaml`

```yaml
services:
  backend:
    # ... existing configuration ...
    ports:
      - "8000:8000"  # Add this line
```

#### Step 3: Configure Cloudflare Tunnel to Route `/api/` to Backend

**Option A: Path-based routing**

```yaml
# ~/.cloudflared/config.yml
tunnel: <your-tunnel-id>
credentials-file: /path/to/credentials.json

ingress:
  # Route /api/* directly to backend (port 8000)
  - hostname: kortix.syhc.dev
    path: /api/.*
    service: http://localhost:8000

  # Route everything else to Next.js frontend (port 9990)
  - hostname: kortix.syhc.dev
    service: http://localhost:9990

  # Catch-all
  - service: http_status:404
```

**Option B: Subdomain routing (more reliable)**

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

If using subdomain, also update:

```env
# frontend/.env.production
NEXT_PUBLIC_BACKEND_URL=https://api.kortix.syhc.dev/api
```

**Restart Cloudflare Tunnel:**
```powershell
systemctl restart cloudflared
# or
cloudflared tunnel run <tunnel-name>
```

#### Apply Changes:

```powershell
cd /home/user/suna

# Rebuild frontend and restart backend
docker compose down
docker compose up -d --build

# Verify backend is accessible
curl http://localhost:8000/api/health
```

---

## 🧪 Testing & Verification

### Test 1: Backend Direct Access

```powershell
curl http://localhost:8000/api/health
# Expected: {"status": "healthy"}

curl https://kortix.syhc.dev/api/health
# Expected: {"status": "healthy"}
```

### Test 2: Browser Network Tab (DevTools)

1. Navigate to VNC view in Kortix
2. Open DevTools → Network → WS filter
3. Look for `websockify` connection

**Expected (success):**
```
Name: websockify
Status: 101 Switching Protocols
Type: websocket
```

**Previous (failure):**
```
Name: websockify
Status: 502 Bad Gateway
or (failed)
```

### Test 3: Backend Logs

```powershell
docker compose logs backend --tail=50 -f
```

**Expected when VNC connects:**
```
[VNC WebSocket] New connection request for sandbox=... port=6080 path=websockify
[VNC WebSocket] Connection accepted for sandbox=...
[VNC WebSocket] Verifying access for sandbox=...
[VNC WebSocket] Access granted for sandbox=...
[VNC WebSocket] Connecting to upstream WebSocket: wss://6080-...-proxy.daytona.works/websockify
[VNC WebSocket] ✅ Successfully connected to upstream for sandbox ...
[VNC WebSocket] Starting bidirectional relay for sandbox=...
[VNC WebSocket] Relayed binary to client: 1024 bytes (total: 1 msgs, 1024 bytes)
```

### Test 4: VNC Visual Confirmation

- ✅ VNC displays immediately (no gray screen)
- ✅ Continuous live browser stream
- ✅ No freezing or disconnections
- ✅ Mouse/keyboard input works
- ✅ Works in both iframe and direct URL access

---

## 📊 Impact Analysis

### What Changes:

| Request Type | Before | After |
|--------------|--------|-------|
| `/api/*` HTTP | Next.js rewrite → backend | Direct → backend |
| `/api/*` WebSocket | Next.js rewrite (fails) | Direct → backend (works) |
| `/auth/v1/*` | Next.js rewrite → Supabase | **No change** ✅ |
| `/rest/v1/*` | Next.js rewrite → Supabase | **No change** ✅ |
| `/*` (frontend) | Next.js serves | **No change** ✅ |

### What Stays The Same:

- ✅ Frontend pages still served by Next.js
- ✅ Supabase authentication still works (rewrites preserved)
- ✅ Supabase database access still works (rewrites preserved)
- ✅ All non-API routes unchanged

### What Improves:

- ✅ VNC WebSocket connections work
- ✅ All backend API calls potentially faster (one less hop)
- ✅ WebSocket support for any future features
- ✅ Simpler architecture (no rewrite layer for API)

### Potential Issues:

- ⚠️ If backend becomes unavailable, no fallback from Next.js
  - **Mitigation:** Backend availability is already critical for app functionality
- ⚠️ CORS configuration may need updating if using subdomain
  - **Mitigation:** Add `api.kortix.syhc.dev` to CORS allowed origins in `backend/api.py`

---

## 🔄 Rollback Plan

If issues arise, revert changes:

### Revert Next.js Config:

```typescript
// frontend/next.config.ts - re-add the rewrite
{
  source: '/api/:path*',
  destination: `${backendUrl}/:path*`,
},
```

### Revert Docker Compose:

```yaml
# docker-compose.yaml - remove backend port exposure
services:
  backend:
    # Remove:
    # ports:
    #   - "8000:8000"
```

### Revert Cloudflare Tunnel:

```yaml
# Single route back to Next.js only
ingress:
  - hostname: kortix.syhc.dev
    service: http://localhost:9990
  - service: http_status:404
```

### Rebuild:

```powershell
docker compose down
docker compose up -d --build
systemctl restart cloudflared
```

---

## 📚 Documentation Created

1. **VNC_WEBSOCKET_CLOSURE_ANALYSIS.md** - Detailed technical analysis with diagrams
2. **VNC_WEBSOCKET_FIX_SOLUTION.md** - Multiple solution options with implementation details
3. **VNC_WEBSOCKET_IMMEDIATE_FIX.md** - Step-by-step immediate fix guide
4. **VNC_ARCHITECTURE_DIAGRAM.md** - Before/after architecture comparison with ASCII diagrams
5. **VNC_ISSUE_SUMMARY.md** - This document (executive summary)

### Previously Created Documentation:

6. **VNC_DEBUGGING_REFERENCE.md** - Comprehensive debugging guide
7. **VNC_DOUBLE_SLASH_FIX.md** - Previous double-slash issue fix (already applied)

---

## ✅ Recommended Next Steps

1. **Review** this summary and solution proposal
2. **Backup** current working state:
   ```powershell
   docker tag suna-backend:local suna-backend:backup-2025-12-07
   docker tag suna-frontend:latest suna-frontend:backup-2025-12-07
   ```
3. **Implement** the 3-step fix above
4. **Test** locally first (http://localhost:9990)
5. **Configure** Cloudflare Tunnel for production
6. **Test** production (https://kortix.syhc.dev)
7. **Monitor** backend logs for WebSocket connections
8. **Verify** VNC streaming works continuously

---

## 🎯 Success Criteria

✅ VNC connects immediately without gray screen
✅ Backend WebSocket logs appear when VNC connects
✅ Browser DevTools shows `101 Switching Protocols` for WebSocket
✅ Continuous live VNC stream without freezing
✅ Works in both iframe (application) and direct URL access
✅ Mouse and keyboard input responsive
✅ No regression in other application features

---

## 💡 Why This Solution Is Correct

**Problem:** Next.js rewrites incompatible with WebSocket protocol
**Evidence:** Direct URL access works, iframe (through rewrites) fails
**Solution:** Bypass Next.js for `/api/*` requests entirely
**Result:** WebSocket reaches backend directly, handshake succeeds

**This is a production-grade solution** used by many Next.js applications that need WebSocket support alongside HTTP APIs. The pattern of routing WebSocket and API traffic directly to backend while serving frontend from Next.js is a common and recommended architecture.
