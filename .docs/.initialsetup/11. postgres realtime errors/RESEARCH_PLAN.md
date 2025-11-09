# Realtime PostgreSQL Subscription Errors - Research Plan

## The Issue

Supabase Realtime subscriptions are failing with:
```
PostgreSQL error: (PG::InvalidColumnReference) invalid column for filter project_id
```

This indicates the realtime channel is trying to filter on `project_id` but the column either:
1. Doesn't exist in the target table
2. Exists but isn't properly exposed in PostgREST/Realtime
3. Is blocked by RLS policies
4. The table name itself is incorrect

---

## 4-Step Debugging Strategy

### Step 1: Identify What's Being Subscribed To

Find where the realtime channel is being created with the `project_id` filter.

**Objective:** Locate the exact code creating the subscription

**Commands to run:**
```bash
cd d:\Homelab\suna\frontend

# Find postgres_changes subscriptions
grep -r "postgres_changes" src/ --include="*.ts" --include="*.tsx"

# Find project_id filters in realtime contexts
grep -r "project_id" src/ --include="*.ts" --include="*.tsx" | grep -i "realtime\|channel\|subscribe"

# Look for channel creation patterns
grep -r "\.channel\(" src/ --include="*.ts" --include="*.tsx" -A 5
```

**Key files to examine:**
- `src/hooks/useProjectRealtime.ts` (most likely)
- `src/lib/supabase/client.ts` (realtime client setup)
- `src/hooks/useAgentStream.ts` (mentioned in logs)
- Any component using `.on('postgres_changes'`

**Questions to answer:**
- [ ] What is the exact channel name pattern?
- [ ] Which table is being subscribed to? (projects, runs, messages, etc.)
- [ ] What is the exact filter being applied?
- [ ] Is the filter `project_id` or something else?

---

### Step 2: Check the Database Schema

Verify the table actually has a `project_id` column and it's exposed in PostgREST/Realtime.

**Objective:** Confirm the schema matches what the subscription expects

**Steps:**

1. **Access Supabase Studio:**
   - Navigate to `http://localhost:5555` (or your Supabase URL)
   - Login with your credentials
   - Go to **SQL Editor**

2. **Run these queries:**

```sql
-- Query 1: Check which tables have project_id column
SELECT 
  t.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
  AND c.column_name = 'project_id'
ORDER BY t.table_name;

-- Query 2: Check all columns for candidate tables
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('projects', 'runs', 'messages', 'threads')
ORDER BY table_name, ordinal_position;

-- Query 3: List all public tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Key files to examine:**
- Look at all schema files: `suna-supabase/migrations/` or similar
- Check if `project_id` column exists in the actual table

**Questions to answer:**
- [ ] Does the table have a `project_id` column?
- [ ] What is the data type? (uuid, int, text, etc.)
- [ ] Is the column nullable or required?
- [ ] Does the table name in the subscription match the actual table name?

---

### Step 3: Check Realtime Permissions & RLS Policies

Verify that the authenticated user can subscribe to realtime changes and that RLS policies allow it.

**Objective:** Confirm RLS policies aren't blocking the subscription

**Steps:**

1. **In Supabase SQL Editor, run:**

```sql
-- Query 1: Check RLS policies on the table
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('projects', 'runs', 'messages', 'threads')
ORDER BY tablename, policyname;

-- Query 2: Check if RLS is enabled on the table
SELECT tablename, rowsecurity
FROM pg_class
JOIN pg_tables ON pg_class.relname = pg_tables.tablename
WHERE schemaname = 'public'
  AND tablename IN ('projects', 'runs', 'messages', 'threads');

-- Query 3: Check realtime configuration
SELECT table_name, enabled
FROM realtime.subscription_check('projects', 'SELECT');
```

2. **Check if realtime is enabled for the table:**
```sql
-- List which tables are set up for realtime
SELECT schema, table_name, enabled
FROM realtime.tables
WHERE schema = 'public'
ORDER BY table_name;
```

**Key things to look for:**
- Are RLS policies restricting SELECT access?
- Is the table properly enabled for realtime subscriptions?
- Are there any restrictive policies on the `project_id` column?

**Questions to answer:**
- [ ] Are RLS policies enabled on this table?
- [ ] What are the SELECT policies?
- [ ] Is realtime specifically enabled for this table?
- [ ] Are the auth policies preventing subscription?

---

### Step 4: Add Targeted Debugging to Client Code

Add logging to see exactly what subscription is being attempted and what error comes back.

**Objective:** Get granular visibility into the subscription attempt

**Step 4a: Modify realtime client logging**

Edit `frontend/src/lib/supabase/client.ts` and enhance the channel subscription logging:

```typescript
// Add this in createRealtimeClient() where channels are created:

client.channel = (name: string, opts?: any) => {
  console.log('[createRealtimeClient] Creating channel:', name, 'with options:', opts);
  const channel = originalChannel(name, opts);
  
  // Log all events on this channel
  channel.on('*' as any, {}, (payload: any) => {
    console.log('[createRealtimeClient] Channel event (ALL):', { 
      channel: name, 
      eventType: payload.type,
      payload 
    });
  });
  
  // Log subscription errors specifically
  channel.on('error' as any, {}, (error: any) => {
    console.error('[createRealtimeClient] Channel ERROR:', { 
      channel: name, 
      error 
    });
  });
  
  return channel;
};
```

**Step 4b: Add logs where subscriptions are created**

In `useProjectRealtime.ts` (or wherever the subscription happens), add:

```typescript
console.log('[useProjectRealtime] Attempting subscription:', {
  tableName: 'projects',  // or whatever table
  filterColumn: 'project_id',
  filterValue: projectId,
  userId: session?.user?.id,
  timestamp: new Date().toISOString()
});

// Then create the subscription and log the response
const channel = realtimeClient
  .channel('project-' + projectId)
  .on(
    'postgres_changes' as any,
    {
      event: '*',
      schema: 'public',
      table: 'projects',  // Verify this is correct
      filter: `project_id=eq.${projectId}`  // Log the exact filter
    },
    (payload) => {
      console.log('[useProjectRealtime] Subscription success:', payload);
    }
  )
  .subscribe((status) => {
    console.log('[useProjectRealtime] Subscription status:', status);
  });
```

**Questions to answer:**
- [ ] What is the exact table name in the subscription?
- [ ] What is the exact filter string being sent?
- [ ] What is the exact error message from PostgreSQL?
- [ ] What is the auth session/user ID?

---

## Investigation Checklist

Use this to track your findings:

- [ ] **Found the subscription code** 
  - File: `________________`
  - Table name: `________________`
  - Filter: `________________`

- [ ] **Verified schema in database**
  - Column exists: ✓ / ✗
  - Column type: `________________`
  - Table name matches: ✓ / ✗

- [ ] **Checked RLS policies**
  - RLS enabled on table: ✓ / ✗
  - Policies are: `________________`
  - Realtime enabled: ✓ / ✗

- [ ] **Added debugging logs**
  - Logs added to: `________________`
  - Can see exact filter: ✓ / ✗
  - Can see exact error: ✓ / ✗

---

## Likely Scenarios & Fixes

### Scenario A: Wrong Table Name
**Symptom:** Table doesn't exist or has different name
**Fix:** Update subscription to use correct table name

### Scenario B: Column Doesn't Exist
**Symptom:** Column mentioned in filter doesn't exist in table
**Fix:** Either add column to table or change filter to different column

### Scenario C: RLS Policies Blocking
**Symptom:** Column exists but policies prevent access
**Fix:** Update RLS policies to allow realtime subscriptions

### Scenario D: Realtime Not Enabled
**Symptom:** Table exists but realtime subscription isn't configured
**Fix:** Enable realtime in Supabase for the table

### Scenario E: Multiple Supabase Clients
**Symptom:** Auth issues with multiple client instances
**Fix:** Consolidate to single client (address the GoTrueClient warning)

---

## Next Steps After Investigation

1. **Share findings** from the investigation checklist above
2. **I'll provide specific fixes** based on what you find
3. **We'll implement the fixes** in the code
4. **Verify with new logs** that subscriptions work

---

## Quick Reference: Key Files

| File | Purpose |
|------|---------|
| `frontend/src/lib/supabase/client.ts` | Realtime client setup |
| `frontend/src/hooks/useProjectRealtime.ts` | Project realtime subscriptions |
| `frontend/src/hooks/useAgentStream.ts` | Agent stream handling |
| `suna-supabase/` | Database schema/migrations |
| Supabase Studio (localhost:5555) | Database inspector |

---

## Timeline

1. **First:** Run Step 1 commands to find the subscription code
2. **Second:** Run Step 2 SQL queries to verify schema
3. **Third:** Run Step 3 queries to check RLS/realtime config
4. **Fourth:** Add Step 4 logging and check browser console
5. **Finally:** Share findings and I'll provide targeted fixes
