# Portkit - Research Report: Kortix Computer v2

**Source**: `.portkit-cache` (Upstream PRODUCTION)
**Target**: `kortix-computer-v2`
**Spec**: `specs/kortix-computer-v2/spec.md`

## 1. Codemap (The Blast Radius)

### A. File Structure & Purpose
```mermaid
graph TD
    subgraph Frontend [Frontend Components]
        KC[KortixComputer.tsx] -->|Container| VNC[HealthCheckedVncIframe.tsx]
        KC -->|File Explorer| FB[FileBrowserView.tsx]
        KC -->|File Viewer| FV[FileViewerView.tsx]
        KC -->|Browser State| BTV[BrowserToolView.tsx]
        KC -.->|Dependency| NI[next-intl (POISON)]
    end

    subgraph Backend [Backend Services]
        API[backend/core/sandbox/api.py] -->|Orchestrates| DSDK[Daytona SDK]
        API -->|Access| AUTH[core.utils.auth_utils]
        API -->|Data| DB[core.services.supabase]
    end

    KC -->|API Calls| API
```

### B. Critical Component Analysis

#### 1. `KortixComputer.tsx` (Frontend Entry)
*   **Role**: Main aggregator component for the computer interface. Handles mode switching (VNC vs File Browser).
*   **Dependencies**: 
    *   `components/thread/HealthCheckedVncIframe`: Core VNC renderer.
    *   `next-intl`: **INCOMPATIBLE**. Must be stripped.
    *   `framer-motion`: For animations (Keep).
*   **Complexity**: High (42KB).

#### 2. `backend/core/sandbox/api.py` (Backend Gateway)
*   **Role**: FastAPI router managing sandbox lifecycles and proxying VNC traffic.
*   **Dependencies**:
    *   `daytona_sdk`: External lib.
    *   `core.utils.auth_utils`: Upstream auth. **ADAPTATION REQUIRED** to use local `auth_utils` (check compatibility).
*   **State**: Manages sandbox instances in memory/database.

#### 3. `HealthCheckedVncIframe.tsx`
*   **Role**: Embedded VNC client wrapper.
*   **Dependencies**: Likely minimal, but relies on backend proxy endpoints.

## 2. Semantic Diff & Adaptation Needs

### A. Dependency Conflicts
| File | Dependency | Status | Action |
| `KortixComputer.tsx` | `next-intl` | ❌ Toxic | **STRIP**: Replace with raw strings. |
| `KortixComputer.tsx` | `use-document-modal-store` | ⚠️ Risk | **CHECK**: Ensure store exists locally. |
| `api.py` | `daytona_sdk` | ⚠️ Missing? | **INSTALL**: Add to `backend/pyproject.toml`. |

### B. Implementation Risks
*   **Auth Mismatch**: Upstream `auth_utils` might have different user object structure than local Basejump implementation.
    *   *Mitigation*: Verify `get_current_user` signatures in `api.py` matches local `backend/core/services/auth.py`.

## 3. Specifications & Limitations
*   **Billing**: Upstream likely checks for "Credits" before starting sandbox in `api.py`.
    *   *Constraint*: we must **REMOVE** this check entirely given the spec.
*   **Slash Commands**: No overrides found in this blast radius, but careful with `ThreadComponent` integration.

## 4. Recommended Next Steps (Plan)
1.  **Sanitize**: Create `task` to copy `KortixComputer.tsx` but run a sed/regex pass to remove `next-intl`.
2.  **Backend Dependencies**: Add `daytona_sdk` to local backend.
3.  **Integration**: created a new `tool-view` registration for `KortixComputer`.

