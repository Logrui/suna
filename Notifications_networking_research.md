Notification & API Error Investigation Doc
1. Context / Environment
Frontend URL: https://kortix.syhc.dev (Cloudflare tunnel)
Backend URL (Docker internal): http://backend:8000
Architecture:
Next.js frontend (App Router) in Docker
FastAPI backend in Docker, app.include_router(api_router, prefix="/api")
Requests from browser should go to https://kortix.syhc.dev/api/* and be rewritten by Next.js to http://backend:8000/api/*.
Key config:
frontend/next.config.ts
:
backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://backend:8000'
Rewrite:
ts
{
  source: '/api/:path*',
  destination: `${backendUrl}/api/:path*`,
}
frontend/src/lib/get-api-url.ts
:
Browser: window.location.origin + '/api'
Server: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://backend:8000/api'
frontend/src/lib/api-client.ts
:
backendApi.get(...)
 -> 
makeRequest(fullUrl)
makeRequest
 logs:
[makeRequest] Original URL: ...
[makeRequest] About to fetch URL with cache buster: ...&_t=...
2. Current Symptoms
All browser-side API URLs are now correct and proxied, but backend returns 500:

Examples from console:

GET https://kortix.syhc.dev/api/billing/available-models?_t=... 500 (Internal Server Error)
GET https://kortix.syhc.dev/api/agents?page=1&limit=50 500 (Internal Server Error)
GET https://kortix.syhc.dev/api/composio/toolkits/slack/icon?_t=... 500 (Internal Server Error)
GET https://kortix.syhc.dev/api/composio/toolkits/notion/icon?_t=... 500 (Internal Server Error)
GET https://kortix.syhc.dev/api/notifications/?page=1&page_size=10&is_read=false&_t=... 500 (Internal Server Error)
GET https://kortix.syhc.dev/api/notifications/?page=1&page_size=1&is_read=false&_t=... 500 (Internal Server Error)_
Client-side logging confirms:

getApiUrl
 (browser):
[getApiUrl] Browser context detected, returning: https://kortix.syhc.dev/api
backendApi.get
:
[backendApi.get] Constructed URL: https://kortix.syhc.dev/api/notifications/?page=1&page_size=10&is_read=false
makeRequest
:
[makeRequest] Original URL: https://kortix.syhc.dev/api/notifications/?...
[makeRequest] About to fetch URL with cache buster: https://kortix.syhc.dev/api/notifications/?...&_t=..._
So:

No more backend:8000 leaks into the browser.
Requests are correctly going to https://kortix.syhc.dev/api/....
Next.js rewrite should send those to http://backend:8000/api/....
Backend responds with HTTP 500, not 404 or network error.
3. Recent Fixes Already Applied
Fixed Next.js rewrite:
Previously: destination: '${backendUrl}/:path*' (missing /api).
Now: destination: '${backendUrl}/api/:path*'.
Removed broken debug route:
frontend/src/app/api/debug/route.ts
 was an empty file causing Type error: File '.../route.ts' is not a module.
Folder api/debug removed.
Removed conflicting env var overrides:
NEXT_PUBLIC_BACKEND_URL was removed from 
docker-compose.yaml
 build args and env for frontend, so server-side code falls back to http://backend:8000/api.
4. Current Problem Statement
Frontend is now calling the correct URLs via Next.js proxy (https://kortix.syhc.dev/api/...), but multiple backend endpoints – including notifications, billing/available-models, agents, and composio toolkit icons – consistently return HTTP 500.

This is no longer a URL-resolution / proxy issue; it’s now a backend internal error or auth/config issue affecting multiple routes.

5. Files / Areas of Interest
Frontend:
frontend/next.config.ts
 (rewrites, backendUrl)
frontend/src/lib/get-api-url.ts
frontend/src/lib/api-client.ts
frontend/src/lib/api/notifications.ts
frontend/.env.local (if still present / used)
Backend:
backend/api.py
 (router composition, /api prefix)
Notifications API:
backend/core/notifications_api.py
Billing & models:
backend/core/ai_models/registry.py
backend/core/billing/... (exact files to be located)
Composio toolkits:
backend/core/composio_integration/api.py (or similar)
Backend .env mounted at backend/.env from 
docker-compose.yaml
.
6. Likely Causes / Hypotheses
Authentication / session issues:
Many routes require a valid Supabase session / JWT.
If the auth middleware or Supabase client is misconfigured (especially under the Cloudflare tunnel host), backend may throw 500 instead of 401/403.
Environment variables mismatch:
Some service (billing, composio, models) may rely on API keys or base URLs not configured in the backend .env in this environment.
New models (e.g., Gemini variants) were recently added in 
core/ai_models/registry.py
; incomplete config can cause 500s when listing available models.
Schema / migration issues:
If DB schema doesn’t match code expectations (missing tables/columns for billing, notifications, composio), queries could be throwing unhandled exceptions.
Composio configuration:
Missing Composio API key / base URL could cause 500 on toolkit icon endpoints.
Notification-specific issues:
notifications_api logic might assume certain account/user/tenant data that doesn’t exist in this environment.
7. Step-by-Step Plan for the Next Agent
7.1 Verify Backend Health / Basic Routing
From host machine, run:
Invoke-WebRequest -Uri http://localhost:8000/api/health -Method GET
Confirm status 200 and JSON payload.
From inside suna-frontend-1 container:
curl -v http://backend:8000/api/health
Confirm both paths work: if not, fix at network / backend level before continuing.
7.2 Inspect Backend Logs for 500s
Tail backend logs:
docker logs -f suna-backend-1
Reproduce in browser:
Hit:
/api/notifications/?page=1&page_size=10&is_read=false
/api/billing/available-models
/api/agents
/api/composio/toolkits/slack/icon
Observe stack traces and exception messages for each endpoint.
Note:
Exception type
Message
Any KeyError, AttributeError, missing env var, or DB error.
7.3 Directly Call Backend Endpoints (Bypass Next.js)
From host:

Invoke-WebRequest -Uri "http://localhost:8000/api/notifications/?page=1&page_size=10&is_read=false" -Method GET -Headers @{ "Authorization" = "Bearer <valid-token>" }
Similar calls for:
/api/billing/available-models
/api/agents?page=1&limit=50
/api/composio/toolkits/slack/icon
Goal: confirm 500 is present even without the proxy, and verify if 401/403 vs 500 behavior is correct.

7.4 Validate Auth & Supabase Integration
Check middleware:
frontend/src/middleware.ts
 (already known; skips /api/* but auth/session may still affect SSR / server components).
Backend auth dependencies:
Look at notifications_api, billing APIs, and agents endpoints:
What dependencies are used for current_user, current_account, etc.?
Are they failing and raising an HTTPException(500) or generic exceptions?*
7.5 Check Environment Variables / Secrets
Backend .env (mounted via 
docker-compose.yaml
):
Validate keys:
Supabase URL, keys
Billing provider API keys
Composio config
Model provider keys (OpenAI, Anthropic, Google, Bedrock, etc.)
Confirm all required env vars referenced in:
core/ai_models/registry.py
Billing modules
Composio integration
Notifications (e.g., email/push providers, if required).
7.6 Focused Debug on Notifications
Open backend/core/notifications_api.py:
Identify routes for:
GET /notifications/
GET /notifications/preferences
POST /notifications/mark-as-read
Examine:
Dependencies (DB, Supabase, account lookup)
Any code paths that can raise unhandled exceptions.
Add temporary logging around the failing route:
Log incoming user/account IDs, query params.
Log DB query results before accessing fields.
Rebuild backend and re-test.
7.7 Fixes to Apply Once Root Cause Identified
Depending on what logs show:

If missing env vars:
Add proper values to backend/.env.
Consider sensible fallbacks / feature flags to disable non-critical integrations.
If DB schema mismatch:
Run migrations or adjust queries to handle missing data gracefully.
If auth/session issues:
Normalize error handling to respond with 401/403 instead of 500.
Ensure Supabase config matches kortix.syhc.dev host and redirect URIs.
If notifications logic assumes data that may not exist:
Add defensive checks and return empty lists / default preferences instead of throwing.
8. Success Criteria
GET https://kortix.syhc.dev/api/notifications/?page=1&page_size=10&is_read=false:
Returns 200 with a JSON body (even if empty notifications: []).
GET .../api/billing/available-models and /api/agents:
Return 200 or meaningful 4xx (if feature intentionally disabled), not 500.
Dashboard UI:
No more HTTP 500 errors in console for notifications, billing models, agents, or composio icons.
Backend logs:
No unhandled exceptions for these endpoints during normal dashboard load.
You can hand this doc to another agent and ask them to:

Start at Section 7 and follow the investigation plan.
Use backend logs to drive targeted fixes in the backend code and env config.
Keep the existing frontend URL resolution and proxy behavior as-is, since those are now correct.