# Research Report: Kortix Computer v2
Date: 2025-12-08
Target: Upstream `kortix-computer-v2` Feature

## 1. Codemap & Architecture

The feature consists of a **Frontend** interface for interacting with a remote virtual desktop and a **Backend** API for file management and proxying.

### File Topology
```
frontend/src/components/thread/kortix-computer/
├── KortixComputer.tsx          # Main Container (Entry Point)
├── FileBrowserView.tsx         # File Manager UI
├── FileViewerView.tsx          # File Editor/Viewer
├── KortixComputerHeader.tsx    # Shared Header (Tabs)
├── VersionBanner.tsx           # Update Notifications
└── index.ts                    # Exports

backend/core/sandbox/
├── api.py                      # REST Endpoints (NEEDS MERGE)
└── sandbox.py                  # Core Logic (Daytona SDK wrapper)
```

### Data Flow
1.  **Launch**: `KortixComputer.tsx` requests sandbox status via `useKortixComputer`.
2.  **View**: `HealthCheckedVncIframe` connects to VNC stream.
3.  **File Ops**: `FileBrowserView` calls `/api/sandboxes/{id}/files/*`.
4.  **Edit**: `FileViewerView` reads/writes content via API.

## 2. Semantic Diff Analysis
**Tool Used**: `smart-diff.py` (Recursive)

### Backend (`backend/core/sandbox/api.py`)
*   **Status**: `[DIFF DETECTED]` (High Divergence)
*   **Changes**:
    *   **New Imports**: `aiohttp` (Local), `websockets` (Local) vs `shlex` (Upstream).
    *   **New Logic (Upstream)**: `retry_with_backoff` decorator for transient errors.
    *   **New Endpoints (Upstream)**:
        *   `/sandboxes/{id}/files/history`: Git commit history.
        *   `/sandboxes/{id}/files/content-by-hash`: Content at specific commit.
        *   `/sandboxes/{id}/files/content`: **CRITICAL MISSING ENDPOINT** (Current cause of 404).

### Frontend (`frontend/.../kortix-computer`)
*   **Status**: `[DIFF]` on `KortixComputer.tsx`.
*   **Changes**:
    *   Upstream uses `next-intl` (Denied).
    *   Upstream has stricter types for file operations.

## 3. Specifications & Limitations (Blast Radius)

### A. Denied Components
*   **`next-intl`**: Detected in `KortixComputer.tsx`.
    *   *Action*: Strip import, replace `t('key')` with hardcoded strings.
*   **Billing**: User explicitly requested removal.
    *   *Action*: Ensure no `credits` or `subscription` hooks are imported.

### B. Missing Endpoints (The 404 Fix)
The local `api.py` is missing crucial file management endpoints present in upstream.
*   **Missing**: `GET /sandboxes/{id}/files/content`
*   **Missing**: `GET /sandboxes/{id}/files/history`

### C. Dependency Graph
```json
{
  "dependencies": {
    "internal": [
      "@/components/thread/HealthCheckedVncIframe", 
      "@/lib/api/threads"
    ],
    "denied": [
      "next-intl"
    ]
  }
}
```

## 4. Recommendations
1.  **Backend**: Patch `api.py` to include the missing `/files/content` and `/files/history` endpoints from upstream. **DO NOT OVERWRITE** the file; use `smart-diff` reference to copy only the new functions.
2.  **Frontend**: Re-port `KortixComputer.tsx` from upstream, but:
    *   Strip `next-intl`.
    *   Keep local `HealthCheckedVncIframe` integration.
3.  **Sanity Check**: Verify `sandbox.py` matches upstream expectations for `read_file`.
