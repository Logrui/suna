# GEMINI.md

This file provides guidance to Gemini when working with code in this repository.

## 🚨 Critical Constraint: Documentation Hard Limit

**⚠️ MAXIMUM 3 MARKDOWN FILES PER REQUEST - Non-negotiable**

When creating or updating documentation:
- Never create more than 3 `.md` files in any single response
- If you're approaching 3 files, consolidate instead of adding new files
- Each file must serve a distinct, non-overlapping purpose
- Use descriptive filenames: `QUICK_REFERENCE.md`, `COMPLETE_GUIDE.md`, `TROUBLESHOOTING.md`

**IMPORTANT:** See `.github/CLAUDE_CONSTRAINT_REMINDER.md` for detailed enforcement and examples.

See `.github/instructions/documentation.instructions.md` for complete documentation rules.

## Project Overview

Kortix (formerly Suna) is an open-source platform for building, managing, and training autonomous AI agents. The project consists of:

1. **Backend API** (FastAPI/Python) - REST endpoints, thread management, LLM orchestration
2. **Backend Worker** (Dramatiq) - Background agent task execution
3. **Frontend** (Next.js/React) - Web UI for agent management
4. **Agent Sandbox** (Daytona) - Isolated runtime for agent actions - non optional - core part of Suna Kortix
5. **Database** (Supabase) - PostgreSQL with authentication and real-time subscriptions

## This Fork: Self-Hosted Setup

**Important:** This is a self-hosted fork with significant customizations for Docker Compose deployment with local Supabase and Cloudflare Tunnel access. See `.docs/` directory for detailed migration history.

### Key Modifications

1. **Self-Hosted Supabase** - Running via Docker Compose in `suna-supabase/docker/`
2. **Docker Network Integration** - Services connected across `suna` and `supabase` networks
3. **Dynamic URL Detection** - Supports both localhost and Cloudflare Tunnel (`https://kortix.syhc.dev`)
4. **Middleware Routing** - Three-layer URL detection (browser, server, middleware)
5. **Basejump Schema** - Required schema exposure in PostgREST configuration
6. **Graceful Degradation** - Daytona sandboxing is optional, core features work without it

## Development Commands

### Backend

#### Starting Backend Services

```bash
cd backend

# Start Redis (required)
docker compose up redis -d

# Start Dramatiq worker (terminal 1)
uv run dramatiq --processes 4 --threads 4 run_agent_background

# Start API server (terminal 2)
uv run uvicorn api:app --host 0.0.0.0 --port 8000 --reload

# Alternative: Start API with Python
uv run python api.py
```

#### Testing

```bash
cd backend

# Run all tests
./test

# Run only unit tests (fast, no external dependencies)
./test --unit

# Run integration tests
./test --integration

# Run LLM tests (requires API keys, costs money)
./test --llm

# Run with coverage report
./test --coverage

# Run specific test directory
./test --path core/services

# Stop on first failure
./test -x

# Using pytest directly
uv run pytest
uv run pytest core/services/tests/cache.test.py
uv run pytest -m unit
```

Test files must end with `.test.py` and be placed in `tests/` directories within modules.

### Frontend - typically we dont use NPM and simply use Docker commands to 'deploy and test' frontend and backend changes

```bash
cd frontend

# Install dependencies
npm install

# Development server (with Turbopack)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint
npm run lint

# Format code
npm run format

# Check formatting
npm run format:check
```

### Docker Deployment

```bash
# Start all services (Redis, backend, worker, frontend)
docker compose up -d --build

# View logs
docker compose logs -f

# Check status
docker compose ps

# Stop services
docker compose down
```

### Docker Image Backup & Restoration

**Critical Practice:** Before running `docker compose up -d --build`, always backup your stable working images. When Docker rebuilds images, it moves the `latest` or `local` tag to the new build, leaving old images as "dangling" (unnamed) and subject to pruning.

#### Backing Up Stable Images

Before rebuilding, tag your current stable images with a backup identifier:

```powershell
# Backup backend/worker image (uses same image)
docker tag suna-backend:local suna-backend:backup-YYYY-MM-DD

# Backup frontend image
docker tag suna-frontend:latest suna-frontend:backup-YYYY-MM-DD

# Example with today's date
docker tag suna-backend:local suna-backend:backup-2025-12-03
docker tag suna-frontend:latest suna-frontend:backup-2025-12-03
```

#### Verify Backups

```powershell
# List all backup images
docker images | Select-String "backup"

# List specific backup
docker images | Select-String "backup-2025-12-03"
```

#### When to Backup

**Always backup before:**
- Merging upstream changes (especially from PRODUCTION branch)
- Applying major dependency updates (`pyproject.toml`, `package.json`)
- Implementing breaking changes or refactors
- Testing experimental features
- Updating Docker base images or build configurations

#### Restoring from Backup

If a new build fails, introduces bugs, or has breaking changes, restore the backup:

```powershell
# Restore backend to previous stable version
docker tag suna-backend:backup-2025-12-03 suna-backend:local

# Restore frontend to previous stable version
docker tag suna-frontend:backup-2025-12-03 suna-frontend:latest

# Restart services with restored images (no rebuild)
docker compose up -d
```

**Important:** The `docker compose up -d` command (without `--build`) will use the existing tagged images.

#### Multiple Backup Strategy

For critical updates, maintain multiple backup points:

```powershell
# Before upstream merge
docker tag suna-backend:local suna-backend:pre-upstream-merge
docker tag suna-frontend:latest suna-frontend:pre-upstream-merge

# After successful merge (new stable baseline)
docker tag suna-backend:local suna-backend:stable-post-merge
docker tag suna-frontend:latest suna-frontend:stable-post-merge
```

#### Cleanup Old Backups

```powershell
# List all images with sizes
docker images

# Remove specific backup
docker rmi suna-backend:backup-2025-11-15
docker rmi suna-frontend:backup-2025-11-15

# Remove all dangling images (untagged)
docker image prune
```

#### Emergency Rollback Workflow

If you discover issues after deployment:

1. **Stop services immediately:**
   ```powershell
   docker compose down
   ```

2. **Restore last known good images:**
   ```powershell
   docker tag suna-backend:backup-2025-12-03 suna-backend:local
   docker tag suna-frontend:backup-2025-12-03 suna-frontend:latest
   ```

3. **Restart with stable images:**
   ```powershell
   docker compose up -d
   ```

4. **Verify restoration:**
   ```powershell
   docker compose ps
   docker compose logs -f
   ```

#### Best Practices

- **Date-based naming:** Use `backup-YYYY-MM-DD` format for easy chronological sorting
- **Descriptive tags:** For major changes, use descriptive names like `pre-billing-refactor` or `stable-v1.2.3`
- **Keep recent backups:** Maintain at least 2-3 recent backup points
- **Document changes:** Note what changed between backups in commit messages or `.docs/`
- **Test before cleanup:** Verify new build is stable before removing old backups

## Architecture

### Backend Structure

- **`backend/api.py`** - FastAPI application entry point with CORS, middleware, and router initialization
- **`backend/core/agentpress/`** - Core agent orchestration system
  - `thread_manager.py` - Conversation thread management, LLM calls, tool execution
  - `tool_registry.py` - Auto-discovery and registration of tools
  - `tool.py` - Base Tool class with metadata decorators
  - `context_manager.py` - Manages conversation context and token limits
  - `response_processor.py` - Processes LLM responses and tool calls
  - `prompt_caching.py` - Anthropic prompt caching strategies
- **`backend/core/tools/`** - All agent tools (auto-discovered)
  - `sb_*.py` - Sandbox tools (files, shell, docs, presentations, images)
  - `web_search_tool.py` - Web search via Tavily
  - `browser_tool.py` - Browser automation
  - `mcp_tool_wrapper.py` - Model Context Protocol tool integration
  - `agent_builder_tools/` - Tools for creating and managing agents
- **`backend/core/services/`** - Shared services
  - `supabase.py` - Database connection management
  - `redis.py` - Caching and session management
  - `langfuse.py` - LLM observability and tracing
  - `transcription.py` - Audio transcription
- **`backend/core/billing/`** - Billing and subscription management
- **`backend/core/sandbox/`** - Agent runtime environment (Daytona integration)
- **`backend/core/credentials/`** - Credential and profile management
- **`backend/core/templates/`** - Agent templates and marketplace

### Frontend Structure

- **Next.js 15** with App Router
- **`frontend/src/app/`** - App routes and pages
- **`frontend/src/components/`** - React components
- **`frontend/src/hooks/`** - Custom React hooks with TanStack Query
- **`frontend/src/lib/`** - Utility functions and API clients
- **`frontend/src/store/`** - State management (Zustand)

### AgentPress Tool System

The tool system uses **auto-discovery** - tools are automatically registered by scanning `backend/core/tools/`.

#### Creating a New Tool

```python
from core.agentpress.tool import Tool, tool_metadata, method_metadata, openapi_schema

@tool_metadata(
    display_name="My Tool",
    description="Tool description",
    icon="IconName",
    color="bg-blue-100 dark:bg-blue-800/50"
)
class MyTool(Tool):

    @method_metadata(
        display_name="Do Something",
        description="Method description"
    )
    @openapi_schema({
        "type": "function",
        "function": {
            "name": "do_something",
            "description": "Method description",
            "parameters": {
                "type": "object",
                "properties": {
                    "param": {"type": "string", "description": "Parameter description"}
                },
                "required": ["param"]
            }
        }
    })
    def do_something(self, param: str):
        return self.success_response("Done!")
```

The tool will be **automatically discovered** and available to agents - no manual registration needed.

### Database Schema

The backend uses Supabase (PostgreSQL) with these key tables:

- `threads` - Conversation threads
- `messages` - Thread messages
- `agents` - Agent configurations
- `agent_versions` - Agent version history
- `accounts` - User accounts (via Basejump)
- `triggers` - Scheduled/webhook triggers
- `credentials` - Encrypted credentials for tools

**Important**: When setting up Supabase, expose the `basejump` schema: Project Settings → API → Add `basejump` to Exposed Schemas.

### Environment Variables

#### Self-Hosted Docker Setup (This Fork)

Backend requires these in `backend/.env`:

```env
# Database & Auth (Self-Hosted Supabase)
SUPABASE_URL=http://supabase-kong:8000  # Internal Docker network hostname
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Redis (Required)
REDIS_HOST=redis  # Docker service name
REDIS_PORT=6379
REDIS_SSL=false

# LLM Providers (OpenAI REQUIRED for embeddings!)
OPENAI_API_KEY=your-key  # CRITICAL: Required for kb-fusion embeddings
ANTHROPIC_API_KEY=your-key  # For LLM (optional if have OpenAI)
# Also supports: GROQ_API_KEY, OPENROUTER_API_KEY, GEMINI_API_KEY, XAI_API_KEY

# Web Tools (Required)
TAVILY_API_KEY=your-key  # Web search
FIRECRAWL_API_KEY=your-key  # Web scraping
RAPID_API_KEY=your-key  # Data APIs

# Agent Sandbox (OPTIONAL - graceful degradation)
DAYTONA_API_KEY=your-key  # Leave empty to disable sandboxing
DAYTONA_SERVER_URL=https://app.daytona.io/api
DAYTONA_TARGET=us

# Security (Recommended)
MCP_CREDENTIAL_ENCRYPTION_KEY=your-fernet-key
TRIGGER_WEBHOOK_SECRET=your-secret
```

Frontend requires these in `frontend/.env.local`:

```env
# Docker internal URL for server-side requests
NEXT_PUBLIC_SUPABASE_URL=http://supabase-kong:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_BACKEND_URL=http://backend:8000/api
NEXT_PUBLIC_URL=http://localhost:9990
NEXT_PUBLIC_ENV_MODE=LOCAL
```

**Important:** Frontend uses dynamic URL detection at runtime. The `NEXT_PUBLIC_SUPABASE_URL` is used for server-side rewrites, but browser requests use `window.location.origin` for multi-domain support.

#### Cloud Setup (Original)

For cloud-hosted Supabase, use:
- `SUPABASE_URL=https://your-project.supabase.co`
- `NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co`

### Key Technology Choices

- **Python Package Manager**: `uv` (fast, modern alternative to pip/poetry)
- **Background Jobs**: Dramatiq with Redis broker
- **LLM Integration**: LiteLLM (unified interface for multiple LLM providers)
- **Agent Runtime**: Daytona SDK for isolated sandboxed environments (OPTIONAL)
- **Observability**: Langfuse for LLM tracing and monitoring
- **Frontend State**: TanStack Query for server state, Zustand for client state
- **Styling**: Tailwind CSS with Radix UI components
- **Embeddings**: kb-fusion with OpenAI text-embedding-3-small (hardcoded)

## Self-Hosted Setup Specifics

### Docker Networking Configuration

This fork uses a dual-network architecture to connect Suna services with self-hosted Supabase:

```yaml
# docker-compose.yaml
networks:
  default:
    name: suna
  supabase:
    name: supabase
    external: true  # Connects to separately-run Supabase stack

services:
  backend:
    networks:
      - default      # Internal suna communication
      - supabase     # Access to Supabase services

  frontend:
    networks:
      - default
      - supabase

  worker:
    networks:
      - default
      - supabase
```

**Critical:** Services must be on BOTH networks to communicate with Redis (suna network) AND Supabase (supabase network).

### Supabase Self-Hosted Setup

1. **Location**: `suna-supabase/docker/` (separate directory)
2. **Port Mappings**:
   - Kong (API Gateway): `8002` → Internal `8000`
   - Auth Service: `8100` → Internal `9999`
   - Studio (Dashboard): `6005` → Internal `3000`
   - PostgreSQL: `5432` (direct access)

3. **Required Configuration** (`suna-supabase/docker/.env`):
   ```env
   # CRITICAL: Must expose basejump schema for user permissions
   PGRST_DB_SCHEMAS=public,storage,graphql_public,basejump
   ```

4. **Starting Supabase**:
   ```bash
   cd suna-supabase/docker
   docker compose up -d
   ```

### Basejump Schema Exposure

**Critical Fix:** Backend requires access to `basejump` schema for user permissions, but PostgREST doesn't expose it by default.

**Error if not configured:**
```
postgrest.exceptions.APIError: Invalid schema: basejump
PGRST106: Only the following schemas are exposed: public, storage, graphql_public
```

**Solution:**
1. Edit `suna-supabase/docker/.env`
2. Add `basejump` to `PGRST_DB_SCHEMAS`
3. Restart: `docker compose up -d rest`
4. **CRITICAL:** Full restart Suna: `cd suna && docker compose down && docker compose up -d`
   - Simple `restart` is NOT sufficient - must recreate containers for fresh connections

See `.docs/sandbox_issues/BASEJUMP_SCHEMA_EXPOSURE_FIX_v2.md` for details.

### Multi-Domain Access (Cloudflare Tunnel)

This fork supports simultaneous access via:
- `http://localhost:9990` (local development)
- `https://kortix.syhc.dev` (Cloudflare Tunnel)

**Implementation:** Three-layer dynamic URL detection

1. **Browser Client** (`frontend/src/lib/supabase/client.ts`):
   ```typescript
   const supabaseUrl = typeof window !== 'undefined'
     ? window.location.origin
     : 'http://localhost:9990'
   ```

2. **Server Client** (`frontend/src/lib/supabase/server.ts`):
   ```typescript
   const protocol = headers().get('x-forwarded-proto') || 'http'
   const host = headers().get('host') || 'localhost:9990'
   const supabaseUrl = `${protocol}://${host}`
   ```

3. **Middleware** (`frontend/src/middleware.ts`):
   - Uses request headers for auth redirects
   - Preserves cookies across domains

**Result:** Same Docker image works on both localhost and Cloudflare Tunnel without rebuild.

See `.docs/initialsetup/6. middleware migrations/` for complete documentation.

### Knowledge Base & Embeddings

**Critical Dependency:** OpenAI API key is REQUIRED for knowledge base functionality.

- **Embeddings**: kb-fusion uses OpenAI `text-embedding-3-small` (hardcoded, no alternatives)
- **LLM Models**: LiteLLM supports 7+ providers (OpenAI, Anthropic, Google, etc.)
- **Without OPENAI_API_KEY**:
  - ✅ Documents upload and store
  - ✅ LLM summarization works (uses fallback providers)
  - ❌ KB semantic search fails (no embeddings)

**kb-fusion Architecture:**
- SQLite FTS5 indexing
- RRF (Reciprocal Rank Fusion) + MMR (Maximal Marginal Relevance) ranking
- 220-word chunks with ~200 word stride
- Returns top 18 documents with 500-char snippets

See `.docs/file storage and embeddings/` for detailed documentation.

### Daytona Sandbox (Optional)

**Important:** Daytona sandboxing is OPTIONAL with graceful degradation.

**Without Daytona:**
- ✅ Core agent functionality works
- ✅ General tools work
- ✅ LLM reasoning works
- ❌ Sandbox-specific tools fail (browser automation, isolated file operations)

**Configuration:** All Daytona fields in `backend/core/utils/config.py` are `Optional[str] = None`

**Behavior:**
- App starts without Daytona configuration
- Sandbox creation only attempted when sandbox tool is called
- Clear error messages when sandbox features unavailable
- No cascade failures

See `.docs/initialsetup/7. sandbox debugging/GRACEFUL_DEGRADATION_PATTERN.md` for architectural details.

## Common Development Patterns

### Adding a New API Endpoint

1. Create router in appropriate module (e.g., `backend/core/my_feature/api.py`)
2. Register router in `backend/api.py`:
   ```python
   from core.my_feature import api as my_feature_api
   app.include_router(my_feature_api.router)
   ```

### Adding a New Frontend Page

1. Create route in `frontend/src/app/my-page/page.tsx`
2. Use server components by default, client components only when needed
3. Fetch data with TanStack Query hooks in `frontend/src/hooks/react-query/`

### Working with Threads

```python
from core.agentpress.thread_manager import ThreadManager

thread_manager = ThreadManager()

# Create thread
thread_id = await thread_manager.create_thread(account_id="...")

# Add user message
await thread_manager.add_message(thread_id, "user", "Hello")

# Run agent (streams responses)
async for chunk in thread_manager.run_thread_stream(
    thread_id=thread_id,
    agent_config=agent_config,
    model="claude-3-5-sonnet-20241022"
):
    print(chunk)
```

### Tool Response Patterns

Tools should return structured responses:

```python
# Success
return self.success_response("Operation completed", {"result": data})

# Error
return self.error_response("Operation failed", {"details": error_info})

# Progress (for long-running operations)
return self.progress_response("Processing...", {"progress": 50})
```

## Important Implementation Notes

### Prompt Caching

The backend uses Anthropic's prompt caching to reduce costs. System prompts and tool definitions are cached. See `backend/core/agentpress/prompt_caching.py` for implementation.

### Security Considerations

- Credentials are encrypted using Fernet symmetric encryption (key: `MCP_CREDENTIAL_ENCRYPTION_KEY`)
- Sandbox operations run in isolated Daytona environments
- Agent runs are tied to user accounts for access control
- API endpoints check authentication via Supabase JWT tokens

### Performance Optimization

- Redis caches frequently accessed data (agent configs, user sessions)
- Dramatiq handles long-running agent executions asynchronously
- Frontend uses React Query for intelligent caching and deduplication
- Database queries use proper indexes (see migration files)

### Windows Development

The backend sets `WindowsProactorEventLoopPolicy` on Windows (see `backend/api.py:37`) to handle asyncio properly.

## Mobile App

The repository includes a React Native mobile app in `apps/mobile/` (Expo-based). It shares similar architecture with the web frontend but is currently in development.

## Troubleshooting (Self-Hosted Setup)

### Docker Networking Issues

**Problem:** `ECONNREFUSED` or "fetch failed" errors

**Solution:**
1. Verify services are on both networks:
   ```bash
   docker network inspect supabase | grep suna-frontend
   docker network inspect suna | grep suna-frontend
   ```
2. If missing, restart with full teardown:
   ```bash
   docker compose down
   docker compose up -d
   ```

**Never use** `docker compose restart` after network configuration changes - always use `down` then `up`.

### Supabase 400 Errors

**Problem:** `400 Bad Request` from Supabase API endpoints

**Causes & Solutions:**

1. **Basejump schema not exposed:**
   - Check: `docker inspect supabase-rest --format='{{.Config.Env}}' | grep PGRST_DB_SCHEMAS`
   - Fix: Add `basejump` to `PGRST_DB_SCHEMAS` in `suna-supabase/docker/.env`
   - Restart: Full `down && up` for both Supabase and Suna

2. **URL mismatch in browser:**
   - Verify middleware is using correct headers
   - Check browser console for DNS errors
   - Ensure `window.location.origin` is used in client.ts

3. **Auth service not accessible:**
   - Check port 8100 is exposed: `docker ps | grep auth`
   - Verify Kong can route to auth: `curl http://localhost:8002/health`

### Knowledge Base Search Failing

**Problem:** Documents upload but search returns no results

**Solution:**
1. Verify OpenAI API key is set: `docker exec suna-backend-1 env | grep OPENAI_API_KEY`
2. Check backend logs for embedding errors: `docker compose logs backend | grep "embedding"`
3. KB search requires OpenAI - no workaround in kb-fusion v0.1.1

### OAuth/Login Issues

**Problem:** Login redirects to blank page or 404

**Causes & Solutions:**

1. **Port 8100 not exposed:**
   - Edit `suna-supabase/docker/docker-compose.yml`
   - Add `ports: ["8100:9999"]` to auth service
   - Restart Supabase

2. **Network isolation:**
   - Ensure frontend is on supabase network
   - Test: `docker exec suna-frontend-1 wget -O - http://supabase-kong:8000/health`

3. **Cloudflare Tunnel access:**
   - Verify middleware uses `x-forwarded-proto` and `host` headers
   - Check auth cookies are set with correct domain
   - Review `.docs/initialsetup/2. oauth/` for OAuth fixes

### Sandbox/Daytona Errors

**Problem:** "Snapshot not found" or "Daytona API error"

**This is expected if Daytona is not configured.** The app will:
- ✅ Continue working for non-sandbox features
- ❌ Fail sandbox-specific tools with clear error messages

**To enable Daytona:**
1. Sign up at https://app.daytona.io/
2. Set `DAYTONA_API_KEY` in `backend/.env`
3. Build custom Docker image with workspace snapshot
4. Configure snapshot ID in Daytona settings
5. Restart: `docker compose up -d`

**To disable gracefully:** Leave `DAYTONA_API_KEY` empty - app works without sandboxing.

### Configuration Changes Not Taking Effect

**Problem:** Changed `.env` but behavior unchanged

**Solution:**
1. **Build-time variables** (NEXT_PUBLIC_*): Require rebuild
   ```bash
   docker compose up -d --build
   ```

2. **Runtime variables** (backend): Restart is sufficient
   ```bash
   docker compose restart backend worker
   ```

3. **Supabase configuration**: Requires full recreation
   ```bash
   cd suna-supabase/docker && docker compose down && docker compose up -d
   cd ../../suna && docker compose down && docker compose up -d
   ```

4. **Code Changes (Backend)**:
   - **Source Code (`.py`)**: Restart is sufficient (volume mounted)
     ```bash
     docker compose restart backend
     ```
   - **Dependencies (`pyproject.toml`, `uv.lock`)**: Requires rebuild
     ```bash
     docker compose up -d --build backend
     ```
   - **System Deps (`Dockerfile`)**: Requires rebuild
     ```bash
     docker compose up -d --build backend
     ```

### Checking Service Health

```bash
# All services status
docker compose ps

# Backend logs
docker compose logs backend --tail=50 -f

# Frontend logs (middleware, rewrites)
docker compose logs frontend --tail=50 -f

# Supabase services
cd ../suna-supabase/docker
docker compose ps
docker compose logs rest --tail=20

# Test connectivity
docker exec suna-backend-1 wget -O - http://supabase-kong:8000/health
docker exec suna-frontend-1 wget -O - http://backend:8000/api/health
```

## Documentation References

### General Documentation
- Self-hosting guide: `docs/SELF-HOSTING.md`
- Backend testing: `backend/TESTING.md`
- Tool system refactor: `backend/core/utils/TOOL_SYSTEM_REFACTOR.md`
- AgentPress caching: `backend/core/agentpress/PROMPT_CACHING.md`
- Sandbox setup: `backend/core/sandbox/README.md`
- Contributing guidelines: `CONTRIBUTING.md`

### Self-Hosted Fork Documentation (`.docs/`)

**Initial Setup & Migrations:**
- `.docs/initialsetup/1. env and migrations/` - Environment setup and database migrations
- `.docs/initialsetup/2. oauth/` - OAuth provider configuration and fixes
- `.docs/initialsetup/3. dashboard load in/` - Dashboard loading fixes
- `.docs/initialsetup/5. proxy for oauth/` - Backend API proxy configuration
- `.docs/initialsetup/6. middleware migrations/` - **Critical:** Multi-domain URL detection
- `.docs/initialsetup/7. sandbox debugging/` - Daytona sandbox analysis and graceful degradation

**File Storage & Knowledge Base:**
- `.docs/file storage and embeddings/README.md` - Overview of storage architecture
- `.docs/file storage and embeddings/1_EMBEDDINGS_AND_KNOWLEDGE_BASE.md` - kb-fusion and OpenAI dependency
- `.docs/file storage and embeddings/2_FILE_STORAGE_AND_S3_ARCHITECTURE.md` - S3/Supabase storage
- `.docs/file storage and embeddings/3_RAG_AND_THREAD_LEVEL_KB.md` - RAG implementation
- `.docs/file storage and embeddings/4_STORAGE_LIMITS_AND_SCALING.md` - Storage configuration

**Troubleshooting:**
- `.docs/sandbox_issues/BASEJUMP_SCHEMA_EXPOSURE_FIX_v2.md` - **Critical:** Basejump schema fix
- `.docs/kb storage upgrade/` - Supabase storage configuration and upgrades

**Key Documents to Read:**
1. **Start here:** `.docs/initialsetup/6. middleware migrations/README.md` - Multi-domain setup
2. **Must configure:** `.docs/sandbox_issues/BASEJUMP_SCHEMA_EXPOSURE_FIX_v2.md` - Basejump schema
3. **Understand KB:** `.docs/file storage and embeddings/README.md` - Knowledge base system
4. **Optional sandboxing:** `.docs/initialsetup/7. sandbox debugging/GRACEFUL_DEGRADATION_PATTERN.md`

## Portkit Awareness
This repository uses **Portkit** for syncing upstream features to this soft-fork.
- **Strategy**: `.portkit/README.md` (Read this first for any Portkit task).
- **Registry**: `.portkit/addon-features-registry/feature-registry.json` (Source of Truth for features).
- **Tools**: `.portkit/scripts/` (Use `uv run scripts/python/script.py` or `npx tsx scripts/typescript/script.ts`).
- **Workflow**: Specify -> Research -> Plan -> Tasks -> Implement -> Verify.
