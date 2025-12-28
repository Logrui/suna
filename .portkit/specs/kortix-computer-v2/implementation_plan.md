# Portkit - Implementation Plan: Kortix Computer v2

## Status
*   **Source**: Upstream PRODUCTION `backend/core/sandbox/*`, `frontend/src/components/thread/kortix-computer/*`
*   **Target**: Local `suna` repository.

## 1. Strategy Overview
**"Surgical Patch & Clean Port"**

We are dealing with a "Partial Manual Port" state that led to API mismatches.
1.  **Backend**: Use a **surgical patch** approach. The local `api.py` is customized but missing specific endpoints. We will append the missing functions from upstream without overwriting the whole file.
2.  **Frontend**: Use a **clean port** approach for `KortixComputer.tsx` and related components. The local versions are potentially outdated or inconsistent. We will re-import them from upstream but apply strict "Shim/Strip" rules for `next-intl` and billing.

## 2. Component Morphing Table

| Upstream Component | Local Destination | Strategy | Adaptation Rules |
| :--- | :--- | :--- | :--- |
| `backend/core/sandbox/api.py` | `backend/core/sandbox/api.py` | **Merge/Append** | 1. Identify `endpoints` missing in local.<br>2. Copy `retry_with_backoff`.<br>3. Copy `/files/content`, `/files/history`, `/files/content-by-hash`.<br>4. **Do Not** overwrite existing Auth/Supabase imports. |
| `frontend/.../KortixComputer.tsx` | `frontend/.../KortixComputer.tsx` | **Nuke & Shim** | 1. **Strip** `next-intl`. Replace `t('key')` with raw strings.<br>2. **Strip** `BillingContext`.<br>3. Ensure `HealthCheckedVncIframe` import path is correct. |
| `frontend/.../FileBrowserView.tsx` | `frontend/.../FileBrowserView.tsx` | **Port & Shim** | 1. **Strip** `next-intl`. |
| `frontend/.../FileViewerView.tsx` | `frontend/.../FileViewerView.tsx` | **Port & Shim** | 1. **Strip** `next-intl`. |
| `frontend/.../KortixComputerHeader.tsx` | `frontend/.../KortixComputerHeader.tsx` | **Port & Shim** | 1. **Strip** `next-intl`. |
| `frontend/.../VersionBanner.tsx` | `frontend/.../VersionBanner.tsx` | **Port & Shim** | 1. **Strip** `next-intl`. |

## 3. Bridge Adapters (Shims)

### A. Localization (Shim)
**Target**: `next-intl`
**Strategy**: **Inline Replacement**.
*   Instead of creating a fake hook, we will perform a syntactic find-and-replace during the porting task.
*   `const t = useTranslations('Computer')` -> Removed.
*   `t('files.title')` -> `"Files"` (Hardcoded).

### B. Billing (Omission)
**Target**: `BillingContext`, `useCredits`
**Strategy**: **Strip**.
*   Remove all imports and `useContext` hooks.
*   Remove UI blocks conditional on `credits < 0`.

## 4. Execution Steps (High Level)
1.  **Backend Patch**: Read upstream `api.py`, extract the missing functions, append to local `api.py`.
2.  **Frontend Re-Port**: Read upstream files, apply regex replacements for `next-intl`, write to local.
3.  **Verify**: Run basic build check.

## 5. Verification Checklist
*   [ ] `backend/core/sandbox/api.py` has `/files/content` endpoint.
*   [ ] Frontend calls to `/files/content` return 200 (not 404).
*   [ ] `KortixComputer.tsx` renders without `NextIntlClientProvider` error.
*   [ ] No `next-intl` imports remain in the target directory.

## 6. Emergency Fixes Phase (Post-Research)
**Updated based on user feedback (2025-12-09)**

### A. Files Tab (500 Error)
*   **Symptoms**: `GET /sandboxes/.../files` returns 500.
*   **Cause**: `backend/core/sandbox/api.py` uses `sandbox.fs.list_files(path)`.
*   **Hypothesis**: The Daytona SDK method is likely `list_dir` or similar, not `list_files`.
*   **Action**: 
    1.  Research `daytona_sdk` filesystem methods (create a `debug_sdk.py` script if needed).
    2.  Patch `api.py` to use the correct method (e.g., `list_dir` or `ls`).

### B. Actions Tab (Non-Functional)
*   **Symptoms**: User reports "non functional", possibly empty or crashing.
*   **Cause**: Potential missing exports in `frontend/src/components/thread/tool-views/wrapper.tsx` or missing dependencies for `ToolView`.
*   **Action**:
    1.  Verify `ToolView` import in `KortixComputer.tsx`.
    2.  Check `frontend/src/components/thread/tool-views/wrapper.tsx` for correct exports.
    3.  Ensure `BrowserToolView` and other components are correctly registered.

