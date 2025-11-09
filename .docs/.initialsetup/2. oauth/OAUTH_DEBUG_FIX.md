# OAuth & Login Debug & Fix Guide

## 🔴 Issue Found

### Symptoms
1. **OAuth Flow Broken**: Clicking "Continue with Google" redirects to blank page at `http://localhost:8100/auth/v1/authorize?provider=google...`
2. **Manual Login Failed**: "Login failed fetch failed" with `ECONNREFUSED 127.0.0.1:8100`
3. **Root Cause**: **Supabase Auth service not exposed on port 8100**

### Error Details
```
TypeError: fetch failed
  [cause]: Error: connect ECONNREFUSED 127.0.0.1:8100
    code: 'ECONNREFUSED',
    address: '127.0.0.1',
    port: 8100
```

---

## ✅ Fix Applied

### Change Made to `suna-supabase/docker/docker-compose.yml`

Added port mapping to the `auth` service:

```yaml
auth:
  container_name: supabase-auth
  image: supabase/gotrue:v2.180.0
  restart: unless-stopped
  ports:
    - "8100:9999"  # ← ADDED THIS
  healthcheck:
    # ... rest of config
```

**What this does:**
- Exposes Supabase Auth service on port **8100** (host)
- Auth service internally runs on port **9999**
- Frontend can now reach the Auth UI at `http://localhost:8100`
- OAuth providers can now communicate with the auth endpoint

---

## 🚀 Steps to Deploy Fix

### Step 1: Restart Supabase Stack
```bash
cd d:\Homelab\suna-supabase\docker

# Stop the old services
docker compose down

# Verify port 8100 is free
netstat -ano | findstr :8100

# Start with the updated config
docker compose up -d

# Wait for services to be healthy
docker compose ps
```

Expected output:
```
NAME                     STATUS        PORTS
supabase-studio          Up (healthy)  6005:3000
supabase-kong            Up (healthy)  8002:8000
supabase-auth            Up (healthy)  8100:9999  ← NEW
supabase-rest            Up (healthy)  
supabase-realtime        Up (healthy)  
supabase-storage         Up (healthy)  
supabase-db              Up (healthy)  
... (other services)
```

### Step 2: Verify Port 8100 is Accessible
```bash
# Test connection
curl http://localhost:8100/health

# Should return something or empty 200 OK
# NOT: Connection refused
```

### Step 3: Restart Frontend (to clear any cached state)
```bash
cd d:\Homelab\suna
docker compose restart frontend

# Watch logs
docker compose logs -f frontend
```

### Step 4: Test OAuth Flow
1. Open http://localhost:3000/auth
2. Click "Continue with Google"
3. You should see a Google OAuth consent screen (not a blank page)

### Step 5: Test Email/Password Login
1. Open http://localhost:3000/auth
2. Enter email: `yhcsanction@gmail.com`
3. Enter password: (the one you set)
4. Click "Login"
5. Should redirect to dashboard or show error if credentials wrong

---

## 🔍 Architecture: How Auth Flow Works Now

```
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND (localhost:3000)                                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User clicks "Continue with Google"                         │
│    ↓                                                          │
│  Supabase JS Client sends request to /auth/v1/authorize    │
│    ↓                                                          │
│  KONG (localhost:8002) receives request                    │
│    ↓                                                          │
│  Kong routes /auth/v1/authorize → http://auth:9999/authorize
│    ↓                                                          │
│  AUTH SERVICE (localhost:8100 exposed from port 9999)      │
│    ↓                                                          │
│  Auth service redirects to Google OAuth provider            │
│    ↓                                                          │
│  User authorizes, Google redirects back to auth callback    │
│    ↓                                                          │
│  Auth service generates JWT token                           │
│    ↓                                                          │
│  Frontend receives session in cookie                        │
│    ↓                                                          │
│  User logged in! Redirected to /dashboard                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 How OAuth Providers Are Configured

### Current Setup
The Supabase Auth service is configured to handle OAuth, but **Google/GitHub OAuth requires configuration**.

### To Enable Google OAuth:

1. **In Supabase Studio** (http://localhost:6005):
   - Go to Authentication → Providers → Google
   - Add your Google OAuth App credentials (Client ID, Client Secret)
   - Set redirect URI to: `http://localhost:8002/auth/v1/callback`

2. **OR via Environment Variables** (in `.env`):
   ```bash
   # Add to suna-supabase/docker/.env
   GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
   GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=your-google-client-id
   GOTRUE_EXTERNAL_GOOGLE_SECRET=your-google-secret
   ```

3. **To Get Google Credentials**:
   - Go to https://console.cloud.google.com
   - Create OAuth 2.0 credentials (Web application)
   - Add `http://localhost:8002/auth/v1/callback` to redirect URIs
   - Copy Client ID and Secret

### To Enable GitHub OAuth:

Similar process, add to `.env`:
```bash
GOTRUE_EXTERNAL_GITHUB_ENABLED=true
GOTRUE_EXTERNAL_GITHUB_CLIENT_ID=your-github-client-id
GOTRUE_EXTERNAL_GITHUB_SECRET=your-github-secret
```

---

## ✅ Port Summary (Now Complete)

| Service | Port | Purpose | Status |
|---------|------|---------|--------|
| Frontend | 3000 | Next.js UI | ✅ Working |
| Backend | 8000 | FastAPI + /docs | ✅ Working |
| Kong | 8002 | Supabase API Gateway | ✅ Working |
| **Auth** | **8100** | **OAuth & Login UI** | **✅ FIXED** |
| Studio | 6005 | Database Management | ✅ Working |
| Redis | 6379 | Cache/Queue | ✅ Working |

---

## 🐛 Troubleshooting

### Issue: Still getting "blank page" at port 8100
**Solution:**
```bash
# Check if auth service is running
docker ps | grep supabase-auth

# If not running, check logs
docker compose logs supabase-auth

# Restart it
docker compose restart supabase-auth
```

### Issue: "Connection refused" on port 8100
**Solution:**
```bash
# Verify port 8100 is actually exposed
netstat -ano | findstr :8100

# Should show something like:
#   TCP    0.0.0.0:8100       LISTENING

# If not, restart compose
docker compose down
docker compose up -d
```

### Issue: OAuth provider says "invalid redirect URI"
**Solution:**
Check in Supabase console that redirect URI matches exactly:
- Configured: `http://localhost:8002/auth/v1/callback`
- In OAuth provider dashboard: `http://localhost:8002/auth/v1/callback`

### Issue: "Login failed" but no specific error
**Solution:**
Check backend logs:
```bash
cd d:\Homelab\suna
docker compose logs backend | tail -50
```

---

## 🧪 Testing Checklist

After applying the fix, verify each step:

- [ ] `docker compose ps` shows all Supabase services as "healthy"
- [ ] `curl http://localhost:8100/health` returns success
- [ ] Frontend loads at `http://localhost:3000`
- [ ] Auth page displays at `http://localhost:3000/auth`
- [ ] "Continue with Google" button exists (if OAuth configured)
- [ ] Email input field exists for manual login
- [ ] Can enter credentials without fetch errors
- [ ] Submitted login form doesn't cause "fetch failed" error
- [ ] Either successful login or proper error message appears

---

## 📝 Configuration Files Modified

| File | Change | Reason |
|------|--------|--------|
| `suna-supabase/docker/docker-compose.yml` | Added `ports: - "8100:9999"` to auth service | Expose Supabase Auth UI |

---

## 🎯 Next Steps After Fix

1. **Test Email/Password Login**
   - User created: `yhcsanction@gmail.com`
   - Test manual login

2. **Configure OAuth (Optional)**
   - Set up Google OAuth credentials
   - Set up GitHub OAuth credentials
   - Test OAuth flows

3. **Backend Integration**
   - Verify backend receives auth tokens
   - Test API endpoint authentication

4. **Database Verification**
   - Check that users are being created/stored correctly
   - Verify accounts table in Supabase

---

## 📚 Related Documentation

- [SUNA_AUTH_OVERVIEW.md](./SUNA_AUTH_OVERVIEW.md) - Complete auth system architecture
- [SETUP_CONFIGURATION_SUMMARY.md](./SETUP_CONFIGURATION_SUMMARY.md) - Docker setup guide
- [Supabase Auth Docs](https://supabase.com/docs/guides/auth)
- [Supabase OAuth Setup](https://supabase.com/docs/guides/auth/oauth-setup)

---

## ✨ Success Indicators

Once the fix is applied, you should see:

✅ **OAuth Flow:**
- Click "Continue with Google" → Redirects to Google consent screen → Back to app → Logged in

✅ **Email/Password:**
- Enter credentials → Submit → Either logged in or error shown

✅ **Logs:**
```bash
# Frontend: No ECONNREFUSED errors
docker compose logs frontend | grep -i "connection refused"
# Should return nothing

# Auth: Showing requests being processed
docker compose logs supabase-auth | grep -i "request"
```

---

## 🆘 Still Having Issues?

If problems persist after this fix, check:

1. **Is port 8100 exposed?**
   ```bash
   docker port supabase-auth
   # Should show: 9999/tcp -> 0.0.0.0:8100
   ```

2. **Can you reach it from host?**
   ```bash
   curl -v http://localhost:8100
   ```

3. **Are environment variables correct?**
   ```bash
   docker compose config supabase-auth | grep -i "GOTRUE"
   ```

4. **Check browser console**
   - Open http://localhost:3000/auth
   - Press F12 (Developer Tools)
   - Check Console tab for errors
   - Look for fetch/network errors

If still stuck, share:
- Output of `docker compose ps`
- Output of `curl -v http://localhost:8100`
- Browser console errors (F12)
- Frontend logs: `docker compose logs frontend | tail -100`
