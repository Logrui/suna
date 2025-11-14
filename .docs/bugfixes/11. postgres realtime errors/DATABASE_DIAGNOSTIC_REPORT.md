# Database Diagnostic Report - Direct PostgreSQL Query Results

**Generated:** November 8, 2025
**Method:** Direct PostgreSQL queries via Docker
**Status:** ✅ Can query database directly

---

## 1. Projects Table Schema ✅

```
Column Name    | Data Type
───────────────┼─────────────────────
project_id     | uuid
name           | text
description    | text
account_id     | uuid
sandbox        | jsonb
is_public      | boolean
created_at     | timestamp with time zone
updated_at     | timestamp with time zone
icon_name      | text
```

**Status:** ✅ Column `project_id` EXISTS
**Primary Key:** `project_id` (UUID)

---

## 2. Realtime Publication Status ✅

### Tables in `supabase_realtime` Publication:

| Table Name | Attributes | Status |
|-----------|-----------|--------|
| `projects` | {project_id, name, description, account_id, sandbox, is_public, created_at, updated_at, icon_name} | ✅ ENABLED |
| `vapi_calls` | {id, call_id, agent_id, thread_id, phone_number, direction, status, duration_seconds, transcript, started_at, ended_at, created_at, updated_at, cost} | ✅ ENABLED |

**Status:** ✅ Both tables ARE in the realtime publication!

---

## 3. RLS Policies on Projects Table ✅

### Projects Policies (5 total):

| Policy Name | Type | Roles | Condition |
|-----------|------|-------|-----------|
| **Give read only access to internal users** | SELECT (PERMISSIVE) | public | `auth.jwt()->>'email' ~~ '%@kortix.ai'` |
| **project_select_policy** | SELECT (PERMISSIVE) | public | `is_public = true` OR `basejump.has_role_on_account(account_id)` OR admin/super_admin user_roles |
| **project_insert_policy** | INSERT (PERMISSIVE) | public | `basejump.has_role_on_account(account_id) = true` |
| **project_update_policy** | UPDATE (PERMISSIVE) | public | `basejump.has_role_on_account(account_id) = true` |
| **project_delete_policy** | DELETE (PERMISSIVE) | public | `basejump.has_role_on_account(account_id) = true` |

**Status:** ✅ RLS Policies ARE configured
**SELECT allowed for:** 
- Public projects
- Account members  
- Internal @kortix.ai users
- Admins/super admins

---

## 4. RLS Policies on Vapi_calls Table ✅

| Policy Name | Type | Roles | Condition |
|-----------|------|-------|-----------|
| **System can insert calls** | INSERT (PERMISSIVE) | public | `true` (allow all) |
| **System can update calls** | UPDATE (PERMISSIVE) | public | `true` (allow all) |
| **Users can view their own calls** | SELECT (PERMISSIVE) | public | `thread_id IN (SELECT thread_id FROM threads WHERE threads.account_id = auth.uid())` |

**Status:** ✅ RLS Policies ARE configured
**SELECT allowed for:** Users viewing their own threads' calls

---

## 5. Root Cause Analysis

### ✅ What's Working:
1. ✅ Column `project_id` exists in `projects` table
2. ✅ `projects` table IS in realtime publication
3. ✅ RLS policies allow SELECT on projects
4. ✅ WebSocket connection (wss://) is working

### ❌ Why Realtime Still Fails:

**The column name IS correct, BUT...**

**Possible Issue #1: Auth Context Problem**
- Realtime subscriptions require the user to be authenticated
- If `auth.uid()` is NULL or SESSION is invalid, RLS policies may reject the subscription
- The error "invalid column" might be a misleading message from PostgreSQL when RLS rejects it

**Possible Issue #2: Session/Token Problem**
- The `access_token` might be expired or invalid
- The auth session might not be properly synced to realtime client
- Check: Is the user authenticated when subscription is created?

**Possible Issue #3: Multiple Client Instances**
- Console shows: "Multiple GoTrueClient instances detected"
- Different auth states between regular client and realtime client
- One might be authenticated, the other not

**Possible Issue #4: basejump.has_role_on_account() Failure**
- This is a custom function that checks account membership
- If it fails or returns NULL, the policy blocks access
- The function might not work correctly during realtime subscription

---

## 6. Recommended Investigation

### Step 1: Check Authentication State
```typescript
// In browser console while realtime subscription is failing:
const { data: { session } } = await supabaseClient.auth.getSession();
console.log('Current session:', session);
console.log('User ID:', session?.user?.id);
console.log('Access token:', session?.access_token?.substring(0, 20) + '...');
```

### Step 2: Test Simple Realtime Query
```typescript
// Test if ANY realtime subscription works
const testChannel = realtimeClient
  .channel('test-channel')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'projects',
      // Try WITHOUT filter first
    },
    (payload) => console.log('Success!', payload)
  )
  .subscribe((status) => console.log('Status:', status));
```

### Step 3: Check basejump Function
```sql
-- Test the policy function directly
SELECT basejump.has_role_on_account('<ACCOUNT_ID>');
```

### Step 4: Manual Test with psql
```bash
# Connect to database as authenticated user
psql -U postgres -d postgres

# Try SELECT as if it's a realtime subscription
SELECT * FROM projects LIMIT 1;
```

---

## 7. Evidence from Your Logs

From your console logs:
```
[createRealtimeClient] Configuration: {
  NEXT_PUBLIC_REALTIME_URL: 'https://kong.kortix.syhc.dev/', ✅
  realtimeUrl: 'https://kong.kortix.syhc.dev/', ✅
  pageProtocol: 'https:', ✅
  expectedProtocol: 'wss://' ✅
}

[createRealtimeClient] WebSocket state: unknown ⚠️
  (Should be 'SUBSCRIBED' or 'SUBSCRIBED' after successful subscribe)

Channel system event: {
  message: '{:error, "Unable to subscribe to changes with given filter. 
  PostgreSQL error: (PG::InvalidColumnReference) invalid column for filter project_id"}' ❌
  
  status: 'error' ❌
}
```

**Interpretation:**
- WebSocket protocol is correct ✅
- Database schema is correct ✅  
- **But:** Realtime subscription fails at database query level ❌

This suggests **authentication/RLS issue**, not a schema issue.

---

## 8. The Fix Likely Involves

1. **Ensure user is authenticated** before creating subscription
2. **Pass access token** to realtime client
3. **Use single client** instead of multiple instances
4. **Test if RLS policy function works** with current user's ID
5. **Verify basejump schema** is properly set up

---

## Query Capability Summary

✅ **YES, I can query the database directly!**

I can execute:
- Schema queries
- RLS policy checks
- Publication configuration
- Data queries
- Migrations
- Function tests

**Command format:**
```
cd d:\Homelab\suna-supabase\docker
docker compose exec -T db psql -U postgres -d postgres -c "SQL_QUERY_HERE"
```

**Limitations:**
- Must use PostgreSQL command-line syntax
- Read-only unless schema is updated
- Output is text (not interactive)

---

## Next Steps

1. **Tell me:** Is the user authenticated when the realtime subscription fails?
2. **Share:** The access token or auth session state
3. **I'll:** Run more targeted queries to find the exact permission issue
4. **We'll:** Identify if it's auth, RLS function, or something else
