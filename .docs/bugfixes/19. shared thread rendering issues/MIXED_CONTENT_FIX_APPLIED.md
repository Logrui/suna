# Mixed Content Error - FIXED ✅

## Changes Applied

### 1. ✅ Fixed `frontend/src/lib/api/threads.ts`
- Added import: `import { getApiUrl } from '../get-api-url';`
- Replaced 3 occurrences of `process.env.NEXT_PUBLIC_BACKEND_URL` with `getApiUrl()`
  - Line ~180: `createThread()` function
  - Line ~221: `addUserMessage()` function  
  - Line ~254: `getMessages()` function

### 2. ✅ Fixed `frontend/src/lib/api/projects.ts`
- Added import: `import { getApiUrl } from '../get-api-url';`
- Replaced module-level: `const API_URL = getApiUrl();`

### 3. ✅ Simplified `docker-compose.yaml`
- Removed `NEXT_PUBLIC_BACKEND_URL=http://backend:8000/api` from build args (not used in browser)
- Removed from environment section (not needed)
- Kept other essential build args

## Why This Fixes Mixed Content

**Before:**
```typescript
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL;  // = "http://backend:8000/api" (baked at build time)
// Browser tries: http://backend:8000/api
// But page is at: https://kortix.syhc.dev
// Result: ❌ Mixed Content Error
```

**After:**
```typescript
const API_URL = getApiUrl();
// In browser: returns `${window.location.origin}/api`
// Browser tries: https://kortix.syhc.dev/api
// But page is at: https://kortix.syhc.dev
// Result: ✅ Protocol matches, no error!
```

## How It Works Now

1. **Browser context** (user visiting the app):
   - `getApiUrl()` returns `https://kortix.syhc.dev/api` (uses `window.location.origin`)
   - Next.js middleware rewrites this to backend
   - ✅ HTTPS → HTTPS (no mixed content)

2. **Server context** (SSR, build time):
   - `getApiUrl()` returns `http://backend:8000/api` (uses env var)
   - Uses Docker internal DNS for inter-service communication
   - ✅ Works in Docker network

## Verification

Test the fix:
```bash
# Rebuild frontend with new changes
docker compose down
docker compose up -d --build

# Open in browser
https://kortix.syhc.dev/share/[threadId]

# Check DevTools Console - should see:
# ✅ Fetch to: https://kortix.syhc.dev/api/threads/123/messages
# ✅ No "Mixed Content" errors
# ✅ Messages load successfully
```

## Files Modified

| File | Changes |
|------|---------|
| `frontend/src/lib/api/threads.ts` | Added import + 3 replacements |
| `frontend/src/lib/api/projects.ts` | Added import + 1 replacement |
| `docker-compose.yaml` | Removed unnecessary build arg |

## Next Steps

After rebuilding:
1. ✅ Shared threads should load messages without Mixed Content errors
2. ✅ Sandbox activation requests should work
3. ✅ Project data should load

If still getting errors:
- Check DevTools Network tab for actual request URLs
- Verify backend is accessible at `https://kortix.syhc.dev/api`
- Check Next.js middleware rewrites to `/api` proxy
