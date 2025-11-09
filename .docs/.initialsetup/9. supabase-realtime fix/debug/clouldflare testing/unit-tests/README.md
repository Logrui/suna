# WebSocket Debugging Unit Tests

This directory contains standalone HTML test files to debug WebSocket connections to Supabase Realtime.

## Test Files

### 1. `test-websocket-basic.html`
**Purpose:** Basic WebSocket connection testing with detailed logging

**Features:**
- Test basic connection to `wss://kong.kortix.syhc.dev`
- Test with full Supabase parameters (apikey, eventsPerSecond, vsn)
- Detailed error logging with close codes
- Real-time connection status monitoring

**How to use:**
1. Open the file in your browser (double-click or drag to browser)
2. Click "Test Basic Connection" to test minimal parameters
3. Click "Test With Full Params" to test with all Supabase parameters
4. Check the logs for detailed error information

**What to look for:**
- **Close Code 1006:** Network/proxy issue (connection never established)
- **Close Code 1015:** TLS/SSL handshake failure
- **Close Code 1000:** Normal closure (connection worked!)
- **Error event:** Check browser console for detailed error

---

### 2. `test-websocket-ports.html`
**Purpose:** Compare HTTP (8888) vs HTTPS (8445) port behavior

**Features:**
- Side-by-side testing of both Kong ports
- Test through Cloudflare Tunnel (kortix.syhc.dev / kong.kortix.syhc.dev)
- Test direct localhost connections
- Performance comparison (connection time)
- Summary of which configurations work

**How to use:**
1. Open the file in your browser
2. Click tests for HTTP port (left side) and HTTPS port (right side)
3. Compare results in the summary section

**Test scenarios:**
- HTTP via kortix.syhc.dev (Cloudflare → localhost:8888)
- HTTP Direct (localhost:8888)
- HTTPS via kong.kortix.syhc.dev (Cloudflare → localhost:8445)
- HTTPS Direct (localhost:8445)

---

## Current Issue

Based on browser console logs, the WebSocket connection to `wss://kong.kortix.syhc.dev/realtime/v1/websocket` is failing with a generic "failed" error.

**Known Facts:**
1. ✅ Regular HTTP/HTTPS requests work through Cloudflare Tunnel
2. ✅ Auth, REST API, Storage all work fine on HTTP port (8888)
3. ❌ WebSocket connections fail
4. ⚠️ HTTPS port (8445) is now configured in Cloudflare Tunnel with "No TLS Verify"

**Possible Causes:**
1. **TLS/SSL Certificate Issue** - Kong's self-signed cert is rejected
2. **WebSocket Protocol Upgrade Failure** - Cloudflare not properly upgrading HTTP→WS
3. **Kong Configuration** - Kong not routing `/realtime/v1/websocket` correctly
4. **Cloudflare Security Rules** - WAF or firewall blocking WebSocket connections

---

## Debugging Steps

### Step 1: Run Basic Test
```bash
# Open in browser:
file:///D:/Homelab/suna/.docs/.initialsetup/9.%20supabase-realtime/unit-tests/test-websocket-basic.html
```

Look for the close code in the logs:
- **1006** → Network issue (never reached server)
- **1015** → SSL/TLS handshake failed
- Other codes → Server-side issue

### Step 2: Compare Ports
```bash
# Open in browser:
file:///D:/Homelab/suna/.docs/.initialsetup/9.%20supabase-realtime/unit-tests/test-websocket-ports.html
```

Test all 4 scenarios and see which ones work:
- If only localhost works → Cloudflare Tunnel issue
- If HTTPS works but HTTP doesn't → Protocol issue
- If nothing works → Kong/Realtime service issue

### Step 3: Check Kong Logs
```powershell
# In terminal:
docker logs supabase-kong --tail 50

# Look for WebSocket upgrade requests:
# Should see: GET /realtime/v1/websocket HTTP/1.1
# Should see: Connection: Upgrade
# Should see: Upgrade: websocket
```

### Step 4: Check Realtime Logs
```powershell
# In terminal:
docker logs realtime-dev.supabase-realtime --tail 50

# Look for connection attempts
# Should see Phoenix channel joins
```

---

## Expected Behavior

**Successful WebSocket Connection:**
```
[timestamp] ✅ WebSocket OPENED successfully!
[timestamp] ReadyState: 1 (OPEN)
[timestamp] 📨 Message received: {"event":"phx_reply","payload":{"response":{},"status":"ok"},"ref":"1","topic":"phoenix"}
```

**Failed Connection (TLS):**
```
[timestamp] ❌ WebSocket ERROR occurred!
[timestamp] 🔌 WebSocket CLOSED
[timestamp] Code: 1015
[timestamp] Close code meaning: TLS handshake failed
```

**Failed Connection (Network):**
```
[timestamp] ❌ WebSocket ERROR occurred!
[timestamp] 🔌 WebSocket CLOSED
[timestamp] Code: 1006
[timestamp] Close code meaning: Abnormal closure (no status code)
```

---

## Next Steps Based on Results

### If Close Code = 1015 (TLS Handshake Failed)
**Problem:** SSL/TLS certificate issue
**Solution:** 
1. Verify "No TLS Verify" is enabled in Cloudflare Tunnel for kong.kortix.syhc.dev
2. Try HTTP port instead (kortix.syhc.dev with path-based routing)
3. Generate proper SSL cert for Kong

### If Close Code = 1006 (Abnormal Closure)
**Problem:** Connection never reaches Kong
**Solution:**
1. Check Cloudflare Tunnel status
2. Verify hostname routing (kong.kortix.syhc.dev → localhost:8445)
3. Check firewall rules
4. Try different Cloudflare Tunnel settings (HTTP2, compression, etc.)

### If Direct Localhost Works But Cloudflare Doesn't
**Problem:** Cloudflare Tunnel not passing WebSocket correctly
**Solution:**
1. Check Cloudflare dashboard for WebSocket settings
2. Verify tunnel configuration file
3. Try path-based routing instead of subdomain

---

## Additional Debugging Commands

```powershell
# Test WebSocket upgrade locally (PowerShell)
$headers = @{ 
    "Connection" = "Upgrade"
    "Upgrade" = "websocket"
    "Sec-WebSocket-Version" = "13"
    "Sec-WebSocket-Key" = "dGhlIHNhbXBsZSBub25jZQ=="
}
Invoke-WebRequest -Uri "http://localhost:8888/realtime/v1/websocket?apikey=YOUR_KEY" -Headers $headers -Method GET

# Check Kong routes
docker exec supabase-kong curl -s http://localhost:8001/routes | ConvertFrom-Json

# Check if Realtime is healthy
docker exec supabase-kong curl -s http://realtime-dev.supabase-realtime:4000/api/tenants/realtime-dev/health
```

---

## Resources

- [Cloudflare Tunnel WebSocket Support](https://developers.cloudflare.com/cloudflare-one/)
- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [WebSocket Close Codes](https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent/code)
- [Phoenix Channels Protocol](https://hexdocs.pm/phoenix/channels.html)
