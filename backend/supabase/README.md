# Supabase CLI with Docker - Complete Guide

## 📋 Overview

This guide explains how to use the Supabase CLI with a self-hosted Docker Supabase instance. The standard `supabase link` command won't work because it's designed exclusively for Supabase Cloud projects.

## 🎯 The Problem

The Supabase CLI is designed for two scenarios:
1. **Cloud Projects**: Requires `supabase login` and a cloud project reference
2. **CLI-Managed Local**: Uses `supabase start` to manage containers

**Your setup is different**: You have a custom Docker Compose-managed instance, which requires a different approach.

## ✅ The Solution

Use the **`sb.ps1` wrapper script** that sets environment variables and passes database connection details to the CLI.

## 🚀 Quick Start

### Basic Usage

```powershell
# Navigate to the supabase directory
cd backend/supabase

# List all migrations
.\sb.ps1 migration list

# Check for pending migrations
.\check-migrations.ps1

# Filter by keyword (e.g., "billing")
.\check-migrations.ps1 -Filter "billing"

# Create a new migration
.\sb.ps1 migration new "add_feature"

# Apply pending migrations
.\sb.ps1 db push

# Pull current schema from database
.\sb.ps1 db pull

# Generate diff of schema changes
.\sb.ps1 db diff -f "schema_changes"

# Reset database (⚠️ DESTRUCTIVE)
.\sb.ps1 db reset
```

## 🎓 How It Works

The `sb.ps1` wrapper script:

1. **Sets PostgreSQL environment variables**:
   - `PGSSLMODE=disable` (Docker instance doesn't use TLS)
   - `PGPASSWORD`, `PGHOST`, `PGPORT`, etc.

2. **Builds the connection string**:
   - `postgresql://postgres:PASSWORD@HOST:PORT/DATABASE`

3. **Passes arguments to Supabase CLI**:
   - Appends `--db-url` flag automatically
   - Forwards all your commands to the CLI

This bypasses the need for `supabase link` or `.env` file reading.

## 📖 Common Commands Reference

| Task | Command | Notes |
|------|---------|-------|
| **List migrations** | `.\sb.ps1 migration list` | Shows all applied migrations |
| **Check pending** | `.\check-migrations.ps1` | Compares local vs database |
| **Filter migrations** | `.\check-migrations.ps1 -Filter "keyword"` | Find specific migrations |
| **Create migration** | `.\sb.ps1 migration new "name"` | Creates timestamped SQL file |
| **Apply migrations** | `.\sb.ps1 db push` | Runs pending migrations |
| **Pull schema** | `.\sb.ps1 db pull` | Generates migration from DB |
| **Generate diff** | `.\sb.ps1 db diff -f "name"` | Creates migration from changes |
| **Reset database** | `.\sb.ps1 db reset` | ⚠️ Drops all data, re-runs migrations |

## 🐳 Docker Configuration

Your Docker Supabase instance uses these ports:

- **Database**: `localhost:5434` (PostgreSQL)
- **API Gateway**: `http://localhost:8888` (Kong)
- **Studio**: `http://localhost:6005` (Supabase Studio UI)
- **Project ID**: `agentpress`

**Connection String Format**:
```
postgresql://postgres:PASSWORD@localhost:5434/postgres?sslmode=disable
```

## 🔧 Configuration Files

### `config.toml`
CLI configuration file with ports matching your Docker setup:
- Database port: `5434`
- API port: `8888`
- Studio port: `6005`

### `.env`
Contains database credentials and API keys:
- Database connection details
- Supabase API keys (anon, service role)
- Project configuration

**Note**: The CLI doesn't automatically read `.env` files, which is why the wrapper script is necessary.

### `sb.ps1`
Wrapper script that makes CLI work with Docker instance.

### `check-migrations.ps1`
Utility to check for pending migrations and filter by keyword.

### `supabase-helpers.ps1` (Alternative)
Advanced helper functions like `sb-migration-list`, `sb-db-push`, etc.
Load with: `. .\supabase-helpers.ps1`

## ❓ Frequently Asked Questions

### Why can't I use `supabase link`?

**`supabase link` only works with Supabase Cloud.** It requires:
- Cloud authentication via `supabase login`
- A project reference ID from Supabase Cloud dashboard
- Access to Supabase's management API

Your Docker instance is self-hosted, so there's no cloud project to link to.

### Why doesn't the CLI read my `.env` file?

The Supabase CLI doesn't support automatic `.env` file reading for database connections. The wrapper script solves this by:
- Reading credentials from `.env`
- Setting environment variables
- Passing `--db-url` flag automatically

### Can I use `supabase start`?

**Not recommended.** It would:
- Conflict with Docker ports (both use similar port ranges)
- Create duplicate containers
- Cause confusion between two separate instances

Your Docker Compose setup already provides everything `supabase start` would create.

### How do I make this permanent?

Add an alias to your PowerShell profile (`$PROFILE`):

```powershell
# Edit profile
notepad $PROFILE

# Add this function
function sb {
    & "$PSScriptRoot/backend/supabase/sb.ps1" $args
}
```

Then you can use `sb migration list` from anywhere!

### What about alternative methods?

**Option 1: Helper Functions**
```powershell
. .\supabase-helpers.ps1
sb-migration-list
sb-db-push
```

**Option 2: Direct CLI with variable**
```powershell
$DB_URL = "postgresql://postgres:PASSWORD@localhost:5434/postgres?sslmode=disable"
supabase migration list --db-url $DB_URL
```

**Option 3: psql directly**
```powershell
$env:PGPASSWORD="PASSWORD"
psql -h localhost -p 5434 -U postgres -d postgres -c "SELECT version FROM supabase_migrations.schema_migrations;"
```

## 🎓 Best Practices

1. **Always check pending migrations** before pushing:
   ```powershell
   .\check-migrations.ps1
   ```

2. **Create descriptive migration names**:
   ```powershell
   .\sb.ps1 migration new "add_user_preferences_table"
   ```

3. **Test migrations locally** before production deployment

4. **Backup before destructive operations**:
   ```powershell
   # Backup first!
   pg_dump -h localhost -p 5434 -U postgres postgres > backup.sql
   # Then reset
   .\sb.ps1 db reset
   ```

5. **Use `db diff` for schema changes**:
   ```powershell
   # Make changes in Studio or directly in DB
   .\sb.ps1 db diff -f "captured_changes"
   ```

## 🚨 Common Issues

### TLS Connection Error

**Error**: `tls error (server refused TLS connection)`

**Solution**: The wrapper script sets `PGSSLMODE=disable`. If using raw commands, add `?sslmode=disable` to URL.

### Port Already in Use

**Error**: `port 5434 already in use`

**Solution**: Your Docker containers are running. Don't use `supabase start`.

### Cannot Find Migration

**Error**: Migration file exists locally but doesn't show in `migration list`

**Solution**: The migration hasn't been applied yet. Run `.\sb.ps1 db push`.

### Wrong Database

**Error**: Connecting to wrong database

**Solution**: Check `.env` file has correct:
- `POSTGRES_HOST=localhost`
- `POSTGRES_PORT=5434`
- `POSTGRES_DB=postgres`

## 📁 File Structure

```
backend/supabase/
├── config.toml              # CLI configuration (ports, project settings)
├── .env                     # Database credentials and API keys
├── sb.ps1                   # Main wrapper script (USE THIS)
├── check-migrations.ps1     # Migration status checker
├── supabase-helpers.ps1     # Alternative helper functions
├── migrations/              # SQL migration files
│   ├── 20240101000000_initial.sql
│   ├── 20240102000000_add_users.sql
│   └── ...
└── README.md               # This file
```

## 🚀 Next Steps

1. **Verify connection**:
   ```powershell
   .\sb.ps1 migration list
   ```

2. **Check for pending migrations**:
   ```powershell
   .\check-migrations.ps1
   ```

3. **Set up PowerShell alias** (optional):
   ```powershell
   notepad $PROFILE
   # Add: function sb { & "path/to/sb.ps1" $args }
   ```

4. **Start developing**:
   - Create migrations as needed
   - Push to database regularly
   - Pull schema when making live changes

## 📚 Additional Resources

- [Supabase CLI Reference](https://supabase.com/docs/reference/cli)
- [Self-Hosting Supabase](https://supabase.com/docs/guides/self-hosting)
- [Database Migrations Guide](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [PostgreSQL Connection Strings](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)
