# Specification: Thread Branching and Message Editing

## Overview
Implement frontend and backend support for conversation branching, in-place message editing, and resending. This feature allows users to "undo" parts of a conversation, modify their inputs, or branch a conversation into a separate thread while preserving the current project context.

## Functional Requirements
### 1. Message Submenu (Contextual)
- Implement a hover-triggered submenu for user messages.
- Buttons: 'Copy Message', 'Edit', and 'Branch'.
- Theming must follow `frontend-design-guidelines.md`.

### 2. Message Editing (In-Place)
- **Edit Trigger:** Clicking 'Edit' replaces the message text bubble with a text area.
- **Undo Warning:** Before submission, show a "Confirm Undo" modal with the text: *"Confirm Undo. This undo action will not make any code changes or file changes."*
- **Drop Logic:** Submitting an edit permanently drops all subsequent messages in the *current* thread.
- **Submission:** Provide "Cancel" and "Update" buttons below the editing text area.

### 3. Thread Branching (Server-Side)
- **Branch Trigger:** Clicking 'Branch' opens a naming modal.
- **Naming Modal:** Pre-filled input field using the auto-naming/icon pipeline.
- **Logic:** Server-side cloning of message history up to the selected message into a new thread within the same project.
- **Navigation:** Frontend navigates to the new thread upon successful creation.

### 4. Auto-Naming Fix
- Debug and fix the existing pipeline that handles automatic thread naming and icon assignment.

### 5. Utilities
- **Copy Message:** Simple clipboard copy functionality.

## Technical Constraints
- **Modularization:** Create new components/files for the submenu and modals to minimize bloat in `thread` components.
- **Backend:** Implement a branching endpoint that handles database-level cloning of messages.
- **State Management:** Utilize Zustand/TanStack Query for thread state updates.

## Acceptance Criteria
- [ ] Users can edit a message and the thread correctly truncates and resubmits.
- [ ] "Confirm Undo" modal appears with correct warning text.
- [ ] Users can branch a thread, and the new thread contains the correct historical context.
- [ ] Auto-naming and icons work correctly for newly branched/created threads.
- [ ] Submenu buttons appear on hover and match the project UI theme.

## Out of Scope
- Visual "Branch Tree" or Project Manager divergence view (Future Goal).
- Editing assistant messages.
