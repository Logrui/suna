# Portkit - Research: Kortix Computer v2

## Codemap
The "Kortix Computer" feature spans frontend interactions and backend sandbox control.

### Component Tree
```mermaid
graph TD
    A[Thread/Message] -->|Render Tool| B[KortixComputer.tsx]
    B --> C[FileBrowserView.tsx]
    B --> D[FileViewerView.tsx]
    B --> E[HealthCheckedVncIframe.tsx]
    B --> F[VersionBanner.tsx]
    
    B -->|API: /sandboxes/{id}/files| G[Backend: api.py]
    B -->|API: /sandboxes/{id}/proxy| G
    
    G --> H[Daytona SDK]
    G --> I[Supabase Auth]
```

### Critical Paths
1.  **VNC Stream**: `HealthCheckedVncIframe` -> Backend Proxy -> Daytona container.
2.  **File Operations**: Frontend -> `api.py` -> Daytona `fs` operations.
3.  **Git History**: New endpoints in `api.py` allow viewing file history/diffs.

## Semantic Diff (Upstream vs Local)

### Backend (`backend/core/sandbox/api.py`)
*   **Upstream Status**: significantly larger (~1350 lines vs ~870 lines).
*   **New Endpoints** (Missing Locally):
    *   `GET /sandboxes/{id}/files/history`: Lists git commit history for files.
    *   `GET /sandboxes/{id}/files/content-by-hash`: Reads file content at specific commit.
    *   `Retry Logic`: `retry_with_backoff` wrapper introduced for transient Daytona errors.
*   **Action**: **Merge Required**. We must append the new endpoints and helper functions (`retry_with_backoff`) to our local file, carefully preserving our custom `ensure_project_sandbox` logic.

### Frontend (`frontend/src/components/thread/kortix-computer/`)
*   **Upstream Status**: New components.
*   **Dependencies**:
    *   `next-intl` (POISON): Used in `KortixComputer.tsx` (`useTranslations`).
    *   `sonner`, `framer-motion`: Standard deps (likely available).
*   **Action**: **Port & Strip**.
    *   Replace `useTranslations` with hardcoded English strings.
    *   Copy mostly as-is, removing localization hooks.

## Specifications & Limitations
1.  **Billing**: No explicit billing logic found in `kortix-computer` components or `api.py`.
    *   *Risk*: Low.
2.  **Localization**: `next-intl` removal is the primary modification task.
    *   *Strategy*: "Inline English" (replace `t('key')` with actual text).
3.  **Auth**: Upstream uses `VerifyUser`, we use `Supabase/Basejump`.
    *   *Strategy*: Ensure `api.py` merge uses `core.utils.auth_utils` (already present locally).

## Blast Radius
*   **High**: `backend/core/sandbox/api.py` (Merge conflict potential).
*   **Low**: New Frontend components (Additive).

## Conclusion
The port is feasible. The main complexity lies in merging `api.py` to gain the new Git/History capabilities without breaking our custom sandbox orchestration.
