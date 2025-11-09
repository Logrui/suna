# Fix: Sandbox Files Listing & Content Reading - Basejump Schema Exposure

**Date**: October 31, 2025  
**Status**: ✅ RESOLVED  
**Impact**: Fixes all 500 errors related to `/api/sandboxes/*/files/` endpoints

---

## Problem Summary

Users experienced multiple 500 errors when attempting to interact with sandbox files:

```
/api/sandboxes/9ca5caf2-21f1-4ab5-b56c-823eb48aea36/files?path=%2Fworkspace - 500 Internal Server Error
/api/sandboxes/9ca5caf2-21f1-4ab5-b56c-823eb48aea36/files/content?path=... - 500 Internal Server Error
/api/project/.../sandbox/ensure-active - 500 Internal Server Error
```

**Root Cause**: 

The backend was trying to access the `basejump` schema to verify user permissions:

```python
# In backend/core/sandbox/api.py (line 380)
account_user_result = await client.schema('basejump').from_('account_user')
    .select('account_role')
    .eq('user_id', user_id)
    .eq('account_id', account_id)
    .execute()
```

However, PostgREST (the Supabase REST API layer) was configured to only expose these schemas:
- `public`
- `storage`
- `graphql_public`

The `basejump` schema existed in the PostgreSQL database but was NOT exposed by PostgREST, resulting in:

```
postgrest.exceptions.APIError: {
    'message': 'Invalid schema: basejump',
    'code': 'PGRST106',
    'hint': 'Only the following schemas are exposed: public, storage, graphql_public'
}
```

---

## Solution

### Step 1: Update PostgREST Configuration

**File**: `d:\Homelab\suna-supabase\docker\.env`  
**Line**: 53

**Before**:
```properties
PGRST_DB_SCHEMAS=public,storage,graphql_public
```

**After**:
```properties
PGRST_DB_SCHEMAS=public,storage,graphql_public,basejump
```

This configuration tells PostgREST which database schemas to expose via the REST API.

### Step 2: Recreate PostgREST Container

```bash
cd d:\Homelab\suna-supabase\docker
docker compose up -d rest
```

### Step 3: **Completely Restart All Suna Services**

⚠️ **CRITICAL**: Simply restarting the backend is NOT sufficient. You must completely tear down and recreate services:

```bash
cd d:\Homelab\suna
docker compose down
docker compose up -d
```

**Why this step is essential**:
- Connection pools and DNS resolutions may be cached in running containers
- Docker networks must be refreshed to pick up PostgREST configuration changes
- A `restart` command only signals containers to reload—it doesn't refresh network configurations or connections
- A full `down` followed by `up` creates fresh network namespaces and connection handles

**Gotcha**: If you only do `docker compose restart backend`, the backend may maintain stale connections to the old PostgREST configuration and continue seeing "basejump schema not exposed" errors!

---

## Verification

### Check PostgREST Configuration

```bash
docker inspect supabase-rest --format='{{.Config.Env}}' | grep PGRST_DB_SCHEMAS
```

**Expected Output**:
```
PGRST_DB_SCHEMAS=public,storage,graphql_public,basejump
```

### Check Backend Logs

```bash
docker compose logs backend --tail=20
```

**Expected**: No `Invalid schema: basejump` errors. Backend should start cleanly:

```
[debug] Daytona sandbox configured successfully
[debug] Daytona API URL set to: https://app.daytona.io/api
[info] Successfully connected to Redis
[info] Application startup complete
```

### Test Endpoint

Try making a request to a sandbox file endpoint. Should return 200 instead of 500:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://kortix.syhc.dev/api/sandboxes/SANDBOX_ID/files?path=/workspace
```

---

## Technical Details

### What is the `basejump` Schema?

Basejump is a Supabase starter kit that provides:
- User authentication management
- Account/organization structures  
- Role-based access control (RBAC)
- Billing and subscription management

The `basejump` schema contains tables like:
- `accounts` - Organization/account records
- `account_user` - User-to-account mappings
- `account_role` - User roles within accounts
- `billing_customers` - Billing integration records

### Why Was It Missing from PostgREST?

The PostgREST configuration's `PGRST_DB_SCHEMAS` environment variable explicitly lists which schemas the REST API should expose. This is a security measure to ensure:
1. Internal-only schemas (like `basejump`) are not accidentally exposed
2. Only explicitly allowed schemas are accessible via the REST API

However, for Suna's backend to function properly, it needs access to verify user permissions in the `basejump` schema, so we must add it to the exposed schemas list.

### Why Does Backend Need Basejump Access?

The backend uses `basejump` for:

1. **Sandbox Access Verification** (`backend/core/sandbox/api.py`):
   - Checks if user is a member of the account that owns the sandbox
   - Verifies user's role within the account

2. **User Authorization** (`backend/core/utils/auth_utils.py`):
   - Validates user access to projects
   - Checks account membership for permission verification

3. **Template Management** (`backend/core/templates/template_service.py`):
   - Retrieves account information
   - Manages template ownership

### Docker Container Lifecycle Issue

This fix exposed an important gotcha with Docker Compose networking:

**Problem**: 
- Changing `.env` and running `docker compose up -d rest` updates the PostgREST container
- But running `docker compose restart backend` does NOT refresh backend's connections
- Docker connection pools maintain references to the old service state

**Solution**:
- `docker compose down` removes all containers and networks
- `docker compose up -d` recreates fresh containers and networks
- Fresh connections are established to all services, including the updated PostgREST

---

## Prevention

To prevent this issue in the future:

### 1. When Setting Up New Supabase Instance

Always configure PostgREST to expose the `basejump` schema from the start:

```properties
PGRST_DB_SCHEMAS=public,storage,graphql_public,basejump
```

### 2. Document Schema Dependencies

In setup documentation, clearly list which schemas each service needs:

```markdown
## Supabase Schema Requirements

| Schema | Purpose | Required By |
|--------|---------|------------|
| public | Core tables | Backend, Frontend |
| storage | File storage | Frontend |
| graphql_public | GraphQL API | Frontend |
| basejump | User management, RBAC | Backend |
```

### 3. Add Configuration Validation

Consider adding a startup check in the backend to validate schema access:

```python
async def validate_schema_access():
    """Verify basejump schema is accessible"""
    try:
        result = await db.client.table('basejump.account_user').limit(1).execute()
        logger.info("✓ Basejump schema is accessible")
    except Exception as e:
        logger.error(f"✗ Cannot access basejump schema: {e}")
        # Could raise or warn depending on your policy
```

### 4. Always Use Full Down/Up for Configuration Changes

When modifying critical Docker Compose configuration files (especially network or environment variables), always use:

```bash
docker compose down   # Remove all containers/networks
docker compose up -d  # Recreate fresh
```

Never just use `restart` if you've changed configuration files.

---

## Summary

| Aspect | Details |
|--------|---------|
| **Root Cause** | PostgREST not exposing `basejump` schema |
| **Error Code** | PGRST106 |
| **Primary Fix** | Add `basejump` to `PGRST_DB_SCHEMAS` |
| **Critical Secondary Fix** | Full `docker compose down && up` (not just restart) |
| **Files Modified** | `suna-supabase/docker/.env` |
| **Services Affected** | `supabase-rest`, `suna-backend`, `suna-worker`, `suna-frontend` |
| **Impact** | All sandbox file operations now work correctly |
| **Testing** | Try reading/listing files from a sandbox - should return 200 |

---

## Rollback

If issues arise, you can rollback by:

1. Revert the `.env` file change:
   ```properties
   PGRST_DB_SCHEMAS=public,storage,graphql_public
   ```

2. Completely restart services:
   ```bash
   cd suna-supabase/docker && docker compose up -d rest
   cd suna && docker compose down && docker compose up -d
   ```

---

## Related Documentation

- [Supabase PostgREST Configuration](https://supabase.com/docs/guides/api/rest-api-overview)
- [Basejump Authentication](https://docs.usebasejump.com)
- [Suna Sandbox Implementation](backend/core/sandbox/README.md)
- [Docker Compose Networking](https://docs.docker.com/compose/networking/)
