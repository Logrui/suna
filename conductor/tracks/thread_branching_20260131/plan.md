# Implementation Plan: Thread Branching and Message Editing

## Phase 1: Research and Backend Foundation
- [x] Task: Research existing thread creation and message cloning logic in the backend.
    - [x] Analyze `backend/core/agentpress/thread_manager.py` for message handling.
    - [x] Identify where the auto-naming and icon assignment pipeline is failing.
- [x] Task: Fix the Thread Auto-Naming and Icon Pipeline.
    - [x] Debug the naming service and ensure it triggers correctly for new threads.
    - [x] Verify icons are correctly assigned based on thread content/intent.
- [x] Task: Implement Server-Side Branching Endpoint.
    - [x] Create a new endpoint `/threads/{thread_id}/branch` that accepts a `message_id`.
    - [x] Logic: Clone the thread and all messages up to (and including) the target message into a new thread.
- [x] User Manual Verification for Phase 1.
- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Frontend Infrastructure & Modularization
- [x] Task: Implement Sidebar Agent Pinning (Favorites).
    - [x] Add pinning support to `NavAgents` and `NavAgentsView`.
    - [x] Use Supabase metadata for persistence to allow starring agents.
- [x] Task: Enhance Thread Naming for Branching.
    - [x] Implement context-aware naming using LLM (GPT-5 Nano) with history compression.
    - [x] Update backend to use new naming logic for branched threads.
- [x] Task: Create Modular UI Components for Message Actions.
    - [x] Implement `MessageActions` component (Copy, Edit, Branch).
    - [x] Implement `ThreadUndoModal` for the "Confirm Undo" warning.
    - [x] Implement Auto-Naming for branches (Replacing `ThreadBranchModal`).
- [x] Task: Integrate Submenu into User Message Bubbles.
    - [x] Update the message bubble component to support hover-triggered visibility for the submenu.
    - [x] Ensure the submenu is correctly positioned and themed per guidelines.
- [x] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Message Editing & Undo Logic
- [x] Task: Implement In-Place Editing State.
    - [x] Add state management to toggle "edit mode" for a specific user message.
    - [x] Swap message text with a Lexical or standard text area during edit mode.
- [x] Task: Implement Edit Submission and Thread Truncation.
    - [x] Connect the "Update" button to the "Confirm Undo" modal.
    - [x] Implement the backend call to delete subsequent messages and update the current one.
    - [x] Trigger a thread resubmission (resend) after the edit is saved.
- [x] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)

## Phase 4: Branching & Copy Implementation
- [x] Task: Connect Branching UI to Backend.
    - [x] Implement the submission logic (Direct Branching).
    - [x] Handle navigation to the new `thread_id` upon successful server response.
- [x] Task: Implement 'Copy Message' Utility.
    - [x] Add clipboard API interaction to the Copy button in the submenu.
- [x] Task: Final Polishing and Integration Testing.
    - [x] Verify the entire flow from editing a message to branching a thread.
    - [x] Ensure auto-naming works during the branching process.
- [x] Task: Conductor - User Manual Verification 'Phase 4' (Protocol in workflow.md)
