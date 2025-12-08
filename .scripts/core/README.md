# Core Helper Scripts

PowerShell scripts for common Docker operations in the Suna repository.

## Available Scripts

### 1. `docker-backend-tail-logs.ps1`
Display most recent backend logs.

```powershell
# Show last 250 lines and exit
.\.scripts\core\docker-backend-tail-logs.ps1

# Show last 500 lines and exit
.\.scripts\core\docker-backend-tail-logs.ps1 500

# Show last 250 lines and follow (stream)
.\.scripts\core\docker-backend-tail-logs.ps1 -Follow
```

### 2. `docker-compose-build.ps1`
Build and restart Docker services.

```powershell
# Build all services
.\.scripts\core\docker-compose-build.ps1

# Build specific service
.\.scripts\core\docker-compose-build.ps1 backend
.\.scripts\core\docker-compose-build.ps1 frontend
.\.scripts\core\docker-compose-build.ps1 worker
```

### 3. `docker-exec.ps1`
Execute commands in containers.

```powershell
# Open interactive shell
.\.scripts\core\docker-exec.ps1 backend

# Run specific command
.\.scripts\core\docker-exec.ps1 backend env
.\.scripts\core\docker-exec.ps1 backend uv run pytest --version
```

### 4. `docker-compose-hard-restart.ps1`
Perform full restart (down then up).

```powershell
# Hard restart all services
.\.scripts\core\docker-compose-hard-restart.ps1

# Hard restart specific service
.\.scripts\core\docker-compose-hard-restart.ps1 backend

# Hard restart with rebuild
.\.scripts\core\docker-compose-hard-restart.ps1 -Build
.\.scripts\core\docker-compose-hard-restart.ps1 backend -Build
```

### 5. `docker-list-containers.ps1`
List Suna Docker containers.

```powershell
# List running containers
.\.scripts\core\docker-list-containers.ps1

# List all containers (including stopped)
.\.scripts\core\docker-list-containers.ps1 -All
```

### 6. `docker-apply-migration.ps1`
Apply SQL migration to Supabase database container.

```powershell
# Apply migration to default 'supabase-db' container
.\.scripts\core\docker-apply-migration.ps1 .\migrations\001_init.sql

# Apply migration to specific container
.\.scripts\core\docker-apply-migration.ps1 .\migrations\001_init.sql -ContainerName my-db
```

### 7. `list-recent-edits.ps1`
List recently edited files in the repository.

```powershell
# List top 10 (default)
.\.scripts\core\list-recent-edits.ps1

# List top 20
.\.scripts\core\list-recent-edits.ps1 20
```

### 8. `list-recent-docs.ps1`
List recently edited documentation files (.md).

```powershell
# List top 10 (default)
.\.scripts\core\list-recent-docs.ps1

# List top 20
.\.scripts\core\list-recent-docs.ps1 20
```

## Optional: PowerShell Aliases

Add these to your PowerShell profile (`$PROFILE`) for quick access:

```powershell
# Suna helper aliases
function suna-logs { .\.scripts\core\docker-backend-tail-logs.ps1 @args }
function suna-build { .\.scripts\core\docker-compose-build.ps1 @args }
function suna-exec { .\.scripts\core\docker-exec.ps1 @args }
function suna-restart { .\.scripts\core\docker-compose-hard-restart.ps1 @args }
function suna-ps { .\.scripts\core\docker-list-containers.ps1 @args }
function suna-migrate { .\.scripts\core\docker-apply-migration.ps1 @args }
function suna-recent { .\.scripts\core\list-recent-edits.ps1 @args }
function suna-docs { .\.scripts\core\list-recent-docs.ps1 @args }
```

Then use like:
```powershell
suna-ps
suna-logs
suna-build backend
suna-exec backend
suna-migrate .\my-migration.sql
```

## Help Documentation

All scripts include built-in help:

```powershell
Get-Help .\.scripts\core\docker-backend-tail-logs.ps1 -Full
Get-Help .\.scripts\core\docker-compose-build.ps1 -Examples
```
