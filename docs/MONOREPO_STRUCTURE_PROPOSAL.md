# Turborepo Monorepo Structure Proposal

## Overview

This document proposes a unified monorepo structure for integrating:
- **App 1 (Suna/Kortix)**: Next.js frontend + FastAPI backend
- **App 2**: Create React App frontend + FastAPI backend + Python Core Library

## Proposed Directory Structure

```
suna/
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # Unified CI pipeline
│   │   ├── deploy-web.yml            # Deploy Next.js app
│   │   ├── deploy-cra.yml            # Deploy CRA app
│   │   ├── deploy-backend-suna.yml   # Deploy Suna backend
│   │   ├── deploy-backend-app2.yml   # Deploy App2 backend
│   │   └── test-python.yml           # Python package tests
│   └── instructions/
│       └── documentation.instructions.md
│
├── apps/
│   │
│   ├── web/                          # ══════ NEXT.JS APP (App 1) ══════
│   │   ├── src/
│   │   │   ├── app/                  # Next.js App Router
│   │   │   │   ├── (dashboard)/
│   │   │   │   │   ├── agents/
│   │   │   │   │   ├── dashboard/
│   │   │   │   │   ├── knowledge/
│   │   │   │   │   ├── projects/
│   │   │   │   │   ├── settings/
│   │   │   │   │   ├── threads/
│   │   │   │   │   ├── triggers/
│   │   │   │   │   └── layout.tsx
│   │   │   │   ├── (home)/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── layout.tsx
│   │   │   │   ├── api/              # Next.js API routes (proxies)
│   │   │   │   │   ├── auth/
│   │   │   │   │   ├── v1/           # Proxy to backend-suna
│   │   │   │   │   └── v2/           # Proxy to backend-app2
│   │   │   │   ├── auth/
│   │   │   │   └── layout.tsx
│   │   │   │
│   │   │   ├── components/           # App-specific components
│   │   │   │   ├── agents/
│   │   │   │   ├── threads/
│   │   │   │   └── dashboard/
│   │   │   │
│   │   │   ├── hooks/
│   │   │   │   ├── react-query/      # TanStack Query hooks
│   │   │   │   │   ├── agents/
│   │   │   │   │   ├── threads/
│   │   │   │   │   └── billing/
│   │   │   │   └── use-*.ts
│   │   │   │
│   │   │   ├── lib/
│   │   │   │   ├── supabase/
│   │   │   │   │   ├── client.ts
│   │   │   │   │   └── server.ts
│   │   │   │   └── utils.ts
│   │   │   │
│   │   │   └── stores/               # Zustand stores
│   │   │       ├── model-store.ts
│   │   │       └── agent-store.ts
│   │   │
│   │   ├── public/
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json             # Extends ../../packages/config/tsconfig.nextjs.json
│   │   └── package.json
│   │
│   │
│   ├── cra/                          # ══════ CREATE REACT APP (App 2) ══════
│   │   ├── src/
│   │   │   ├── components/           # App-specific components
│   │   │   │   ├── workflows/
│   │   │   │   ├── pipelines/
│   │   │   │   └── analytics/
│   │   │   │
│   │   │   ├── pages/                # CRA "pages" (react-router)
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── Workflows.tsx
│   │   │   │   ├── Pipelines.tsx
│   │   │   │   └── Settings.tsx
│   │   │   │
│   │   │   ├── hooks/
│   │   │   │   ├── use-workflows.ts
│   │   │   │   └── use-pipelines.ts
│   │   │   │
│   │   │   ├── lib/
│   │   │   │   └── api.ts            # Uses @suna/api-client
│   │   │   │
│   │   │   ├── stores/               # Zustand or Redux
│   │   │   │   └── workflow-store.ts
│   │   │   │
│   │   │   ├── App.tsx
│   │   │   ├── index.tsx
│   │   │   └── routes.tsx            # React Router config
│   │   │
│   │   ├── public/
│   │   ├── craco.config.js           # CRACO for webpack customization
│   │   ├── tsconfig.json             # Extends ../../packages/config/tsconfig.react.json
│   │   └── package.json
│   │
│   │
│   └── mobile/                       # ══════ REACT NATIVE (Existing) ══════
│       ├── src/
│       ├── app.json
│       ├── metro.config.js
│       └── package.json
│
│
├── packages/                         # ══════ SHARED TYPESCRIPT PACKAGES ══════
│   │
│   ├── ui/                           # Shared React UI components
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Modal.tsx
│   │   │   │   ├── Input.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Avatar.tsx
│   │   │   │   ├── Dropdown.tsx
│   │   │   │   ├── Toast.tsx
│   │   │   │   ├── Skeleton.tsx
│   │   │   │   ├── DataTable.tsx
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── primitives/           # Radix UI wrappers
│   │   │   │   ├── Dialog.tsx
│   │   │   │   ├── Popover.tsx
│   │   │   │   ├── Select.tsx
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── layouts/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   └── PageContainer.tsx
│   │   │   │
│   │   │   ├── styles/
│   │   │   │   └── globals.css       # Shared Tailwind styles
│   │   │   │
│   │   │   ├── utils/
│   │   │   │   └── cn.ts             # clsx + tailwind-merge
│   │   │   │
│   │   │   └── index.ts              # Main export
│   │   │
│   │   ├── tailwind.config.ts        # Shared Tailwind config
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   │
│   ├── api-client/                   # Shared API client & auth
│   │   ├── src/
│   │   │   ├── client.ts             # Base HTTP client (fetch wrapper)
│   │   │   ├── auth.ts               # Auth utilities
│   │   │   │   ├── getToken()
│   │   │   │   ├── refreshToken()
│   │   │   │   └── AuthProvider
│   │   │   │
│   │   │   ├── supabase.ts           # Supabase client factory
│   │   │   │   ├── createBrowserClient()
│   │   │   │   └── createServerClient()
│   │   │   │
│   │   │   ├── hooks/
│   │   │   │   ├── use-auth.ts       # Authentication hook
│   │   │   │   ├── use-user.ts       # Current user hook
│   │   │   │   └── use-session.ts    # Session management
│   │   │   │
│   │   │   ├── endpoints/
│   │   │   │   ├── suna.ts           # App 1 API endpoints
│   │   │   │   └── app2.ts           # App 2 API endpoints
│   │   │   │
│   │   │   └── index.ts
│   │   │
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   │
│   ├── types/                        # Shared TypeScript types
│   │   ├── src/
│   │   │   ├── user.ts
│   │   │   ├── agent.ts
│   │   │   ├── thread.ts
│   │   │   ├── workflow.ts           # App 2 types
│   │   │   ├── pipeline.ts           # App 2 types
│   │   │   ├── api.ts                # API response types
│   │   │   └── index.ts
│   │   │
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   │
│   ├── utils/                        # Shared utilities
│   │   ├── src/
│   │   │   ├── format.ts             # Date, number formatting
│   │   │   ├── validation.ts         # Zod schemas
│   │   │   ├── storage.ts            # localStorage helpers
│   │   │   ├── url.ts                # URL manipulation
│   │   │   └── index.ts
│   │   │
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   │
│   ├── config/                       # Shared configurations
│   │   ├── eslint/
│   │   │   ├── base.js
│   │   │   ├── react.js
│   │   │   └── next.js
│   │   │
│   │   ├── typescript/
│   │   │   ├── tsconfig.base.json
│   │   │   ├── tsconfig.react.json
│   │   │   └── tsconfig.nextjs.json
│   │   │
│   │   ├── tailwind/
│   │   │   ├── preset.js             # Shared Tailwind preset
│   │   │   └── theme.js
│   │   │
│   │   └── package.json
│   │
│   │
│   └── test-utils/                   # Shared testing utilities
│       ├── src/
│       │   ├── render.tsx            # Custom render with providers
│       │   ├── mocks/
│       │   │   ├── handlers.ts       # MSW handlers
│       │   │   └── server.ts
│       │   └── index.ts
│       │
│       ├── tsconfig.json
│       └── package.json
│
│
├── services/                         # ══════ PYTHON BACKENDS ══════
│   │
│   ├── backend-suna/                 # App 1 FastAPI (existing backend/)
│   │   ├── core/
│   │   │   ├── agentpress/           # Agent orchestration
│   │   │   │   ├── thread_manager.py
│   │   │   │   ├── tool_registry.py
│   │   │   │   ├── tool.py
│   │   │   │   └── context_manager.py
│   │   │   │
│   │   │   ├── tools/                # Auto-discovered tools
│   │   │   │   ├── sb_files_tool.py
│   │   │   │   ├── sb_shell_tool.py
│   │   │   │   ├── web_search_tool.py
│   │   │   │   └── browser_tool.py
│   │   │   │
│   │   │   ├── services/
│   │   │   │   ├── supabase.py
│   │   │   │   ├── redis.py
│   │   │   │   └── langfuse.py
│   │   │   │
│   │   │   ├── billing/
│   │   │   ├── sandbox/
│   │   │   ├── knowledge_base/
│   │   │   └── utils/
│   │   │       ├── config.py
│   │   │       └── logger.py
│   │   │
│   │   ├── supabase/
│   │   │   └── migrations/
│   │   │
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   └── integration/
│   │   │
│   │   ├── api.py                    # FastAPI entry point
│   │   ├── run_agent_background.py   # Dramatiq worker
│   │   ├── pyproject.toml
│   │   ├── Dockerfile
│   │   └── .env.example
│   │
│   │
│   ├── backend-app2/                 # App 2 FastAPI
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── v1/
│   │   │   │   │   ├── workflows.py
│   │   │   │   │   ├── pipelines.py
│   │   │   │   │   ├── executions.py
│   │   │   │   │   └── router.py
│   │   │   │   └── deps.py           # Dependency injection
│   │   │   │
│   │   │   ├── models/               # SQLModel models
│   │   │   │   ├── workflow.py
│   │   │   │   ├── pipeline.py
│   │   │   │   ├── execution.py
│   │   │   │   └── base.py
│   │   │   │
│   │   │   ├── services/
│   │   │   │   ├── workflow_service.py
│   │   │   │   ├── pipeline_service.py
│   │   │   │   └── execution_service.py
│   │   │   │
│   │   │   ├── tasks/                # Celery tasks
│   │   │   │   ├── workflow_tasks.py
│   │   │   │   └── celery_app.py
│   │   │   │
│   │   │   ├── integrations/         # LangChain integrations
│   │   │   │   ├── langchain_runner.py
│   │   │   │   └── vector_stores.py
│   │   │   │
│   │   │   └── core/
│   │   │       ├── config.py
│   │   │       └── security.py
│   │   │
│   │   ├── alembic/                  # Database migrations
│   │   │   ├── versions/
│   │   │   └── env.py
│   │   │
│   │   ├── tests/
│   │   │   ├── unit/
│   │   │   └── integration/
│   │   │
│   │   ├── main.py                   # FastAPI entry point
│   │   ├── alembic.ini
│   │   ├── pyproject.toml
│   │   ├── Dockerfile
│   │   └── .env.example
│   │
│   │
│   └── core-runtime/                 # App 2 Python Core Library
│       ├── core_runtime/
│       │   ├── __init__.py
│       │   │
│       │   ├── agents/               # LangChain agents
│       │   │   ├── base.py
│       │   │   ├── researcher.py
│       │   │   └── executor.py
│       │   │
│       │   ├── chains/               # LangChain chains
│       │   │   ├── reasoning.py
│       │   │   └── planning.py
│       │   │
│       │   ├── tools/                # LangChain tools
│       │   │   ├── search.py
│       │   │   ├── code_exec.py
│       │   │   └── file_ops.py
│       │   │
│       │   ├── memory/               # Conversation memory
│       │   │   ├── buffer.py
│       │   │   └── vector.py
│       │   │
│       │   ├── prompts/              # Prompt templates
│       │   │   └── templates/
│       │   │
│       │   ├── serve/                # FastAPI serve command
│       │   │   ├── __init__.py
│       │   │   ├── app.py
│       │   │   └── routes.py
│       │   │
│       │   └── cli/                  # Typer CLI
│       │       ├── __init__.py
│       │       ├── main.py
│       │       ├── run.py
│       │       └── serve.py
│       │
│       ├── tests/
│       │   ├── unit/
│       │   └── integration/
│       │
│       ├── pyproject.toml
│       ├── Dockerfile
│       └── README.md
│
│
├── python-packages/                  # ══════ SHARED PYTHON PACKAGES ══════
│   │
│   ├── auth-common/                  # Shared authentication
│   │   ├── auth_common/
│   │   │   ├── __init__.py
│   │   │   ├── jwt.py                # JWT verification
│   │   │   │   ├── JWTVerifier
│   │   │   │   ├── decode_token()
│   │   │   │   └── verify_supabase_jwt()
│   │   │   │
│   │   │   ├── dependencies.py       # FastAPI dependencies
│   │   │   │   ├── get_current_user()
│   │   │   │   ├── get_optional_user()
│   │   │   │   └── require_admin()
│   │   │   │
│   │   │   ├── middleware.py         # Auth middleware
│   │   │   └── exceptions.py         # Auth exceptions
│   │   │
│   │   ├── tests/
│   │   ├── pyproject.toml
│   │   └── README.md
│   │
│   │
│   ├── db-common/                    # Shared database utilities
│   │   ├── db_common/
│   │   │   ├── __init__.py
│   │   │   ├── supabase.py           # Supabase client factory
│   │   │   ├── redis.py              # Redis client factory
│   │   │   ├── models.py             # Shared SQLModel base
│   │   │   └── migrations.py         # Migration helpers
│   │   │
│   │   ├── tests/
│   │   ├── pyproject.toml
│   │   └── README.md
│   │
│   │
│   ├── logging-common/               # Shared logging
│   │   ├── logging_common/
│   │   │   ├── __init__.py
│   │   │   ├── config.py             # Structlog config
│   │   │   ├── middleware.py         # Request logging
│   │   │   └── formatters.py
│   │   │
│   │   ├── pyproject.toml
│   │   └── README.md
│   │
│   │
│   └── langchain-tools/              # Shared LangChain components
│       ├── langchain_tools/
│       │   ├── __init__.py
│       │   ├── base_tool.py          # Shared tool base class
│       │   ├── web_search.py
│       │   ├── code_interpreter.py
│       │   └── document_loader.py
│       │
│       ├── tests/
│       ├── pyproject.toml
│       └── README.md
│
│
├── infrastructure/                   # ══════ INFRASTRUCTURE ══════
│   │
│   ├── docker/
│   │   ├── Dockerfile.web            # Next.js production
│   │   ├── Dockerfile.cra            # CRA production (nginx)
│   │   ├── Dockerfile.backend-suna   # App 1 FastAPI
│   │   ├── Dockerfile.backend-app2   # App 2 FastAPI
│   │   ├── Dockerfile.core-runtime   # Core library
│   │   ├── Dockerfile.worker-suna    # Dramatiq worker
│   │   └── Dockerfile.worker-app2    # Celery worker
│   │
│   ├── nginx/
│   │   ├── nginx.conf                # Reverse proxy config
│   │   └── cra.conf                  # CRA static serving
│   │
│   └── scripts/
│       ├── setup-dev.sh              # Development setup
│       ├── run-migrations.sh         # Database migrations
│       └── seed-data.sh              # Seed data
│
│
├── docs/                             # ══════ DOCUMENTATION ══════
│   ├── architecture/
│   │   ├── overview.md
│   │   ├── authentication.md
│   │   └── data-flow.md
│   │
│   ├── development/
│   │   ├── getting-started.md
│   │   ├── local-setup.md
│   │   └── contributing.md
│   │
│   ├── deployment/
│   │   ├── docker.md
│   │   ├── kubernetes.md
│   │   └── ci-cd.md
│   │
│   └── api/
│       ├── suna-api.md
│       └── app2-api.md
│
│
├── scripts/                          # ══════ DEVELOPMENT SCRIPTS ══════
│   ├── dev.sh                        # Start all services for dev
│   ├── build.sh                      # Build all packages
│   ├── test.sh                       # Run all tests
│   ├── lint.sh                       # Lint all code
│   └── clean.sh                      # Clean build artifacts
│
│
│── ══════════════════════════════════════════════════════════════════════════
│   ROOT CONFIGURATION FILES
│── ══════════════════════════════════════════════════════════════════════════
│
├── turbo.json                        # Turborepo configuration
├── pnpm-workspace.yaml               # pnpm workspaces
├── package.json                      # Root package.json
├── pnpm-lock.yaml                    # pnpm lockfile
│
├── pyproject.toml                    # Root Python config (uv workspace)
├── uv.lock                           # uv lockfile
│
├── docker-compose.yaml               # Local development
├── docker-compose.prod.yaml          # Production
├── docker-compose.test.yaml          # Testing
│
├── Makefile                          # Common commands
├── .gitignore
├── .prettierrc
├── .eslintrc.js
├── CLAUDE.md                         # AI assistant instructions
└── README.md
```

---

## Key Configuration Files

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "globalEnv": ["NODE_ENV", "CI"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "build/**"],
      "env": ["NEXT_PUBLIC_*"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "env": ["CI"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "clean": {
      "cache": false
    }
  }
}
```

### pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### Root package.json

```json
{
  "name": "suna-monorepo",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "dev:web": "turbo run dev --filter=web",
    "dev:cra": "turbo run dev --filter=cra",
    "build": "turbo run build",
    "build:web": "turbo run build --filter=web",
    "build:cra": "turbo run build --filter=cra",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck",
    "clean": "turbo run clean && rm -rf node_modules",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md}\"",
    "prepare": "husky install"
  },
  "devDependencies": {
    "@changesets/cli": "^2.27.1",
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0",
    "prettier": "^3.2.0",
    "turbo": "^2.0.0",
    "typescript": "^5.3.0"
  },
  "packageManager": "pnpm@8.15.0",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=8.0.0"
  }
}
```

### Root pyproject.toml (uv workspace)

```toml
[project]
name = "suna-monorepo"
version = "0.1.0"
description = "Suna/Kortix Monorepo"
requires-python = ">=3.11"

[tool.uv]
workspace = true

[tool.uv.workspace]
members = [
    "services/backend-suna",
    "services/backend-app2",
    "services/core-runtime",
    "python-packages/auth-common",
    "python-packages/db-common",
    "python-packages/logging-common",
    "python-packages/langchain-tools",
]

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B"]
ignore = ["E501"]

[tool.pytest.ini_options]
testpaths = ["services", "python-packages"]
python_files = ["*.test.py", "test_*.py"]
addopts = "-v --tb=short"
```

### Makefile

```makefile
.PHONY: dev build test lint clean install

# ══════════════════════════════════════════════════════════════
# Development
# ══════════════════════════════════════════════════════════════

dev: ## Start all services for development
	@echo "Starting development environment..."
	docker compose up -d redis
	pnpm run dev & \
	cd services/backend-suna && uv run uvicorn api:app --reload --port 8000 & \
	cd services/backend-app2 && uv run uvicorn main:app --reload --port 8001

dev-web: ## Start only Next.js app
	pnpm run dev:web

dev-cra: ## Start only CRA app
	pnpm run dev:cra

dev-backends: ## Start only Python backends
	docker compose up -d redis
	@make -j2 dev-backend-suna dev-backend-app2

dev-backend-suna:
	cd services/backend-suna && uv run uvicorn api:app --reload --port 8000

dev-backend-app2:
	cd services/backend-app2 && uv run uvicorn main:app --reload --port 8001

# ══════════════════════════════════════════════════════════════
# Installation
# ══════════════════════════════════════════════════════════════

install: install-js install-py ## Install all dependencies

install-js: ## Install JavaScript dependencies
	pnpm install

install-py: ## Install Python dependencies
	uv sync --all-extras

# ══════════════════════════════════════════════════════════════
# Building
# ══════════════════════════════════════════════════════════════

build: build-packages build-apps ## Build everything

build-packages: ## Build shared packages
	pnpm run build --filter="./packages/*"

build-apps: ## Build applications
	pnpm run build --filter="./apps/*"

build-docker: ## Build Docker images
	docker compose -f docker-compose.prod.yaml build

# ══════════════════════════════════════════════════════════════
# Testing
# ══════════════════════════════════════════════════════════════

test: test-js test-py ## Run all tests

test-js: ## Run JavaScript tests
	pnpm run test

test-py: ## Run Python tests
	uv run pytest

test-unit: ## Run unit tests only
	pnpm run test -- --filter=unit
	uv run pytest -m unit

test-integration: ## Run integration tests
	uv run pytest -m integration

# ══════════════════════════════════════════════════════════════
# Linting & Formatting
# ══════════════════════════════════════════════════════════════

lint: lint-js lint-py ## Lint all code

lint-js: ## Lint JavaScript/TypeScript
	pnpm run lint

lint-py: ## Lint Python
	uv run ruff check .

format: format-js format-py ## Format all code

format-js: ## Format JavaScript/TypeScript
	pnpm run format

format-py: ## Format Python
	uv run ruff format .

typecheck: ## Run type checking
	pnpm run typecheck
	uv run mypy services python-packages

# ══════════════════════════════════════════════════════════════
# Database
# ══════════════════════════════════════════════════════════════

migrate: ## Run database migrations
	cd services/backend-suna && uv run alembic upgrade head
	cd services/backend-app2 && uv run alembic upgrade head

migrate-create: ## Create new migration
	@read -p "Migration name: " name; \
	cd services/backend-app2 && uv run alembic revision --autogenerate -m "$$name"

# ══════════════════════════════════════════════════════════════
# Docker
# ══════════════════════════════════════════════════════════════

up: ## Start all services with Docker
	docker compose up -d

down: ## Stop all services
	docker compose down

logs: ## View logs
	docker compose logs -f

ps: ## Show running containers
	docker compose ps

# ══════════════════════════════════════════════════════════════
# Cleanup
# ══════════════════════════════════════════════════════════════

clean: ## Clean all build artifacts
	pnpm run clean
	rm -rf node_modules
	rm -rf .turbo
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true

# ══════════════════════════════════════════════════════════════
# Help
# ══════════════════════════════════════════════════════════════

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
```

---

## Package Dependencies

### packages/ui/package.json

```json
{
  "name": "@suna/ui",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./components": "./src/components/index.ts",
    "./primitives": "./src/primitives/index.ts",
    "./layouts": "./src/layouts/index.ts",
    "./styles": "./src/styles/globals.css"
  },
  "scripts": {
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "dependencies": {
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-popover": "^1.0.7",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-slot": "^1.0.2",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "@suna/config": "workspace:*",
    "@types/react": "^18.2.0",
    "typescript": "^5.3.0"
  }
}
```

### packages/api-client/package.json

```json
{
  "name": "@suna/api-client",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./auth": "./src/auth.ts",
    "./supabase": "./src/supabase.ts",
    "./hooks": "./src/hooks/index.ts"
  },
  "scripts": {
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.39.0",
    "@supabase/ssr": "^0.1.0",
    "@suna/types": "workspace:*"
  },
  "peerDependencies": {
    "react": "^18.0.0"
  },
  "devDependencies": {
    "@suna/config": "workspace:*",
    "@types/react": "^18.2.0",
    "typescript": "^5.3.0",
    "vitest": "^1.2.0"
  }
}
```

### apps/web/package.json (Next.js)

```json
{
  "name": "web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@suna/api-client": "workspace:*",
    "@suna/types": "workspace:*",
    "@suna/ui": "workspace:*",
    "@suna/utils": "workspace:*",
    "@tanstack/react-query": "^5.17.0",
    "next": "15.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.4.0"
  },
  "devDependencies": {
    "@suna/config": "workspace:*",
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0"
  }
}
```

### apps/cra/package.json (Create React App)

```json
{
  "name": "cra",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "craco start",
    "build": "craco build",
    "test": "craco test",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@suna/api-client": "workspace:*",
    "@suna/types": "workspace:*",
    "@suna/ui": "workspace:*",
    "@suna/utils": "workspace:*",
    "@tanstack/react-query": "^5.17.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0",
    "zustand": "^4.4.0"
  },
  "devDependencies": {
    "@craco/craco": "^7.1.0",
    "@suna/config": "workspace:*",
    "@types/react": "^18.2.0",
    "react-scripts": "5.0.1",
    "typescript": "^5.3.0"
  },
  "browserslist": {
    "production": [">0.2%", "not dead", "not op_mini all"],
    "development": ["last 1 chrome version", "last 1 firefox version", "last 1 safari version"]
  }
}
```

---

## Python Package Examples

### python-packages/auth-common/pyproject.toml

```toml
[project]
name = "auth-common"
version = "0.1.0"
description = "Shared authentication utilities for Suna backends"
requires-python = ">=3.11"
dependencies = [
    "pyjwt>=2.8.0",
    "fastapi>=0.109.0",
    "httpx>=0.26.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.4.0",
    "pytest-asyncio>=0.23.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.hatch.build.targets.wheel]
packages = ["auth_common"]
```

### services/backend-app2/pyproject.toml

```toml
[project]
name = "backend-app2"
version = "0.1.0"
description = "App 2 FastAPI Backend"
requires-python = ">=3.11"
dependencies = [
    # Shared packages (local)
    "auth-common",
    "db-common",
    "logging-common",

    # FastAPI
    "fastapi>=0.109.0",
    "uvicorn[standard]>=0.27.0",

    # Database
    "sqlmodel>=0.0.14",
    "alembic>=1.13.0",
    "asyncpg>=0.29.0",

    # Background tasks
    "celery[redis]>=5.3.0",

    # LangChain
    "langchain>=0.1.0",
    "langchain-community>=0.0.10",
    "langchain-openai>=0.0.5",

    # Core runtime (local)
    "core-runtime",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.4.0",
    "pytest-asyncio>=0.23.0",
    "httpx>=0.26.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.uv.sources]
auth-common = { workspace = true }
db-common = { workspace = true }
logging-common = { workspace = true }
core-runtime = { workspace = true }
```

---

## Docker Compose (Development)

```yaml
# docker-compose.yaml
version: '3.8'

services:
  # ══════════════════════════════════════════════════════════════
  # Frontend Apps
  # ══════════════════════════════════════════════════════════════

  web:
    build:
      context: .
      dockerfile: infrastructure/docker/Dockerfile.web
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      - NEXT_PUBLIC_BACKEND_URL=http://backend-suna:8000/api
      - NEXT_PUBLIC_BACKEND_APP2_URL=http://backend-app2:8001/api
    depends_on:
      - backend-suna
      - backend-app2
    networks:
      - suna
      - supabase

  cra:
    build:
      context: .
      dockerfile: infrastructure/docker/Dockerfile.cra
    ports:
      - "3001:80"
    environment:
      - REACT_APP_API_URL=/api/v2
      - REACT_APP_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - REACT_APP_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
    networks:
      - suna

  # ══════════════════════════════════════════════════════════════
  # Backend Services
  # ══════════════════════════════════════════════════════════════

  backend-suna:
    build:
      context: .
      dockerfile: infrastructure/docker/Dockerfile.backend-suna
    ports:
      - "8000:8000"
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    depends_on:
      - redis
    networks:
      - suna
      - supabase

  backend-app2:
    build:
      context: .
      dockerfile: infrastructure/docker/Dockerfile.backend-app2
    ports:
      - "8001:8001"
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - redis
      - backend-suna
    networks:
      - suna
      - supabase

  worker-suna:
    build:
      context: .
      dockerfile: infrastructure/docker/Dockerfile.worker-suna
    command: uv run dramatiq --processes 4 --threads 4 run_agent_background
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - REDIS_HOST=redis
    depends_on:
      - redis
      - backend-suna
    networks:
      - suna
      - supabase

  worker-app2:
    build:
      context: .
      dockerfile: infrastructure/docker/Dockerfile.backend-app2
    command: celery -A app.tasks.celery_app worker -l info
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
      - backend-app2
    networks:
      - suna
      - supabase

  # ══════════════════════════════════════════════════════════════
  # Infrastructure
  # ══════════════════════════════════════════════════════════════

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - suna

networks:
  suna:
    name: suna
  supabase:
    name: supabase
    external: true

volumes:
  redis_data:
```

---

## Migration Path

### Phase 1: Setup Monorepo Structure
1. Install Turborepo: `pnpm dlx create-turbo@latest`
2. Move `frontend/` → `apps/web/`
3. Move `backend/` → `services/backend-suna/`
4. Create `packages/` structure
5. Update imports and paths

### Phase 2: Extract Shared Packages
1. Create `packages/ui/` from existing components
2. Create `packages/api-client/` from lib/api-client.ts
3. Create `packages/types/` from shared types
4. Create `python-packages/auth-common/`

### Phase 3: Add App 2
1. Add CRA to `apps/cra/`
2. Add App 2 backend to `services/backend-app2/`
3. Add core runtime to `services/core-runtime/`
4. Configure shared auth

### Phase 4: Integration
1. Configure auth token sharing
2. Add API proxies in Next.js
3. Update Docker Compose
4. Test end-to-end

---

## Benefits of This Structure

| Aspect | Benefit |
|--------|---------|
| **Code Sharing** | UI, types, utils shared across all apps |
| **Auth Sharing** | Single `auth-common` package for all backends |
| **Build Caching** | Turborepo caches builds across apps |
| **Independent Deploy** | Each app/service can be deployed separately |
| **Type Safety** | Shared types ensure API contracts |
| **Developer Experience** | Single `make dev` starts everything |
| **CI/CD** | Affected-only builds save time |
