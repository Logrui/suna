# Supabase Configuration: `config.toml` Usage & Self-Hosted Setup

## Overview

The relationship between `D:\Homelab\suna\backend\supabase\config.toml` and `D:\Homelab\suna-supabase\docker\docker-compose.yml` is **one of two separate systems**:

1. **Supabase CLI (`config.toml`)** - Used by `npx supabase start` for local development
2. **Suna-Supabase Docker Compose** - Pre-built containerized Supabase instance for production/staging

---

## Current Setup: Two Separate Systems

### System 1: Supabase CLI (What You Modified)

**File:** `backend/supabase/config.toml`

```toml
[storage]
file_size_limit = "100GiB"  # ← You updated this

[storage.buckets.agentpress]
file_size_limit = "100GiB"  # ← And this
```

**Used by:** `npx supabase start` (CLI command)

**When it applies:** Only when running Supabase via the CLI locally

```bash
cd backend
npx supabase start  # ← Uses config.toml
```

---

### System 2: Docker Compose (Suna-Supabase)

**File:** `D:\Homelab\suna-supabase\docker\docker-compose.yml`

**Used by:** Pre-built containerized Supabase services

```bash
cd suna-supabase/docker
docker-compose up -d  # ← Does NOT read config.toml
```

**Storage Configuration:** Defined inline in environment variables and volumes, NOT in `config.toml`

---

## Key Question: Which System Are You Using?

### Check Your Setup

Let me analyze your docker-compose output to determine:

```bash
# Option 1: Are you running Supabase CLI?
cd D:\Homelab\suna\backend
npx supabase status

# Option 2: Are you running suna-supabase Docker?
cd D:\Homelab\suna-supabase\docker
docker-compose ps
```

### From Your `docker-compose.yaml` in suna/:

```yaml
# This comment in your main docker-compose.yaml says:
# ⚠️  IMPORTANT LIMITATION - LOCAL SUPABASE:
# Currently, local Supabase (via `npx supabase start`) is NOT supported with
# Docker Compose due to network configuration complexity.
#
# CURRENT WORKAROUND:
# - Use cloud Supabase for Docker Compose setup
# - OR run everything manually (no Docker) to use local Supabase
```

**This tells us:** Your current setup uses one of two approaches:

1. **Approach A:** `npx supabase start` (Supabase CLI) + Manual backend/frontend
   - Config location: `backend/supabase/config.toml` ✅ Your config applies here
   
2. **Approach B:** Suna-Supabase Docker + Backend Docker
   - Config location: `suna-supabase/docker/docker-compose.yml` (hardcoded)

---

## Where Storage Limits Are Defined in Each System

### System 1: Supabase CLI (`npx supabase start`)

**Your config file is used here:**

```toml
# backend/supabase/config.toml
[storage]
enabled = true
file_size_limit = "100GiB"  # ← You changed this ✅

[storage.buckets.agentpress]
public = false
file_size_limit = "100GiB"  # ← You changed this ✅
```

**How it works:**
1. Supabase CLI reads `config.toml`
2. Creates local Docker containers based on it
3. Applies the storage limit

**To apply changes:**
```bash
cd backend
npx supabase stop
npx supabase start  # Restart to pick up new config.toml
```

---

### System 2: Suna-Supabase Docker (`docker-compose.yml`)

**Storage limits are NOT in a config file - they're hardcoded in the compose file:**

```yaml
# suna-supabase/docker/docker-compose.yml
db:
  container_name: supabase-postgres
  image: supabase/postgres:15.1.0.147
  volumes:
    # Configuration comes from postgres.conf files, not config.toml
    - ./volumes/db/postgres.conf:/etc/postgresql/postgresql.conf:ro,z
    - ./volumes/db/pg_hba.conf:/etc/postgresql/pg_hba.conf:ro,z
    - ./volumes/db/pgsodium.sql:/docker-entrypoint-initdb.d/migrations/01-pgsodium.sql:Z
    # ↑ These are the actual config files used
```

**Storage limit applies at:**
- PostgreSQL level (max_wal_size, max_virtual_address_space)
- NOT configurable via `config.toml` in this setup
- Would require modifying `volumes/db/postgres.conf`

---

## Answer: Do You Need to Restart suna-supabase?

### ✅ YES, IF You're Using suna-supabase Docker:

**If you're running:**
```bash
cd suna-supabase/docker
docker-compose up -d
```

**Then you need to restart it** (but NOT because of your config.toml changes):

```bash
cd D:\Homelab\suna-supabase\docker
docker-compose down
docker-compose up -d
```

**Why?** The suna-supabase Docker compose:
- Does NOT read `backend/supabase/config.toml` at all
- Has its own hardcoded storage configs
- Your changes to 50MB → 100GB apply only to Supabase CLI, not Docker

---

### ❌ NO, IF You're Using Supabase CLI:

**If you're running:**
```bash
cd backend
npx supabase start
```

**Then you only need to restart Supabase CLI:**

```bash
cd D:\Homelab\suna\backend
npx supabase stop
npx supabase start  # This picks up the new config.toml
```

---

## How to Determine Your Current Setup

### Check if Supabase CLI is running:

```powershell
# Windows PowerShell
npx supabase status

# If this works, you're using CLI setup
# If error "not initialized", you're using Docker
```

### Check if Docker Supabase is running:

```powershell
cd D:\Homelab\suna-supabase\docker
docker-compose ps

# If containers like supabase-postgres, supabase-kong show up, you're using Docker
```

### Check which one handles your requests:

```bash
# From your backend logs, look for connection string:
echo $env:SUPABASE_URL

# If it says http://localhost:54321 → CLI setup
# If it says http://supabase-kong:8000 → Docker setup
# If it says https://xxx.supabase.co → Cloud setup
```

---

## Detailed Configuration Paths for Each System

### Supabase CLI (System 1)

```
D:\Homelab\suna\backend\
├── supabase/
│   ├── config.toml ← Storage config (YOU MODIFIED THIS) ✅
│   ├── migrations/
│   │   └── *.sql
│   └── functions/
└── .env
```

**Storage limits in config.toml:**
```toml
[storage]
file_size_limit = "100GiB"  # Global limit

[storage.buckets.agentpress]
file_size_limit = "100GiB"  # Per-bucket limit
```

**Applied when:** `npx supabase start`

---

### Suna-Supabase Docker (System 2)

```
D:\Homelab\suna-supabase\docker\
├── docker-compose.yml ← Main configuration (NOT using config.toml)
├── volumes/
│   ├── db/
│   │   ├── postgres.conf ← PostgreSQL config (NOT your config.toml)
│   │   ├── pg_hba.conf
│   │   ├── pgsodium.sql
│   │   └── *.sql
│   ├── functions/
│   ├── pooler/
│   └── logs/
└── .env
```

**Storage limits:** Hardcoded in `docker-compose.yml` environment variables + `volumes/db/postgres.conf`

**Applied when:** `docker-compose up -d`

---

## Important Discovery: Your config.toml Changes DON'T Affect Docker Setup

### The Problem

Your file: `D:\Homelab\suna\backend\supabase\config.toml`

```toml
[storage]
file_size_limit = "100GiB"  # ← YOU CHANGED THIS
```

The suna-supabase docker-compose at `D:\Homelab\suna-supabase\docker\docker-compose.yml`:
- **Does NOT read this file** ❌
- Has its own separate configuration
- Storage limits defined elsewhere

### Why They're Separate

1. **Different projects:**
   - `suna/` = Your Suna Kortix project (uses Supabase CLI locally)
   - `suna-supabase/` = Pre-built Supabase distribution (uses Docker, standalone)

2. **Different deployment models:**
   - CLI = Development-focused, reads from `config.toml`
   - Docker = Production-ready, self-contained

3. **Different configuration sources:**
   - CLI: `config.toml`
   - Docker: `docker-compose.yml` + `volumes/*.conf`

---

## What You Should Do

### Option 1: Using Supabase CLI (Recommended for Development)

**If running:**
```bash
cd D:\Homelab\suna\backend
npx supabase start
```

**Your changes already apply!** ✅

```bash
# Restart to confirm
npx supabase stop
npx supabase start
```

**Verify:**
```bash
# Check that 100GB limit is active
curl http://localhost:54321/health  # Verify Supabase is running
```

---

### Option 2: Using Suna-Supabase Docker

**If running:**
```bash
cd D:\Homelab\suna-supabase\docker
docker-compose ps  # Verify containers are running
```

**You need to update Docker storage limits separately:**

```toml
# Edit: D:\Homelab\suna-supabase\docker\volumes\db\postgres.conf
# Add or modify:
max_wal_size = 100GB  # 100GB WAL limit
work_mem = '4GB'      # Working memory per operation
```

**Then restart:**
```bash
cd D:\Homelab\suna-supabase\docker
docker-compose down
docker-compose up -d
```

---

### Option 3: Migrate to Unified Setup (Recommended for Production)

**Use suna-supabase Docker with backend services:**

```bash
# Start Supabase
cd D:\Homelab\suna-supabase\docker
docker-compose up -d

# Start Suna backend (connects to Docker Supabase)
cd D:\Homelab\suna\backend
docker build -t suna-backend .
docker run -e SUPABASE_URL=http://supabase-kong:8000 \
           -e SUPABASE_ANON_KEY=<key> \
           suna-backend
```

---

## Summary Table

| Aspect | Supabase CLI | Suna-Supabase Docker |
|--------|--------------|---------------------|
| **Config file** | `backend/supabase/config.toml` ✅ | `docker-compose.yml` (NOT config.toml) |
| **Storage limit config** | `[storage] file_size_limit` | `volumes/db/postgres.conf` |
| **Your 100GB change applies?** | ✅ YES | ❌ NO |
| **Start command** | `npx supabase start` | `docker-compose up -d` |
| **Restart needed?** | YES: `npx supabase stop && start` | YES: `docker-compose down && up -d` |
| **Best for** | Development | Production |

---

## Recommended Action for Your Self-Hosted Setup

### Step 1: Identify Your Current System

```powershell
# Check if CLI running
npx supabase status 2>&1 | findstr "API URL"

# Check if Docker running
docker ps --filter "name=supabase"
```

### Step 2: If Using CLI (Recommended for Development)

```bash
cd D:\Homelab\suna\backend

# Your config.toml changes are ready - just restart
npx supabase stop
npx supabase start

# Verify 100GB limit is active
# (This is already configured in your updated config.toml)
```

### Step 3: If Using Docker (For Production)

```bash
# Update storage config
# Edit: D:\Homelab\suna-supabase\docker\volumes\db\postgres.conf
# Ensure PostgreSQL can handle 100GB workloads

# Restart Docker Supabase
cd D:\Homelab\suna-supabase\docker
docker-compose down
docker-compose up -d
```

---

## Next Steps

1. **Verify which system you're currently using** (CLI or Docker)
2. **If CLI:** Restart with `npx supabase stop && start` (your 100GB change applies automatically)
3. **If Docker:** Also update `volumes/db/postgres.conf` and restart Docker
4. **Test:** Try uploading files > 50MB to verify 100GB limit works

The key insight: **Your `config.toml` changes only affect the Supabase CLI setup, not the Docker-based suna-supabase.**
