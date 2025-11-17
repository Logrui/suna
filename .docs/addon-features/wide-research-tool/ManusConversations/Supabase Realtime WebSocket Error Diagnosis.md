# Supabase Realtime WebSocket Error Diagnosis

## Error Summary

**Error**: `WebSocket connection to 'wss://kortix.syhc.dev/realtime/v1/websocket?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlLWRlbW8iLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.3oxoyIq4gsDgKv97f3OU7EPTAOOyXaq_yqci_5kDjTY&vsn=1.0.0' failed`

**Context**: Self-hosted Suna/Kortix instance at `kortix.syhc.dev`

## What is Supabase Realtime Used For in Suna?

Based on the codebase analysis, Supabase Realtime serves **two critical real-time update functions** in the Suna frontend:

### 1. Project/Sandbox Updates (`useProjectRealtime`)

**Purpose**: Immediately notifies the frontend when sandbox data changes in a project.

**Location**: `frontend/src/hooks/useProjectRealtime.ts`

**What it does**:
- Subscribes to PostgreSQL changes on the `projects` table
- Listens for updates to the `sandbox` field
- Invalidates React Query cache when sandbox data changes
- Ensures the UI reflects the latest sandbox state without manual refresh

**Usage**: Called in `ThreadComponent.tsx` whenever a user is viewing a project thread.

### 2. VAPI Call Updates (`useVapiCallRealtime`)

**Purpose**: Provides real-time updates for voice call status and transcripts via VAPI integration.

**Location**: `frontend/src/hooks/useVapiCallRealtime.ts`

**What it does**:
- Subscribes to PostgreSQL changes on the `vapi_calls` table
- Monitors call status changes (e.g., `ringing`, `in-progress`, `ended`)
- Updates live transcripts as they're generated during calls
- Invalidates and refetches queries to keep UI synchronized

**Usage**: Used in VAPI call tool views (`MakeCallToolView.tsx`, `MonitorCallToolView.tsx`)

## Technical Architecture

### Frontend Configuration

The Supabase client is created using:

```typescript
// frontend/src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**Required Environment Variables**:
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase instance URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key

### WebSocket Connection Flow

1. Frontend creates Supabase client with URL and anon key
2. Client attempts to establish WebSocket connection to `/realtime/v1/websocket`
3. Connection includes `apikey` parameter (the anon key) and `vsn=1.0.0` (protocol version)
4. Supabase Realtime server handles the WebSocket upgrade
5. Once connected, frontend subscribes to specific database changes

## Root Cause Analysis

### Issue Source: **Infrastructure/Proxy Configuration**

The error is **NOT** a frontend or backend code issue. The WebSocket connection is failing at the infrastructure level, most likely due to one of these reasons:

### 1. **Reverse Proxy Not Configured for WebSocket Upgrade** (Most Likely)

If you're using nginx, Caddy, Traefik, or another reverse proxy in front of your Supabase instance, it must be configured to handle WebSocket upgrade requests.

**Symptoms**:
- HTTP/HTTPS connections work fine
- WebSocket connections fail with connection errors
- Direct connection to Supabase (bypassing proxy) works

**Why this happens**: WebSocket requires an HTTP upgrade handshake. If your proxy doesn't forward the `Upgrade` and `Connection` headers properly, the WebSocket connection will fail.

### 2. **Supabase Realtime Service Not Running**

The Supabase Realtime service might not be running or properly configured in your self-hosted setup.

**Check**: Verify that the Realtime container/service is running and healthy.

### 3. **CORS or Security Policy Issues**

If your frontend domain differs from your Supabase domain, CORS policies might be blocking the WebSocket connection.

### 4. **SSL/TLS Certificate Issues**

If using `wss://` (WebSocket Secure), ensure your SSL certificates are valid and properly configured for the `/realtime` path.

## Diagnostic Steps

### Step 1: Check if Supabase Realtime is Running

If using Docker Compose:

```bash
docker ps | grep realtime
```

Check the Supabase config:

```bash
# In your Supabase directory
cat config.toml | grep -A 5 "\[realtime\]"
```

Expected output should show `enabled = true`.

### Step 2: Test Direct Connection

Try connecting directly to the Realtime service without the proxy:

```javascript
// In browser console
const ws = new WebSocket('ws://localhost:54321/realtime/v1/websocket?apikey=YOUR_ANON_KEY&vsn=1.0.0');
ws.onopen = () => console.log('Connected!');
ws.onerror = (e) => console.error('Error:', e);
```

If this works, the issue is with your reverse proxy configuration.

### Step 3: Check Reverse Proxy Configuration

Examine your nginx/Caddy/Traefik configuration for the `/realtime` path.

## Solutions

### Solution 1: Configure Nginx for WebSocket Support

If you're using nginx as a reverse proxy, you need to add WebSocket upgrade headers:

```nginx
server {
    listen 443 ssl;
    server_name kortix.syhc.dev;

    # SSL configuration
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # WebSocket upgrade headers (CRITICAL)
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    
    # Standard proxy headers
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # Proxy to Supabase
    location / {
        proxy_pass http://localhost:54321;
    }

    # Specific configuration for realtime (optional but recommended)
    location /realtime/ {
        proxy_pass http://localhost:54321/realtime/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400; # 24 hours for long-lived connections
    }
}
```

**Key lines**:
- `proxy_http_version 1.1;` - Required for WebSocket
- `proxy_set_header Upgrade $http_upgrade;` - Forwards the upgrade header
- `proxy_set_header Connection "upgrade";` - Signals WebSocket upgrade
- `proxy_read_timeout 86400;` - Prevents timeout on long-lived connections

### Solution 2: Configure Caddy for WebSocket Support

If using Caddy (Caddyfile):

```caddy
kortix.syhc.dev {
    reverse_proxy localhost:54321 {
        # Caddy handles WebSocket upgrades automatically
        # But you can be explicit:
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

Caddy handles WebSocket upgrades automatically, so this should work out of the box.

### Solution 3: Configure Traefik for WebSocket Support

If using Traefik (docker-compose labels):

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.supabase.rule=Host(`kortix.syhc.dev`)"
  - "traefik.http.routers.supabase.entrypoints=websecure"
  - "traefik.http.routers.supabase.tls.certresolver=letsencrypt"
  - "traefik.http.services.supabase.loadbalancer.server.port=54321"
```

Traefik also handles WebSocket upgrades automatically.

### Solution 4: Verify Supabase Realtime Configuration

Ensure your `backend/supabase/config.toml` has Realtime enabled:

```toml
[realtime]
enabled = true
# Bind realtime via either IPv4 or IPv6. (default: IPv4)
# ip_version = "IPv6"
# The maximum length in bytes of HTTP request headers. (default: 4096)
# max_header_length = 4096
```

### Solution 5: Check Environment Variables

Verify your frontend `.env` file has the correct Supabase URL:

```env
NEXT_PUBLIC_SUPABASE_URL="https://kortix.syhc.dev"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Important**: The URL should match your domain exactly. If you're using a subdomain for Supabase (e.g., `supabase.kortix.syhc.dev`), use that instead.

## Quick Fix: Temporary Workaround

If you need a quick workaround while fixing the proxy configuration, you can disable Realtime features temporarily:

1. Comment out the `useProjectRealtime` and `useVapiCallRealtime` hooks in the components
2. Rely on manual refresh or polling instead

**Note**: This will degrade the user experience, as real-time updates won't work.

## Testing the Fix

After applying the configuration changes:

1. Restart your reverse proxy (nginx/Caddy/Traefik)
2. Clear browser cache and reload the frontend
3. Open browser DevTools → Network tab → Filter by "WS" (WebSocket)
4. Look for the `/realtime/v1/websocket` connection
5. It should show status "101 Switching Protocols" (success)

## Expected Behavior When Working

When properly configured, you should see:

1. **In Browser DevTools**:
   - WebSocket connection established (status 101)
   - Messages being sent/received on the WebSocket
   - No connection errors

2. **In Frontend Console**:
   - `[Vapi Realtime] Setting up subscription for...`
   - `[Vapi Realtime] Subscribed to...`
   - No `CHANNEL_ERROR` messages

3. **In User Experience**:
   - Sandbox status updates appear immediately
   - VAPI call status changes in real-time
   - Transcripts update live during calls

## Conclusion

**The issue is almost certainly a reverse proxy configuration problem**, not a code issue. The frontend code is correctly configured to use Supabase Realtime, but the WebSocket connection is being blocked or improperly handled by your infrastructure layer.

**Most likely fix**: Add WebSocket upgrade headers to your nginx/proxy configuration as shown in Solution 1.

**Next steps**:
1. Identify which reverse proxy you're using (nginx, Caddy, Traefik, etc.)
2. Apply the appropriate WebSocket configuration
3. Restart the proxy service
4. Test the WebSocket connection
5. If still failing, check Supabase Realtime service logs for errors
