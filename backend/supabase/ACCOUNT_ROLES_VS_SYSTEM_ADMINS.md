# Understanding Account Roles vs System Admins

## The Confusion

### Basejump `account_role` (Multi-Tenant System)

**Purpose**: Team/Workspace permissions  
**Valid Values**: Only 2 options:
- `'owner'` - Owner of a workspace/account
- `'member'` - Team member in someone else's workspace

**How it works**:
1. When a user signs up, they automatically get a "personal account" (workspace)
2. They become the `'owner'` of their own personal workspace
3. If they create a team workspace, they're the owner of that too
4. If they invite someone to their workspace, that person is a `'member'`

**Result**: ALL 19 users are "owners" because they each own their own workspace!

### System Admins (Platform-Level)

**Purpose**: Platform/system administration  
**Location**: `user_roles` table  
**Valid Values**:
- `'admin'` - System administrator
- `'super_admin'` - Super administrator

**How it works**:
- Must be manually added to `user_roles` table
- Grants platform-wide access (can see all threads, messages, projects via RLS policies)
- This is what you actually wanted!

## What Went Wrong

❌ **What happened**: Granted ultra tier to all `basejump.account_user` where `account_role = 'owner'`  
✅ **What you wanted**: Grant ultra tier to `user_roles` where `role IN ('admin', 'super_admin')`

## The Fix

Run: `.\grant-ultra-admins-only.ps1`

This script:
1. **Rolls back** all ultra tier grants (resets to 'none')
2. **Correctly grants** ultra tier ONLY to users in `user_roles` table with admin/super_admin role

## Key Tables

### `basejump.account_user`
- Links users to workspaces/teams
- `account_role`: 'owner' or 'member' (workspace-level)
- Everyone who creates an account is an "owner" of their personal workspace

### `user_roles`  
- Defines system-level administrators
- `role`: 'admin' or 'super_admin' (platform-level)
- Must be manually populated
- This is the table you care about!

## How to Check Current Admins

```sql
SELECT 
    u.email,
    ur.role 
FROM user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.role IN ('admin', 'super_admin');
```

## How to Add a System Admin

```sql
INSERT INTO user_roles (user_id, role)
VALUES 
    ('your-user-uuid-here', 'admin'),
    ('another-user-uuid', 'super_admin');
```

## Summary

- **Basejump account roles** = Team/workspace permissions (every user is an "owner")
- **user_roles** = Actual system administrators (manually assigned)
- **Ultra tier should go to** = `user_roles` admins, NOT basejump owners!
