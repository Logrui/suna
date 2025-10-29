# File Changes Reference - OAuth & Networking Fixes

This document shows the exact changes made to fix OAuth and login issues.

---

## File 1: `suna-supabase/docker/docker-compose.yml`

### Change: Add port mapping to auth service

**Location:** Line ~88-92 (auth service)

**Added:**
```yaml
ports:
  - "8100:9999"
```

**Full section (after change):**
```yaml
auth:
  container_name: supabase-auth
  image: supabase/gotrue:v2.180.0
  restart: unless-stopped
  ports:
    - "8100:9999"  # ← NEW
  healthcheck:
    # ... rest of config
```

**Reason:** Exposes the Auth service UI on port 8100 for OAuth flows and login.

---

## File 2: `docker-compose.yaml` (Suna root)

### Change 1: Add networks definition at bottom

**Location:** After `volumes:` section (around line 95+)

**Added:**
```yaml
networks:
  default:
    name: suna
  supabase:
    name: supabase
    external: true
```

**Full file ending (after change):**
```yaml
volumes:
  redis_data:

networks:
  default:
    name: suna
  supabase:
    name: supabase
    external: true
```

---

### Change 2: Add network config to backend service

**Location:** backend service (line ~47)

**Added at end of service definition:**
```yaml
networks:
  - default
  - supabase
```

**Full backend section (after change):**
```yaml
backend:
  image: ghcr.io/suna-ai/suna-backend:latest
  platform: linux/amd64
  build:
    context: ./backend
    dockerfile: Dockerfile
  ports:
    - "8000:8000"
  volumes:
    - ./backend/.env:/app/.env:ro
  environment:
    - REDIS_HOST=redis
    - REDIS_PORT=6379
    - REDIS_PASSWORD=
    - REDIS_SSL=False
  depends_on:
    redis:
      condition: service_healthy
    worker:
      condition: service_started
  networks:  # ← NEW
    - default  # ← NEW
    - supabase # ← NEW
```

---

### Change 3: Add network config to worker service

**Location:** worker service (line ~67)

**Added at end of service definition:**
```yaml
networks:
  - default
  - supabase
```

**Full worker section (after change):**
```yaml
worker:
  image: ghcr.io/suna-ai/suna-backend:latest
  platform: linux/amd64
  build:
    context: ./backend
    dockerfile: Dockerfile
  command: uv run dramatiq --skip-logging --processes 4 --threads 4 run_agent_background
  volumes:
    - ./backend/.env:/app/.env:ro
  environment:
    - REDIS_HOST=redis
    - REDIS_PORT=6379
    - REDIS_PASSWORD=
    - REDIS_SSL=False
  depends_on:
    redis:
      condition: service_healthy
  networks:  # ← NEW
    - default  # ← NEW
    - supabase # ← NEW
```

---

### Change 4: Add network config to frontend service

**Location:** frontend service (line ~84)

**Added at end of service definition:**
```yaml
networks:
  - default
  - supabase
```

**Full frontend section (after change):**
```yaml
frontend:
  init: true
  build:
    context: ./frontend
    dockerfile: Dockerfile
  ports:
    - "3000:3000"
  depends_on:
    - backend
  networks:  # ← NEW
    - default  # ← NEW
    - supabase # ← NEW
```

---

## File 3: `frontend/.env.local`

### Change: Update Supabase URL for container communication

**Location:** Line 2

**Changed from:**
```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8002
```

**Changed to:**
```bash
NEXT_PUBLIC_SUPABASE_URL=http://supabase-kong:8000
```

**Full file (after change):**
```bash
NEXT_PUBLIC_ENV_MODE=local
NEXT_PUBLIC_SUPABASE_URL=http://supabase-kong:8000

NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE

NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_URL=http://localhost:3000
```

**Reason:** 
- `localhost` inside container means container itself, not the host
- `supabase-kong` is the service name on the supabase network
- Port 8000 is the internal port (8002 is host mapping)

---

## Summary of Changes

| File | Changes | Lines Changed |
|------|---------|----------------|
| `suna-supabase/docker/docker-compose.yml` | Added port 8100 mapping | 1 line added |
| `docker-compose.yaml` | Added networks config + connected 3 services | 16 lines added |
| `frontend/.env.local` | Changed Supabase URL | 1 line changed |
| **Total** | **3 files** | **~18 changes** |

---

## Verification

To verify all changes were applied correctly:

```bash
# Check suna-supabase config
grep -n "8100" d:\Homelab\suna-supabase\docker\docker-compose.yml
# Should find: ports:
#              - "8100:9999"

# Check docker-compose networks
tail -10 d:\Homelab\suna\docker-compose.yaml
# Should show networks section

# Check frontend env
cat d:\Homelab\suna\frontend\.env.local | grep SUPABASE_URL
# Should show: NEXT_PUBLIC_SUPABASE_URL=http://supabase-kong:8000
```

---

## Rollback (if needed)

### Rollback Change 1 (Port 8100)
```bash
# Remove port 8100 from auth service
# Or: git checkout suna-supabase/docker/docker-compose.yml
```

### Rollback Change 2 (Networks)
```bash
# Remove networks config from docker-compose.yaml
# Or: git checkout docker-compose.yaml
```

### Rollback Change 3 (Frontend URL)
```bash
# Revert frontend/.env.local to:
# NEXT_PUBLIC_SUPABASE_URL=http://localhost:8002
```

---

## Impact Analysis

### What This Enables

✅ Frontend can reach Supabase services via shared network
✅ OAuth flows complete successfully
✅ Login requests reach auth service
✅ Backend can access database/auth

### What This Doesn't Change

- Service isolation (services still only access what they need)
- Port mappings to host (localhost:3000, etc. still work same way)
- Internal logic (no code changes)
- Security model (still uses auth tokens)

---

## Testing After Applying Changes

```bash
# Rebuild and start
docker compose down
docker compose up -d --build

# Verify
docker compose ps
docker network inspect supabase | grep suna

# Test login
# Go to http://localhost:3000/auth
# Enter credentials
# Should work (not "fetch failed")
```
