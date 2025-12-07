# Implementation Plan - Global Maintenance Page Trigger

## Goal Description
Implement a global mechanism to display the `MaintenancePage` whenever specific API errors occur (specifically 404s as requested by the user, likely indicating a missing critical resource or backend issue). This ensures a consistent "fail-safe" UI across the application without modifying every page individually.

## User Review Required
> [!WARNING]
> **Global 404 Handling**: Enabling this for *all* 404s will cause the Maintenance Page to appear even for standard "Not Found" scenarios (e.g., user navigates to a non-existent agent).
> **Recommendation**: I will implement this to trigger on **404** errors as requested, but we should consider narrowing this scope in the future (e.g., only for `/api/workflows/*` or 5xx errors).

## Proposed Changes

### Frontend

#### [NEW] [GlobalMaintenanceHandler.tsx](file:///d:/Homelab/suna/frontend/src/components/global-maintenance-handler.tsx)
- Create a Client Component that subscribes to `useMaintenanceStore`.
- If `isMaintenanceMode` is true, render the `MaintenancePage` as a fixed overlay (z-index 50).
- This ensures it covers the entire app content.

#### [MODIFY] [layout.tsx](file:///d:/Homelab/suna/frontend/src/app/layout.tsx)
- Import `GlobalMaintenanceHandler`.
- Add `<GlobalMaintenanceHandler />` inside the `<body>`, preferably near the top or bottom (it's fixed position so order doesn't matter much, but logically near the root).

#### [MODIFY] [react-query-provider.tsx](file:///d:/Homelab/suna/frontend/src/providers/react-query-provider.tsx)
- Import `useMaintenanceStore`.
- Update `QueryClient` configuration:
    - Add `queries.onError` handler.
    - Check if `error.status === 404` (and potentially other critical statuses).
    - If matched, call `useMaintenanceStore.getState().setMaintenanceMode(true)`.

## Verification Plan

### Manual Verification
1.  **Trigger 404**:
    - Navigate to a page that makes an API call.
    - Temporarily modify the API endpoint in the code (or use browser devtools network blocking) to return a 404.
    - Alternatively, modify `react-query-provider.tsx` to manually trigger the mode for testing.
2.  **Observe**:
    - Verify that the `MaintenancePage` overlay appears immediately.
3.  **Recovery**:
    - Click the "Refresh" icon on the Maintenance Page.
    - Verify the page reloads (which resets the store) and tries again.
