# Portkit - Tasks: Kortix Computer v2

## Phase 1: Ingestion & Setup
- [x] T001 [Ingest] Update shadow repo: `npx tsx .portkit/scripts/typescript/update-registry.ts --update`
- [x] T002 [Ingest] Install Backend Dependencies: Add `daytona-sdk` to `backend/pyproject.toml` and run `uv sync`.
- [x] T003 [Ingest] Sanitize Upstream Code: `python .portkit/scripts/python/sanitize-upstream.py` (Ensures generic rules applied).

## Phase 2: Backend Implementation (Smart Merge)
- [x] T004 [Adapt] **MERGE** `backend/core/sandbox/api.py`.
    -   Action: Read upstream `backend/core/sandbox/api.py` from `.portkit-cache`.
    -   Action: Read local `backend/core/sandbox/api.py`.
    -   Action: Merge upstream logic (sandbox creation/deletion) into local file.
    -   **CRITICAL**: Preserve `// feature-start: daytona-preview-bypass` blocks INTENT.
    -   **CRITICAL**: Do NOT import billing/credits.
- [x] T005 [Adapt] [P] Verify `backend/core/utils/preview_urls.py`. Ensure local version (bypass logic) is kept intact or merged if upstream has non-conflicting updates.

## Phase 3: Frontend Implementation (Sanitize & Paste)
- [x] T006 [Morph] Port `HealthCheckedVncIframe.tsx`.
    -   Action: `python .portkit/scripts/python/extract-region.py` (or manual read) from upstream.
    -   Action: Merge into `frontend/src/components/thread/HealthCheckedVncIframe.tsx`.
    -   **CRITICAL**: Preserve `// feature-start: daytona-preview-bypass` tags around URL construction.
- [x] T007 [Morph] [P] Create `frontend/src/components/thread/kortix-computer/KortixComputer.tsx`.
    -   Action: Copy from upstream.
    -   Action: Remove `next-intl` imports and `useTranslations`. Replace `t('key')` with raw strings.
    -   Action: Add `// feature-start: kortix-computer-v2` tags.
# Portkit - Tasks: Kortix Computer v2

## Phase 1: Ingestion & Setup
- [x] T001 [Ingest] Update shadow repo: `npx tsx .portkit/scripts/typescript/update-registry.ts --update`
- [x] T002 [Ingest] Install Backend Dependencies: Add `daytona-sdk` to `backend/pyproject.toml` and run `uv sync`.
- [x] T003 [Ingest] Sanitize Upstream Code: `python .portkit/scripts/python/sanitize-upstream.py` (Ensures generic rules applied).

## Phase 2: Backend Implementation (Smart Merge)
- [x] T004 [Adapt] **MERGE** `backend/core/sandbox/api.py`.
    -   Action: Read upstream `backend/core/sandbox/api.py` from `.portkit-cache`.
    -   Action: Read local `backend/core/sandbox/api.py`.
    -   Action: Merge upstream logic (sandbox creation/deletion) into local file.
    -   **CRITICAL**: Preserve `// feature-start: daytona-preview-bypass` blocks INTENT.
    -   **CRITICAL**: Do NOT import billing/credits.
- [x] T005 [Adapt] [P] Verify `backend/core/utils/preview_urls.py`. Ensure local version (bypass logic) is kept intact or merged if upstream has non-conflicting updates.

## Phase 3: Frontend Implementation (Sanitize & Paste)
- [x] T006 [Morph] Port `HealthCheckedVncIframe.tsx`.
    -   Action: `python .portkit/scripts/python/extract-region.py` (or manual read) from upstream.
    -   Action: Merge into `frontend/src/components/thread/HealthCheckedVncIframe.tsx`.
    -   **CRITICAL**: Preserve `// feature-start: daytona-preview-bypass` tags around URL construction.
- [x] T007 [Morph] [P] Create `frontend/src/components/thread/kortix-computer/KortixComputer.tsx`.
    -   Action: Copy from upstream.
    -   Action: Remove `next-intl` imports and `useTranslations`. Replace `t('key')` with raw strings.
    -   Action: Add `// feature-start: kortix-computer-v2` tags.
- [x] T008 [Morph] [P] Create `frontend/src/components/thread/kortix-computer/FileBrowserView.tsx`.
    -   Action: Copy from upstream.
    -   Action: Remove `next-intl` usage.
    -   Action: Add `// feature-start: kortix-computer-v2` tags.

## Phase 4: Integration
- [x] T009: Register `kortix_computer` tool view (frontend/src/components/thread/tool-views/wrapper/ToolViewRegistry.tsx) <!-- Integration verified via ThreadLayout --> to map `kortix_computer` tool to `KortixComputer` component.

## Phase 5: Verification
- [ ] T900 [Verify] Run `uv run pytest backend/core/sandbox/tests/` (if tests exist) or verify `api.py` compilation.
- [ ] T901 [Verify] Manual check: Open VNC view, verify no "Preview Warning" (Bypass check).
