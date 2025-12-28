# Plan: Stabilize and Fix Railway Deployment Networking

## Phase 1: Deep Investigation and Comparison
- [x] Task: Audit Backend Service on Railway.
    - [x] Sub-task: Run `railway logs -s "Suna Backend - Dev" -n 100` to capture the exact stack trace causing the 500 error.
    - [x] Sub-task: Dump variables via `railway variables -s "Suna Backend - Dev" --json` and verify `REDIS_HOST` and `SUPABASE_URL`.
- [x] Task: Inspect Supabase Kong Configuration.
    - [x] Sub-task: Check Kong service logs on Railway for WebSocket rejection reasons (403/404/502).
    - [x] Sub-task: Compare local `suna-supabase/docker/volumes/api/kong.yml` (if exists) or docker-compose config with Railway's Kong setup.
- [x] Task: Compare Build Configurations.
    - [x] Sub-task: Analyze `backend/Dockerfile.railway` vs `backend/Dockerfile` to identify missing dependencies or networking tweaks.
- [x] Task: Conductor - User Manual Verification 'Deep Investigation' (Protocol in workflow.md)

## Phase 2: Configuration and Network Fixes
- [x] Task: Fix Backend Connectivity (500 Error).
    - [x] Sub-task: Update `Suna Backend - Dev` variables to use the correct `RAILWAY_PRIVATE_DOMAIN` for Redis and Postgres.
    - [x] Sub-task: Ensure `SUPABASE_SERVICE_ROLE_KEY` is correctly set and matches the Supabase service.
- [x] Task: Fix WebSocket/Realtime Connection.
    - [x] Sub-task: Verify `NEXT_PUBLIC_SUPABASE_URL` in `Suna Frontend - Dev` points to the *public* Kong URL with `https://`.
    - [x] Sub-task: Investigate if Railway's Kong service requires specific headers (`Upgrade`, `Connection`) to be explicitly allowed or passed.
- [x] Task: Harmonize Environment Variables.
    - [x] Sub-task: Ensure `NEXT_PUBLIC_URL` matches the actual Railway public domain.
- [x] Task: Conductor - User Manual Verification 'Network Fixes' (Protocol in workflow.md)

## Phase 3: Deployment and Verification
- [x] Task: Trigger Redeploy.
    - [x] Sub-task: Force redeploy of Backend and Frontend services.
- [x] Task: Verification Suite.
    - [x] Sub-task: Check browser console for WebSocket connection success.
    - [x] Sub-task: Verify `POST /v1/presence/update` returns 200.
    - [x] Sub-task: Create a test agent to verify full end-to-end functionality.
- [x] Task: Conductor - User Manual Verification 'Deployment Success' (Protocol in workflow.md)