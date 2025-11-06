# Slash Commands: Implementation Plan

**Last Updated**: November 5, 2025  
**Current Status**: Phase 1-2 Complete, Phase 3 In Progress (Testing & Polish)

## Overview

This document outlines the implementation plan for the Slash Commands feature in the Suna frontend, including current progress and remaining work.

---

## 🚀 Path A Implementation (Ready to Code!)

**New detailed guides created:**

1. **PATH-A-DETAILED-IMPLEMENTATION.md** ← Start here!
   - Complete architecture explanation
   - Answers: Where does download happen? How is content returned? How do we extract prompts?
   - Memory flow diagrams
   - Request/response examples
   - Step-by-step code with explanations

2. **PATH-A-IMPLEMENTATION-CHECKLIST.md**
   - Phase-by-phase checklist
   - Testing procedures
   - Common issues and fixes
   - Success criteria

**TL;DR What Happens:**
- Backend: S3 download happens **in memory** (not to disk)
- File bytes are immediately decoded to text
- Text is returned as JSON: `{"content": "...", "filename": "..."}`
- Frontend receives JSON and uses content directly as prompt
- Prompt injected into message: `${content}\n\n${userText}`

**Total Time:** ~1.5 hours
**Files Changed:** 2 (backend api.py, frontend useSlashCommands.ts)
**Database Changes:** 0 (zero schema changes!) ✅

---

## ✅ Completed Work

### Phase 1: Foundation ✓ COMPLETE

#### 1.1 Core Utilities ✅ COMPLETE
**File**: `frontend/src/lib/slashCommands.ts`

- ✅ TypeScript interface `SlashCommand` created
  ```typescript
  interface SlashCommand {
    name: string;
    description: string;
    prompt: string;
  }
  ```
- ✅ `parseMarkdownCommand()` - Implemented (parses YAML frontmatter and content)
  - Status: Created but currently unused (KB API provides parsed data)
- ✅ `detectCommand()` - Implemented (regex pattern matching)
  - Status: Created but replaced by activeCommand state tracking
- ✅ `injectPrompt()` - Implemented (combines prompt + user text)
  - Status: Created but replaced by inline logic in chat-input submit handler

**Note**: Some functions created during initial implementation but replaced by better approaches:
- Direct KB API usage eliminated need for markdown parsing
- Active command state tracking is cleaner than pattern detection on submit
- Inline prompt injection provides better context and clarity

---

#### 1.2 Data Fetching Hook ✅ COMPLETE
**File**: `frontend/src/hooks/useSlashCommands.ts`

**Architecture**: Uses Knowledge Base API instead of file system
- ✅ `getAuthHeaders()` - Gets Supabase session token for API requests
- ✅ `initializeSlashCommands()` - Auto-initialization function:
  - ✅ Fetches all KB folders via `GET /knowledge-base/folders`
  - ✅ Checks if `Suna` folder exists
  - ✅ Creates `Suna` folder if missing via `POST /knowledge-base/folders`
  - ✅ Fetches existing entries via `GET /knowledge-base/folders/{id}/entries`
  - ✅ Compares existing files with example commands (case-insensitive)
  - ✅ Only uploads missing commands (prevents duplicates)
  - ✅ Uploads `.md` files via `POST /knowledge-base/folders/{id}/upload`
  - ✅ Updates entry `summary` field with description via `PUT /knowledge-base/{entry_id}`
- ✅ `useSlashCommands()` - React Query hook:
  - ✅ Calls `initializeSlashCommands()` on first load
  - ✅ Fetches all entries from Suna folder
  - ✅ Maps entries to `SlashCommand[]` format:
    - `name`: Filename without extension
    - `description`: Entry `summary` field
    - `prompt`: Entry `content` field
  - ✅ Returns fallback hardcoded commands on error
  - ✅ React Query caching with 5-minute stale time
  - ✅ Retry logic (2 retries)

**Example Commands** (hardcoded in EXAMPLE_COMMANDS constant):
```typescript
[
  { name: 'summarize', description: '...', content: '...' },
  { name: 'draft-email', description: '...', content: '...' },
  { name: 'brainstorm', description: '...', content: '...' },
  { name: 'explain-simple', description: '...', content: '...' }
]
```

**API Endpoints Used**:
- `GET /knowledge-base/folders` - List all folders
- `POST /knowledge-base/folders` - Create Suna folder
- `GET /knowledge-base/folders/{id}/entries` - Fetch commands
- `POST /knowledge-base/folders/{id}/upload` - Upload .md files
- `PUT /knowledge-base/{entry_id}` - Update entry metadata

---

#### 1.3 Autocomplete Component ✅ COMPLETE
**File**: `frontend/src/components/slash-commands/SlashCommandAutocomplete.tsx`

**Component Structure**:
```typescript
interface SlashCommandAutocompleteProps {
  isOpen: boolean;
  commands: SlashCommand[];
  selectedIndex: number;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
}
```

**Features Implemented**:
- ✅ Compact dropdown UI positioned `absolute bottom-full` (appears above input)
- ✅ Props: `isOpen`, `commands`, `selectedIndex`, `onSelect`, `onClose`
- ✅ Displays command name with `/` prefix and description
- ✅ Visual feedback:
  - ✅ Hover state: `hover:bg-accent`
  - ✅ Selected state: `bg-accent`
  - ✅ Border between items: `border-b border-border`
- ✅ Auto-scrolling with `useRef` and `scrollIntoView`:
  - ✅ `listRef` for container
  - ✅ `selectedItemRef` for selected item
  - ✅ Smooth scroll behavior
- ✅ Keyboard navigation support (parent component handles events)
- ✅ Custom scrollbar: `scrollbar-thin scrollbar-thumb-muted-foreground/30`
- ✅ Compact sizing:
  - Padding: `px-2 py-1` (items), `px-2 py-1` (footer)
  - Icon: `w-4 h-4` with `/` symbol
  - Text: `text-[13px]` (command name), `text-[11px]` (description)
  - Max height: `max-h-48`
- ✅ Footer with keyboard hints: `text-[9px]`
  - "↑↓ Navigate"
  - "↵ Select"  
  - "Esc Close"
- ✅ Returns null when `!isOpen` or no commands

**Styling**:
- Uses shadcn/ui components: `bg-popover`, `border-border`
- Matches chat element design system
- Responsive max-width: `max-w-md`

---

### Phase 2: Integration ✓ MOSTLY COMPLETE

#### 2.1 Chat Input Integration ✅ COMPLETE
**File**: `frontend/src/components/thread/chat-input/chat-input.tsx`

- ✅ Imported `useSlashCommands` hook
- ✅ Imported `SlashCommandAutocomplete` component
- ✅ State management for autocomplete UI (showSlashCommands, slashCommandFilter, selectedCommandIndex, activeSlashCommand)
- ✅ `/` detection triggers autocomplete
- ✅ Real-time filtering as user types
- ✅ Keyboard event handling:
  - ✅ `/` key - Shows autocomplete
  - ✅ `ArrowUp`/`ArrowDown` - Navigate autocomplete
  - ✅ `Enter` - Select command (while autocomplete is open)
  - ✅ `Escape` - Close autocomplete
  - ✅ `Enter` - Send message (when autocomplete is closed)
- ✅ `activeSlashCommand` state tracks selected command
- ✅ Visual highlighting overlay for `/command` text (bg-primary/10, text-primary)
- ✅ Prompt injection on submit:
  - ✅ Extracts user text after `/command`
  - ✅ Replaces `/command` with full prompt
  - ✅ Appends user text after prompt
  - ✅ Clears active command after sending
- ✅ Clears active command when user edits/removes it

**Implementation Details**:
- Uses overlay div with `pointer-events-none` for highlighting
- Maintains textarea as background with relative z-index
- Conditional rendering of highlight when activeSlashCommand exists
- Pattern matching to extract user text: `/^\\/${commandName}\\s*/`

---

#### 2.2 Example Commands ✅ COMPLETE
**Location**: Auto-created in Knowledge Base `Suna` folder

**Files Created** (as `.md` files):

1. ✅ **summarize.md**
   - Description: "Summarize content into 5 bullet points."
   - Prompt: "Summarize the following content in 5 bullet points, focusing on key takeaways and important numbers or dates."

2. ✅ **draft-email.md**
   - Description: "Draft a professional email."
   - Prompt: "Draft a professional email for the following scenario. Keep it to 2-3 paragraphs, use a formal tone, and include a clear call-to-action."

3. ✅ **brainstorm.md**
   - Description: "Generate 10 creative ideas."
   - Prompt: "Generate 10 creative ideas for the following topic. Be diverse, think outside the box, and explain each idea briefly."

4. ✅ **explain-simple.md**
   - Description: "Explain complex concepts simply."
   - Prompt: "Explain the following in simple terms that a 10-year-old could understand. Avoid technical jargon and use real-world examples if possible."

**Storage Details**:
- Format: `.md` files (Markdown)
- MIME type: `text/markdown`
- Description stored in: `entry.summary` field
- Prompt content stored in: `entry.content` field
- Auto-created on first page load if Suna folder is empty
- Duplicate prevention: Checks existing filenames before upload

---

## ✅ Issues Resolved (Verified November 5, 2025)

### Issue #1: File Upload - FIXED ✅
**Status**: RESOLVED  
- ✅ 500 errors fixed
- ✅ Example commands created successfully
- ✅ No duplicate files on refresh
- ✅ Entries have correct metadata

### Issue #2: Console Logging - FIXED ✅
**Status**: RESOLVED  
- ✅ All console messages correct

### Issue #3: Code Cleanup - DONE ✅
**Status**: RESOLVED  
- ✅ `slashCommands.ts` clean and minimal
- ✅ Only 11 lines (exports SlashCommand interface only)

---

## 🎯 Remaining Work

### Phase 2: Complete Bug Fixes

#### 2.3 Fix File Upload ⏳
---

## 🎯 Next Steps (Priority Order)

### Phase 3: Testing & Polish (CURRENT PRIORITY)

#### 3.1 Manual E2E Testing ⏳
- [ ] Delete all files from Suna folder
- [ ] Refresh page, verify 4 commands created
- [ ] Refresh again, verify no duplicates
- [ ] Type `/sum` → autocomplete appears
- [ ] Select command → `/summarize` appears highlighted
- [ ] Type additional text
- [ ] Send message → verify agent receives full prompt + text
- [ ] Test with all 4 example commands
- [ ] Test clearing input resets active command

**Time**: 30 minutes

---

#### 3.2 UX Improvements (Optional)
- [ ] Add loading state while initializing Suna folder
- [ ] Show toast notification if commands fail to load
- [ ] Better error handling for auth failures
- [ ] Consider adding "reload commands" button if fetch fails

**Time**: 1 hour

---

#### 3.3 Edge Cases (Optional)
- [ ] Test when user is not authenticated
- [ ] Test when Knowledge Base API is down
- [ ] Test when Suna folder is deleted externally
- [ ] Test typing `/` multiple times
- [ ] Test backspacing over `/command`
- [ ] Test pasting text that starts with `/`

**Time**: 1 hour

---### Phase 4: Documentation & Polish ⏳

#### 4.1 Update Documentation
- [x] Update `01_SPECIFICATIONS.md` with current implementation
- [x] Update `05_PHASE1_IMPLEMENTATION.md` with completion status
- [x] Create `CURRENT_STATUS.md` with detailed overview
- [ ] Update this file (`04_PLAN.md`) with progress - IN PROGRESS
- [ ] Add JSDoc comments to all functions
- [ ] Document edge cases and error handling

**Time**: 30 minutes

---

#### 4.2 User Guide
- [ ] Create user-facing documentation on how to use slash commands
- [ ] Document how to add custom commands via Knowledge Base
- [ ] Add screenshots/GIFs of feature in action
- [ ] Update README with slash commands feature

**Time**: 30 minutes

---

## 📊 Progress Summary

| Phase | Status | Completion | Details |
|-------|--------|------------|---------|
| Phase 1: Foundation | ✅ Complete | 100% | All utilities, hooks, and UI components built |
| Phase 2: Integration | 🔧 In Progress | 90% | Chat input fully integrated, file upload has issues |
| Phase 3: Testing & Polish | ⏳ Not Started | 0% | Waiting for file upload fix |
| Phase 4: Documentation | 🔧 In Progress | 70% | Specs updated, plan updated, need user guide |
| **Overall** | **🔧 In Progress** | **75%** | Core functionality complete, debugging file upload |

**Files Created**: 3 new files
- `frontend/src/lib/slashCommands.ts` (67 lines)
- `frontend/src/hooks/useSlashCommands.ts` (220 lines)
- `frontend/src/components/slash-commands/SlashCommandAutocomplete.tsx` (104 lines)

**Files Modified**: 1 existing file
- `frontend/src/components/thread/chat-input/chat-input.tsx` (~150 lines added/modified)

**Total Lines of Code**: ~541 lines added

---

## 🚀 Next Steps (Priority Order)

1. **HIGH**: Debug and fix 500 error on file upload
2. **HIGH**: Test file creation works end-to-end
3. **MEDIUM**: Clean up unused code
4. **MEDIUM**: Complete E2E testing checklist
5. **LOW**: Add UX improvements (loading states, error handling)
6. **LOW**: Final documentation and user guide

---

## 📊 Progress Summary (Updated November 5, 2025)

| Phase | Status | Completion | Details |
|-------|--------|------------|---------|
| Phase 1: Foundation | ✅ Complete | 100% | All utilities, hooks, and UI components built |
| Phase 2: Integration | ✅ Complete | 100% | Chat input fully integrated, file upload working |
| Phase 3: Testing & Polish | ⏳ In Progress | 0% | Ready to begin E2E testing |
| Phase 4: Documentation | 🔧 In Progress | 80% | Specs updated, plan updated, need user guide |
| **Overall** | **🔧 In Progress** | **87%** | Core functionality complete and working, testing phase next |

**Timeline to Completion**:
- E2E Testing: 30 minutes
- UX Polish (optional): 1 hour
- Edge Cases (optional): 1 hour
- Documentation: 30 minutes
- **Estimated Total**: 2-3 hours to full completion

---

## ✅ Success Criteria (Updated)

Current Status:
- ✅ Typing "/" triggers autocomplete
- ✅ Autocomplete filters commands in real-time
- ✅ Arrow keys navigate the dropdown
- ✅ Enter selects a command
- ✅ `/command` shows with visual highlight
- ✅ Files created in Suna folder (WORKING)
- ✅ No console errors
- ⏳ Command prompt injected into message (needs E2E testing)
- ⏳ Message sent successfully to agent (needs E2E testing)
- ⏳ All edge cases handled gracefully (needs testing)

---

## Architecture Changes from Original Plan

### What Changed:

1. **Storage Mechanism**:
   - Original: Sandbox files in `/Knowledge/prompts/`
   - Current: Knowledge Base API with `Suna` folder
   - Reason: Better integration, no sandbox dependency

2. **File Format**:
   - Original: Markdown with YAML frontmatter
   - Current: Plain markdown, description in `entry.summary`
   - Reason: Simpler, uses existing KB metadata

3. **Command Detection**:
   - Original: Parse `/command` pattern and inject immediately
   - Current: Track `activeSlashCommand` state, inject on submit
   - Reason: Better UX - shows `/command` to user, injects for agent

4. **Visual Feedback**:
   - Original: No visual indication
   - Current: Highlighted `/command` with colored background
   - Reason: Better UX - user knows command is active

---

## Rollout Plan

1. ✅ Create `feature/slash-commands` branch
2. ⏳ Fix remaining bugs
3. ⏳ Complete testing
4. ⏳ Merge to main/develop
5. ⏳ Deploy to staging
6. ⏳ User acceptance testing
7. ⏳ Production deployment

---
4. Merge to main branch
5. Deploy to production

---

## Future Enhancements

- [ ] User can create/edit commands via UI (instead of manual file creation)
- [ ] Share commands with team
- [ ] Command categories/organization
- [ ] Usage analytics
- [ ] Command versioning
- [ ] Import/export commands
