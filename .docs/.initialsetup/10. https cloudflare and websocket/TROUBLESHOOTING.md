# WebSocket WSS - Troubleshooting Guide

## Issue 1: Still Seeing ws:// Instead of wss://

### Symptoms
- Browser console shows `expectedProtocol: "ws://"`
- WebSocket in Network tab shows `ws://` instead of `wss://`
- Works on HTTP, fails on HTTPS

### Root Cause
Environment variable didn't propagate or container is using old image.

### Solution
**Step 1: Verify docker-compose.yaml**
```yaml
environment:
  - NEXT_PUBLIC_REALTIME_URL=https://kong.kortix.syhc.dev/
```
Must use `https://`, not `http://`.

**Step 2: Rebuild with --no-cache**
```bash
docker compose down frontend
docker compose build --no-cache frontend
docker compose up -d frontend
```

**Step 3: Verify in container**
```bash
docker compose exec frontend env | grep NEXT_PUBLIC_REALTIME_URL
# Should show: NEXT_PUBLIC_REALTIME_URL=https://kong.kortix.syhc.dev/
```

**Step 4: Force full restart**
```bash
docker compose down -v
docker compose up -d frontend
```

---

## Issue 2: SecurityError: Insecure WebSocket Connection

### Symptoms
```
SecurityError: Failed to construct 'WebSocket': 
An insecure WebSocket connection may not be initiated from a page loaded over HTTPS.
```

### Root Cause
WebSocket is using `ws://` from an HTTPS page (mixed content).

### Solution
Follow Issue 1 above - ensure `NEXT_PUBLIC_REALTIME_URL` uses `https://` scheme.

---

## Issue 3: NEXT_PUBLIC_REALTIME_URL Not Found in Container

### Symptoms
- Environment variable is missing
- `docker compose exec frontend env | grep REALTIME` shows nothing

### Root Cause
Dockerfile missing `ARG` or `ENV` declaration.

### Verification
Check frontend/Dockerfile has:
```dockerfile
# Around line 36:
ARG NEXT_PUBLIC_REALTIME_URL

# Around line 48:
ENV NEXT_PUBLIC_REALTIME_URL=${NEXT_PUBLIC_REALTIME_URL}
```

### Solution
**Step 1: Add missing declarations to Dockerfile**
- Add `ARG NEXT_PUBLIC_REALTIME_URL` if missing
- Add `ENV NEXT_PUBLIC_REALTIME_URL=${NEXT_PUBLIC_REALTIME_URL}` if missing

**Step 2: Rebuild**
```bash
docker compose build --no-cache frontend
docker compose up -d frontend
```

**Step 3: Verify**
```bash
docker compose exec frontend env | grep NEXT_PUBLIC_REALTIME_URL
```

---

## Issue 4: WebSocket Connection Attempts but Fails Immediately

### Symptoms
- Network tab shows WebSocket connection attempt
- Status: "closed" with no data flow
- No errors in console

### Root Cause
Kong not reachable, certificate issue, or realtime service not running.

### Debugging Steps

**Step 1: Verify Kong is running**
```bash
docker compose ps kong
# Should show "Up" status
```

**Step 2: Test Kong connectivity from frontend**
```bash
docker compose exec frontend curl -v https://kong.kortix.syhc.dev/
# Should get response (not "connection refused")
```

If certificate error, try:
```bash
docker compose exec frontend curl -k https://kong.kortix.syhc.dev/
# -k bypasses certificate validation
```

**Step 3: Check Kong logs**
```bash
docker compose logs kong | tail -50
# Look for errors about WebSocket or certificate
```

**Step 4: Verify realtime endpoint**
```bash
docker compose exec kong curl http://localhost:3000/realtime/v1/websocket
# Should fail with "WebSocket upgrade required" (expected)
# If this fails, realtime service may not be running
```

### Solutions

**If Kong not running:**
```bash
docker compose up -d kong
```

**If certificate issue:**
- Check Kong certificate is valid
- Check Cloudflare certificate if using tunnel
- Try accessing Kong directly without tunnel

**If realtime service not responding:**
```bash
docker compose ps realtime
docker compose logs realtime | tail -50
```

---

## Issue 5: Mixed Content Warning in Browser

### Symptoms
```
Mixed Content: The page at 'https://kortix.syhc.dev' was loaded over HTTPS, 
but requested an insecure resource 'ws://...'
```

### Root Cause
Identical to Issue 1/2 - WebSocket using `ws://` from HTTPS page.

### Solution
Ensure `NEXT_PUBLIC_REALTIME_URL` uses `https://` scheme (see Issue 1).

---

## Issue 6: WebSocket Works Locally but Not Over Cloudflare Tunnel

### Symptoms
- Works: `http://localhost:3000`
- Fails: `https://kortix.syhc.dev` (via Cloudflare)
- Network timeout or "cannot reach"

### Root Cause
Kong not accessible through Cloudflare tunnel, or wrong URL configured.

### Debugging

**Step 1: Verify Cloudflare tunnel is routing correctly**
```bash
# From outside the network:
curl https://kortix.syhc.dev
# Should get Next.js page
```

**Step 2: Check if Kong is accessible via tunnel**
```bash
# If using direct Kong route:
curl https://kong.kortix.syhc.dev/
# Should respond (not timeout)
```

**Step 3: Verify NEXT_PUBLIC_REALTIME_URL is correct**
```bash
docker compose exec frontend env | grep REALTIME
# Should match your Kong endpoint accessible from browser
```

### Solutions

**Option A: Expose Kong via Cloudflare tunnel**
```
Configure Cloudflare to route:
kong.kortix.syhc.dev → localhost:8000 (Kong)
```

**Option B: Use same-origin proxy**
```yaml
environment:
  - NEXT_PUBLIC_REALTIME_URL=https://kortix.syhc.dev/
```
(Then configure Next.js rewrite to proxy to Kong)

**Option C: Use different endpoint**
Ensure `NEXT_PUBLIC_REALTIME_URL` points to an endpoint accessible from the browser.

---

## Issue 7: Can See Correct URL in Logs But WebSocket Still Won't Connect

### Symptoms
- Console logs show correct URL and protocol
- `expectedProtocol: "wss://"`
- But WebSocket doesn't connect
- No connection errors in console

### Root Cause
Firewall, certificate validation, or WebSocket-specific network issue.

### Debugging

**Step 1: Check all environment variables**
```bash
docker compose exec frontend env | grep -i "supabase\|realtime\|backend"
# Should show all config
```

**Step 2: Test WebSocket manually**
```bash
# Use websocat if available:
websocat wss://kong.kortix.syhc.dev/realtime/v1/websocket

# Or use wscat (Node.js):
npx wscat -c wss://kong.kortix.syhc.dev/realtime/v1/websocket
```

**Step 3: Check Kong WebSocket upgrade**
```bash
docker compose exec kong curl -v -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  http://localhost:3000/realtime/v1/websocket
# Should attempt WebSocket upgrade
```

**Step 4: Check firewall/network**
- Verify port 443 is accessible (for wss://)
- Check if corporate firewall blocks WebSocket
- Verify certificate is valid for the domain

### Solutions

**Check certificate:**
```bash
docker compose exec frontend curl -v https://kong.kortix.syhc.dev/
# Look for certificate details
```

**Enable more logging:**
```bash
docker compose logs kong realtime | tail -100
# Look for WebSocket upgrade attempts
```

**Try without certificate validation (local debugging only):**
```bash
docker compose exec frontend curl -k -v https://kong.kortix.syhc.dev/
```

---

## General Debugging Checklist

Use this systematic approach:

- [ ] Configuration is correct
  ```bash
  docker compose exec frontend env | grep NEXT_PUBLIC_REALTIME_URL
  ```

- [ ] Container is running latest build
  ```bash
  docker compose build --no-cache frontend && docker compose up -d frontend
  ```

- [ ] Kong is accessible
  ```bash
  docker compose exec frontend curl https://kong.kortix.syhc.dev/
  ```

- [ ] Browser console shows correct protocol
  ```
  [createRealtimeClient] expectedProtocol: "wss://"
  ```

- [ ] Network tab shows correct WebSocket URL
  ```
  wss://kong.kortix.syhc.dev/realtime/v1/websocket
  ```

- [ ] No JavaScript errors in console
  ```
  Open DevTools → Console → Look for red errors
  ```

- [ ] Kong logs show WebSocket attempt
  ```bash
  docker compose logs kong | grep -i websocket
  ```

---

## Quick Debug Commands

```bash
# 1. Check env var
docker compose exec frontend env | grep REALTIME

# 2. Check Kong running
docker compose ps kong

# 3. Test Kong connectivity
docker compose exec frontend curl -v https://kong.kortix.syhc.dev/

# 4. Check frontend logs
docker compose logs -f frontend

# 5. Check Kong logs
docker compose logs -f kong

# 6. Rebuild everything
docker compose build --no-cache frontend
docker compose up -d frontend

# 7. Clear containers and restart
docker compose down
docker compose up -d

# 8. Check if all services healthy
docker compose ps
```

---

## When All Else Fails

**Nuclear option: Complete fresh start**

```bash
# Stop everything
docker compose down

# Remove volumes (careful - deletes data!)
docker compose down -v

# Rebuild images
docker compose build --no-cache

# Start fresh
docker compose up -d

# Check status
docker compose ps
docker compose logs -f frontend
```

Then verify:
1. Open browser DevTools
2. Go to Console tab
3. Look for `[createRealtimeClient]` logs
4. Verify `expectedProtocol: "wss://"`
5. Check Network tab for WebSocket connection

---

## Logs to Check

### Frontend Logs
```bash
docker compose logs frontend | grep -i "websocket\|realtime\|error"
```
Look for: Connection attempts, protocol mismatch, errors

### Kong Logs
```bash
docker compose logs kong | grep -i "websocket\|upgrade\|error"
```
Look for: WebSocket upgrade attempts, certificate issues

### Realtime Service Logs
```bash
docker compose logs realtime | grep -i "error\|connect"
```
Look for: Connection failures, authentication issues

---

## Performance Baseline

After fixing, measure normal performance:

```javascript
// Browser console
console.time('websocket-latency');
// Message appears
console.timeEnd('websocket-latency');

// Should be:
// - Local: < 100ms
// - Over Cloudflare: 100-500ms
// - Over slow network: < 2000ms
```

If significantly slower, check:
- Network tab for latency
- Kong logs for bottlenecks
- Browser performance tab

---

## Need More Help?

1. Check [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) for fast answers
2. Review [COMPLETE_GUIDE.md](./COMPLETE_GUIDE.md) for full explanation
3. Use checklist above to verify each component
4. Collect logs and environment info
5. Compare with configuration examples in COMPLETE_GUIDE.md

**Still stuck?** Collect:
```bash
docker compose ps > status.txt
docker compose logs frontend >> logs.txt
docker compose logs kong >> logs.txt
docker compose exec frontend env | grep -i "supabase\|realtime" >> env.txt
```

Then review logs and configuration against the guides.
