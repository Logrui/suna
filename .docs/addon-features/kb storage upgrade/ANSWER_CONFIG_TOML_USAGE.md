# Answer: How config.toml Is Used & Do You Need to Restart suna-supabase?

**Question:** "How is D:\Homelab\suna\backend\supabase\config.toml actually passed to the actual supabase server? Do we need to restart our suna-supabase self hosted version at D:\Homelab\suna-supabase\docker\docker-compose.yml?"

---

## Short Answer

**NO, you do NOT need to restart suna-supabase docker-compose.**

**Why?** Because `backend/supabase/config.toml` is **not used by** `suna-supabase/docker/docker-compose.yml`. They are **two completely separate systems**.

---

## Long Answer: How config.toml Actually Works

### The Two Systems

Your setup includes **two completely independent Supabase deployments**:

```
System 1: Supabase CLI
├── Command: npx supabase start
├── Location: D:\Homelab\suna\backend\
├── Config file: backend/supabase/config.toml ← YOU EDITED THIS ✅
├── Storage: Local Docker containers (managed by CLI)
└── Used for: Development

System 2: Suna-Supabase Docker
├── Command: docker-compose up -d
├── Location: D:\Homelab\suna-supabase\docker\
├── Config file: docker-compose.yml (NOT config.toml)
├── Storage: Containerized Supabase (pre-built)
└── Used for: Production/Staging
```

### How config.toml Gets to Supabase CLI

**Flow for System 1 (Supabase CLI):**

```
1. You edit: backend/supabase/config.toml
                ↓
2. You run: npx supabase start
                ↓
3. Supabase CLI reads config.toml
                ↓
4. CLI creates local Docker containers based on config
                ↓
5. Storage limit becomes: 100GiB (as you configured)
                ↓
6. Your app connects to: http://localhost:54321
```

**Example from your config:**
```toml
# backend/supabase/config.toml
[storage]
file_size_limit = "100GiB"  # ← This gets read by npx supabase start
```

---

### How Suna-Supabase Docker Works (Separately)

**Flow for System 2 (Docker Compose):**

```
1. You run: cd suna-supabase/docker && docker-compose up -d
                ↓
2. Docker reads: docker-compose.yml (NOT config.toml)
                ↓
3. Docker containers start with hardcoded config
                ↓
4. Storage limit comes from: docker-compose.yml environment variables
                ↓
5. Your app connects to: http://supabase-kong:8000
```

**Key point:** The `backend/supabase/config.toml` file is **never read** by docker-compose.

---

## The Critical Discovery

### What You Changed
```
File: D:\Homelab\suna\backend\supabase\config.toml

OLD: file_size_limit = "50MiB"
NEW: file_size_limit = "100GiB"
```

### Where It Actually Applies

✅ **APPLIES TO:** Supabase CLI (System 1)
- When you run: `npx supabase start`
- Storage limit becomes: 100GiB

❌ **DOES NOT APPLY TO:** Suna-Supabase Docker (System 2)
- When you run: `docker-compose up -d` in suna-supabase/
- Storage limit stays at default (NOT your config.toml)
- Why? Docker compose doesn't read `backend/supabase/config.toml`

---

## Do You Need to Restart suna-supabase?

### If You're Using suna-supabase Docker

**Answer: NO** (for your config.toml changes)

**Reason:** Your config.toml changes are **irrelevant to Docker**. The Docker compose doesn't read that file.

**However, IF you want to use the suna-supabase Docker:**
- It already has storage configured
- You would need to configure it within the Docker setup
- Not through `backend/supabase/config.toml`

---

### If You're Using Supabase CLI

**Answer: YES** (restart the CLI)

```bash
cd D:\Homelab\suna\backend

# Stop the running instance
npx supabase stop

# Start it again (picks up new config.toml)
npx supabase start

# Now 100GiB limit is active
```

---

## How to Determine Which System You're Using

### Check 1: Is Supabase CLI Running?

```powershell
npx supabase status
```

**If it shows:**
```
API URL:           http://localhost:54321
DB URL:            ...
```
→ You're using **Supabase CLI** ✅

**If it shows error:**
```
Not in a Supabase directory
```
→ You're NOT using Supabase CLI ❌

---

### Check 2: Is Docker Supabase Running?

```powershell
docker ps --filter "name=supabase"
```

**If it shows containers like:**
```
CONTAINER ID    IMAGE                      NAMES
abc123...       supabase/postgres:15.1     supabase-postgres
def456...       supabase/kong:2.8.1        supabase-kong
```
→ You're using **Docker Supabase** ✅

---

### Check 3: What Port Is Your App Connecting To?

Check your `.env` file:

```bash
# CLI setup would show:
SUPABASE_URL=http://localhost:54321

# Docker setup would show:
SUPABASE_URL=http://supabase-kong:8000

# Cloud setup would show:
SUPABASE_URL=https://yourproject.supabase.co
```

---

## The Configuration Breakdown

### System 1: Supabase CLI (`backend/supabase/config.toml`)

```toml
[storage]
enabled = true
file_size_limit = "100GiB"  # ← YOU CHANGED THIS

[storage.buckets.agentpress]
public = false
file_size_limit = "100GiB"  # ← AND THIS
allowed_mime_types = ["text/plain", "application/json", ...]
```

**How it's used:**
1. `npx supabase start` reads this file
2. Creates Docker containers with these settings
3. Storage limit becomes 100GiB

---

### System 2: Suna-Supabase Docker (`docker-compose.yml`)

```yaml
# suna-supabase/docker/docker-compose.yml
services:
  db:
    container_name: supabase-postgres
    image: supabase/postgres:15.1.0.147
    volumes:
      - ./volumes/db/postgres.conf:/etc/postgresql/postgresql.conf:ro,z
      # ↑ This is where Docker gets its config, NOT from config.toml
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      # Storage settings come from postgres.conf, not config.toml
```

**How it's configured:**
- Docker reads: `suna-supabase/docker/docker-compose.yml`
- Then: `suna-supabase/docker/volumes/db/postgres.conf`
- NOT from: `backend/supabase/config.toml`

---

## What You Should Do Now

### Option 1: Using Supabase CLI (Recommended for Development)

```bash
# 1. Stop current Supabase
cd D:\Homelab\suna\backend
npx supabase stop

# 2. Start Supabase again (reads your updated config.toml)
npx supabase start

# 3. Verify it worked
# Try uploading a file > 50MB, should now work up to 100GB
```

**Result:** ✅ Your 100GB limit is now active

---

### Option 2: Using Suna-Supabase Docker

**Your config.toml changes don't affect this setup.**

If you want to increase storage in Docker:

```bash
# 1. Edit Docker's PostgreSQL config
# File: D:\Homelab\suna-supabase\docker\volumes\db\postgres.conf
# Find and update:
#   max_wal_size = 100GB
#   work_mem = '4GB'

# 2. Restart Docker
cd D:\Homelab\suna-supabase\docker
docker-compose down
docker-compose up -d
```

---

### Option 3: Are You Running Multiple Systems?

If you're running both:
- `npx supabase start` in `backend/`
- `docker-compose up` in `suna-supabase/docker/`

**They operate independently.** Your app connects to one or the other, not both.

Check which one your app is using by looking at `SUPABASE_URL` in your `.env` file.

---

## Documentation Created

Two new guides have been created:

1. **`SUPABASE_CONFIG_USAGE.md`** (Comprehensive)
   - Full explanation of how both systems work
   - Configuration paths explained
   - Troubleshooting guide

2. **`SUPABASE_CONFIG_QUICK_REFERENCE.md`** (Quick Lookup)
   - TL;DR version
   - Decision tree flowchart
   - Commands to run

---

## Summary

| Question | Answer |
|----------|--------|
| Where is config.toml used? | Supabase CLI only (`npx supabase start`) |
| Does Docker read config.toml? | NO ❌ |
| Do you need to restart suna-supabase Docker? | NO - Your changes don't affect it |
| Do you need to restart Supabase CLI? | YES - But only if using CLI |
| Is your 100GB change active? | YES (for CLI), N/A (for Docker) |
| What command activates the change? | `npx supabase stop && npx supabase start` |

---

## Next Step

Run this command to verify which system you're using:

```powershell
npx supabase status
```

- **If it works** → You're using Supabase CLI. Restart it to activate 100GB.
- **If it fails** → You're using Docker or Cloud. Your config.toml changes don't apply.

Then, refer to the appropriate section in `SUPABASE_CONFIG_USAGE.md` for your setup.
