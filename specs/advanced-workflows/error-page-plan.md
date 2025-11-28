# Implementation Plan - Workflow Error Page

## Goal Description
Create a user-friendly `error.tsx` page for the workflow editor (`/agents/config/[agentId]/workflow/[workflowId]`). This page will act as an error boundary, catching client-side exceptions and displaying a styled error message instead of the default Next.js error screen. The design will mirror the existing `MaintenancePage` for consistency.

## User Review Required
> [!NOTE]
> The error page will replace the default Next.js error overlay in development and the generic error page in production for this specific route segment.

## Proposed Changes

### Frontend
#### [NEW] [error.tsx](file:///d:/Homelab/suna/frontend/src/app/(dashboard)/agents/config/[agentId]/workflow/[workflowId]/error.tsx)
- Create a new Client Component `ErrorPage` (default export).
- Props: `{ error: Error & { digest?: string }, reset: () => void }`.
- UI Components:
    - `AnimatedBg` (variant="hero")
    - `KortixLogo`
    - `Card` for error details
    - `Button` to retry (`reset()`)
- Content:
    - Title: "Something went wrong"
    - Description: "An unexpected error occurred in the workflow editor."
    - Error Details: Show `error.message` in a collapsible or subtle way (or just the main message).
    - Status Indicator: Red "Workflow Error" indicator.

## Verification Plan

### Manual Verification
1.  **Trigger Error**: Temporarily introduce a `throw new Error('Test error')` in `frontend/src/app/(dashboard)/agents/config/[agentId]/workflow/[workflowId]/page.tsx`.
2.  **Navigate**: Go to a workflow page (e.g., `/agents/config/123/workflow/456`).
3.  **Observe**: Verify the new error page appears with the correct styling and error message.
4.  **Retry**: Click the "Try Again" button and verify it attempts to re-render the segment (if the error is removed, it should recover).
