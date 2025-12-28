# Portkit - Tasks: Kortix Computer v2 (Revised for v2)

## Phase 1: Ingestion & Analysis
- [x] T001 [Ingest] Re-sync Upstream Cache: `uv run python .portkit/scripts/python/fetch-upstream.py --ref PRODUCTION`
- [x] T002 [Ingest] Verify Blast Radius: `uv run python .portkit/scripts/python/map-dependencies.py --target .portkit-cache/frontend/src/components/thread/kortix-computer/KortixComputer.tsx`

## Phase 2: Backend Implementation (Surgical Patch)
- [x] T003 [Morph] **Patch** `backend/core/sandbox/api.py` with `retry_with_backoff`.
    -   Action: Extract `retry_with_backoff` from `.portkit-cache/backend/core/sandbox/api.py`.
    -   Action: Insert into `backend/core/sandbox/api.py` (before endpoints).
- [x] T004 [Morph] **Patch** `backend/core/sandbox/api.py` with missing endpoints.
    -   Action: Extract functions `get_sandbox_file_content`, `get_sandbox_file_content_by_hash`, `get_sandbox_file_history`.
    -   Action: Append to `backend/core/sandbox/api.py`.
    -   Constraint: Ensure they use `get_current_user` or equivalent local auth correctly.

## Phase 3: Frontend Implementation (Nuke & Shim)
- [x] T005 [Morph] [P] **Re-Port** `frontend/src/components/thread/kortix-computer/KortixComputer.tsx`.
    -   Action: Read from upstream.
    -   Action: Apply Shim: Remove `next-intl` import. Replace `t('files.title')` -> `'Files'`, etc.
    -   Action: Apply Shim: Remove `BillingContext` usage.
    -   Action: Overwrite local file `frontend/src/components/thread/kortix-computer/KortixComputer.tsx`.
- [x] T006 [Morph] [P] **Re-Port** `frontend/src/components/thread/kortix-computer/FileBrowserView.tsx`.
    -   Action: Read from upstream.
    -   Action: Apply Shim: Remove `next-intl`.
    -   Action: Overwrite local file.
- [x] T007 [Morph] [P] **Re-Port** `frontend/src/components/thread/kortix-computer/FileViewerView.tsx`.
    -   Action: Read from upstream.
    -   Action: Apply Shim: Remove `next-intl`.
    -   Action: Overwrite local file.
- [x] T008 [Morph] [P] **Re-Port** `frontend/src/components/thread/kortix-computer/KortixComputerHeader.tsx`.
    -   Action: Read from upstream.
    -   Action: Apply Shim: Remove `next-intl`.
    -   Action: Overwrite local file.
- [x] T009 [Morph] [P] **Re-Port** `frontend/src/components/thread/kortix-computer/VersionBanner.tsx`.
    -   Action: Read from upstream.
    -   Action: Apply Shim: Remove `next-intl`.
    -   Action: Overwrite local file.
- [x] T010 [Verify] **Verify** `frontend/src/components/thread/kortix-computer/index.ts`.
    -   Action: Ensure all components are exported correctly.

## Phase 4: Verification
- [x] T900 [Verify] Backend Build: `uv run python backend/api.py` (Check for syntax errors).
- [x] T901 [Verify] Frontend Build: `npm run build` (Check for missing `next-intl` errors).
