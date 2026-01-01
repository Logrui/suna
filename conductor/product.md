# Initial Concept

Kortix is an open-source platform for building, managing, and training autonomous AI agents. This project is a **custom soft fork** of `kortix-ai/suna`, designed for personal and community use rather than as a commercial product.

## Target Audience

- **Primary:** The project maintainer and community members for daily homelab automation.
- **Secondary:** Independent developers and hobbyists experimenting with self-hosted AI agents.

## Deployment Goals

- **Production:** Railway (Work In Progress) - synced with the fork's repo.
- **Staging:** Local Docker containers utilizing Cloudflare Tunnels.
- **Core Philosophy:** Personal/Community-driven experimentation and automation.

## Development Strategy

- **Upstream Syncing:** Minimal core file edits to ensure easy synchronization with `kortix-ai/suna`.

- **Version Control:** Exclusive use of **Jujutsu (`jj`)** to manage development and syncs efficiently. **Standard Git commands (`git add`, `git commit`) are strictly forbidden.**

- **Commit Conventions:** Always use `jj describe -m` following standard **[Semantic Commit Conventions](https://www.conventionalcommits.org/)** (e.g., `feat:`, `fix:`, `chore:`, `refactor:`).

- **Customization:** Features are tailored for personal homelab needs/wants.

## Project Components

1. **Backend API** (FastAPI/Python) - REST endpoints, thread management, LLM orchestration
2. **Backend Worker** (Dramatiq) - Background agent task execution
3. **Frontend** (Next.js/React) - Web UI for agent management
4. **Agent Sandbox** (Daytona) - **Mandatory core requirement** - Isolated runtime for agent actions.
5. **Database** (Supabase) - PostgreSQL with authentication and real-time subscriptions

## Key Fork Modifications

1. **Self-Hosted Supabase** - Running via Docker Compose in `suna-supabase/docker/`
2. **Docker Network Integration** - Services connected across `suna` and `supabase` networks
3. **Basejump Schema** - Required schema exposure in PostgREST configuration
4. **Local Model Integration** - Support for discovering and using local AI models via Ollama and LM Studio

## System Architecture

### Backend Structure

- **`backend/api.py`** - FastAPI application entry point with CORS, middleware, and router initialization
- **`backend/core/agentpress/`** - Core agent orchestration system
  - `thread_manager.py` - Conversation thread management, LLM calls, tool execution
  - `tool_registry.py` - Auto-discovery and registration of tools
  - `context_manager.py` - Manages conversation context and token limits
  - `prompt_caching.py` - Anthropic prompt caching strategies
- **`backend/core/tools/`** - All agent tools (auto-discovered)
- **`backend/core/services/`** - Shared services (Supabase, Redis, Langfuse)
- **`backend/core/sandbox/`** - Agent runtime environment (Daytona integration)

### Frontend Structure

- **Next.js 15** with App Router
- **`frontend/src/app/`** - App routes and pages
- **`frontend/src/components/`** - React components
- **`frontend/src/hooks/`** - Custom React hooks with TanStack Query
- **`frontend/src/store/`** - State management (Zustand)

### Database Schema

The backend uses Supabase (PostgreSQL) with these key tables:

- `threads` - Conversation threads
- `messages` - Thread messages
- `agents` - Agent configurations
- `agent_versions` - Agent version history
- `accounts` - User accounts (via Basejump)
- `triggers` - Scheduled/webhook triggers
- `credentials` - Encrypted credentials for tools

**Important**: The `basejump` schema must be exposed in PostgREST configuration.

## Self-Hosted Setup Specifics

### Docker Networking

This fork uses a dual-network architecture (`suna` and `supabase`) to connect Suna services with self-hosted Supabase. Services must be on BOTH networks to communicate with Redis and Supabase.

### Knowledge Base & Embeddings

- **Critical Dependency:** OpenAI API key is REQUIRED for knowledge base functionality (kb-fusion uses OpenAI `text-embedding-3-small`).
- **Without OPENAI_API_KEY:** Documents upload/store and LLM summarization work, but KB semantic search fails.

### Daytona Sandbox (Core Requirement)

Daytona sandboxing is a **mandatory and non-optional** part of the Suna Kortix architecture. It provides the isolated runtime environment necessary for agent tool execution and file operations.

- **Configuration:** `DAYTONA_API_KEY`, `DAYTONA_SERVER_URL`, and `DAYTONA_TARGET` must be correctly configured in the backend environment.
- **Dependency:** Without a functional Daytona configuration, core agent capabilities including browser use and secure code execution will be unavailable.

## Railway & Deployment

### Railway CLI

The Railway CLI is essential for managing deployed services.

- **Variable Syntax:** Use `${{ServiceName.VARIABLE_NAME}}` for cross-service variable references.
- **Domains:** `RAILWAY_PUBLIC_DOMAIN` returns just the domain; always add `https://` prefix.
