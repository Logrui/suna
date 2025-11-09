# 🛠️ Kortix Technology Stack & Architecture

**Last Updated:** November 1, 2025  
**Repository:** [kortix-ai/suna](https://github.com/kortix-ai/suna)  
**License:** Apache 2.0

---

## Table of Contents

1. [Repository Overview](#-repository-overview)
2. [Technology Stack](#-technology-stack)
3. [Architecture & Component Diagram](#️-architecture--component-diagram)
4. [Integration: Python Backend + Next.js Frontend](#seamless-integration-python-backend--nextjs-frontend)
5. [Dependency Analysis](#-dependency-analysis)
6. [Key Features & Capabilities](#-key-features--capabilities)

---

## 🏢 Repository Overview

**Project Name:** Kortix (formerly Suna)  
**Description:** Open-source platform for building, managing, and training autonomous AI agents  
**Current Branch:** feature/ollama

### Directory Structure

```
suna/
├── backend/              # FastAPI REST API & agent orchestration
├── frontend/             # Next.js web interface
├── apps/mobile/          # React Native mobile app (Expo)
├── sdk/                  # Python SDK for integration
├── docs/                 # User documentation
├── .github/workflows/    # CI/CD pipelines
├── docker-compose.yaml   # Local development orchestration
└── .docs/               # Internal documentation
```

### Notable Configuration Files

- **`docker-compose.yaml`** - Orchestrates Redis, Backend, Frontend, Supabase
- **`pyproject.toml`** - Python 3.11+ dependencies and project metadata
- **`package.json`** - Node.js dependencies and scripts
- **`Dockerfile`** - Alpine Linux + Python 3.11 with uv package manager
- **`mise.toml`** - Development environment tool versioning
- **`.github/workflows/`** - Docker build and deployment automation

---

## 🛠️ Technology Stack

### Frontend Technologies

| Category | Technologies |
|----------|---------------|
| **Framework** | Next.js 15.3.1, React 18 |
| **UI Components** | Radix UI (comprehensive library), Shadcn/ui patterns |
| **Styling** | Tailwind CSS, PostCSS, Autoprefixer |
| **Rich Text Editor** | TipTap with 20+ extensions (tables, code blocks, collaboration, math, embeds) |
| **Data Visualization** | Mermaid 11.12, Altair, cobe (3D visualization), GSAP |
| **Code Editor** | CodeMirror with VSCode theme syntax highlighting |
| **File Handling** | jszip, papaparse (CSV), xlsx parsing |
| **PDF** | react-pdf, html2pdf.js, html-to-docx conversion |
| **State Management** | TanStack React Query 5.75.2, React Hook Form 7.62 |
| **Animation** | Framer Motion 12.6.5, Lottie React |
| **Analytics** | PostHog 1.258.6, Vercel Analytics & Speed Insights |
| **Theming** | next-themes with dark mode support |
| **Database Client** | Supabase JS SDK with real-time subscriptions |
| **Type Safety** | TypeScript with moderate strictness |

### Mobile Technologies

| Category | Technologies |
|----------|---------------|
| **Framework** | Expo 54.0.20, React Native |
| **Navigation** | expo-router (file-based routing) |
| **UI Primitives** | @rn-primitives (20+ components) |
| **Styling** | NativeWind (Tailwind CSS for React Native) |
| **Authentication** | Expo Apple Auth, OAuth via expo-auth-session |
| **File System** | expo-file-system, expo-document-picker, expo-image-picker |
| **Media** | expo-audio, expo-av (video/audio playback) |
| **Storage** | AsyncStorage, Secure Store (encrypted) |
| **Database** | Supabase JS SDK |
| **Accessibility** | Screen reader support via React Native accessibility APIs |

### Backend Technologies

| Category | Technologies |
|----------|---------------|
| **Runtime** | Python 3.11+ |
| **Web Framework** | FastAPI 0.115.12, Uvicorn 0.27.1 (ASGI server) |
| **Task Queue** | Dramatiq 1.18.0 with Redis backend |
| **Database** | Supabase PostgreSQL, Prisma ORM 0.15.0 |
| **Authentication** | PyJWT, fastapi-sso, Supabase JWT validation |
| **Cache Layer** | Redis 5.2.1, Upstash Redis (optional) |
| **LLM Integration** | litellm (multi-model LLM abstraction) |
| **AI/ML Models** | OpenAI SDK, Anthropic SDK, e2b-code-interpreter, Ollama |
| **Web Services** | Tavily (search), Exa (web intelligence), Composio (tool marketplace) |
| **Document Processing** | PyPDF2, python-docx, openpyxl, BeautifulSoup4, Pillow, pytesseract |
| **Code Execution** | Daytona SDK (isolated code sandbox), e2b (alternative) |
| **Payments** | Stripe 11.6.0 API integration |
| **Monitoring** | Sentry (error tracking), Prometheus (metrics), Langfuse (LLM observability) |
| **Logging** | structlog 25.4.0 (structured JSON logging) |
| **Scheduling** | APScheduler, croniter (task scheduling) |
| **Protocol** | MCP (Model Context Protocol) 1.9.4 support |
| **Email** | Mailtrap 2.0.1, FastMail integration |
| **VoIP** | VAPI integration for voice capabilities |

### Build & Development Tools

| Category | Technologies |
|----------|---------------|
| **Package Managers** | npm, pnpm, uv (fast Python package manager) |
| **Testing** | pytest 8.3.4 with comprehensive plugins |
| **Test Plugins** | pytest-asyncio, pytest-cov, pytest-mock, pytest-xdist, pytest-timeout |
| **Linting** | ESLint (frontend), pytest checks (backend) |
| **Formatting** | Prettier (TypeScript/JavaScript) |
| **TypeScript** | TSC compiler (strict mode disabled for frontend flexibility) |
| **Build System** | Turbopack (Next.js), Expo bundler (React Native) |
| **Dev Tools** | mise.toml for tool version management |

### Infrastructure & Deployment

| Category | Technologies |
|----------|---------------|
| **Containerization** | Docker (Alpine Linux base), Docker Compose |
| **Web Server** | Gunicorn 23.0.0 with Uvicorn workers (7 workers, 2 threads) |
| **Database** | Supabase (cloud PostgreSQL), local PostgreSQL via Docker |
| **Cache/Queue** | Redis (local or Upstash cloud) |
| **Cloud Services** | AWS (boto3), Supabase cloud, Cloudflare Tunnel |
| **CI/CD** | GitHub Actions with multi-environment support |
| **Container Registry** | GitHub Container Registry (ghcr.io) |
| **Deployment Targets** | Staging (main branch), Production (PRODUCTION branch) |
| **Code Sandbox** | Daytona API for isolated code execution |

### Database

- **Primary DB:** Supabase PostgreSQL with row-level security
- **ORM:** Prisma 0.15.0 for type-safe database access
- **Cache:** Redis for sessions, task queues, real-time data
- **Real-time:** Supabase Realtime subscriptions for live updates
- **Authentication:** Supabase Auth with JWT tokens

---

## 🏗️ Architecture & Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              KORTIX PLATFORM                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌─────────────────┐   │
│  │   WEB FRONTEND       │  │   MOBILE (Expo)      │  │   SDK (Python)  │   │
│  │   (Next.js 15)       │  │   (React Native)     │  │   (Python 3.11) │   │
│  │                      │  │                      │  │                 │   │
│  │ - React 18           │  │ - React Native       │  │ - Async HTTP    │   │
│  │ - Radix UI           │  │ - NativeWind         │  │ - FastMCP       │   │
│  │ - TanStack Query     │  │ - TanStack Query     │  │ - httpx         │   │
│  │ - TipTap Editor      │  │ - AsyncStorage       │  │                 │   │
│  │ - Mermaid/Charts     │  │ - Expo Router        │  │                 │   │
│  │ - PostHog Analytics  │  │                      │  │                 │   │
│  └──────────┬───────────┘  └──────────┬───────────┘  └────────┬────────┘   │
│             │                         │                        │             │
│             │ REST/WebSocket          │ REST/WebSocket        │ REST        │
│             └─────────────────────────┴────────────────────────┼─────────┐  │
│                                                                │        │  │
│  ┌──────────────────────────────────────────────────────────┼────────┐│  │
│  │                    BACKEND API (FastAPI)                  │        ││  │
│  │                    Port 8000                              │        ││  │
│  ├──────────────────────────────────────────────────────────┼────────┴┘  │
│  │                                                            │             │
│  │  ┌─ REST Endpoints                                       │             │
│  │  │ • Agent CRUD operations                               │             │
│  │  │ • Thread/Session management                           │             │
│  │  │ • LLM orchestration                                   │             │
│  │  │ • File uploads/downloads                              │             │
│  │  │ • Authentication & billing                            │             │
│  │  └─────────────────────────┬──────────────────────────────┤             │
│  │                            │                              │             │
│  │  ┌────────────────────────────────────────────────────┐   │             │
│  │  │    CORE SERVICES & MODULES                        │   │             │
│  │  ├────────────────────────────────────────────────────┤   │             │
│  │  │ • agentpress/       - Agent execution engine        │   │             │
│  │  │ • ai_models/        - LLM integrations              │   │             │
│  │  │ • tools/            - Agent capabilities            │   │             │
│  │  │ • sandbox/          - Code execution (Daytona)      │   │             │
│  │  │ • mcp_module/       - MCP protocol support          │   │             │
│  │  │ • knowledge_base/   - Document storage & retrieval  │   │             │
│  │  │ • composio_integration/ - Tool marketplace        │   │             │
│  │  │ • credentials/      - API key management            │   │             │
│  │  │ • billing/          - Stripe integration            │   │             │
│  │  │ • triggers/         - Event-driven workflows        │   │             │
│  │  │ • vapi_*/           - Voice API integration         │   │             │
│  │  └────────┬─────────────────────────────────────┬─────┘   │             │
│  │           │                                     │          │             │
│  │           └────┐                           ┌────┘          │             │
│  │                │                           │               │             │
│  └────────────────┼───────────────────────────┼───────────────┘             │
│                   │                           │                             │
│  ┌────────────────┴───────────────────────────┴──────────────────┐         │
│  │                 BACKGROUND WORKER (Dramatiq)                  │         │
│  │                                                                 │         │
│  │  ┌──────────────────────────────────────────────────────────┐ │         │
│  │  │ • Agent task execution                                   │ │         │
│  │  │ • Long-running operations (research, analysis)           │ │         │
│  │  │ • Scheduled jobs (APScheduler, cron)                     │ │         │
│  │  │ • Background monitoring                                  │ │         │
│  │  │ • Worker health checks                                   │ │         │
│  │  └──────────────────────────────────────────────────────────┘ │         │
│  └──────────────────────────────────────────────────────────────┘          │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │              DATA & EXTERNAL INTEGRATIONS                    │           │
│  ├──────────────────────────────────────────────────────────────┤           │
│  │                                                               │           │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │           │
│  │  │  Supabase   │  │    Redis     │  │  Code Sandbox    │   │           │
│  │  │             │  │              │  │   (Daytona)      │   │           │
│  │  │ • PostgreSQL│  │ • Cache      │  │                  │   │           │
│  │  │ • Auth      │  │ • Sessions   │  │ • Execute code   │   │           │
│  │  │ • Storage   │  │ • Task queue │  │ • Run scripts    │   │           │
│  │  │ • Realtime  │  │              │  │ • Isolated env   │   │           │
│  │  └─────────────┘  └──────────────┘  └──────────────────┘   │           │
│  │                                                               │           │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐   │           │
│  │  │ LLM Models  │  │  Web Tools   │  │ External APIs    │   │           │
│  │  │             │  │              │  │                  │   │           │
│  │  │ • OpenAI    │  │ • Tavily     │  │ • Stripe         │   │           │
│  │  │ • Anthropic │  │ • Exa        │  │ • Google APIs    │   │           │
│  │  │ • Ollama    │  │ • Composio   │  │ • Custom APIs    │   │           │
│  │  │ • Others    │  │ • VAPI       │  │ • Mailtrap       │   │           │
│  │  └─────────────┘  └──────────────┘  └──────────────────┘   │           │
│  │                                                               │           │
│  │  ┌─────────────────────────────────────────────────────┐    │           │
│  │  │  Observability & Monitoring                        │    │           │
│  │  │  • Sentry (error tracking)                        │    │           │
│  │  │  • Prometheus (metrics)                           │    │           │
│  │  │  • Langfuse (LLM observability)                   │    │           │
│  │  │  • structlog (structured JSON logging)            │    │           │
│  │  └─────────────────────────────────────────────────────┘    │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            CI/CD & DEPLOYMENT                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  GitHub Actions Workflows:                                                   │
│  • docker-build.yml    - Multi-environment build & push to ghcr.io          │
│  • update-PROD.yml     - Production deployment trigger                      │
│                                                                               │
│  Deployment Targets:                                                         │
│  • Staging (main branch)       → ghcr.io/suna-ai/suna-backend:latest        │
│  • Production (PRODUCTION branch) → ghcr.io/suna-ai/suna-backend:prod       │
│                                                                               │
│  Infrastructure:                                                              │
│  • Docker Compose (local dev)  - Redis, Backend, Frontend, Supabase         │
│  • Cloudflare Tunnel support (self-hosted)                                  │
│  • Multi-environment support (local, staging, production)                   │
│                                                                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Interaction** → Frontend/Mobile sends REST requests via `/api/*`
2. **API Gateway** → Next.js rewrites requests to Python backend (seamless proxy)
3. **Processing** → FastAPI validates, routes to appropriate service module
4. **Long Tasks** → Enqueued to Dramatiq worker via Redis for async execution
5. **External Integration** → Workers call LLMs, APIs, web tools as needed
6. **Data Persistence** → Results stored in Supabase PostgreSQL
7. **Real-time Updates** → Frontend subscribes to Supabase Realtime events
8. **Response** → Data flows back through same path to client

---

## Seamless Integration: Python Backend + Next.js Frontend

### The Core Problem

How do you cleanly integrate a Python backend with a Next.js frontend without CORS headaches, authentication nightmares, or environment-specific configuration?

### The Solution: Three-Layer Architecture

#### Layer 1: Next.js as Intelligent Reverse Proxy

**File:** `frontend/next.config.ts`

```typescript
async rewrites() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://backend:8000/api'
  
  return [
    // Browser requests to /api/* get proxied to Python backend
    {
      source: '/api/:path*',
      destination: `${backendUrl}/:path*`,
    },
    // Plus rewrites for Supabase auth/storage
    {
      source: '/auth/v1/:path*',
      destination: `${supabaseUrl}/auth/v1/:path*`,
    },
    // ... more rewrites for storage and realtime
  ]
}
```

**How it works:**
- Browser sends: `GET http://localhost:3000/api/agents`
- Next.js intercepts & rewrites to: `GET http://backend:8000/api/agents` (Docker) or `GET https://kortix.syhc.dev/api/agents` (production)
- Response flows back to browser as if from `localhost:3000`

**Benefits:**
- ✅ No CORS issues (same origin from browser perspective)
- ✅ Backend URL is hidden from client
- ✅ Works seamlessly with Cloudflare Tunnel (no OAuth redirect complexity)
- ✅ Single config works for localhost → Docker → production

#### Layer 2: Context-Aware API URL Detection

**File:** `frontend/src/lib/get-api-url.ts`

```typescript
export const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    // Browser context: use relative URL
    return `${window.location.origin}/api`;
  }
  
  // Server context (SSR): use Docker internal hostname
  return process.env.NEXT_PUBLIC_BACKEND_URL || 
         'http://backend:8000/api';
}
```

**Execution Contexts:**

| Context | URL | Why |
|---------|-----|-----|
| **Browser** | `/api` (relative) | Next.js rewrites to backend; stays same-origin |
| **Server-Side Render (SSR)** | `http://backend:8000/api` | Direct Docker network via internal DNS |
| **Build Time** | `http://backend:8000/api` | Environment variable configures it |
| **Production (Cloudflare)** | `https://kortix.syhc.dev/api` | NEXT_PUBLIC_BACKEND_URL set per environment |

**Result:** Single function, all deployment scenarios handled automatically.

#### Layer 3: Unified Authentication

**Frontend API Client** (TypeScript):
```typescript
private async getAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  return {
    'Authorization': `Bearer ${session.access_token}`,
  };
}
```

**Backend Validation** (Python):
```python
from core.services.supabase import DBConnection

db = DBConnection()  # Same Supabase instance
# Every request includes Bearer token
# Backend verifies it's valid Supabase JWT
```

**Result:**
- Single login to Supabase
- Token automatically attached to all API calls
- Both systems trust same JWT issuer
- No separate session management

### Docker Compose Orchestration

**File:** `docker-compose.yaml`

```yaml
services:
  backend:
    image: ghcr.io/suna-ai/suna-backend:latest
    ports:
      - "8000:8000"
    environment:
      - REDIS_HOST=redis        # Docker DNS resolution
      - ENV_MODE=local
    networks:
      - default
      - supabase

  frontend:
    build:
      context: ./frontend
      args:
        - NEXT_PUBLIC_BACKEND_URL=http://backend:8000/api
    ports:
      - "3000:3000"
    depends_on:
      - backend
    networks:
      - default
      - supabase
```

**Docker DNS Magic:**
- Services reference each other by name: `backend`, `redis`, `supabase-kong`
- Docker's embedded DNS resolver converts to internal IPs
- Result: Zero IP hardcoding, automatic service discovery

### Complete Request Flow

```
Browser Request
    ↓
GET http://localhost:3000/api/agents
    ↓
Next.js Middleware (detects /api/*)
    ↓
Rewrites to: http://backend:8000/api/agents (Docker) 
           OR https://kortix.syhc.dev/api/agents (production)
    ↓
Attaches Auth Header: Authorization: Bearer <JWT>
    ↓
FastAPI Backend receives request
    ↓
Validates JWT with Supabase
    ↓
Queries Supabase PostgreSQL via Prisma ORM
    ↓
Returns JSON response
    ↓
Response travels back through rewrites
    ↓
Browser receives 200 OK
    ↓
React updates UI with fresh data
```

### Backend CORS Configuration

**File:** `backend/api.py`

```python
allowed_origins = [
    "https://www.kortix.com",
    "https://kortix.com",
    "http://localhost:3000",        # Local dev
    "http://127.0.0.1:3000",
]

allow_origin_regex = r"https://.*\.syhc\.dev"  # Cloudflare Tunnel
```

CORS headers are included as a fallback, but requests through Next.js rewriting appear as same-origin.

---

## 📦 Dependency Analysis

### Core Backend Dependencies

| Dependency | Version | Purpose |
|-----------|---------|---------|
| **FastAPI** | 0.115.12 | Modern async REST framework |
| **Uvicorn** | 0.27.1 | ASGI web server |
| **Prisma** | 0.15.0 | Type-safe PostgreSQL ORM |
| **Supabase** | 2.17.0 | Database & auth client |
| **litellm** | ≥1.77.5 | Multi-model LLM abstraction layer |
| **Dramatiq** | 1.18.0 | Distributed task queue |
| **Redis** | 5.2.1 | In-memory cache & message broker |
| **OpenAI** | ≥1.99.5 | OpenAI API client |
| **Anthropic** | ≥0.69.0 | Claude/Anthropic API client |
| **e2b-code-interpreter** | 1.2.0 | Code execution sandbox |
| **Daytona** | ≥0.21.6 | Advanced isolated code environment |
| **Composio** | ≥0.8.0 | Tool marketplace integration |
| **Tavily** | 0.5.4 | Web search capability |
| **Exa** | 1.9.1 | Web intelligence API |
| **Stripe** | 11.6.0 | Payment processing |
| **Langfuse** | 2.60.5 | LLM observability & analytics |
| **Sentry** | 2.29.1 | Error tracking & monitoring |
| **PyJWT** | 2.10.1 | JWT token handling |
| **Pydantic** | (FastAPI dep) | Data validation |

### Frontend Dependencies

| Dependency | Version | Purpose |
|-----------|---------|---------|
| **Next.js** | 15.3.1 | React framework with SSR & API routes |
| **React** | 18 | UI component library |
| **Radix UI** | 1.3.x+ | Headless accessible components |
| **TanStack React Query** | 5.75.2 | Server state management |
| **React Hook Form** | 7.62.0 | Efficient form state |
| **Tailwind CSS** | Latest | Utility-first CSS framework |
| **TipTap** | 3.3.0 | Collaborative rich text editor (20+ extensions) |
| **Mermaid** | 11.12.0 | Diagram & flowchart rendering |
| **Framer Motion** | 12.6.5 | Animation library |
| **TypeScript** | (via Next.js) | Type safety |
| **Supabase JS** | Latest | Database & auth client |

### Testing Infrastructure

| Tool | Version | Purpose |
|------|---------|---------|
| **pytest** | 8.3.4 | Main test runner |
| **pytest-asyncio** | 0.24.0 | Async test execution |
| **pytest-cov** | 6.0.0 | Code coverage reporting |
| **pytest-mock** | 3.14.0 | Mocking utilities |
| **pytest-xdist** | 3.3.0 | Parallel test execution |
| **pytest-timeout** | 2.3.1 | Test timeout enforcement |
| **pytest-randomly** | 3.12.0 | Random test ordering |
| **pytest-rerunfailures** | 10.2.0 | Flaky test handling |

### Development Environment (mise.toml)

```toml
[tools]
node = "20"              # LTS for npm/pnpm
python = "3.11.10"       # Modern Python with performance improvements
uv = "0.6.5"            # Fast Rust-based Python package manager

[env]
PYTHONPATH = "{{config_root}}/backend"  # Simplified imports
```

### Version Constraints & Compatibility

- **Python:** Requires ≥3.11 (pattern matching, performance)
- **Node.js:** 20.x LTS
- **Docker:** Alpine Linux base (minimal, secure)
- **TypeScript:** Moderate strictness (strict: false on frontend for flexibility)
- **React:** 18.x with concurrent rendering

### Security & Maintenance Status

✅ **Well-Maintained & Secure:**
- FastAPI (actively maintained, production-ready)
- Supabase (PostgreSQL alternative to Firebase)
- TanStack libraries (React ecosystem standard)
- OpenAI/Anthropic SDKs (official, frequently updated)

⚠️ **Monitor:**
- Prisma (0.x version - pre-1.0, track breaking changes)
- e2b vs Daytona (dual sandbox approach - standardize long-term)
- MCP implementation (emerging standard - watch for API changes)

---

## 🚀 Key Features & Capabilities

### Agent Platform Core

- **Multi-model LLM Support:** OpenAI, Anthropic, Ollama, custom providers via litellm
- **Autonomous Orchestration:** Thread-based agent state management with persistence
- **Tool Marketplace:** Composio integration for 50+ pre-built tools
- **Knowledge Base/RAG:** Document storage, retrieval, and embedding search

### AI Capabilities

- **Code Execution:** Isolated sandboxes (Daytona, e2b) for safe code running
- **Web Automation:** Browser automation, form filling, data extraction
- **Web Search:** Tavily & Exa integration for research and real-time data
- **Document Processing:** PDF, Word, Excel, image extraction and conversion
- **Voice Integration:** VAPI for voice-to-text and text-to-speech
- **File Management:** Upload, download, and processing at scale

### Developer Experience

- **Type Safety:** Full-stack TypeScript + Python with Pydantic validation
- **Real-time Ready:** Supabase Realtime for live collaboration
- **Comprehensive Testing:** 50+ pytest plugins and GitHub Actions CI/CD
- **Containerized Dev:** Docker Compose for reproducible local environments
- **Observable:** Sentry, Prometheus, Langfuse, structlog built-in

### Deployment Flexibility

- **Multi-environment:** Local dev → Docker → Staging → Production
- **Cloudflare Tunnel:** Self-hosted support with custom domains
- **Cloud-agnostic:** Works on AWS, Azure, or on-premise
- **Graceful Degradation:** Core features work without optional Daytona sandbox
- **CI/CD Automated:** GitHub Actions for build, test, push, deploy

### Scalability

- **Horizontal Scaling:** Stateless FastAPI workers behind load balancer
- **Task Distribution:** Dramatiq workers for parallel agent execution
- **Caching Layer:** Redis for performance optimization
- **Database:** PostgreSQL with connection pooling
- **Storage:** Supabase Storage for files at scale

---

## Developer Workflow

### Local Development

```bash
# Start development environment
docker compose up -d

# Access services
Frontend:    http://localhost:3000
Backend API: http://localhost:8000
Redis:       localhost:6380
```

### Backend Development

```bash
cd backend

# Start API server
uv run uvicorn api:app --host 0.0.0.0 --port 8000 --reload

# Start Dramatiq worker (in another terminal)
uv run dramatiq --processes 4 --threads 4 run_agent_background

# Run tests
uv run pytest -m unit      # Fast unit tests
uv run pytest -m integration  # With external deps
uv run pytest --cov        # With coverage
```

### Frontend Development

```bash
cd frontend

# Dev server with hot reload
npm run dev

# Build for production
npm run build

# Type checking
npm run lint
```

### Testing & Quality

```bash
# Backend testing
cd backend
./test                    # Run all tests
./test --unit            # Unit only (fast)
./test --coverage        # With coverage report

# Frontend testing & linting
cd frontend
npm run format:check     # Check formatting
npm run lint            # ESLint
```

---

## Production Deployment

### Build & Push

```bash
# GitHub Actions automatically triggers on push to main/PRODUCTION
# Builds Docker images and pushes to ghcr.io

# Manual build (if needed)
docker build -t ghcr.io/suna-ai/suna-backend:prod backend/
docker push ghcr.io/suna-ai/suna-backend:prod
```

### Environment Variables

**Backend (.env):**
```
ENV_MODE=production
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=xxx
REDIS_URL=redis://xxx:6379
OPENAI_API_KEY=sk-xxx
```

**Frontend (.env.local):**
```
NEXT_PUBLIC_BACKEND_URL=https://api.kortix.com
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

---

## Conclusion

Kortix is a sophisticated, production-ready AI agent platform with:

- 🎯 Clear separation of concerns (Python backend, Next.js frontend, React Native mobile)
- 🔒 Enterprise-grade security (Supabase auth, JWT validation, HTTPS)
- 📈 Scalable architecture (async workers, caching, horizontal scaling)
- 🛠️ Developer-friendly (type safety, testing, hot reload, Docker)
- 🚀 Modern tech stack (FastAPI, Next.js, React 18, PostgreSQL)
- 🌍 Multi-deployment support (localhost, Docker, cloud, self-hosted)

The seamless integration between Python backend and Next.js frontend via intelligent request rewriting demonstrates sophisticated architectural thinking and enables rapid development without the complexity typically associated with polyglot codebases.
