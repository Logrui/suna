# Supabase Realtime Troubleshooting Guide

**Last Updated**: November 3, 2025
**Status**: Common issues and solutions documented

---

## Quick Diagnosis

Start with these questions to identify the issue:

1. **Can you access the app?**
   - If NO → Network/Cloudflare issue (see "Cannot Access App")
   - If YES → Continue to next question

2. **Can you login?**
   - If NO → Authentication issue (see "Login Fails")
   - If YES → Continue to next question

3. **Do you see WebSocket connection in DevTools?**
   - If NO → WebSocket connection issue (see "WebSocket Connection Failed")
   - If YES → Continue to next question

4. **Is WebSocket in green (connected)?**
   - If NO → WebSocket connection drops (see "WebSocket Disconnects")
   - If YES → Realtime should work, see "Realtime Updates Not Appearing"

---

## Problem: Cannot Access App

### Symptom
Browser shows error when accessing https://kortix.syhc.dev:
- `ERR_NAME_NOT_RESOLVED` - DNS resolution failed
- `ERR_TIMED_OUT` - Connection timed out
- `ERR_CONNECTION_REFUSED` - Server not accepting connections

### Root Causes & Solutions

#### 1. Cloudflare Tunnel Not Running

**Check**:
```bash
cloudflared tunnel list
# Should show your tunnel as "ACTIVE"

# Or check tunnel status
cloudflared tunnel info
```

**Fix**:
```bash
# Start tunnel
cloudflared tunnel run your-tunnel-name
```

#### 2. Tunnel Not Routing to Frontend

**Check in Cloudflare Dashboard**:
- Zero Trust → Tunnels → Your Tunnel → Public Hostnames
- Verify `kortix.syhc.dev` → `http://localhost:3000`

**Fix**: Add/update the routing in Cloudflare UI

#### 3. Frontend Container Not Running

**Check**:
```bash
docker compose ps | grep frontend
# Should show "Up" status
```

**Fix**:
```bash
docker compose logs frontend --tail=50
# Check for errors

docker compose restart frontend
```

#### 4. DNS Not Resolving

**Check**:
```bash
nslookup kortix.syhc.dev
# Should return Cloudflare IP address

ping -c 4 kortix.syhc.dev
# Should ping Cloudflare servers, not timeout
```

**Fix**:
- Wait 15 minutes for DNS to propagate
- Clear browser DNS cache (Chrome: Clear browsing data)
- Try different DNS: 1.1.1.1 (Cloudflare) or 8.8.8.8 (Google)

---

## Problem: Login Fails

### Symptom
When trying to login, see error:
```
This site can't provide a secure connection
kong.kortix.syhc.dev uses an unsupported protocol.
Error code: ERR_SSL_VERSION_OR_CIPHER_MISMATCH
```

### Root Cause
Browser is trying to use HTTPS to Kong, but Kong's certificate is self-signed and untrusted.

### Solutions

#### Solution 1: Fix Cloudflare SSL/TLS Settings (Recommended)

**Step 1: Set SSL/TLS Mode to "Flexible"**

Cloudflare Dashboard → Your Domain → SSL/TLS:
- Change from "Full" or "Full (Strict)" to **"Flexible"**
- This allows HTTP connections to Kong while providing HTTPS to visitors

**Step 2: Disable Automatic HTTPS Rewrites**

Cloudflare Dashboard → SSL/TLS → Edge Certificates:
- Turn OFF **"Automatic HTTPS Rewrites"**
- This prevents browser from auto-upgrading HTTP to HTTPS

**Step 3: Verify Settings**

```bash
# Should NOT auto-upgrade to HTTPS
curl -i http://kong.kortix.syhc.dev/ 2>&1 | head -10
# Should show HTTP response, NOT redirect to HTTPS

# Frontend should still be HTTPS
curl -i https://kortix.syhc.dev/ 2>&1 | head -10
# Should show HTTPS response
```

#### Solution 2: Use HTTP-Only Frontend (Testing Only)

**Change frontend URL to HTTP** (not recommended for production):
```bash
# Instead of https://kortix.syhc.dev
# Use http://localhost:3000
```

**Why**: Avoids browser's "secure context" requirement for WebSocket

**Why not production**: Less secure, browser will show warning

#### Solution 3: Fix Kong HTTPS Certificate (Advanced)

**For production**, Kong should have a valid certificate:

**Check Kong HTTPS configuration**:
```bash
docker exec supabase-kong-1 ls /etc/kong/ssl/
# Should have certs directory

docker logs supabase-kong-1 | grep -i "certificate\|ssl\|tls" | tail -20
```

**To fix Kong HTTPS**:
1. Generate valid certificate (e.g., using Let's Encrypt)
2. Mount certificate in Kong container
3. Configure Kong to use HTTPS
4. Change Cloudflare tunnel to `https://localhost:8445`
5. Update frontend env var: `NEXT_PUBLIC_SUPABASE_URL=https://kong.kortix.syhc.dev`

**Note**: This is complex - Solution 1 is recommended for self-hosted

---

## Problem: WebSocket Connection Failed

### Symptom
Browser DevTools → Network → Filter "WS" shows:
- No WebSocket connection at all
- Or WebSocket shows red X (failed)
- Console shows error like: `WebSocket connection failed` or `Failed to fetch`

### Root Causes & Solutions

#### 1. Wrong NEXT_PUBLIC_SUPABASE_URL

**Check your frontend .env.local**:
```bash
cat frontend/.env.local | grep NEXT_PUBLIC_SUPABASE_URL
```

**Should be one of these**:
- `http://localhost:8888` (local development)
- `http://kong.kortix.syhc.dev` (Cloudflare tunnel)
- `https://your-project.supabase.co` (external Supabase)

**If wrong**: Update and restart frontend:
```bash
docker compose restart frontend
```

#### 2. Kong Not Accessible

**Check Kong is running**:
```bash
docker compose ps | grep kong
# Should show supabase-kong with "Up" status

# Test Kong HTTP endpoint
curl -I http://localhost:8888/
# Should return 401 Unauthorized (Kong is there)
```

**If not running**:
```bash
cd suna-supabase/docker
docker compose up -d kong
```

#### 3. Kong Port Not Exposed

**Check Kong port mapping**:
```bash
docker compose ps | grep kong
# Should show: 0.0.0.0:8888->8000/tcp
```

**If missing**: Update `suna-supabase/docker/docker-compose.yml`:
```yaml
supabase-kong:
  ports:
    - "8888:8000"  # Add this line
```

Then restart:
```bash
docker compose down
docker compose up -d
```

#### 4. Backend CORS Not Configured

**Check backend CORS**:
```bash
grep -n "allowed_origins.extend" backend/api.py
# Should show your domain
```

**Required entries** (around line 165):
```python
allowed_origins.extend([
    "https://kortix.syhc.dev",           # Frontend domain
    "http://kong.kortix.syhc.dev",       # Kong domain
    "https://kong.kortix.syhc.dev",      # Kong HTTPS (future)
])
```

**If missing**: Add these lines to `backend/api.py` and restart:
```bash
docker compose restart backend
```

#### 5. Cloudflare Tunnel Kong Routing Wrong

**Check Cloudflare tunnel configuration**:

Cloudflare Dashboard → Zero Trust → Tunnels → Your Tunnel:
- Public Hostname: `kong.kortix.syhc.dev`
- Protocol: `HTTP`
- URL: `http://localhost:8888`

**If wrong**: Update and wait 30 seconds for propagation

**Test**:
```bash
curl -I http://kong.kortix.syhc.dev/
# Should return 401 from Kong (it's there)
```

#### 6. Services Not on Both Docker Networks

**Check**:
```bash
docker network inspect suna | grep -A2 "frontend"
docker network inspect supabase | grep -A2 "frontend"
# Frontend should appear in BOTH
```

**If frontend is only on one network**:
```bash
docker compose down -v
docker compose up -d
# Full restart to recreate with both networks
```

---

## Problem: WebSocket Disconnects Frequently

### Symptom
WebSocket connection shows status 101, but frequently:
- Disconnects and reconnects
- Shows "Connection closing" in DevTools
- Browser console shows reconnection messages

### Root Causes & Solutions

#### 1. Browser Idle Timeout

**Check**: Does it disconnect after 5-30 minutes of inactivity?

**Solution**: WebSocket idle timeouts are normal. Supabase client auto-reconnects.

**If too frequent**: Increase timeout in Kong configuration (advanced)

#### 2. Network Interruption

**Check**: Ping Kong endpoint:
```bash
# Test connectivity every 10 seconds
while true; do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8888/; sleep 10; done
# Should consistently return 401 or 200
```

**If drops**: Check network stability, Cloudflare status

#### 3. Kong Container Restarting

**Check Kong logs**:
```bash
docker logs supabase-kong -f --tail=100
# Watch for crashes or errors
```

**If restarting**: Check `docker compose logs` for errors, check disk space

#### 4. Cloudflare Tunnel Connection Issues

**Check tunnel logs**:
```bash
cloudflared tunnel run your-tunnel-name
# Watch for "Connection error" messages
```

**Solution**: Restart tunnel
```bash
# Ctrl+C to stop
# Then restart
cloudflared tunnel run your-tunnel-name
```

---

## Problem: Realtime Updates Not Appearing

### Symptom
WebSocket is connected (status 101 in DevTools), but:
- Changes don't appear in real-time
- Manual refresh shows new data
- Vapi call doesn't update automatically

### Root Causes & Solutions

#### 1. Table Not Published for Realtime

**Check PostgreSQL**:
```bash
# Connect to Supabase PostgreSQL
docker exec supabase-db-1 psql -U postgres -d postgres -c \
  "SELECT schemaname, tablename FROM pg_tables WHERE tablename IN ('vapi_calls', 'projects');"

# Check publications
docker exec supabase-db-1 psql -U postgres -d postgres -c \
  "SELECT pubname FROM pg_publication WHERE pubname = 'supabase_realtime';"

# Check which tables are in publication
docker exec supabase-db-1 psql -U postgres -d postgres -c \
  "SELECT pg_get_publication_tables('supabase_realtime');"
```

**Should return**: `vapi_calls` and `projects` in publication

**If missing**: Need to run migration:
```bash
# Migration file exists at:
backend/supabase/migrations/20251010173052_vapi_real_time.sql

# To apply: Use Supabase Studio or run directly
docker exec supabase-db-1 psql -U postgres -d postgres -f /migrations/file.sql
```

#### 2. Row-Level Security (RLS) Blocking Reads

**Check RLS policies**:
```bash
# Check if RLS is enabled
docker exec supabase-db-1 psql -U postgres -d postgres -c \
  "SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'vapi_calls';"

# Check RLS policies
docker exec supabase-db-1 psql -U postgres -d postgres -c \
  "SELECT * FROM pg_policies WHERE tablename = 'vapi_calls';"
```

**If policies are too restrictive**: Update to allow reads:
```sql
-- Example: Allow users to see their own calls
CREATE POLICY "Users can view their own calls"
ON vapi_calls FOR SELECT
USING (
  thread_id IN (
    SELECT thread_id FROM threads WHERE account_id = auth.uid()
  )
);
```

#### 3. No Data Changes Happening

**Check**: Is data actually being updated?

**Verify**:
```bash
# Make a change (e.g., create a Vapi call)
# Then check if it appears in database
docker exec supabase-db-1 psql -U postgres -d postgres -c \
  "SELECT * FROM vapi_calls ORDER BY created_at DESC LIMIT 5;"
```

**If no new records**: The change isn't being written to database

#### 4. Hook Not Invalidating Cache

**Check browser console** when a realtime event arrives:

**Expected**:
```
[Vapi Realtime] Subscribed to vapi_calls changes
[Vapi Realtime] Change received: {type: 'UPDATE', ...}
[React Query] Invalidating cache for vapi_calls
[React Query] Refetching vapi_calls...
```

**If missing**: Hook isn't receiving realtime events

**Fix**: Verify WebSocket connection is actually receiving data:
```javascript
// In browser console:
const supabase = createClient();
const channel = supabase.channel('test');
channel.on('postgres_changes', { event: '*', schema: 'public', table: 'vapi_calls' }, (payload) => {
  console.log('Raw payload:', payload);
});
channel.subscribe((status) => {
  console.log('Subscription status:', status);
});
```

#### 5. React Query Polling Too Slow

**If realtime works but updates are delayed**: Check React Query polling interval

**Location**: Check `useVapiCallRealtime` hook:
```typescript
// Should include cache invalidation:
queryClient.invalidateQueries({
  queryKey: ['vapi-calls'],
});
```

---

## Problem: High CPU/Memory Usage

### Symptom
Docker container using 50%+ CPU or memory constantly increasing

### Root Causes & Solutions

#### 1. WebSocket Connection Loop

**Check Kong logs**:
```bash
docker logs supabase-kong -f | grep -i "connection\|websocket" | head -20
```

**If seeing many connection attempts**: Browser is reconnecting too fast

**Solution**:
1. Clear browser cache
2. Hard refresh (Ctrl+Shift+R)
3. Restart frontend container

#### 2. Database Polling Too Frequent

**Check backend logs**:
```bash
docker logs suna-backend-1 | grep -i "query\|select" | wc -l
# High count = frequent polling
```

**If too many queries**: React Query polling interval might be too low

#### 3. Memory Leak in Realtime Connection

**Check**:
```bash
docker stats suna-frontend-1
# Watch memory column

# Stop and restart
docker compose restart frontend
```

**If memory keeps growing**: Report issue to Supabase

---

## Problem: Auth Proxy Returns 404/403 or Login Fails

### Symptom
When clicking login, see error:
```
404 Not Found
or
403 Forbidden
or
ERR_SSL_VERSION_OR_CIPHER_MISMATCH
```

### Root Cause
Auth proxy file (`frontend/src/app/api/proxy/auth/[...slug]/route.ts`) was routing back to frontend instead of Kong

### Solution ✅ FIXED

**Verified configuration** in `frontend/src/app/api/proxy/auth/[...slug]/route.ts` (line 37):

```typescript
// ✅ CORRECT: Routes to Kong subdomain
supabaseBackend = `${protocol}://kong.${host}`

// ❌ WRONG (previously broken): Routes back to frontend
// supabaseBackend = `${protocol}://${host}`  // This caused infinite loops
```

**Status**: This has been fixed and tested. Login now works correctly.

**If you're still experiencing issues**:
1. Verify the fix is applied (check line 37)
2. Restart frontend: `docker compose restart frontend`
3. Clear browser cache (Ctrl+Shift+Delete)
4. Try incognito window
5. Verify Cloudflare SSL/TLS is set to "Flexible" (see "Login Fails" section)

**Test**:
```bash
# Should return auth endpoint response
curl -I http://localhost:3000/auth/v1/health
# Should NOT be 404
```

---

## Diagnostic Commands

### Kong Health Check
```bash
# HTTP (should work)
curl -I http://localhost:8888/

# HTTPS (will fail on certificate - that's OK)
curl -I https://localhost:8445/ 2>&1 | grep -i "certificate\|untrusted"

# Auth endpoint
curl http://localhost:8888/auth/v1/health | jq .

# Realtime endpoint
curl http://localhost:8888/realtime/v1/websocket
```

### Cloudflare Tunnel Check
```bash
# Can browser reach Kong through tunnel?
curl -v http://kong.kortix.syhc.dev/ 2>&1 | head -15

# Check SSL/TLS settings
curl -v https://kong.kortix.syhc.dev/ 2>&1 | grep -E "certificate|error" | head -5
```

### Docker Network Check
```bash
# Verify services on both networks
docker network inspect suna | grep "Name\|Containers" -A5

docker network inspect supabase | grep "Name\|Containers" -A5

# Test from within containers
docker exec suna-frontend-1 curl -I http://supabase-kong:8000/
docker exec suna-backend-1 curl -I http://supabase-kong:8000/
```

### Browser Network Check
**DevTools → Network → Filter "realtime"**:
- Should see `/realtime/v1/websocket` request
- Type should be "websocket"
- Status should be "101 Switching Protocols"
- Headers should show `Upgrade: websocket`

**DevTools → Console**:
```javascript
// Check Supabase connection status
const supabase = createClient();
supabase.auth.onAuthStateChange((event, session) => {
  console.log('Auth state:', { event, session });
});

// Try subscribing
supabase.channel('test').subscribe((status) => {
  console.log('Subscription status:', status);
});
```

---

## When Nothing Works: Reset Procedure

If you've tried everything and nothing works, do a complete reset:

```bash
# Stop all services
docker compose down -v  # -v removes volumes

# Clear browser cache
# DevTools → Application → Clear site data

# Full restart
docker compose up -d --build

# Restart frontend specifically
docker compose restart frontend

# Clear browser cache again (hard refresh: Ctrl+Shift+R)
# Then test again
```

---

## Getting Help

If the issue persists after trying these solutions:

1. **Collect diagnostics**:
   ```bash
   docker compose logs --tail=100 > logs.txt
   curl -I http://localhost:8888/ >> logs.txt
   curl -I http://kong.kortix.syhc.dev/ >> logs.txt
   ```

2. **Check for errors** in:
   - Browser DevTools → Console (JavaScript errors)
   - Browser DevTools → Network (failed requests)
   - `docker compose logs` (service logs)
   - Cloudflare dashboard (tunnel status)

3. **Report with**:
   - Error messages (exact text)
   - Steps to reproduce
   - Environment (localhost vs Cloudflare)
   - Logs from above
