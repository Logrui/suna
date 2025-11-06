# OAuth Fix - Quick Start Guide

## 🚨 What Was Wrong
Port 8100 (Supabase Auth) was not exposed, causing:
- OAuth flows to fail (blank page)
- Login to fail with "fetch failed" / "ECONNREFUSED 127.0.0.1:8100"

## ✅ What Was Fixed
Added port mapping to `suna-supabase/docker/docker-compose.yml`:
```yaml
ports:
  - "8100:9999"
```

## 🚀 How to Deploy the Fix

### Option A: Quick Restart (Recommended)
```bash
cd d:\Homelab\suna-supabase\docker
docker compose down
docker compose up -d
docker compose ps
```

Wait for all services to show "healthy" status.

### Option B: Full Rebuild
```bash
cd d:\Homelab\suna-supabase\docker
docker compose down -v
docker compose up -d --build
docker compose ps
```

## ✓ Verify Fix Works

### Check 1: Port 8100 is accessible
```bash
curl http://localhost:8100/health
# Should return 200 OK (or connection established)
```

### Check 2: Frontend loads
```
http://localhost:3000/auth
```
Should show login page without errors.

### Check 3: Try login
1. Email: `yhcsanction@gmail.com`
2. Try a password
3. Should show "Invalid credentials" or similar error (not "fetch failed")

### Check 4: No fetch errors
```bash
docker compose logs frontend | grep ECONNREFUSED
# Should return nothing
```

## 📋 Files Modified
- ✅ `suna-supabase/docker/docker-compose.yml` - Auth service port mapping added

## 🎯 Next: Configure OAuth (Optional)

To enable Google/GitHub OAuth, you need API credentials:

### Google OAuth Setup
1. Get credentials from https://console.cloud.google.com
2. Add to `suna-supabase/docker/.env`:
   ```bash
   GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
   GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=xxx
   GOTRUE_EXTERNAL_GOOGLE_SECRET=xxx
   ```
3. Restart: `docker compose restart supabase-auth`

### GitHub OAuth Setup
Similar to Google:
```bash
GOTRUE_EXTERNAL_GITHUB_ENABLED=true
GOTRUE_EXTERNAL_GITHUB_CLIENT_ID=xxx
GOTRUE_EXTERNAL_GITHUB_SECRET=xxx
```

## 🆘 Still Not Working?

```bash
# Check auth service health
docker compose ps supabase-auth

# Check logs
docker compose logs supabase-auth

# Test port directly
netstat -ano | findstr :8100
```

See `OAUTH_DEBUG_FIX.md` for detailed troubleshooting.

## 📝 Summary

| Before | After |
|--------|-------|
| ❌ Port 8100: Not exposed | ✅ Port 8100: Exposed |
| ❌ OAuth: Blank page | ✅ OAuth: Works (if configured) |
| ❌ Login: fetch failed | ✅ Login: Works |
| ❌ Port map: 8002 only | ✅ Port map: 8002 + 8100 |
