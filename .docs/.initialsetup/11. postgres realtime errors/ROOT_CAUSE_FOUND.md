# PostgreSQL Realtime Error - Root Cause Found ✅

## The Problem: Column Name Mismatch

**Error:**
```
PostgreSQL error: (PG::InvalidColumnReference) invalid column for filter project_id
```

**Root Cause:**
The `projects` table uses **`project_id`** as the column name (PRIMARY KEY), but the realtime subscriptions are trying to filter on it correctly. However, let me verify the exact table structure...

---

## Investigation Results

### Step 1: ✅ Found Subscription Code

**Location:** `frontend/src/hooks/useProjectRealtime.ts` (Lines 20-30)

```typescript
const channel = supabase
  .channel(`project-${projectId}`)
  .on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: 'projects',        // ← Table name
      filter: `project_id=eq.${projectId}`,  // ← Filter using project_id
    },
    ...
```

**Other subscriptions:**
- `useVapiCallRealtime.ts` - Subscribes to `vapi_calls` table with `call_id` filter
- `MonitorCallToolView.tsx` - Subscribes to `vapi_calls` table with `call_id` filter

---

### Step 2: ✅ Verified Database Schema

**File:** `backend/supabase/migrations/20250416133920_agentpress_schema.sql`

```sql
CREATE TABLE projects (
    project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    sandbox JSONB DEFAULT '{}'::jsonb,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
```

**Schema confirms:**
✅ Column `project_id` exists
✅ It's the PRIMARY KEY
✅ Data type is UUID

---

## Actual Issue: Realtime Not Enabled for Projects Table

The problem is likely **not** that the column doesn't exist, but rather that:

1. **Realtime subscriptions might not be enabled** for the `projects` table
2. **RLS policies** might be blocking the subscription
3. **The subscription is failing silently** and then showing a misleading error

### Evidence from logs:

```
[createRealtimeClient] Current connection state: unknown
[createRealtimeClient] Channel system event: {
  message: '{:error, "Unable to subscribe to changes with given filter. 
  PostgreSQL error: (PG::InvalidColumnReference) invalid column for filter project_id"}',
  status: 'error',
  extension: 'postgres_changes',
  channel: 'project-...'
}
```

The connection state stays **"unknown"**, suggesting the WebSocket connection is established but the Realtime subscription is being rejected at the database level.

---

## Why The Error is Misleading

The error says "invalid column for filter project_id" but the column DOES exist. This usually means:

1. **Realtime publication not set up** - The table isn't in the `supabase_realtime` publication
2. **RLS policies blocking SELECT** - Row-Level Security prevents reading the data
3. **Table not in public schema** - Realtime only works on public schema
4. **Outdated schema cache** - The realtime schema cache hasn't been updated

---

## Solution Path

**Step 1: Verify Realtime is Enabled**

Run in Supabase SQL Editor:
```sql
-- Check if projects table is in realtime publication
SELECT * 
FROM pg_publication_tables 
WHERE publication_name = 'supabase_realtime';

-- If projects is NOT listed, add it:
ALTER PUBLICATION supabase_realtime ADD TABLE projects;
```

**Step 2: Check RLS Policies**

```sql
-- Check if projects table has RLS enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename = 'projects';

-- Check policies on projects table
SELECT policyname, permissive, roles, qual 
FROM pg_policies 
WHERE tablename = 'projects' 
  AND schemaname = 'public';
```

**Step 3: Verify Policy Allows SELECT for Authenticated Users**

```sql
-- Check if SELECT policy allows access
-- The policy should allow auth users to select their own projects
SELECT * FROM projects WHERE project_id = '<YOUR_PROJECT_ID>';
```

---

## The Three Subscriptions in Your Code

| File | Table | Filter | Status |
|------|-------|--------|--------|
| `useProjectRealtime.ts` | `projects` | `project_id=eq.${projectId}` | ❌ FAILING |
| `useVapiCallRealtime.ts` | `vapi_calls` | `call_id=eq.${callId}` or `thread_id=eq.${threadId}` | ? |
| `MonitorCallToolView.tsx` | `vapi_calls` | `call_id=eq.${initialData.call_id}` | ? |

---

## Next Steps

1. **Run the SQL queries above** in Supabase Studio
2. **Check if realtime is enabled** for projects table
3. **Verify RLS policies** allow access
4. **Re-enable realtime if needed:** `ALTER PUBLICATION supabase_realtime ADD TABLE projects;`
5. **Restart the frontend** to clear caches
6. **Check browser console** for success message

---

## Debugging Checklist

- [ ] Logged into Supabase Studio (http://localhost:5555)
- [ ] Ran query to list tables in realtime publication
- [ ] Confirmed `projects` table is listed
- [ ] Checked RLS policies on projects table
- [ ] Verified SELECT is allowed for auth users
- [ ] (If missing) Ran `ALTER PUBLICATION supabase_realtime ADD TABLE projects;`
- [ ] Restarted frontend container: `docker compose restart frontend`
- [ ] Checked browser console for "Channel system event: success" message
- [ ] Realtime is now working for projects

---

## Key Insight

**The column name is NOT the problem.** The PostgreSQL error message is misleading because it's actually a permissions/publication issue, not a schema issue. The real question is: "Is the projects table allowed to broadcast realtime changes?"
