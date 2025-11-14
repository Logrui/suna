# WebSocket WSS - Complete Guide

## Problem Statement

When accessing the Suna frontend over HTTPS (via Cloudflare Tunnel), WebSocket connections fail with:

```
SecurityError: Failed to construct 'WebSocket': 
An insecure WebSocket connection may not be initiated from a page loaded over HTTPS.
```

This breaks real-time features like chat updates and agent response streaming.

## Root Cause

### Why It Happens
- Browser serves page over **HTTPS** (secure)
- WebSocket attempts to connect with `ws://` (insecure)
- Browser security policy blocks mixed content
- **Cloudflare handles HTTP→HTTPS upgrade for regular requests but NOT WebSocket**

### The Configuration Problem
The code was missing `NEXT_PUBLIC_REALTIME_URL` and falling back to `NEXT_PUBLIC_SUPABASE_URL` (HTTP):

```typescript
// OLD CODE - BROKEN
const realtimeUrl = 
  process.env.NEXT_PUBLIC_REALTIME_URL ||  // Undefined!
  process.env.NEXT_PUBLIC_SUPABASE_URL ||  // Falls back to HTTP
  'http://localhost:8888'
// Result: Uses HTTP → becomes ws:// (insecure) ❌
```

### Why NEXT_PUBLIC_* Variables Matter
Next.js environment variables with `NEXT_PUBLIC_` prefix are **baked into the JavaScript bundle at build time**, not runtime. This means:
- Cannot be changed after container starts
- Must pass as Docker build arguments
- Docker build args must be declared in Dockerfile with `ARG`
- Both `ARG` and `ENV` declarations are required

## The Solution

### Step 1: Configure docker-compose.yaml

Add HTTPS-based realtime URL to both `build.args` and `environment`:

```yaml
frontend:
  build:
    context: ./frontend
    dockerfile: Dockerfile
    args:
      - NEXT_PUBLIC_ENV_MODE=local
      - NEXT_PUBLIC_SUPABASE_URL=http://kong.kortix.syhc.dev/
      - NEXT_PUBLIC_REALTIME_URL=https://kong.kortix.syhc.dev/    # ← ADD THIS
      - NEXT_PUBLIC_BACKEND_URL=http://backend:8000/api
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
  
  environment:
    - NEXT_PUBLIC_ENV_MODE=local
    - NEXT_PUBLIC_SUPABASE_URL=http://kong.kortix.syhc.dev/
    - NEXT_PUBLIC_REALTIME_URL=https://kong.kortix.syhc.dev/      # ← ADD THIS
    - NEXT_PUBLIC_BACKEND_URL=http://backend:8000/api
    - NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

**Key:** Use HTTPS scheme for `NEXT_PUBLIC_REALTIME_URL` (HTTP is fine for `NEXT_PUBLIC_SUPABASE_URL` since Cloudflare handles upgrade).

### Step 2: Declare in frontend/Dockerfile

Add `ARG` declaration (around line 36):

```dockerfile
ARG NEXT_PUBLIC_ENV_MODE
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLIC_URL
ARG NEXT_PUBLIC_REALTIME_URL              # ← ADD THIS
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
```

And export as `ENV` (around line 48):

```dockerfile
ENV NEXT_PUBLIC_ENV_MODE=${NEXT_PUBLIC_ENV_MODE}
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_PUBLIC_URL=${NEXT_PUBLIC_SUPABASE_PUBLIC_URL}
ENV NEXT_PUBLIC_REALTIME_URL=${NEXT_PUBLIC_REALTIME_URL}        # ← ADD THIS
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
```

### Step 3: Verify Implementation

The code in `frontend/src/lib/supabase/client.ts` already handles this correctly:

```typescript
export function createRealtimeClient() {
  // Prioritizes NEXT_PUBLIC_REALTIME_URL
  const realtimeUrl = 
    process.env.NEXT_PUBLIC_REALTIME_URL ||      // Uses HTTPS URL ✅
    process.env.NEXT_PUBLIC_SUPABASE_URL ||      // Fallback to HTTP
    'http://localhost:8888'

  // Auto-detects protocol based on URL scheme
  const wsProtocol = realtimeUrl.startsWith('https') ? 'wss://' : 'ws://'
  
  // Result:
  // HTTPS URL → wss:// (secure) ✅
  // HTTP URL → ws:// (insecure, but for local dev) ✅
}
```

## How It Works

### Protocol Selection Logic

```
NEXT_PUBLIC_REALTIME_URL
         ↓
    URL Scheme Check
    ├─ Starts with "https://" → wsProtocol = "wss://"
    └─ Starts with "http://"  → wsProtocol = "ws://"
         ↓
    WebSocket Connection
    ├─ For HTTPS page → wss://kong.kortix.syhc.dev/... ✅ Secure
    └─ For HTTP page  → ws://localhost:8888/...        ✅ Unencrypted (local)
```

### Environment Variable Flow

```
docker-compose.yaml (build args)
    ↓
frontend/Dockerfile (ARG → ENV)
    ↓
Next.js build process (baked into bundle)
    ↓
process.env.NEXT_PUBLIC_REALTIME_URL = "https://kong..."
    ↓
createRealtimeClient()
    ↓
WebSocket protocol detection → wss://
    ↓
Browser WebSocket Connection ✅
```

### Two Client Strategy

The solution uses two separate Supabase clients:

**Regular Client (createClient)**
- Uses: `window.location.origin`
- For: Auth, REST API calls
- Routing: Through Next.js rewrites at `/auth/v1/*`, `/rest/v1/*`
- Proxies to Kong through Next.js
- Reason: Avoids HTTPS upgrade issues and certificate validation

**Realtime Client (createRealtimeClient)**
- Uses: `NEXT_PUBLIC_REALTIME_URL` (explicit HTTPS)
- For: WebSocket subscriptions
- Routing: Direct connection to Kong
- Cannot be proxied through Next.js
- Reason: WebSocket requires explicit protocol specification

## Deployment

### Build and Deploy

```bash
cd d:\Homelab\suna

# Critical: Use --no-cache to force rebuild
docker compose build --no-cache frontend

# Start updated container
docker compose up -d frontend
```

### Verify Deployment

**1. Check environment variable in container:**
```bash
docker compose exec frontend env | grep NEXT_PUBLIC_REALTIME_URL
# Should output: NEXT_PUBLIC_REALTIME_URL=https://kong.kortix.syhc.dev/
```

**2. Check Kong connectivity:**
```bash
docker compose exec frontend curl -v https://kong.kortix.syhc.dev/
# Should succeed (not "connection refused")
```

**3. Check browser console:**
Open DevTools → Console tab and look for:
```javascript
[createRealtimeClient] WebSocket configuration: {
  expectedProtocol: "wss://",    // ← Must be "wss://" not "ws://"
  shouldBeSecure: true,          // ← Must be true for HTTPS pages
}
```

**4. Check browser Network tab:**
- Open DevTools → Network
- Filter to "WS" (WebSocket)
- Should show connection to `wss://kong.kortix.syhc.dev/realtime/v1/websocket`
- Status should be "101 Web Socket Protocol Handshake" (successful)

**5. Test real-time features:**
- Send a chat message
- Agent response streams in real-time
- No delays or timeouts
- No WebSocket security errors in console

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ LOCAL DEV (HTTP):                                               │
│                                                                 │
│  Browser (http://localhost:3000)                               │
│      ├─ HTTP requests via window.location.origin               │
│      │  → localhost:3000 (through Next.js rewrites)            │
│      │  → Kong ✅                                               │
│      │                                                         │
│      └─ WebSocket via NEXT_PUBLIC_REALTIME_URL                │
│         → ws://localhost:8888/realtime/v1/websocket ✅        │
└─────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│ PRODUCTION (HTTPS via Cloudflare):                              │
│                                                                 │
│  Browser (https://kortix.syhc.dev via Cloudflare Tunnel)      │
│      ├─ HTTPS requests via window.location.origin              │
│      │  → https://kortix.syhc.dev (Cloudflare proxy)           │
│      │  → /auth/v1/*, /rest/v1/* rewrites                      │
│      │  → Kong ✅                                               │
│      │                                                         │
│      └─ WebSocket via NEXT_PUBLIC_REALTIME_URL                │
│         → wss://kong.kortix.syhc.dev/realtime/v1/websocket ✅│
└─────────────────────────────────────────────────────────────────┘
```

## Configuration Examples

### Development (HTTP)
```yaml
environment:
  - NEXT_PUBLIC_SUPABASE_URL=http://localhost:8888/
  - NEXT_PUBLIC_REALTIME_URL=http://localhost:8888/
# → WebSocket: ws://localhost:8888/realtime/v1/websocket
```

### Production (HTTPS + Cloudflare)
```yaml
environment:
  - NEXT_PUBLIC_SUPABASE_URL=http://kong.kortix.syhc.dev/
  - NEXT_PUBLIC_REALTIME_URL=https://kong.kortix.syhc.dev/
# → WebSocket: wss://kong.kortix.syhc.dev/realtime/v1/websocket
```

## Success Criteria

Deployment is successful when:
- ✅ `docker compose exec frontend env | grep REALTIME` shows HTTPS URL
- ✅ Browser console shows `expectedProtocol: "wss://"`
- ✅ Browser Network tab shows `wss://` WebSocket URL (not `ws://`)
- ✅ No WebSocket security errors in console
- ✅ Real-time features work (chat, agent streaming)
- ✅ Messages appear immediately without delays
- ✅ No mixed content warnings

## Key Learnings

1. **Next.js environment variables are build-time, not runtime** - Variables are baked into the JavaScript bundle during Docker build. Changes require full rebuild.

2. **WebSocket requires explicit protocol** - Browsers enforce mixed content policy. HTTPS pages must use `wss://`, not `ws://`.

3. **Cloudflare Tunnel handles HTTP→HTTPS for regular requests** - But WebSocket must be explicitly configured with HTTPS URL.

4. **Docker build arguments need dual declaration** - Must declare with `ARG` in Dockerfile AND pass through docker-compose.yaml `args:` section.

5. **Separate clients enable different routing** - REST client uses `window.location.origin` (works with proxies), Realtime client uses explicit URL (direct connection).

## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for detailed issue diagnosis.

Quick checks:
- Is `NEXT_PUBLIC_REALTIME_URL` using `https://`? 
- Did you rebuild with `--no-cache`?
- Does Dockerfile have both `ARG` and `ENV` declarations?
- Is Kong running? (`docker compose ps kong`)
- Check browser console for `expectedProtocol: "wss://"`

## Related Files Modified

- ✅ `docker-compose.yaml` - Added `NEXT_PUBLIC_REALTIME_URL=https://...`
- ✅ `frontend/Dockerfile` - Added `ARG` and `ENV` declarations
- ✅ `frontend/src/lib/supabase/client.ts` - Already optimized for this fix
- ✅ `frontend/next.config.ts` - Added `productionBrowserSourceMaps: true` (for debugging)

## References

- [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Fast lookup guide
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and solutions
- Root cause documented in: [AGENT_CHAT_TIMEOUT_FIX.md](../../AGENT_CHAT_TIMEOUT_FIX.md)
