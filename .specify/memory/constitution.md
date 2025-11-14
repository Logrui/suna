# Suna Project Constitution

## 1. Overview: Kortix/Suna Self-Hosted Fork

Kortix (formerly Suna) is an open-source, full-stack agentic AI system. This
workspace (`d:\Homelab\suna`) is a **self-hosted fork** of the upstream
Kortix/Suna project with significant local modifications, while still
maintaining periodic syncs with the original repo.

At a high level:

- **Frontend**: Next.js App Router application (React Server Components) that
  renders the Suna UI.
- **Backend**: Python FastAPI service orchestrating LLM chat completions via
  **AgentPress**, managing tools and conversation threads.
- **Streaming**: Chat responses stream from backend to frontend using Redis
  pub/sub and Server-Sent Events (SSE).
- **State & Auth**: Supabase (PostgreSQL + auth + realtime) store threads,
  messages, agents, accounts, and related data.
- **Sandboxing**: Daytona is the backbone of Suna and provides a “virtual computer” runtime for agents to execute
  tools and working with files in isolated environments
- **Deployment**: This self-hosted version runs via Docker alongside a
  self-hosted Supabase stack. Daytona currently runs in the cloud, but that
  may change in the future.
- **Networking**: A Cloudflare tunnel and custom routing configuration provide
  HTTPS access while still supporting `localhost`. The system has been tuned
  so that the same images work both locally and through the tunnel without
  rebuilds.

This constitution encodes the non-negotiable rules for documentation,
architecture, and workflows in this fork.

These principles are **hard constraints** and MUST be followed.

### 2.1 File Count & Purpose

1. **Maximum 3 Markdown Files per Request**  
   - Never create more than **three** `.md` files in any single request or
     change set.  
   - If more documentation is needed, consolidate content into at most three
     well‑structured files.

2. **No Summary/Status Files**  
   - Do **not** create files whose primary purpose is to summarize or report
     status (e.g. `SUMMARY.md`, `STATUS_UPDATE.md`, `COMPLETION_STATUS.md`).  
   - All summaries, progress updates, and high‑level overviews belong in the
     **chat / conversation**, not in new files.

3. **Chat First, Files Second**  
   - Chat is the **primary communication channel** for analysis, decisions,
     and status.  
   - Files are for **implementation‑grade content** only: guides, reference,
     architecture, API docs, troubleshooting.

### 2.2 Location Rules (Suna‑Specific)

1. **Never Create Docs in Repo Root**  
   - All new documentation files MUST live under `.docs/` or a clearly
     associated documentation directory.  
   - The repo root is reserved for project‑wide meta files (e.g. `README.md`,
     `CLAUDE.md`, `LICENSE`).

2. **Top‑Level Documentation Folders**  
   When creating or updating docs, place them into appropriate subfolders
   under `.docs/`, for example:
   - `.docs/feature-planning`
   - `.docs/features`
   - `.docs/bugfixes`
   - `.docs/architecture`

3. **Bug Fix / Troubleshooting Docs**  
   - For bug fixes and troubleshooting, documentation MUST live under
     `.docs/bugfixes/` in a numbered subfolder.  
   - Existing examples:
     - `.docs/bugfixes/11. postgres realtime errors`
     - `.docs/bugfixes/13. message displays and debug mode crashes`
   - When creating a **new** bugfix folder:
     - Use the next available integer prefix (e.g. `22 example issue`).
     - The folder name should briefly describe the issue being addressed.

4. **Feature Implementation & Planning Docs**  
   - For new features or significant updates to existing features, docs MUST
     live under `.docs/features/` (or `.docs/feature-planning/` if that is the
     agreed convention).  
   - Each feature gets its own folder, created if it does not already exist.  
   - Examples:
     - `.docs/features/kb-file-previews-editors`
     - `.docs/features/library-implementation`

5. **Folder Creation Rules**  
   - Before creating a new folder under `.docs/bugfixes/` or `.docs/features/`,
     check for an existing appropriate folder.  
   - If a bug or feature clearly belongs to an existing folder, **reuse** that
     folder instead of adding a new one.

### 2.3 Consolidation Policy

1. **Pre‑Creation Check**  
   - Before creating any new docs in a target directory, count existing `.md`
     files in that directory.  
   - If there are already **3 or more**, consolidate into existing files
     rather than creating new ones.

2. **Consolidation Strategy**  
   - Prefer a three‑file pattern where needed:
     - `GUIDE.md` or similar for step‑by‑step implementation.
     - `ARCHITECTURE.md` for design and rationale.
     - `QUICK_REFERENCE.md` for commands, checklists, troubleshooting.  
   - When unsure how to consolidate, ask the user explicitly before editing.

---

## 3. Architecture & Runtime Principles

1. **Graceful Degradation**  
   - Optional dependencies (e.g. Daytona sandbox) must fail gracefully.  
   - The core agent and UI flows must remain functional when optional services
     are unavailable, with clear error messages and no cascading failures.

2. **AgentPress Tool Auto‑Discovery**  
   - Backend tools are auto‑discovered via the `core.agentpress.tool` system
     and scanning `backend/core/tools/`.  
   - New tools MUST integrate through this auto‑discovery mechanism rather
     than ad‑hoc wiring.

3. **Self‑Hosted Supabase & Basejump**  
   - Supabase (including the `basejump` schema) is the canonical data layer.  
   - All schema‑related changes must respect the requirement that `basejump`
     is exposed through PostgREST in self‑hosted environments.

4. **URL & Environment Flexibility**  
   - Frontend URL handling must support both `localhost` and Cloudflare Tunnel
     URLs via the existing three‑layer detection (browser, server, middleware).  
   - Configuration changes that impact URLs should be documented under
     `.docs/initialsetup/` and tested in both local and tunneled setups.

5. **Performance & Observability**  
   - Use Redis, Dramatiq, and Langfuse according to existing patterns for
     caching, background work, and LLM tracing.  
   - New features should integrate with this stack instead of introducing
     parallel ad‑hoc solutions.

---

## 4. Development Workflow Principles

1. **Backend & Worker**  
   - Use the documented `backend` commands (`uv run`, `./test`, etc.) as the
     single source of truth for running, testing, and debugging backend code.

2. **Frontend**  
   - Use Next.js App Router with server components by default; client
     components only when necessary.  
   - New UI features should respect the plugin/extensibility strategy captured
     in `.docs/plugin-system/`.  
   - When working on threads, chat, and streaming UI, developers MUST be
     vigilant about avoiding infinite render/update loops ("Maximum update
     depth exceeded" errors).  
   - Always follow the guidelines documented in
     `.docs/guidelines/Rendering_React_Best_Practices.md` when adding or
     modifying React components that participate in streaming, stateful
     rendering, or complex hook usage.

3. **Knowledge Base & Embeddings**  
   - OpenAI embeddings (via kb‑fusion) are a hard dependency for KB search.  
   - When embeddings are unavailable, KB features must fail gracefully while
      allowing other parts of the system to function.

4. **Windows Support**  
   - Backend asyncio must continue to support Windows (via the documented
     event loop policy in `backend/api.py`).  
   - Avoid introducing platform‑specific code that breaks Windows support
     without a clear documented rationale.

5. **Test-Driven Development (TDD)**  
   - Where practical, development SHOULD follow a TDD-style workflow, and for
     core logic and regressions it is strongly RECOMMENDED:
     - **Red**: Write an automated test that captures the desired behavior or
       reproduces a bug. The test must fail initially.
     - **Green**: Implement the minimum code necessary to make the test pass.
     - **Refactor**: Improve the implementation while keeping all tests green.  
   - Tests should be written as close as possible to the point where a
     behavior or regression is understood, so requirements and expectations
     are encoded in code early.
   - TDD is especially encouraged for:
     - AgentPress orchestration logic and critical tools.
     - Thread/streaming behavior in the chat pipeline.
     - Complex React components and hooks that are prone to infinite update
       loops or subtle state bugs.
   - This process should align with existing CI and test tooling so that
     failing tests block regressions from being merged.
   - **Minimal checklist for test scripts:**
     - [ ] New behavior or bug is captured in a failing test first.
     - [ ] The fix only ships once the new test passes alongside existing tests.
     - [ ] Tests assert on observable behavior (responses, UI state, events),
           not internal implementation details where avoidable.
     - [ ] For regressions, the test clearly references the issue or folder
           under `.docs/bugfixes/` that motivated it.

---

## 5. Safety, Security & Secrets

1. **Secrets Management**  
   - API keys and secrets (OpenAI, Anthropic, Supabase, etc.) must never be
     hard‑coded. They belong in environment variables and `.env` files as
     already documented in `CLAUDE.md`.

2. **Credential Encryption**  
   - Credentials stored for tools or agents must use the existing Fernet‑based
   encryption mechanisms (`MCP_CREDENTIAL_ENCRYPTION_KEY`).

3. **Sandbox Safety**  
   - Daytona sandbox integrations must continue to run in isolated
     environments and must not assume direct host access beyond what is
     already configured.

---

## 6. Governance & Amendments

1. **Authority of This Document**  
   - This constitution is the canonical reference for project‑wide rules in
     the Suna workspace. When in conflict with older docs, this document
     takes precedence.

2. **Amendment Process**  
   - Any change to non‑trivial principles (especially documentation limits,
     location rules, or architecture constraints) requires:
     - An explicit edit to this `constitution.md` file.
     - A short rationale in the commit message.
   - Semantic versioning of `CONSTITUTION_VERSION`:
     - **MAJOR**: Backward‑incompatible changes to rules or removal of
       principles.
     - **MINOR**: New principles or materially expanded guidance.
     - **PATCH**: Clarifications, wording improvements, or typo fixes.

3. **Review Expectations**  
   - When adding new templates under `.specify/templates/`, ensure they
     reference this constitution where relevant (e.g. limits on docs,
     .docs folder rules).  
   - Future updates should complete the "Templates requiring updates" section
     of the Sync Impact Report.

4. **Validation Checklist (Human or Tooling)**  
   - No new docs in repo root unless explicitly exempt (e.g. `README.md`).
   - Per‑request `.md` file creation ≤ 3.
   - No new summary/status files.
   - Bugfix and feature docs located under the correct `.docs` subfolders.
   - Optional systems (Daytona, embeddings) degrade gracefully when absent.

---

End of Suna Project Constitution v1.2.0.

**Version**: 1.2.0 | **Ratified**: [RATIFICATION_DATE] | **Last Amended**: [LAST_AMENDED_DATE]
