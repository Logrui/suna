# Technology Stack

This document defines the core technology stack for the project.

## Backend
- **Language:** Python 3.11+
- **Framework:** FastAPI
- **Server:** Uvicorn
- **AI/LLM:** LiteLLM (Unified Interface), Langfuse (Observability), MCP, Ollama & LM Studio (Local Inference)
- **Database & Auth:** Supabase (PostgreSQL), Redis (Caching & Broker)
- **Task Queue:** Dramatiq (with Redis broker)
- **Monitoring:** Sentry

## Frontend
- **Framework:** Next.js 15 (App Router)
- **Library:** React 18
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4, Radix UI (ShadCN primitives)
- **State Management:** TanStack Query (Server State), Zustand (Client State)
- **Rich Text/Editors:** Lexical
- **Visualization:** ReactFlow

## Infrastructure & DevOps
- **Containerization:** Docker, Docker Compose
- **Production Deployment:** Railway
- **Staging/Local:** Docker with Cloudflare Tunnel
- **Version Control:** Jujutsu (`jj`) - **Mandatory**

## Development Tools
- **Package Managers:** `uv` (Python), `npm` (Node.js)
- **Testing:** `pytest` (Backend), `vitest` (Frontend)
