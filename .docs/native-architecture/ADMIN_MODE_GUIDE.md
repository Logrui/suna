# Admin Mode Setup Guide for Suna

## Overview

Suna has a comprehensive admin system with three role levels and multiple admin features:

- **user**: Standard user role (default)
- **admin**: Administrative access to user management, billing, and system configuration
- **super_admin**: Full system access with ability to grant admin roles to others

## Admin Features Available

### 1. **Admin Dashboard** (`/admin/billing`)
- View all users with pagination and filtering
- Search users by email
- Filter by tier (free, pro, enterprise, etc.)
- Sort by various fields (created_at, email, balance, tier)
- View detailed user information including:
  - Credit balance and usage history
  - Subscription status
  - Recent activity (agent runs)
  - All threads and projects

### 2. **Master Password Login** (`/master-login`)
- Emergency admin access to any user account
- Requires master password (configured in backend)
- Allows admins to log in as any user without knowing their password
- Works with both OAuth and standard email accounts

### 3. **User Management API** (`/admin/users/*`)
- List all users with advanced filtering
- Get detailed user information
- View user activity and threads
- Manage user statistics

### 4. **Billing Management** (`/admin/billing`)
- View user billing information
- Manage credits and subscriptions
- Track usage history

---

## How to Set Up Admin Accounts

### Method 1: Direct Database Insertion (Recommended for Initial Setup)

The admin role is stored in the `user_roles` table in Supabase. To make an account an admin:

1. **Access Supabase Console**
   - Go to your Supabase project dashboard
   - Navigate to the SQL Editor

2. **Insert Admin Role**
   ```sql
   -- Make a user an admin
   INSERT INTO user_roles (user_id, role, granted_by, granted_at)
   VALUES (
     'USER_UUID_HERE',
     'admin',
     'GRANTER_UUID_HERE',  -- Can be the same user for initial setup
     NOW()
   )
   ON CONFLICT (user_id) DO UPDATE
   SET role = 'admin', granted_by = 'GRANTER_UUID_HERE', granted_at = NOW();
   ```

3. **To make a user super_admin**
   ```sql
   INSERT INTO user_roles (user_id, role, granted_by, granted_at)
   VALUES (
     'USER_UUID_HERE',
     'super_admin',
     'GRANTER_UUID_HERE',
     NOW()
   )
   ON CONFLICT (user_id) DO UPDATE
   SET role = 'super_admin', granted_by = 'GRANTER_UUID_HERE', granted_at = NOW();
   ```

4. **Find User UUID**
   - In Supabase, go to Authentication > Users
   - Copy the user's UUID from the list

### Method 2: Using the Backend API (Requires Existing Admin)

If you already have an admin account, use the `grant_user_role` function:

```sql
-- Call the grant_user_role function
SELECT public.grant_user_role(
  'TARGET_USER_UUID',
  'admin'::user_role
);
```

This function enforces role hierarchy:
- **Admins** can grant `user` or `admin` roles
- **Super admins** can grant any role including `super_admin`

### Method 3: Using Master Password (Emergency Access)

If you need immediate admin access without modifying the database:

1. **Navigate to** `/master-login`
2. **Enter**:
   - User Email: The email of the account you want to access
   - Master Password: `kortix_master_2024_secure!` (configured in `backend/core/admin/master_password_api.py`)
3. **Click** "Login as User"

This logs you in as that user without needing their password.

---

## Admin Role Hierarchy

The system enforces a role hierarchy:

```
super_admin (level 2)
    ↓
admin (level 1)
    ↓
user (level 0)
```

**Permissions by Role:**

| Feature | User | Admin | Super Admin |
|---------|------|-------|------------|
| Access own data | ✅ | ✅ | ✅ |
| View all users | ❌ | ✅ | ✅ |
| View user details | ❌ | ✅ | ✅ |
| View billing info | ❌ | ✅ | ✅ |
| Grant admin role | ❌ | ❌ | ✅ |
| Grant super_admin role | ❌ | ❌ | ✅ |
| Access all threads | ❌ | ✅ | ✅ |
| Access all projects | ❌ | ✅ | ✅ |

---

## Admin Access Control Implementation

### Frontend
- **File**: `frontend/src/hooks/admin/use-admin-role.ts`
- Checks `user_roles` table for admin/super_admin roles
- Caches role data for 5 minutes
- Used to conditionally render admin UI components

### Backend
- **File**: `backend/core/auth.py`
- `require_admin` dependency enforces admin role requirement
- `require_super_admin` dependency enforces super_admin role requirement
- Role hierarchy is checked: `role_hierarchy = {'user': 0, 'admin': 1, 'super_admin': 2}`

### Database
- **Table**: `user_roles`
  - `user_id`: UUID of the user
  - `role`: Enum ('user', 'admin', 'super_admin')
  - `granted_by`: UUID of who granted the role
  - `granted_at`: Timestamp of when role was granted
  - `metadata`: JSON field for additional info

- **RLS Policies**: Admins bypass normal access controls via policies in:
  - `threads` table
  - `messages` table
  - `projects` table
  - `agent_runs` table

---

## Accessing Admin Features

### Admin Dashboard
1. **Login** with an admin account
2. **Navigate to** `/dashboard`
3. **Look for** "Billing Management - Admin" section (if you have admin role)
4. **Features available**:
   - User list with search/filter
   - Click on any user to see detailed information
   - View user's threads, activity, and billing

### Master Password Login
1. **Navigate to** `/master-login`
2. **Enter any user's email** and the master password
3. **Click** "Login as User"
4. **You'll be logged in** as that user (useful for debugging)

### Admin API Endpoints

All admin endpoints require `admin` or `super_admin` role:

```
GET  /admin/users/list                    - List all users
GET  /admin/users/{user_id}               - Get user details
GET  /admin/users/{user_id}/activity      - Get user activity
GET  /admin/users/threads/by-email        - Get user's threads
GET  /admin/users/stats/overview          - Get system statistics
```

---

## Environment Configuration

### Master Password
- **Location**: `backend/core/admin/master_password_api.py`
- **Variable**: `MASTER_PASSWORD = "kortix_master_2024_secure!"`
- **Change this** in production to a secure value
- **Store in** environment variables, not hardcoded

### Admin API Key (Optional)
- **Location**: `backend/core/utils/auth_utils.py`
- **Variable**: `KORTIX_ADMIN_API_KEY`
- **Usage**: For server-to-server admin operations
- **Header**: `X-Admin-Api-Key`

---

## Security Considerations

1. **Master Password**: Change from default in production
2. **Role Assignment**: Only super_admins should grant admin roles
3. **Audit Trail**: All role grants are logged with `granted_by` and `granted_at`
4. **RLS Policies**: Admins bypass row-level security - use carefully
5. **API Keys**: Store admin API keys securely, never in version control

---

## Troubleshooting

### Admin Dashboard Not Showing
- **Check**: User has `admin` or `super_admin` role in `user_roles` table
- **Check**: Role cache (5 min TTL) - wait or clear cache
- **Check**: Browser console for errors

### Master Password Login Not Working
- **Check**: Master password is correct (default: `kortix_master_2024_secure!`)
- **Check**: User email exists in the system
- **Check**: Backend is running and accessible

### Can't Grant Admin Role
- **Check**: You have `super_admin` role (only super_admins can grant roles)
- **Check**: Target user exists in the system
- **Check**: No database errors in backend logs

---

## Quick Start: Making Your First Admin

1. **Get your user UUID**:
   - Go to Supabase > Authentication > Users
   - Find your user and copy the UUID

2. **Run this SQL** in Supabase SQL Editor:
   ```sql
   INSERT INTO user_roles (user_id, role, granted_by, granted_at)
   VALUES (
     'YOUR_UUID_HERE',
     'super_admin',
     'YOUR_UUID_HERE',
     NOW()
   )
   ON CONFLICT (user_id) DO UPDATE
   SET role = 'super_admin', granted_by = 'YOUR_UUID_HERE', granted_at = NOW();
   ```

3. **Refresh** your browser

4. **You should now see** the admin dashboard at `/admin/billing`

---

## Related Files

- **Frontend Admin Hooks**: `frontend/src/hooks/admin/`
- **Frontend Admin Components**: `frontend/src/components/admin/`
- **Backend Admin API**: `backend/core/admin/admin_api.py`
- **Backend Auth**: `backend/core/auth.py`
- **Database Migrations**: `backend/supabase/migrations/20250905102908_user_roles.sql`
- **RLS Policies**: `backend/supabase/migrations/20251005160000_admin_roles_access.sql`
