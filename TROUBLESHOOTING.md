# Troubleshooting and Common Issues

## ⚠️ Misleading "CORS" Errors (Check Backend Logs First!)

**Problem:** Browser console shows `Access-Control-Allow-Origin` / CORS errors, but CORS is configured correctly.

**What's actually happening:**

1. Browser sends request to API (e.g., `GET /v1/workflows`)
2. Server starts processing but throws an **unhandled exception** (500 error)
3. When FastAPI crashes mid-request, the CORS middleware doesn't add headers to the error response
4. Browser receives a 500 response **without** CORS headers
5. Browser security blocks the response and reports: "CORS policy blocked"

**The browser never sees the real error** - it only knows the response lacked CORS headers.

**Solution:**

1. **Always check backend logs first** when you see CORS errors:

   ```bash
   docker logs suna-backend-1 --tail 50 2>&1 | Select-String -Pattern "error|Exception|Traceback"
   ```

2. Look for Python exceptions, database errors, or 500 status codes
3. Fix the underlying server error - CORS headers will return automatically

**Example:** The `/v1/workflows` endpoint showed CORS errors, but the real issue was:

```text
postgrest.exceptions.APIError: {'message': 'column agents_1.user_id does not exist'}
```

**Rule of thumb:** If other endpoints work fine with the same origin, it's NOT a CORS config issue - it's a server crash.

## Docker Networking Issues

**Problem:** `ECONNREFUSED` or "fetch failed" errors

**Solution:**

1. Verify services are on both networks:

   ```bash
   docker network inspect supabase | grep suna-frontend
   docker network inspect suna | grep suna-frontend
   ```

2. If missing, restart with full teardown:

   ```bash
   docker compose down
   docker compose up -d
   ```

**Never use** `docker compose restart` after network configuration changes - always use `down` then `up`.

## Supabase 400 Errors

**Problem:** `400 Bad Request` from Supabase API endpoints

**Causes & Solutions:**

1. **Basejump schema not exposed:**
   - Check: `docker inspect supabase-rest --format='{{.Config.Env}}' | grep PGRST_DB_SCHEMAS`
   - Fix: Add `basejump` to `PGRST_DB_SCHEMAS` in `suna-supabase/docker/.env`
   - Restart: Full `down && up` for both Supabase and Suna

2. **URL mismatch in browser:**
   - Verify middleware is using correct headers
   - Check browser console for DNS errors
   - Ensure `window.location.origin` is used in client.ts

3. **Auth service not accessible:**
   - Check port 8100 is exposed: `docker ps | grep auth`
   - Verify Kong can route to auth: `curl http://localhost:8002/health`

## Knowledge Base Search Failing

**Problem:** Documents upload but search returns no results

**Solution:**

1. Verify OpenAI API key is set: `docker exec suna-backend-1 env | grep OPENAI_API_KEY`
2. Check backend logs for embedding errors: `docker compose logs backend | grep "embedding"`
3. KB search requires OpenAI - no workaround in kb-fusion v0.1.1

## OAuth/Login Issues

**Problem:** Login redirects to blank page or 404

**Causes & Solutions:**

1. **Port 8100 not exposed:**
   - Edit `suna-supabase/docker/docker-compose.yml`
   - Add `ports: ["8100:9999"]` to auth service
   - Restart Supabase

2. **Network isolation:**
   - Ensure frontend is on supabase network
   - Test: `docker exec suna-frontend-1 wget -O - http://supabase-kong:8000/health`

3. **Cloudflare Tunnel access:**
   - Verify middleware uses `x-forwarded-proto` and `host` headers
   - Check auth cookies are set with correct domain
   - Review `.docs/initialsetup/2. oauth/` for OAuth fixes

## Sandbox/Daytona Errors

**Problem:** "Snapshot not found" or "Daytona API error"

**This is expected if Daytona is not configured.** The app will:

- ✅ Continue working for non-sandbox features
- ❌ Fail sandbox-specific tools with clear error messages

**To enable Daytona:**

1. Sign up at <https://app.daytona.io/>
2. Set `DAYTONA_API_KEY` in `backend/.env`
3. Build custom Docker image with workspace snapshot
4. Configure snapshot ID in Daytona settings
5. Restart: `docker compose up -d`

**To disable gracefully:** Leave `DAYTONA_API_KEY` empty - app works without sandboxing.

## Configuration Changes Not Taking Effect

**Problem:** Changed `.env` but behavior unchanged

**Solution:**

1. **Build-time variables** (NEXT_PUBLIC_*): Require rebuild

   ```bash
   docker compose up -d --build
   ```

2. **Runtime variables** (backend): Restart is sufficient

   ```bash
   docker compose restart backend worker
   ```

3. **Supabase configuration**: Requires full recreation

   ```bash
   cd suna-supabase/docker && docker compose down && docker compose up -d
   cd ../../suna && docker compose down && docker compose up -d
   ```

4. **Code Changes (Backend)**:
   - **Source Code (`.py`)**: Restart is sufficient (volume mounted)

     ```bash
     docker compose restart backend
     ```

   - **Dependencies (`pyproject.toml`, `uv.lock`)**: Requires rebuild

     ```bash
     docker compose up -d --build backend
     ```

   - **System Deps (`Dockerfile`)**: Requires rebuild

     ```bash
     docker compose up -d --build backend
     ```

## Checking Service Health

```bash
# All services status
docker compose ps

# Backend logs
docker compose logs backend --tail=50 -f

# Frontend logs (middleware, rewrites)
docker compose logs frontend --tail=50 -f

# Supabase services
cd ../suna-supabase/docker
docker compose ps
docker compose logs rest --tail=20

# Test connectivity
docker exec suna-backend-1 wget -O - http://supabase-kong:8000/health
docker exec suna-frontend-1 wget -O - http://backend:8000/api/health
```
