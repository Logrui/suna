# Quick Reference: Supabase Configuration in Your Self-Hosted Setup

## TL;DR

**Question:** Does `backend/supabase/config.toml` affect suna-supabase Docker?

**Answer:** **NO** ❌ - They are two separate systems.

---

## Two Different Systems

### System 1: Supabase CLI
```bash
cd D:\Homelab\suna\backend
npx supabase start  # ← Uses config.toml
```
- **Config file:** `backend/supabase/config.toml` ✅
- **Storage limit:** `file_size_limit = "100GiB"` (you changed this)
- **Your 100GB change applies?** YES ✅
- **Restart needed?** YES: `npx supabase stop && start`

### System 2: Suna-Supabase Docker
```bash
cd D:\Homelab\suna-supabase\docker
docker-compose up -d  # ← Does NOT use config.toml
```
- **Config file:** `docker-compose.yml` (separate system)
- **Storage limit:** Hardcoded in docker-compose.yml + postgres.conf
- **Your 100GB change applies?** NO ❌
- **Restart needed?** YES: `docker-compose down && up -d` (but different reason)

---

## Which One Are You Using?

### Check CLI Status
```powershell
npx supabase status

# Output like this means you're using CLI:
# API URL:           http://localhost:54321
```

### Check Docker Status
```powershell
docker ps --filter "name=supabase"

# Output with containers means you're using Docker:
# CONTAINER ID    IMAGE                      STATUS
# xxx              supabase/postgres:15.1     Up 2 hours
```

---

## If Using Supabase CLI ✅

**Your changes are ready!**

```bash
# Just restart Supabase
cd D:\Homelab\suna\backend
npx supabase stop
npx supabase start

# The 100GB limit is now active
# Your config.toml file was already updated
```

---

## If Using Suna-Supabase Docker ❌

**Your config.toml changes don't apply to Docker.**

You would need to:

1. **Edit Docker config separately:**
```bash
# D:\Homelab\suna-supabase\docker\volumes\db\postgres.conf
# (Your backend/supabase/config.toml is NOT used)
```

2. **Restart Docker:**
```bash
cd D:\Homelab\suna-supabase\docker
docker-compose down
docker-compose up -d
```

---

## Storage Limit Status

| Location | Current Value | Affects CLI? | Affects Docker? |
|----------|---------------|--------------|-----------------|
| `backend/supabase/config.toml` | `100GiB` ✅ | YES | NO |
| `suna-supabase/docker/...` | Hardcoded | NO | YES |

---

## Decision Flowchart

```
Are you running "npx supabase start"?
  ├─ YES → Your 100GB change is active ✅
  │        Restart with: npx supabase stop && start
  │
  └─ NO → Are you running "docker-compose up -d"?
           ├─ YES → Your config.toml doesn't apply ❌
           │        Need to update Docker config separately
           │        Then restart with: docker-compose down && up -d
           │
           └─ NO → You're using cloud Supabase
                   Config changes not applicable
```

---

## Commands to Execute Right Now

### If Using CLI:
```bash
cd D:\Homelab\suna\backend
npx supabase stop
npx supabase start
# Done! 100GB limit is active
```

### If Using Docker:
```bash
cd D:\Homelab\suna-supabase\docker
docker-compose down
docker-compose up -d
# Note: Docker has its own storage config, not config.toml
```

### To Verify:
```bash
# Try uploading a file > 50MB
# It should now succeed (was blocked before at 50MB)
```

---

## Why Are They Different?

1. **suna/** = Your Suna Kortix app (uses Supabase CLI for development)
2. **suna-supabase/** = Pre-built Supabase distribution (standalone Docker)
3. They don't share configuration files
4. They operate independently

---

## The Key Files

```
D:\Homelab\
├── suna/
│   ├── backend/
│   │   ├── supabase/
│   │   │   └── config.toml ← You edited this ✅
│   │   │                     Used by: npx supabase start
│   │   └── .env
│   └── docker-compose.yaml (for Suna backend/frontend)
│
└── suna-supabase/
    └── docker/
        ├── docker-compose.yml ← Separate from config.toml
        │                        Does NOT read backend/supabase/config.toml
        └── volumes/
            └── db/
                └── postgres.conf ← Storage config for Docker mode
```

---

## Bottom Line

✅ **If using Supabase CLI:** Your 100GB change is ready. Just restart.

❌ **If using suna-supabase Docker:** Your 100GB change doesn't apply. Docker has its own config.

🤔 **Not sure which?** Run `npx supabase status` - if it works, you're using CLI.
