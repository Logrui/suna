# Supabase Realtime Implementation Guide

**Last Updated**: November 3, 2025
**Status**: Complete - All configurations tested and working

---

## Prerequisites

Before starting, ensure you have:
- ✅ Docker Compose running (`suna` and `supabase` networks)
- ✅ Cloudflare Tunnel configured (if using remote access)
- ✅ Kong accessible on port 8888 (local) or via tunnel (remote)
- ✅ Backend and frontend services running

---

## Setup Steps

### Step 1: Backend Configuration

#### 1.1 Add CORS Entries for Cloudflare Tunnel

**File**: `backend/api.py` (lines 165-169)

```python
# Add Cloudflare Tunnel domains to allowed_origins
allowed_origins.extend([
    "https://kortix.syhc.dev",          # Frontend via Cloudflare Tunnel
    "http://kong.kortix.syhc.dev",      # Kong/Supabase via Cloudflare Tunnel (HTTP)
    "https://kong.kortix.syhc.dev",     # Kong/Supabase via Cloudflare Tunnel (HTTPS, for future)
])
```

**Why**: Allows backend to accept realtime subscription requests from Cloudflare tunnel domains.

**Test**:
```bash
curl -I http://localhost:8000/api/health
# Should return 200 OK
```

#### 1.2 Auth Proxy Configuration ✅ VERIFIED

**File**: `frontend/src/app/api/proxy/auth/[...slug]/route.ts` (line 37)

The auth proxy correctly routes auth requests to Kong, not back to frontend:

```typescript
// ✅ CORRECT: Routes to Kong subdomain (line 37)
supabaseBackend = `${protocol}://kong.${host}`

// ❌ WRONG: Routes back to frontend (causes login failures)
// supabaseBackend = `${protocol}://${host}`
```

**Status**: This fix has been verified and tested. Login now works correctly via localhost and Cloudflare tunnel.

---

### Step 2: Frontend Configuration

#### 2.1 Update Environment Variables

**File**: `frontend/.env.local`

Choose based on your deployment:

**Option A: Local Development (localhost)**
```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8888
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000/api
NEXT_PUBLIC_ENV_MODE=local
```

**Option B: Cloudflare Tunnel (https://kortix.syhc.dev)**
```env
NEXT_PUBLIC_SUPABASE_URL=http://kong.kortix.syhc.dev
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000/api
NEXT_PUBLIC_ENV_MODE=local
```

**Note**: Use `http://` for Kong even though frontend is HTTPS - Cloudflare handles the tunnel encryption.

#### 2.2 Verify Next.js Rewrites (already configured)

**File**: `frontend/next.config.ts` (lines 26-41)

The following rewrites are pre-configured to proxy Supabase requests through Next.js:

```typescript
{
  source: '/auth/v1/:path*',
  destination: `${supabaseUrl}/auth/v1/:path*`,
},
{
  source: '/rest/v1/:path*',
  destination: `${supabaseUrl}/rest/v1/:path*`,
},
{
  source: '/realtime/v1/:path*',
  destination: `${supabaseUrl}/realtime/v1/:path*`,
},
```

These ensure all Supabase API calls are proxied through the Next.js server, avoiding mixed content issues.

---

### Step 3: Cloudflare Tunnel Configuration

**Critical Settings** for WebSocket realtime to work:

#### 3.1 SSL/TLS Mode

**Navigate to**: Cloudflare Dashboard → Your Domain → SSL/TLS

**Setting**: Change to **"Flexible"**

```
Flexible: Enable encryption only between visitors and Cloudflare.
This will avoid browser security warnings, but all connections
between Cloudflare and your origin are made through HTTP.
```

**Why**: Kong uses a self-signed certificate (port 8445) that browsers don't trust. "Flexible" mode lets Cloudflare accept HTTP from Kong while providing HTTPS to visitors.

#### 3.2 Disable Automatic HTTPS Rewrites

**Navigate to**: Cloudflare Dashboard → Your Domain → SSL/TLS → Edge Certificates

**Setting**: Turn OFF "Automatic HTTPS Rewrites"

```
When enabled: Rewrites all HTTP links to HTTPS (can break intentional HTTP requests)
When disabled: Allows specific HTTP origins (like Kong)
```

**Why**: Prevents browser from auto-upgrading `http://kong.kortix.syhc.dev` to HTTPS, which would fail on Kong's certificate.

#### 3.3 Verify Tunnel Configuration

**Navigate to**: Cloudflare Dashboard → Zero Trust → Tunnels → Your Tunnel

**Verify Public Hostname**:
```
Domain: kong.kortix.syhc.dev
Protocol: HTTP
URL: http://localhost:8888
```

**Why**: Routes incoming requests to Kong's HTTP port (8888), not HTTPS (8445).

---

### Step 4: Docker Networking

Ensure services are on both networks (suna and supabase):

**File**: `docker-compose.yaml`

```yaml
services:
  frontend:
    networks:
      - default      # suna network
      - supabase     # supabase network (for Kong access)

  backend:
    networks:
      - default      # suna network
      - supabase     # supabase network (for Kong access)

  worker:
    networks:
      - default      # suna network
      - supabase     # supabase network (for Redis and Kong access)
```

**Test connectivity**:
```bash
# From frontend container, can reach Kong
docker exec suna-frontend-1 wget -O - http://supabase-kong:8000/health

# From backend container, can reach Kong
docker exec suna-backend-1 wget -O - http://supabase-kong:8000/health
```

---

### Step 5: Deployment

#### 5.1 Restart Services

```bash
cd suna

# Stop all services
docker compose down

# Start fresh (includes build)
docker compose up -d --build

# Verify services are running
docker compose ps
```

#### 5.2 Verify Backend Health

```bash
# Check backend is accessible
curl http://localhost:8000/api/health

# Should return:
# {"status":"ok","timestamp":"2025-11-03T...","instance_id":"single"}
```

#### 5.3 Verify Frontend Access

- **Local**: Open http://localhost:3000
- **Tunnel**: Open https://kortix.syhc.dev

---

## Verification Checklist

### ✅ WebSocket Connection

1. **Open DevTools** (F12)
2. **Go to Network tab**
3. **Filter by "WS"** (WebSocket)
4. **Try to login or navigate to a page that uses realtime**
5. **Look for** `realtime/v1/websocket` connection
6. **Expected**: Status shows "101 Switching Protocols" (green checkmark)

**Example Working Connection**:
```
Name: realtime/v1/websocket?apikey=...&vsn=1.0.0
Type: websocket
Status: 101 Switching Protocols
Size: (messages)
Time: (duration)
```

### ✅ Authentication

1. **Navigate to** http://localhost:3000 (or https://kortix.syhc.dev)
2. **Click Login**
3. **Select auth method** (email, Google, GitHub, etc.)
4. **Should redirect** to Supabase auth page (not certificate error)
5. **After auth** should redirect back to app

**If you see SSL/TLS error** (`ERR_SSL_VERSION_OR_CIPHER_MISMATCH`):
- Verify Cloudflare SSL/TLS is set to "Flexible"
- Verify "Automatic HTTPS Rewrites" is disabled
- Clear browser cache and cookies
- Try incognito window

### ✅ Realtime Updates

1. **Open browser DevTools** → Console tab
2. **Make a change** that triggers realtime (e.g., make a Vapi call)
3. **Look for logs** like `[Vapi Realtime] Subscribed to...`
4. **Verify data updates** appear in real-time (not just on refresh)

---

## Environment-Specific Configurations

### Local Development (localhost:3000 + localhost:8888)

```bash
# Environment variables
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8888
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000/api

# Cloudflare not needed
# Direct Docker network communication
```

### Self-Hosted with Cloudflare Tunnel

```bash
# Environment variables
NEXT_PUBLIC_SUPABASE_URL=http://kong.kortix.syhc.dev
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000/api

# Cloudflare settings (CRITICAL)
# - SSL/TLS: Flexible
# - Automatic HTTPS Rewrites: OFF
# - Tunnel origin: http://localhost:8888
```

### Production (External Supabase)

```bash
# Environment variables
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_BACKEND_URL=https://your-api.example.com/api

# No Cloudflare tunnel needed (uses external Supabase)
# Standard HTTPS setup
```

---

## Common Configuration Mistakes

### ❌ Using HTTPS for Kong when Cloudflare is "Full" or "Full (Strict)"

```env
# WRONG - Will cause certificate validation errors
NEXT_PUBLIC_SUPABASE_URL=https://kong.kortix.syhc.dev
```

**Why**: Kong's certificate is self-signed, browsers reject it.

**Fix**: Use "Flexible" mode in Cloudflare SSL/TLS settings.

### ❌ Not updating CORS in backend

**Symptom**: CORS errors in browser console
```
Access to XMLHttpRequest blocked by CORS policy...
Access-Control-Allow-Origin: ... is missing
```

**Fix**: Add Cloudflare tunnel domains to `backend/api.py` allowed_origins

### ❌ Automatic HTTPS Rewrites enabled

**Symptom**: Browser auto-upgrades to HTTPS, then fails on certificate
```
ERR_SSL_VERSION_OR_CIPHER_MISMATCH
kong.kortix.syhc.dev uses an unsupported protocol
```

**Fix**: Disable in Cloudflare SSL/TLS → Edge Certificates

### ❌ Services not on both Docker networks

**Symptom**: Frontend can't reach Kong
```
Error: Cannot reach http://supabase-kong:8000
```

**Fix**: Verify services have both `default` and `supabase` networks in docker-compose.yaml

---

## Debugging Commands

### Check Kong Health

```bash
# HTTP endpoint (should work)
curl -I http://localhost:8888/

# HTTPS endpoint (will fail - self-signed cert)
curl -I https://localhost:8445/

# Auth endpoint via HTTP
curl -I http://localhost:8888/auth/v1/health

# Realtime endpoint via HTTP
curl -I http://localhost:8888/realtime/v1/websocket
```

### Check Cloudflare Tunnel

```bash
# Test HTTP to Kong (should work, no HTTPS upgrade)
curl -v http://kong.kortix.syhc.dev/ 2>&1 | grep -E "Location:|<" | head -5

# Test HTTPS to Kong (will fail on self-signed cert, that's OK)
curl -v https://kong.kortix.syhc.dev/ 2>&1 | grep -E "certificate|ERR" | head -5
```

### Check Docker Networks

```bash
# Verify services on both networks
docker network inspect suna | grep -E "frontend|backend|worker" | head -10
docker network inspect supabase | grep -E "frontend|backend|worker" | head -10

# Test connectivity from frontend container
docker exec suna-frontend-1 ping supabase-kong
docker exec suna-frontend-1 curl -I http://supabase-kong:8000/
```

### Check Browser Network Traffic

**DevTools → Network Tab**:
1. Filter by "realtime" or "ws"
2. Look for WebSocket connection
3. Check request headers (especially Origin and Authorization)
4. Check response headers (especially Set-Cookie)

**DevTools → Console**:
1. Search for `[Vapi Realtime]` or `[Supabase]` logs
2. Look for error messages
3. Run: `supabase.channel('test').on('postgres_changes', {}, () => {}).subscribe()`

---

## Rollback / Disable Realtime

If realtime isn't working and you need to disable it temporarily:

### Option 1: Keep WebSocket Running (Degrades Gracefully)
- Leave all configuration as-is
- App continues to work via React Query polling
- Updates will have ~5-30s delay instead of instant

### Option 2: Temporarily Use Different URL
```env
# Switch to direct localhost for testing
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8888
```

---

## Next Steps

1. **Verify** all checks in the verification checklist pass
2. **Monitor** WebSocket connections for stability (should stay at 101 status)
3. **Test** realtime updates work (Vapi calls, project updates)
4. **Plan** future enhancements (see README.md for future ideas)

For troubleshooting issues, see **TROUBLESHOOTING.md**.
