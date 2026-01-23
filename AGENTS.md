# AGENTS.md

This file provides guidance to Agents when working with code in this repository

**Related Repositories:**

- ../suna (main repository - Highly Customized Soft Fork of Suna Kortix)
- ../suna-supabase/docker (locally running Supabase backend instance)
- ../suna-advanced-workflows (module for Advanced Workflow Editor)

## Project Overview

Kortix (formerly Suna) is an open-source platform for building, managing, and training autonomous AI agents/workers. The project consists of:

1. **Backend API** (FastAPI/Python) - REST endpoints, thread management, LLM orchestration
2. **Backend Worker** (Dramatiq) - Background agent task execution
3. **Frontend** (Next.js/React) - Web UI for agent management
4. **Agent Sandbox** (Daytona) - Isolated runtime for agent actions - non optional - core part of Suna Kortix
5. **Kortix Browser Extension** - Chrome extension for local browser control and auth-aware automation
6. **Database** (Supabase) - PostgreSQL with authentication and real-time subscriptions

## Suna Repository Soft Fork (This Repository): Self-Hosted Setup for Suna Kortix (Docker Compose) - This is our staging and local development environment (served locally and  via cloudflare tunnel)

**Important:** This is a self-hosted community soft fork of kortix-ai/suna with significant customizations for Docker Compose deployment with local Supabase and Cloudflare Tunnel access. See `.docs/` directory for detailed migration history. See README.md for more information on current status and overview.

## 🚨 Critical Constraint: Documentation Hard Limit

### ⚠️ MAXIMUM 3 MARKDOWN FILES PER REQUEST - Non-negotiable

When creating or updating documentation:

- Never create more than 3 `.md` files in any single response cycle
- If you're approaching 3 files, consolidate instead of adding new files
- Each file must serve a distinct, non-overlapping purpose
- Use descriptive filenames: `QUICK_REFERENCE.md`, `COMPLETE_GUIDE.md`, `TROUBLESHOOTING.md`

## Quickstart: Common Development Commands and Workflows

### Docker Deployment and Common Commands

#### Core Lifecycle

```bash
# Start all services (builds if needed)
docker compose up -d --build

# Stop all services
docker compose down

# Check status of running containers
docker compose ps

# Follow logs for all services
docker compose logs -f
```

### Frontend - typically we dont use NPM and simply use Docker commands to 'deploy and test' frontend and backend changes in our staging environment

```bash
cd frontend

# Install dependencies
npm install

# Development server (with Turbopack)
npm run dev

# Production build
npm run build

```

### Testing

```bash
cd backend # or specific component folder

# Run all tests
./test

# Run only unit tests (fast, no external dependencies)
./test --unit

# Using pytest directly
uv run pytest
uv run pytest core/services/tests/cache.test.py
uv run pytest -m unit
```

Test files must end with `.test.py` and be placed in `tests/` directories within modules.

#### Targeted Operations

```bash
# Rebuild and restart only the backend (fastest for code changes)
docker compose up -d --build backend

# Restart the worker service
docker compose restart worker

# View logs for a specific service
docker compose logs -f backend --tail=100
docker compose logs -f frontend
```

#### Supabase Management (Self-Hosted)

```bash
# Start Supabase services
cd suna-supabase/docker
docker compose up -d

# Restart Supabase API (useful after config changes)
docker compose restart

# Full Supabase reboot - this is good for build or run time variable refreshing
docker compose down && docker compose up -d
```

#### Image Backup & Restore

```bash
# Backup images to tar files
docker save -o suna-backend.tar suna-backend:latest
docker save -o suna-frontend.tar suna-frontend:latest

# Restore images from tar files
docker load -i suna-backend.tar
docker load -i suna-frontend.tar
```

### MANDATORY: Utilization of Jujutsu Version Control System (jj). Never use base git commands automatically unless there is a special case to do so

For full comparison, see [Git Command Comparison Table](https://docs.jj-vcs.dev/latest/git-command-table/).

#### Daily Workflow Cheatsheet

| Task | Git Equivalent | Jujutsu Command | Notes |
| :--- | :--- | :--- | :--- |
| **Status/Log** | `git status`, `git log` | `jj st`, `jj log` | `@` is your working copy |
| **Fetch** | `git fetch` | `jj git fetch` |  |
| **Commit** | `git commit -m "msg"` | `jj describe -m "msg"` then `jj new` | Describes current change, starts new one |
| **Push** | `git push origin feature` | `jj git push --bookmark feature` | Pushes bookmark to origin |
| **New Branch** | `git checkout -b feature` | `jj bookmark create feature -r @` | Creates bookmark on current commit |
| **Switch Branch** | `git switch feature` | `jj edit feature` | Updates working copy to bookmark |
| **Amend** | `git commit --amend` | `jj squash` | Folds working copy changes into parent |
| **Undo** | *10 hours of reflog magic* | `jj undo` | Reverts last operation safely |
| **Untrack (Keep file)** | `git rm --cached <file>` | `jj file untrack <file>` | Stops tracking file, keeps on disk |

#### Managing Changes (Partial File Commits)

In `jj`, the working copy is always an implicit commit (`@`). There is no "staging area" index. All files changes are tracked in the working copy.

Always use `jj bookmark set dev -r "@"` to update the dev bookmark (or any other bookmark) to the current working copy. Don't forget the "@" for powershell environments. This is the eqquivalent of git commit when using jj.

To push to origin use `jj git push --bookmark dev` or any other bookmark name.

**Scenario: You modified `FileA` and `FileB`, but only want to commit `FileA`.**

1. **Split the working copy:**

   ```powershell
   jj split
   ```

   *An interactive menu will appear. Select `FileB` to move it to a NEW child commit, leaving `FileA` in the current commit.*

**Scenario: Add changes to the *parent* commit (Amend):**

1. **Move specific changes to parent:**

   ```powershell
   jj squash -i
   ```

   *Interactively select which file chunks to fold into the parent commit.*

#### Syncing with Upstream kortix-ai/suna

This repository regularly syncs with the upstream `kortix-ai/suna` repository to incorporate new features and bug-fixes. The process uses `jj rebase` to apply our customizations on top of the latest upstream.

**Prerequisites:**

```powershell
# Verify 'upstream' remote exists
jj git remote list
# If missing, add it:
jj git remote add upstream https://github.com/kortix-ai/suna.git
```

**Step 1: Fetch Latest Upstream Changes**

```powershell
# Fetch all branches from upstream remote
jj git fetch --remote upstream

# Or fetch only specific branch(es) - use --branch flag
jj git fetch --remote upstream --branch main
```

This downloads `upstream/main` without modifying your working copy.

**Step 2: Identify Your Current Branch Position**

```powershell
jj log --limit 10
```

Note the commit IDs for your local work (`@`) and where `main` currently points.

**Step 3: Update Your Main Bookmark**

```powershell
# Point local 'main' bookmark to the latest upstream/main
jj bookmark set main -r "main@upstream"
```

**Step 4: Rebase Your Work**

```powershell
# Rebase your current work onto the new main
jj rebase -d main
```

This replays all your local commits on top of the updated `main`. If you have multiple local branches, rebase each one separately.

**Step 5: Resolve Conflicts (if any)**

If `jj st` shows conflicts:

1. **View conflicting files:**

    ```powershell
    jj st
    # Files with conflicts will be marked
    ```

2. **Open and resolve each file** - Look for conflict markers:

    ```text
    <<<<<<< Conflict 1 of 1
    +++++++ Contents of side #1
    Your local changes here
    ======= Contents of base
    Original content
    ------- Contents of side #2
    Upstream changes here
    >>>>>>> Conflict 1 of 1 ends
    ```

3. **IDE-Based Resolution (Recommended):**

    VS Code/Cursor will detect JJ conflict markers and show inline resolution buttons:

    - **Accept Current** - Keep your local changes (side #1)
    - **Accept Incoming** - Take upstream changes (side #2)
    - **Accept Both** - Include both versions
    - **Compare Changes** - Open 3-way merge editor

    **To use the 3-way merge editor:**
    1. Click on a conflicted file in the Source Control panel
    2. Click "Resolve in Merge Editor" button in the top right
    3. Use checkboxes to select which changes to keep
    4. Click "Complete Merge" when done

    **Note:** JJ's conflict format differs slightly from Git's, but modern IDEs handle both.

4. **Manual Resolution:**
    - Edit the file directly, keeping desired content
    - Remove ALL conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`, `+++++++`, `-------`)

5. **Mark resolution complete:**

    ```powershell
    # Squash resolves the conflict by folding changes into the commit
    jj squash
    ```

6. **Repeat** for each conflicting commit in the rebase chain.

**Step 6: Verify and Push**

Review the rebased history:

```powershell
jj log --limit 20
```
**Step 7: Reinstall Dependencies and Push**

```powershell
cd frontend; npm install
cd backend; uv sync
```
Test the application (Docker rebuild recommended):

```powershell
docker compose up -d --build
```

**Step 8: Verify and Push**

```powershell
# Review the rebased history
jj log --limit 20

# Test the application (Docker rebuild recommended)
docker compose up -d --build

# Push to your fork (use --bookmark or -b)
jj git push --bookmark dev        # dev is our default branch
jj git push --bookmark <your-feature-branch>

# Push all tracked bookmarks at once
jj git push --tracked
```

**Common Conflict Patterns: General Guidance**

| Conflict Area | Typical Resolution |
| :--- | :--- |
| `frontend/src/middleware.ts` | Keep our multi-domain URL detection logic |
| `backend/src/lib/supabase/*.ts` | Keep our dynamic URL detection |
| `docker-compose.yaml` | Keep ours, review for additions |
| `backend/.env.example` | Add new upstream vars, keep our defaults |
| `backend/**api.py` | Keep ours, keep custom routes, review for additions |

**Always Keep Theirs (Sync Folder with Upstream):**

Some folders should always match upstream exactly (no local customizations). Use this to accept all upstream changes:

```powershell
# Replace entire folder with upstream's version (during or after rebase)
jj restore --from main apps/

# Other folders that typically stay in sync with upstream:
jj restore --from main docs/
jj restore --from main backend/core/templates/

# After restoring, squash to commit the resolution
jj squash
```

**Pro tip:** If you frequently need to keep certain folders synced, run these `jj restore` commands immediately after `jj rebase -d main` to preemptively resolve those conflicts.

**CRITICAL: EXIT SYNC AND RESTORE FROM PREVIOUS COMMIT DURING A BAD REBASE:**

```powershell
# If rebase goes wrong, undo the entire operation
jj undo

# Or restore to a specific commit
jj edit <previous-commit-id>
```

**Step 7: Restore Missing Files from Upstream (CRITICAL)**

After resolving conflicts, files that exist in upstream but not in your branch may be missing. This causes Docker build failures with "Module not found" errors.

```powershell
# List files that exist in main but are missing in current branch
git diff --diff-filter=D --name-only main

# Restore ALL missing files from upstream (safe - doesn't modify existing files)
git diff --diff-filter=D --name-only main | ForEach-Object { git checkout main -- $_ 2>$null }

# Or restore specific folders that should match upstream:
git checkout main -- frontend/src/components/thread/tool-views/
git checkout main -- frontend/src/components/thread/kortix-computer/
git checkout main -- frontend/src/components/file-renderers/
git checkout main -- frontend/src/components/file-editors/
```

**Step 8: Regenerate Lockfiles**

After sync, lockfiles may be out of date or missing:

```powershell
# Backend (Python)
cd backend
uv lock
cd ..

# Frontend (Node)
cd frontend
Remove-Item node_modules -Recurse -Force -ErrorAction SilentlyContinue
npm install
cd ..
```

**Step 9: Squash to Clean Commit (If Needed)**

If you have many intermediate commits from conflict resolution, you may want to squash them. **However, be aware of a critical pitfall:**

> ⚠️ **CRITICAL WARNING: The Squashing Pitfall**
>
> When you do `jj new main` then `jj restore --from <your-commit>`, you ONLY get files
> that exist in YOUR commit. Any NEW files added by upstream will be MISSING!
>
> **Why this happens:**
> - `jj restore --from X` copies files from commit X to your working copy
> - If upstream added 100 new files that you never had, they won't be restored
> - This causes "Module not found" errors during Docker build
>
> **The safe approach:** Either complete the rebase properly, or always run
> the "Restore Missing Files" command after squashing.

```powershell
# Option 1: Create fresh commit on main with all your changes
jj new main -m "feat: sync with upstream (squashed)"
jj restore --from <your-resolved-commit-id>

# ⚠️ CRITICAL: Restore files added by upstream that you don't have
git diff --diff-filter=D --name-only main | ForEach-Object { git checkout main -- $_ 2>$null }

# Option 2: Move bookmark to skip conflicted ancestors
jj bookmark set dev -r '@' --allow-backwards

# Push (may need force if history changed)
jj git push --bookmark dev
``` 

#### Renaming Commits

```powershell
# Edit message of current working copy
jj describe -m "feat: implement new authentication flow"

# Edit message of a specific revision (without checking it out)
jj describe <revision_id> -m "fix: correct typo in logging"
```

#### Handling .gitignore Updates

If you add files to `.gitignore` that are already being tracked, `jj` will continue to track them until you explicitly untrack them.

```powershell
# 1. Stop tracking specific files (keeps them on disk)
jj file untrack .gemini/config.toml

# 2. Stop tracking a folder recursively
Get-ChildItem .gemini/ -Recurse | ForEach-Object { jj file untrack $_.FullName }
```

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
- **`frontend/src/app/(dashboard)`** - Primary application pages and layouts
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

**Important:** Frontend partially uses dynamic URL detection at runtime. The `NEXT_PUBLIC_SUPABASE_URL` is used for server-side rewrites, but browser requests use `window.location.origin` for multi-domain support overriding API_URL in some custom files.

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

This fork includes significant customizations for self-hosted deployments. Comprehensive documentation is available in the `.docs/` directory.

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

- `http://localhost:9990` (Frontend Host:docker compose up -d --build)
- `http://localhost:3000` (Frontend Host: npm run dev)
- `https://suna.syhc.dev` (Frontend via Cloudflare Tunnel)
- `https://api.suna.syhc.dev/v1` (Backend via Cloudflare Tunnel)

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
2. Use server components for serverside renderingby default, client components only when needed
3. Fetch data with TanStack Query hooks in `frontend/src/hooks/react-query/`

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

## Troubleshooting

Extensive troubleshooting steps have been moved to [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

Common topics include:

- Docker Networking & Connectivity
- Supabase Self-Hosted Errors (400 Bad Request, Auth)
- Knowledge Base Search Issues
- Cloudflare Tunnel & Multi-Domain Setup
- Daytona Sandbox Errors

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

## Railway CLI Reference

For detailed deployment guides, see `.docs/railway-deployments/` and `RAILWAY_DEPLOYMENT.md`.

### Essential Commands

| Action | Command |
| :--- | :--- |
| **Install/Login** | `npm i -g @railway/cli && railway login` |
| **Link Project** | `railway link -p <id>` |
| **Get Variables** | `railway variables -e <env> -s "Service Name"` |
| **Run Local** | `railway run python api.py` |
| **Redeploy** | `railway redeploy -e dev -s "Suna Frontend - Dev"` |

### Key Documentation & Syntax

**Variable Syntax**: `${{Service Name.VARIABLE}}` (e.g., `${{Suna Backend.RAILWAY_PRIVATE_DOMAIN}}`)
**Build Args**: `NEXT_PUBLIC_*` must be set as build args.
**Public Domains**: `RAILWAY_PUBLIC_DOMAIN` requires manual `https://` prefix.

**Relevant Guides:**

- `.docs/railway-deployments/` (Full guides & snapshots)
- `RAILWAY_DEPLOYMENT.md` (Main guide)
- `RAILWAY_ENV_SETUP.md` (Env setup)
- `SUPABASE_MIGRATION.md` (DB rules)

#### Variable Snapshots (Dev Environment)

Raw environment variables (resolved values) are stored in `.docs/railway-deployments/*.json`:

- `frontend.json`
- `backend.json`
- `worker.json`
Use these for reference when configuring `.env` or debugging formula resolution.

## Portkit Awareness

This repository uses **Portkit** for syncing upstream features to this soft-fork.

- **Strategy**: `.portkit/README.md` (Read this first for any Portkit task).
- **Registry**: `.portkit/addon-features-registry/feature-registry.json` (Source of Truth for features).
- **Tools**: `.portkit/scripts/` (Use `uv run scripts/python/script.py` or `npx tsx scripts/typescript/script.ts`).
- **Workflow**: Specify -> Research -> Plan -> Tasks -> Implement -> Verify.

## 🔧 Patch System (Helps with Upstream Sync)

This repository uses a Portkit a **universal patch system** for tracking customizations to sync with upstream. See `patches/AGENT_RULES.md` for complete documentation.

### 🚨 CRITICAL: Never Manually Create .patch Files

**ALWAYS use `git diff` with `--relative` to generate patch files:**

```powershell
# For FRONTEND patches (paths relative to frontend/ for Docker context):
git -C frontend diff HEAD~1 --relative -- src/path/to/file.ts | Set-Content -Path patches/NNN-name.patch -Encoding ASCII

# For BACKEND patches:
git -C backend diff HEAD~1 --relative -- path/to/file.py | Set-Content -Path patches/NNN-name.patch -Encoding ASCII
```

**Why:**

1. Manually written patches have format issues that cause "corrupt patch" errors
2. Docker context is `/app` = frontend content, so paths must NOT include `frontend/` prefix
3. Use ASCII encoding to avoid BOM issues

### Patch Workflow

1. **Make the change** directly in source code
2. **Commit the change** with a descriptive message
3. **Generate the patch** using `git diff HEAD~1 > patches/NNN-name.patch`
4. **Commit the patch file** - this is for upstream sync documentation

### Patch Naming Convention

```
<3-digit-number>-<descriptive-name>.<extension>

Examples:
  001-auth-redirects.patch
  002-api-url-helper.yml
  020-frontend-imports.js
```

- Numbers must be 3 digits with leading zeros
- Use gaps (001, 010, 020) for flexibility
- Files without numbered prefix are ignored

### Smart Detection

The patch system automatically detects already-applied patches using `git apply --check --reverse`:

- **Not applied** → Apply it
- **Already applied** → Skip gracefully (shows "⏭️ Already applied, skipping")
- **Conflicts** → Fail with error

### Key Files

| File | Purpose |
|------|---------|
| `patches/apply-patches.js` | Universal patch application script |
| `patches/AGENT_RULES.md` | Complete agent guidelines |
| `frontend/Dockerfile.railway` | Applies patches during frontend build |
| `backend/Dockerfile.railway` | Applies patches during backend build |
