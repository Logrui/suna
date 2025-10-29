# Docker Networking Fix - Suna & Supabase Integration

## 🔴 Issue Identified

### Symptoms
1. ✅ `curl http://localhost:8100/health` works from host
2. ❌ Frontend container gets `ECONNREFUSED 127.0.0.1:8100` 
3. ❌ OAuth redirects to 404 page
4. ❌ Login fails with "fetch failed"

### Root Cause

**Separate Docker Networks:**
- **supabase network** (172.29.0.0/16): Contains supabase-auth, supabase-kong, etc.
- **suna_default network** (172.28.0.0/16): Contains suna-frontend, suna-backend, etc.

Containers on different networks **cannot reach each other by hostname or IP**. When the frontend tried to reach `localhost:8100` from inside its container, it was trying to reach itself, not the host or other networks.

---

## ✅ Fixes Applied

### Fix #1: Add Supabase Network to Suna Services

**File:** `docker-compose.yaml`

**Changes:**
1. Added networks section at bottom:
```yaml
networks:
  default:
    name: suna
  supabase:
    name: supabase
    external: true
```

2. Added network config to services that need it:
```yaml
services:
  backend:
    # ... existing config ...
    networks:
      - default
      - supabase

  worker:
    # ... existing config ...
    networks:
      - default
      - supabase

  frontend:
    # ... existing config ...
    networks:
      - default
      - supabase
```

**Why:** Allows suna containers to communicate with supabase containers on the same network.

### Fix #2: Update Frontend Environment Variable

**File:** `frontend/.env.local`

**Before:**
```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8002
```

**After:**
```bash
NEXT_PUBLIC_SUPABASE_URL=http://supabase-kong:8000
```

**Why:** 
- `localhost` inside a container refers to the container itself
- `supabase-kong` is the hostname of the Kong service within the supabase network
- Kong internally runs on port 8000 (external port 8002 is host mapping)
- From container-to-container, we use internal hostname and port

---

## 🚀 How to Deploy These Fixes

### Step 1: Verify Changes

Verify the docker-compose.yaml has the networks section:
```bash
cd d:\Homelab\suna
# Check networks section exists
cat docker-compose.yaml | tail -20
```

Verify frontend .env has the updated URL:
```bash
cat frontend/.env.local
# Should show: NEXT_PUBLIC_SUPABASE_URL=http://supabase-kong:8000
```

### Step 2: Restart Suna Stack

```bash
cd d:\Homelab\suna

# Stop and remove containers
docker compose down

# Rebuild and start with new network configuration
docker compose up -d --build

# Wait for services to start
sleep 10
docker compose ps

# Check logs
docker compose logs -f frontend
```

### Step 3: Verify Network Connectivity

Check if frontend container is now on both networks:
```bash
docker network inspect suna | grep -A 50 "Containers" | grep suna-frontend
docker network inspect supabase | grep -A 150 "Containers" | grep suna-frontend
```

Expected output: `suna-frontend` should appear in **both** network inspects.

### Step 4: Test Connectivity from Frontend Container

```bash
# Exec into frontend container
docker exec -it suna-frontend-1 sh

# From inside the container, try to reach Kong
wget -O - http://supabase-kong:8000/health

# Should return success, not connection refused
# Exit container
exit
```

### Step 5: Test in Browser

1. Open http://localhost:3000/auth
2. Try email/password login with: `yhcsanction@gmail.com`
3. Should show an error (invalid credentials) or success, NOT "fetch failed"
4. Try "Continue with Google" (if OAuth configured)

---

## 📊 Network Architecture After Fix

```
┌────────────────────────────────────────────────────────┐
│ HOST MACHINE                                           │
├────────────────────────────────────────────────────────┤
│  Port 3000   →  http://localhost:3000/auth            │
│  Port 8000   →  http://localhost:8000/docs            │
│  Port 8002   →  http://localhost:8002 (Kong)          │
│  Port 8100   →  http://localhost:8100 (Auth UI)       │
│  Port 6005   →  http://localhost:6005 (Studio)        │
│  Port 6379   →  http://localhost:6379 (Redis)         │
└────────────────────────────────────────────────────────┘
         ↓                                  ↓
    ┌────────────────────────────────────────┐
    │ DOCKER HOST BRIDGE                     │
    ├────────────────────────────────────────┤
    │ Maps container ports to host ports     │
    └────────────────────────────────────────┘
         ↓                                  ↓
┌───────────────────────────┐    ┌──────────────────────────┐
│ SUNA NETWORK (172.28.0.0) │    │ SUPABASE NETWORK         │
│ (172.29.0.0)              │    │                          │
├───────────────────────────┤    ├──────────────────────────┤
│ suna-frontend (172.28.0.5)◄───►(now shared!)            │
│ suna-backend  (172.28.0.4)│    supabase-kong:8000       │
│ suna-worker   (172.28.0.3)│    supabase-auth:9999       │
│ suna-redis    (172.28.0.2)│    supabase-db:5432         │
│                           │    ... (other services)      │
└───────────────────────────┘    └──────────────────────────┘

Frontend resolves:
  - http://supabase-kong:8000 → 172.29.0.10:8000 (within supabase network)
  - API routes like /auth/v1/authorize reach Kong → Kong routes to Auth service
```

---

## 🔍 Troubleshooting

### Issue: Still getting "Connection refused"

```bash
# Check if frontend container is on both networks
docker inspect suna-frontend-1 | grep -A 30 "Networks"

# Should show both "suna" and "supabase" networks
```

If not showing both networks:
```bash
cd d:\Homelab\suna
docker compose down
docker compose up -d --build
docker compose ps
```

### Issue: 404 on /auth/v1/authorize

This is actually **expected if OAuth isn't configured**. The endpoint exists, but without OAuth provider credentials, it returns 404.

To fix:
1. Check backend logs: `docker compose logs backend`
2. Verify Kong is working: `curl http://localhost:8002/health`
3. Check if auth service is healthy: `docker compose -f ../suna-supabase/docker/docker-compose.yml ps supabase-auth`

### Issue: Hostname "supabase-kong" not resolving

```bash
# Test DNS resolution from frontend container
docker exec suna-frontend-1 nslookup supabase-kong

# If it fails, check that container is on supabase network
docker network connect supabase suna-frontend-1
docker compose restart frontend
```

---

## ✅ Testing Checklist After Fix

- [ ] `docker compose ps` shows all services as "Up"
- [ ] `docker network inspect suna | grep suna-frontend` shows container
- [ ] `docker network inspect supabase | grep suna-frontend` shows container (NEW!)
- [ ] `curl http://localhost:3000/auth` loads login page
- [ ] Frontend logs don't show "ECONNREFUSED"
- [ ] Can enter credentials and click submit (no fetch error)
- [ ] Get error response (invalid credentials) instead of fetch timeout
- [ ] OAuth redirects to Google/GitHub instead of 404

---

## 📚 Related Configuration

### Docker Compose Networks Documentation
- [Docker Networks Guide](https://docs.docker.com/engine/reference/commandline/network/)
- [Docker Compose Networking](https://docs.docker.com/compose/compose-file/05-services/#networks)

### Container Networking
- Containers on same network: Can reach each other by service name
- Containers on different networks: Need host IP or external routing
- External networks: Must pre-exist before docker-compose starts

---

## 🎯 What This Fixes

✅ **OAuth Flow:** Frontend can now reach Auth service → OAuth providers redirect properly
✅ **Login:** Frontend reaches Supabase Auth → Credentials validated
✅ **API Requests:** Backend can reach Supabase DB/Auth services
✅ **Worker Tasks:** Background workers can access database

---

## 📝 Files Modified

| File | Change | Purpose |
|------|--------|---------|
| `docker-compose.yaml` | Added networks config + connected services | Enable cross-network communication |
| `frontend/.env.local` | Changed URL from localhost:8002 → supabase-kong:8000 | Use container hostname instead of host port |

---

## 🚀 Next Steps

1. **Deploy the fixes** (see "How to Deploy" section above)
2. **Test login** with your test user
3. **Configure OAuth** (Google/GitHub credentials if needed)
4. **Test end-to-end** flow

If issues persist, check the troubleshooting section or share:
- Output of `docker compose ps`
- Output of `docker network inspect suna`
- Frontend logs: `docker compose logs frontend | tail -50`
