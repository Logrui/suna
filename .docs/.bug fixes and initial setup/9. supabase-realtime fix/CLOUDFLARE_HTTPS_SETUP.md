# Cloudflare HTTPS WebSocket Setup - Complete Guide

## What We Had to Do (Because Cloudflare Makes Everything Complicated)

### The Problem
- Local WebSocket worked: `ws://localhost:8888/realtime/v1/websocket` ✅
- Cloudflare WebSocket failed: `wss://kong.kortix.syhc.dev/realtime/v1/websocket` ❌
- Error: `ERR_SSL_VERSION_OR_CIPHER_MISMATCH`

### Root Causes Found
1. **Missing Edge Certificate**: Cloudflare Universal SSL doesn't cover multi-level subdomains (`kong.kortix.syhc.dev`)
2. **Self-signed Origin Certificate**: mkcert certificates aren't trusted by Cloudflare tunnel by default
3. **Kong SSL Configuration**: Missing TLS protocol and cipher configuration

---

## Solution Steps (What Actually Worked)

### 1. Generate Local SSL Certificates with mkcert
**Why**: Kong needs HTTPS certificates that include `localhost` hostname

```powershell
# Install mkcert
choco install mkcert -y

# Install local CA
mkcert -install

# Generate certificates (includes localhost, *.kortix.syhc.dev, etc.)
cd D:\Homelab\suna-supabase\docker\volumes\api
mkcert -cert-file kong-cert.pem -key-file kong-key.pem localhost 127.0.0.1 ::1 kong.kortix.syhc.dev *.kortix.syhc.dev
```

**Files Created**:
- `kong-cert.pem` - SSL certificate
- `kong-key.pem` - Private key
- `C:\Users\<username>\AppData\Local\mkcert\rootCA.pem` - CA certificate

---

### 2. Configure Kong for HTTPS
**Why**: Kong needs to accept HTTPS connections from Cloudflare tunnel

**Edit `docker/docker-compose.yml`**:

```yaml
kong:
  volumes:
    - ./volumes/api/kong-cert.pem:/home/kong/ssl/kong-cert.pem:ro
    - ./volumes/api/kong-key.pem:/home/kong/ssl/kong-key.pem:ro
  environment:
    KONG_SSL_CERT: /home/kong/ssl/kong-cert.pem
    KONG_SSL_CERT_KEY: /home/kong/ssl/kong-key.pem
    KONG_SSL_PROTOCOLS: "TLSv1.2 TLSv1.3"
    KONG_SSL_CIPHERS: "ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384"
    KONG_SSL_PREFER_SERVER_CIPHERS: "on"
```

**Restart Kong**:
```powershell
cd D:\Homelab\suna-supabase\docker
docker-compose restart kong
```

---

### 3. Enable Cloudflare Total TLS
**Why**: Multi-level subdomains (`kong.kortix.syhc.dev`) aren't covered by Universal SSL

**Steps**:
1. Go to: `https://dash.cloudflare.com/<account_id>/syhc.dev/ssl-tls/edge-certificates`
2. Find **Total TLS** section
3. Toggle **Enable Total TLS** to ON
4. Wait 2-5 minutes for certificate issuance

**Result**: Cloudflare automatically issues certificates for all proxied hostnames

---

### 4. Configure Certificate Authority for Cloudflared
**Why**: Cloudflared service needs to trust mkcert's self-signed certificates

```powershell
# Copy mkcert CA to accessible location
New-Item -ItemType Directory -Path "C:\cloudflared" -Force
Copy-Item "$env:LOCALAPPDATA\mkcert\rootCA.pem" "C:\cloudflared\mkcert-ca.pem" -Force

# Grant SYSTEM account read access (cloudflared runs as SYSTEM)
icacls "C:\cloudflared\mkcert-ca.pem" /grant "SYSTEM:(R)"
```

---

### 5. Configure Cloudflare Tunnel (Zero Trust Dashboard)

**Tunnel Settings** → **Public Hostname** → Edit `kong.kortix.syhc.dev`:

**Service**:
- Type: `HTTPS`
- URL: `localhost:8445`

**Additional Application Settings** → **TLS**:
- ✅ **No TLS Verify**: ON (because CA pool path doesn't work reliably with remotely-managed tunnels)
- **Origin Server Name**: (empty)
- **Certificate Authority Pool**: `C:\cloudflared\mkcert-ca.pem` (optional, but we used No TLS Verify instead)

**HTTP Settings**:
- ✅ **HTTP2 Connection**: ON
- **Disable Chunked Encoding**: OFF

**Save** → Restart cloudflared service:
```powershell
# Run as Administrator
Restart-Service cloudflared
```

---

## Testing & Verification

### Local HTTPS Test
```powershell
$key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlLWRlbW8iLCJpYXQiOjE2NDE3NjkyMDAsImV4cCI6MTc5OTUzNTYwMH0.3oxoyIq4gsDgKv97f3OU7EPTAOOyXaq_yqci_5kDjTY"
$uri = [Uri]"https://localhost:8445/realtime/v1/websocket?apikey=$key&vsn=1.0.0"
$request = [Net.HttpWebRequest]::Create($uri)
$request.Headers.Add("Upgrade", "websocket")
$response = $request.GetResponse()
# Should return: HTTP 101 Switching Protocols
```

### Cloudflare WebSocket Test
Open in browser or use in your app:
```
wss://kong.kortix.syhc.dev/realtime/v1/websocket?apikey=YOUR_KEY&vsn=1.0.0
```

---

## Final Architecture

```
Client Browser
    ↓ [HTTPS with Total TLS cert]
Cloudflare Edge
    ↓ [Cloudflare Tunnel]
Cloudflared Service (Windows)
    ↓ [HTTPS with mkcert cert, No TLS Verify enabled]
Kong (localhost:8445)
    ↓ [WebSocket Upgrade]
Supabase Realtime (port 4000)
```

---

## Key Lessons Learned

1. **Cloudflare Universal SSL** only covers one-level subdomains
   - `kortix.syhc.dev` ✅ Covered
   - `kong.kortix.syhc.dev` ❌ Not covered → Need Total TLS

2. **Certificate Authority Pool** in remotely-managed tunnels is unreliable
   - File path issues when cloudflared runs as SYSTEM
   - **Solution**: Use "No TLS Verify" instead

3. **Kong requires explicit TLS configuration**
   - Must specify TLS protocols (1.2, 1.3)
   - Must specify cipher suites
   - Must mount certificate files into container

4. **mkcert certificates must include localhost**
   - Cloudflared connects to `localhost:8445`, not `kong.kortix.syhc.dev`
   - Certificate SAN must include: `localhost`, `127.0.0.1`, `::1`

---

## Files Modified

### Kong Configuration
- `docker/docker-compose.yml` - Added SSL volume mounts and environment variables
- `docker/volumes/api/kong.yml` - No changes (original config was correct!)

### Certificates Created
- `docker/volumes/api/kong-cert.pem` - Kong SSL certificate (mkcert)
- `docker/volumes/api/kong-key.pem` - Kong private key (mkcert)
- `C:\cloudflared\mkcert-ca.pem` - CA certificate for cloudflared

---

## Troubleshooting

### Error: ERR_SSL_VERSION_OR_CIPHER_MISMATCH
**Cause**: Missing Cloudflare edge certificate for multi-level subdomain
**Solution**: Enable Total TLS

### Error: 502 Bad Gateway
**Cause**: Cloudflared can't connect to Kong's HTTPS
**Solution**: Enable "No TLS Verify" in tunnel settings

### Error: This site can't provide a secure connection
**Cause**: Kong's SSL certificate or TLS protocols misconfigured
**Solution**: Verify Kong environment variables and restart container

---

## Maintenance

### Certificate Renewal
mkcert certificates expire in **~2 years**. To renew:
```powershell
cd D:\Homelab\suna-supabase\docker\volumes\api
mkcert -cert-file kong-cert.pem -key-file kong-key.pem localhost 127.0.0.1 ::1 kong.kortix.syhc.dev *.kortix.syhc.dev
docker-compose restart kong
```

### Cloudflared Service Management
```powershell
# Check status
Get-Service cloudflared

# Restart (requires admin)
Restart-Service cloudflared

# View logs
Get-EventLog -LogName Application -Source "cloudflared*" -Newest 10
```

---

## Success Criteria ✅

- [x] Local HTTP WebSocket: `ws://localhost:8888/realtime/v1/websocket` → HTTP 101
- [x] Local HTTPS WebSocket: `wss://localhost:8445/realtime/v1/websocket` → HTTP 101
- [x] Cloudflare WSS: `wss://kong.kortix.syhc.dev/realtime/v1/websocket` → HTTP 101
- [x] Browser shows Kong auth prompt (not SSL error)
- [x] Application can establish WebSocket connection

---

**Date Completed**: November 8, 2025
**Time Spent**: Too fucking long (thanks Cloudflare)
**Final Status**: ✅ WORKING
