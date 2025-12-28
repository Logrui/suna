# Specification: Stabilize and Fix Railway Deployment Networking

## 1. Context
The Railway deployment is experiencing critical networking failures while the local Docker staging environment functions correctly.
- **Current Status:**
    - Frontend loads (from `kortix.railway.syhc.dev`).
    - Backend API returns **500 Internal Server Errors** (e.g., `POST /v1/presence/update`).
    - Supabase Realtime fails with **WebSocket connection errors** on `wss://kong.kortix.railway.syhc.dev/...`.
- **Infrastructure:**
    - Services are built independently using `Dockerfile.railway`.
    - No custom Docker networks on Railway; relies on Railway's private mesh network or public domains.
    - Supabase is deployed via a standard Railway template.
    - Local setup uses a dual-network (`suna`, `supabase`) Docker Compose configuration in `D:/Homelab/suna-supabase/docker`.

## 2. Problem Statement
- **WebSocket Failure:** The Kong API Gateway on Railway is rejecting or failing to proxy WebSocket connections for Realtime features.
- **Backend crash:** The API returning 500 implies a failure to connect to upstream services (likely Redis or Postgres) or a configuration mismatch.
- **Configuration Divergence:** Potential mismatch between the working local Docker networking logic and the Railway service-to-service communication model.

## 3. Goals
1. **Fix Realtime:** Enable successful `wss://` connections to the Supabase Kong service.
2. **Stabilize API:** Resolve the 500 errors on the Backend API by ensuring correct connectivity to Redis and Postgres.
3. **Harmonize Config:** Align Railway environment variables and build configurations with the operational requirements found in the local setup.

## 4. Technical Constraints
- **Railway CLI:** Must use `railway` for all inspections and updates.
- **Jujutsu (`jj`):** All code/config changes must be versioned with `jj`.
- **Variable Syntax:** Strict adherence to `${{Service Name.VAR}}`.
- **Naming Convention:** Services use the suffix ` - Dev` (e.g., `Suna Backend - Dev`).

## 5. Success Criteria
- [ ] No `WebSocket connection failed` errors in the browser console.
- [ ] `POST /v1/presence/update` returns 200 OK.
- [ ] `railway logs` for Backend show successful startup and database connection.