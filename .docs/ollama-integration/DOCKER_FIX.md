# Docker Ollama Fix - Quick Instructions

## Problem
Backend running in Docker can't reach Ollama on the host machine at `localhost:11434` because network namespaces are isolated.

**Error in logs:**
```
[error] Failed to list Ollama models: All connection attempts failed
```

## Solution - 3 Steps

### Step 1: Update backend/.env

Add the Docker networking override:

```bash
# For Docker Desktop (Windows/Mac with WSL2)
OLLAMA_API_BASE=http://host.docker.internal:11434

# For Linux with native Docker
# OLLAMA_API_BASE=http://172.17.0.1:11434
```

**Your full config should look like:**
```bash
ENV_MODE=local
OLLAMA_ENABLED=true
OPENAI_COMPATIBLE_API_KEY=ollama
OPENAI_COMPATIBLE_API_BASE=http://localhost:11434/v1
OLLAMA_API_BASE=http://host.docker.internal:11434
```

### Step 2: Restart Docker containers

```powershell
cd D:\Homelab\suna
docker compose restart
```

### Step 3: Check the logs

```powershell
docker compose logs -f backend
```

Look for:
```
[info] Starting Ollama model discovery...
[info] Successfully registered 12 Ollama models
[debug] Ollama model initialization completed
```

## How It Works

The OllamaClient now checks in order:

1. **OLLAMA_API_BASE** (explicit Docker override) ← **NEW**
2. OPENAI_COMPATIBLE_API_BASE (fallback)
3. Default localhost:11434

When running in Docker:
- `localhost:11434` → Container's own network (doesn't work)
- `host.docker.internal:11434` → Host machine IP (works!)

## Platform-Specific Values

| Platform | Value |
|----------|-------|
| Docker Desktop (Mac) | `http://host.docker.internal:11434` |
| Docker Desktop (Windows) | `http://host.docker.internal:11434` |
| Docker Desktop (WSL2) | `http://host.docker.internal:11434` |
| Linux Docker (native) | `http://172.17.0.1:11434` |
| Podman | `http://host.podman:11434` |

## Verify Everything Works

```bash
# 1. Check Docker backend logs
docker compose logs backend | grep -i "ollama\|model"

# 2. Should see something like:
# [info] Starting Ollama model discovery...
# [info] Successfully registered 12 Ollama models

# 3. Test the API endpoint
curl http://localhost:8000/api/models | grep ollama
```

## Files Updated

- `backend/core/utils/config.py` - Added OLLAMA_API_BASE field
- `backend/core/ai_models/ollama_client.py` - Updated connection logic
- `backend/.env.example` - Added documentation
- `.docs/ollama-integration/USAGE_GUIDE.md` - Added Docker troubleshooting

---

**After this fix, your Docker backend will automatically discover all 12 Ollama models!** 🚀
