# Mixed Content Error - Root Cause & Fix

## The Problem

When accessing `https://kortix.syhc.dev/share/[threadId]`:
- ✅ Frontend loads over HTTPS (secure)
- ❌ But it tries to fetch API from HTTP (insecure)
- 🚫 Browser blocks mixed content for security

```
Mixed Content: The page at 'https://kortix.syhc.dev/...' was loaded 
over HTTPS, but requested an insecure resource 'http://...'. 
This request has been blocked.
```

## Root Cause

**Your docker-compose.yaml:**
```yaml
frontend:
  build:
    args:
      - NEXT_PUBLIC_BACKEND_URL=http://backend:8000/api  # ❌ HTTP
```

**What happens:**

1. Docker builds frontend with `NEXT_PUBLIC_BACKEND_URL=http://backend:8000/api`
2. This value gets baked into the Next.js build at compile time
3. Frontend is deployed via Cloudflare Tunnel at `https://kortix.syhc.dev`
4. Browser receives HTTP URL for API requests → Mixed Content Error
5. Browser blocks the request → "Failed to fetch"

## The Architecture Problem

Your setup has TWO environments that BOTH use the same frontend image:

**Environment 1: Docker Network (Local)**
- Frontend at: `http://localhost:3000`
- Backend at: `http://backend:8000/api` (Docker internal DNS)
- ✅ HTTP works here

**Environment 2: Cloudflare Tunnel (Production)**
- Frontend at: `https://kortix.syhc.dev` 
- Backend at: `https://api.kortix.syhc.dev` or similar (exposed via tunnel)
- ❌ Still using HTTP URL from build time → Mixed Content Error

## Solution: Use Relative URLs

The `getApiUrl()` helper was designed for this! It uses **relative URLs** when in the browser, which work regardless of domain/protocol:

```typescript
export const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    // Browser: use relative URL that works with any domain/protocol
    return `${window.location.origin}/api`;
  }
  // Server-side: use build-time env var for Docker communication
  return process.env.NEXT_PUBLIC_BACKEND_URL! || 'http://backend:8000/api';
};
```

### How It Works

```
User visits: https://kortix.syhc.dev/share/123
    ↓
Frontend loads getApiUrl() in browser
    ↓
window.location.origin = "https://kortix.syhc.dev"
    ↓
Returns: "https://kortix.syhc.dev/api"  ✅ CORRECT!
    ↓
Next.js middleware rewrites to backend
    ↓
Cloudflare Tunnel routes to actual backend
```

## The Problem Code

**In `frontend/src/lib/api/threads.ts`:**

Lines 180, 221, 254 use:
```typescript
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;  // ❌ Direct env var
```

Should use:
```typescript
const API_URL = getApiUrl();  // ✅ Uses getApiUrl() helper
```

**In `frontend/src/lib/api/projects.ts`:**

Line 5 uses:
```typescript
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';  // ❌ Direct env var
```

Should use:
```typescript
const API_URL = getApiUrl();  // ✅ Uses getApiUrl() helper
```

## Fix Summary

### 1. Update threads.ts - Replace 3 occurrences

**Import the helper:**
```typescript
import { getApiUrl } from '../get-api-url';
```

**Replace these 3 lines:**
```typescript
// Line 180
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
→ const API_URL = getApiUrl();

// Line 221  
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
→ const API_URL = getApiUrl();

// Line 254
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
→ const API_URL = getApiUrl();
```

### 2. Update projects.ts - Replace at top

**Import the helper:**
```typescript
import { getApiUrl } from '../get-api-url';
```

**Replace line 5:**
```typescript
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';
→ const API_URL = getApiUrl();
```

## Why This Works

- ✅ In Docker: Browser is at `http://localhost:3000` → uses `http://localhost/api` → works
- ✅ On Cloudflare: Browser is at `https://kortix.syhc.dev` → uses `https://kortix.syhc.dev/api` → works
- ✅ Protocols match: No Mixed Content error
- ✅ Relative URLs: Works with any domain
- ✅ Server-side: Still uses Docker internal DNS when needed

## Docker Compose Update (Optional)

You can also simplify docker-compose.yaml since `NEXT_PUBLIC_BACKEND_URL` won't be used in browser context:

```yaml
frontend:
  build:
    args:
      - NEXT_PUBLIC_ENV_MODE=local
      - NEXT_PUBLIC_SUPABASE_URL=http://kong.kortix.syhc.dev/
      - NEXT_PUBLIC_REALTIME_URL=https://kong.kortix.syhc.dev/
      # NEXT_PUBLIC_BACKEND_URL no longer needed for browser!
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Verification

After fix:
```bash
# Open DevTools Console on https://kortix.syhc.dev/share/123
# Should see successful fetches to:
# ✅ https://kortix.syhc.dev/api/threads/123
# ✅ https://kortix.syhc.dev/api/threads/123/messages

# NOT:
# ❌ http://backend:8000/api/...
```

## Impact on Other Code

Other files that might need review:
- `frontend/src/lib/api/agents.ts` - Check for similar pattern
- `frontend/src/lib/api/billing-v2.ts` - Check for similar pattern
- Any other API files using `process.env.NEXT_PUBLIC_BACKEND_URL` directly
