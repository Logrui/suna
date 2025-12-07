# VNC WebSocket Fix - Two Approaches Comparison

## Pattern You're Referring To: Supabase Realtime Direct Connection

**File:** `frontend/src/lib/supabase/realtime-client.ts`

**Pattern:**
```typescript
// Lines 7, 29-33
// 1. Connects directly to Kong (bypasses Next.js HTTP proxy)

const realtimeUrl =
    process.env.NEXT_PUBLIC_REALTIME_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'http://localhost:8888';

realtimeClientInstance = createSupabaseClient(
    realtimeUrl,  // Direct connection to Supabase Kong, bypassing Next.js
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { ... }
);
```

**Why it bypasses Next.js:**
- Uses `NEXT_PUBLIC_REALTIME_URL` environment variable
- Points directly to Supabase Kong: `http://supabase-kong:8000` (Docker) or `https://kortix.syhc.dev` (Cloudflare)
- WebSocket connections go: Browser → Supabase Kong (direct)
- **No Next.js rewrites involved** ✅

---

## Approach 1: My Original Plan (Backend Proxy Pattern)

### Architecture:
```
Browser (iframe) → wss://kortix.syhc.dev/api/sandboxes/.../websockify
    ↓
Cloudflare Tunnel → localhost:8000 (Backend directly)
    ↓
Backend FastAPI WebSocket Proxy (/api/sandboxes/{id}/proxy/{port}/websockify)
    ↓
Daytona WebSocket (wss://6080-{sandbox-id}.proxy.daytona.works/websockify)
```

### Implementation:
1. Remove `/api/` rewrite from Next.js config
2. Expose backend port 8000
3. Configure Cloudflare to route `/api/*` to backend
4. **Backend still proxies to Daytona** (maintains our proxy layer)

### Pros:
- ✅ Backend maintains control (authentication, logging, metrics)
- ✅ Can inject headers (X-Daytona-Skip-Preview-Warning)
- ✅ Single authentication point
- ✅ Can add rate limiting, abuse prevention
- ✅ Backend logs all WebSocket traffic
- ✅ Consistent with current architecture

### Cons:
- ⚠️ Backend becomes critical path for VNC (if backend down, VNC fails)
- ⚠️ Requires Cloudflare Tunnel reconfiguration
- ⚠️ Extra hop (Browser → Backend → Daytona)

---

## Approach 2: Direct Daytona Connection (Realtime Pattern)

### Architecture:
```
Browser (iframe) → wss://6080-{sandbox-id}.proxy.daytona.works/websockify
    ↓
Daytona WebSocket (direct connection, no backend proxy)
```

### Implementation:
1. Frontend gets sandbox info from backend (HTTP request)
2. Frontend extracts Daytona direct URL: `https://6080-{sandbox-id}.proxy.daytona.works/`
3. Frontend connects VNC **directly to Daytona** (bypasses backend proxy entirely)
4. Use Daytona token for authentication

### Code Changes:

**`frontend/src/components/thread/HealthCheckedVncIframe.tsx`:**
```typescript
// Instead of using sandbox.vnc_preview (proxy URL):
// const vncUrl = sandbox.vnc_preview; // https://kortix.syhc.dev/api/sandboxes/.../proxy/6080/

// Use direct Daytona URL:
const daytonaDirectUrl = `https://6080-${sandbox.id}.proxy.daytona.works/`;

// Construct VNC URL with direct Daytona connection
const vncUrl = `${daytonaDirectUrl}vnc_lite.html?` +
  `password=${sandbox.pass}&` +
  `token=${sandbox.token}&` +  // Daytona auth token
  `autoconnect=true&` +
  `scale=local&` +
  `path=websockify`;  // Relative path, noVNC will use same origin

// WebSocket will connect to: wss://6080-{sandbox-id}.proxy.daytona.works/websockify
```

**Backend changes:**
```python
# backend/core/agent_runs.py
# Already provides sandbox.token from Daytona
# Just need to ensure frontend receives it

sandbox_data = {
    'id': sandbox_id,
    'pass': sandbox_pass,
    'vnc_preview': vnc_url,  # Keep for backward compatibility
    'sandbox_url': website_url,
    'token': token,  # ✅ Already provided!
    'daytona_direct_vnc': f"https://6080-{sandbox_id}.proxy.daytona.works/",  # Add this
}
```

### Pros:
- ✅ **NO Next.js rewrite issues** (bypasses Next.js entirely)
- ✅ **NO backend proxy needed** (one less hop)
- ✅ **NO Cloudflare Tunnel changes** (direct to Daytona)
- ✅ Faster (direct connection)
- ✅ Backend downtime doesn't affect VNC
- ✅ Simpler architecture for VNC streaming
- ✅ **Matches existing Supabase Realtime pattern**

### Cons:
- ❌ Backend loses visibility (no WebSocket logs)
- ❌ Can't inject headers or middleware
- ❌ Daytona token exposed to frontend (security consideration)
- ❌ No centralized authentication/authorization
- ❌ Harder to add rate limiting or abuse prevention

---

## Comparison Table

| Aspect | Approach 1: Backend Proxy | Approach 2: Direct Daytona |
|--------|---------------------------|----------------------------|
| **WebSocket Path** | Through backend | Direct to Daytona |
| **Next.js Rewrites** | Must remove | No changes needed ✅ |
| **Cloudflare Config** | Requires changes | No changes needed ✅ |
| **Backend Logs** | Full visibility ✅ | No visibility ❌ |
| **Security Control** | Backend enforces ✅ | Daytona token only ⚠️ |
| **Latency** | +1 hop (backend) | Direct (faster) ✅ |
| **Code Changes** | Frontend + Backend + Infra | Frontend only ✅ |
| **Failure Mode** | Backend down = VNC fails | Backend down = VNC works ✅ |
| **Architecture Consistency** | Custom proxy pattern | Matches Realtime pattern ✅ |
| **Implementation Effort** | Medium-High (3 steps) | Low (frontend only) ✅ |

---

## Recommendation

### **Use Approach 2: Direct Daytona Connection (Realtime Pattern)**

**Rationale:**
1. ✅ **Matches existing pattern** - Your codebase already uses this pattern for Supabase Realtime
2. ✅ **Simpler implementation** - Frontend-only changes, no infrastructure changes
3. ✅ **No Next.js issues** - Completely bypasses the problematic rewrite layer
4. ✅ **Faster** - Direct connection, no extra hop through backend
5. ✅ **More resilient** - Backend downtime doesn't affect VNC
6. ✅ **No Cloudflare changes** - Works with existing tunnel configuration

**Security Note:**
- Daytona token is already exposed to frontend (it's in sandbox_data)
- Daytona handles authentication via token
- Backend still controls sandbox creation (authentication happens there)
- VNC password provides additional security layer

---

## Implementation Plan: Approach 2 (Direct Daytona)

### Step 1: Update Backend to Provide Direct Daytona URL

**File:** `backend/core/agent_runs.py` (around line 485)

```python
# After getting token from Daytona preview link
sandbox_data = {
    'id': sandbox_id,
    'pass': sandbox_pass,
    'vnc_preview': vnc_url,  # Keep for backward compatibility
    'sandbox_url': website_url,
    'token': token,
    # NEW: Add direct Daytona VNC URL
    'daytona_vnc_direct': f"https://6080-{sandbox_id}.proxy.daytona.works/",
}
```

### Step 2: Update Frontend to Use Direct Connection

**File:** `frontend/src/components/thread/HealthCheckedVncIframe.tsx` (around line 131)

**Replace:**
```typescript
const vncPreviewUrl = new URL(sandbox.vnc_preview, window.location.origin);
const websocketPath = (vncPreviewUrl.pathname.replace(/\/$/, '') + '/websockify').substring(1);
const baseUrl = sandbox.vnc_preview.replace(/\/$/, '');

let vncUrl = `${baseUrl}/vnc_lite.html?password=${sandbox.pass}&autoconnect=true&scale=local&path=${encodeURIComponent(websocketPath)}`;
```

**With:**
```typescript
// Use direct Daytona connection (bypasses backend proxy entirely)
const daytonaDirectUrl = sandbox.daytona_vnc_direct ||
  `https://6080-${sandbox.id}.proxy.daytona.works/`;

console.log('[VNC Debug] Using direct Daytona connection:', daytonaDirectUrl);

// noVNC will connect to same-origin WebSocket automatically
// wss://6080-{sandbox-id}.proxy.daytona.works/websockify
let vncUrl = `${daytonaDirectUrl}vnc_lite.html?` +
  `password=${sandbox.pass}&` +
  (sandbox.token ? `token=${sandbox.token}&` : '') +
  `autoconnect=true&` +
  `scale=local&` +
  `path=websockify`;  // Relative path

console.log('[VNC Debug] Final VNC URL:', vncUrl);
console.log('[VNC Debug] WebSocket will connect to:', daytonaDirectUrl.replace('https://', 'wss://') + 'websockify');
```

### Step 3: Update TypeScript Types

**File:** `frontend/src/types/sandbox.ts` (or wherever Sandbox type is defined)

```typescript
export interface Sandbox {
  id: string;
  pass: string;
  vnc_preview: string;  // Legacy proxy URL
  sandbox_url: string;
  token?: string;
  daytona_vnc_direct?: string;  // NEW: Direct Daytona URL
}
```

### Step 4: Test

```powershell
# Rebuild frontend only (no backend/infrastructure changes needed)
docker compose up -d --build frontend

# Or if running dev server:
cd frontend
npm run dev
```

### Step 5: Verify

1. **Frontend Console:** Should see direct Daytona URLs
   ```
   [VNC Debug] Using direct Daytona connection: https://6080-{sandbox-id}.proxy.daytona.works/
   [VNC Debug] WebSocket will connect to: wss://6080-{sandbox-id}.proxy.daytona.works/websockify
   ```

2. **Browser Network Tab:** WebSocket should connect to Daytona directly
   ```
   Name: websockify
   URL: wss://6080-{sandbox-id}.proxy.daytona.works/websockify
   Status: 101 Switching Protocols ✅
   ```

3. **VNC Display:** Should work immediately, no gray screen

---

## Rollback Plan

If direct connection doesn't work:

1. Revert frontend changes:
   ```typescript
   const baseUrl = sandbox.vnc_preview.replace(/\/$/, '');
   let vncUrl = `${baseUrl}/vnc_lite.html?password=${sandbox.pass}...`;
   ```

2. Rebuild:
   ```powershell
   docker compose up -d --build frontend
   ```

---

## Clarification of My Original Plan

**What I was proposing:**
- Remove Next.js `/api/` rewrite
- Route `/api/*` directly to backend (bypassing Next.js)
- **Backend still proxies to Daytona** (backend remains in the middle)

**What you asked about (Approach 2):**
- Frontend connects **directly to Daytona**
- **No backend proxy at all** (complete bypass)
- Matches Supabase Realtime pattern

**My new recommendation:** **Approach 2** is simpler, faster, and more consistent with your existing architecture.

---

## Next Steps

Which approach do you prefer?

**Option A:** Direct Daytona connection (Approach 2) - Simpler, frontend-only
**Option B:** Backend proxy with Cloudflare reconfiguration (Approach 1) - More control

I recommend **Option A** because it:
- Matches your existing Realtime pattern
- Requires no infrastructure changes
- Solves the Next.js WebSocket issue completely
- Is faster to implement and test
