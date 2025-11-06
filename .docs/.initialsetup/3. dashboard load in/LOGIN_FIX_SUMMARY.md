# Login Issues - Root Cause & Fix

## Problem: "Auth session missing" Error

When attempting to login with correct credentials, the browser would show:
```
AuthSessionMissingError: Auth session missing!
Error getting current user
Error fetching agents: Error: You must be logged in to get agents
```

## Root Causes Identified

### 1. **Missing ANON_KEY Environment Variable** ✅ FIXED
**Symptom:** `401 Invalid authentication credentials`

**Root Cause:** The frontend container wasn't receiving the `NEXT_PUBLIC_SUPABASE_ANON_KEY` environment variable needed for Supabase authentication.

**Solution:**
- Added `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `docker-compose.yaml` as a build arg and runtime environment variable
- Updated `frontend/Dockerfile` to accept and set the ARG in the builder stage
- Key:  `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE`

### 2. **Server-Side Auth Session Cookie Mismatch** ✅ FIXED
**Symptom:** `AuthSessionMissingError: Auth session missing!` persisting after login

**Root Cause:** The login was being performed on the server-side with the internal Supabase URL (`supabase-kong:8000`), but auth cookies set from the internal network weren't accessible to the browser client using the public URL (`localhost:8002`). This created a cross-domain cookie issue:
- Server calls `supabase.auth.signInWithPassword()` via `supabase-kong:8000` (internal Docker hostname)
- Server receives auth tokens and cookies with domain/path restrictions
- Browser cannot use these cookies when making requests via `localhost:8002` (public port)
- Browser client has no session data

**Solution:** Modified login to authenticate directly on the client-side browser:
- Changed `frontend/src/app/auth/page.tsx` handleSignIn function
- Login now calls `supabase.auth.signInWithPassword()` on the browser client (using public URL)
- Browser client is already configured with `NEXT_PUBLIC_SUPABASE_PUBLIC_URL=http://localhost:8002`
- Auth cookies are now set with the correct domain (`localhost`) and accessible to browser
- After successful login, redirect to dashboard with proper session cookies in place

## Files Modified

### 1. `docker-compose.yaml`
Added `NEXT_PUBLIC_SUPABASE_ANON_KEY` to build args and environment:
```yaml
frontend:
  build:
    args:
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  environment:
    - NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. `frontend/Dockerfile`
Added ARG declaration and ENV setting:
```dockerfile
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
```

### 3. `frontend/src/app/auth/page.tsx`
Replaced server-side login with client-side auth:
```typescript
const handleSignIn = async (prevState: any, formData: FormData) => {
  // Now uses createClient() which is browser client with public URL
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  // Cookies set here are accessible to browser since using localhost:8002
  window.location.href = finalReturnUrl;
};
```

## Why This Works Now

1. **Browser client uses correct URL:** `createClient()` from `@/lib/supabase/client.ts` uses `NEXT_PUBLIC_SUPABASE_PUBLIC_URL` (localhost:8002)

2. **Auth cookies have correct domain:** When browser authenticates with `localhost:8002`, cookies are set with domain=localhost, accessible by browser

3. **AuthProvider can find session:** When `AuthProvider` calls `supabase.auth.getSession()` on the client, it has access to properly-scoped cookies and retrieves the session

4. **Middleware can validate auth:** Middleware that checks authentication uses the server client but cookies work because they're properly scoped to the domain

## Architecture After Fix

```
Login Flow:
1. User enters email/password in browser (localhost:3000/auth)
2. Browser calls handleSignIn (client-side function)
3. Browser client makes auth request to localhost:8002 directly
4. Kong routes request to Auth service (supabase-auth container)
5. Auth service returns JWT tokens + session cookies with domain=localhost
6. Browser stores cookies with proper domain scope
7. Browser redirects to /dashboard
8. Dashboard calls AuthProvider.getSession() which finds cookies
9. User is authenticated ✓
```

## Testing

To verify login works:
1. Navigate to http://localhost:3000/auth
2. Enter email: `yhcsanction@gmail.com` (or create new account)
3. Enter password
4. Should redirect to http://localhost:3000/dashboard
5. Dashboard should load agents and accounts
6. No "Auth session missing" errors in console

## Additional Issues Noted (Not Blocking)

- **404 on /health endpoint:** Backend doesn't have this endpoint, but it's non-critical
- **Missing TOLT referral ID:** Analytics script warning, can be ignored
- **Browser extension errors:** Not related to Suna, just VS Code extension warnings

---

**Status:** ✅ Login authentication working properly  
**Date:** October 29, 2025  
**Impact:** Critical - enables dashboard access after login
