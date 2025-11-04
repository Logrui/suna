# Slash Commands: Implementation Plan

## Overview

This document outlines the step-by-step plan to implement the Slash Commands feature in the Suna frontend.

---

## Phase 1: Foundation (Day 1)

### 1.1 Create Core Utilities
**File**: `frontend/src/lib/slashCommands.ts`

- [ ] Implement `parseMarkdownCommand()` - Parse markdown files with frontmatter
- [ ] Implement `detectCommand()` - Detect `/command-name` pattern
- [ ] Implement `injectPrompt()` - Inject prompt into user message
- [ ] Add TypeScript interface `SlashCommand`

**Time**: ~30 mins

---

### 1.2 Create Data Fetching Hook
**File**: `frontend/src/hooks/useSlashCommands.ts`

- [ ] Fetch file list from `Knowledge/prompts/` directory
- [ ] Filter for `.md` files
- [ ] Fetch content of each markdown file
- [ ] Parse each file using `parseMarkdownCommand()`
- [ ] Return array of `SlashCommand` objects
- [ ] Cache results with React Query (5-minute stale time)

**Time**: ~45 mins

---

### 1.3 Create Autocomplete Component
**File**: `frontend/src/components/slash-commands/SlashCommandAutocomplete.tsx`

- [ ] Create dropdown UI component
- [ ] Accept props: `isOpen`, `commands`, `selectedIndex`, `onSelect`, `onClose`
- [ ] Display command name and description
- [ ] Highlight selected item
- [ ] Handle scrolling for long lists
- [ ] Add keyboard navigation support (arrow keys to select)

**Time**: ~45 mins

**Testing**:
- [ ] Manually test dropdown renders when open
- [ ] Test keyboard navigation (up/down arrows)
- [ ] Test item selection and highlighting

---

## Phase 2: Integration (Day 2)

### 2.1 Modify Chat Input Component
**File**: `frontend/src/components/chat/ChatInput.tsx`

- [ ] Import `useSlashCommands` hook
- [ ] Import `SlashCommandAutocomplete` component
- [ ] Detect `/` character in input to trigger autocomplete
- [ ] Filter commands based on typed text after `/`
- [ ] Handle keyboard events:
  - [ ] `/` key - Show autocomplete
  - [ ] `ArrowUp`/`ArrowDown` - Navigate autocomplete
  - [ ] `Enter` - Select command (while autocomplete is open)
  - [ ] `Escape` - Close autocomplete
  - [ ] `Enter` - Send message (when autocomplete is closed)
- [ ] Process message with `injectPrompt()` before sending
- [ ] Pass filtered commands to autocomplete component

**Time**: ~1.5 hours

**Testing**:
- [ ] Type "/" and see autocomplete appear
- [ ] Type "/sum" and see commands filtered
- [ ] Navigate with arrow keys
- [ ] Select command with Enter
- [ ] Command prompt injected correctly into message
- [ ] Message sent to agent with full prompt

---

### 2.2 Create Command Examples
**File**: `Knowledge/prompts/*.md`

- [ ] Create `summarize.md`
- [ ] Create `draft-email.md`
- [ ] Create `brainstorm.md`
- [ ] Create `explain-simple.md`
- [ ] Create `code-review.md`
- [ ] Create `create-todo.md`

Each file should contain YAML frontmatter with description and prompt content.

**Time**: ~20 mins

**Testing**:
- [ ] Each command file loads successfully
- [ ] Frontmatter parsed correctly
- [ ] Prompt content available for injection

---

## Phase 3: Testing & Polish (Day 3)

### 3.1 Unit Tests
**Files**: `lib/slashCommands.test.ts`, `hooks/useSlashCommands.test.ts`

- [ ] Test `parseMarkdownCommand()` with frontmatter
- [ ] Test `parseMarkdownCommand()` without frontmatter
- [ ] Test `detectCommand()` with various inputs
- [ ] Test `injectPrompt()` with different argument combinations
- [ ] Test command filtering logic

**Time**: ~45 mins

---

### 3.2 Integration Testing

- [ ] Test full user workflow:
  1. Type "/" in chat
  2. See autocomplete dropdown
  3. Type command name to filter
  4. Select command with keyboard
  5. Type additional text
  6. Send message
  7. Verify agent receives injected prompt

- [ ] Test edge cases:
  - [ ] No commands available
  - [ ] Command not found (fallback behavior)
  - [ ] Multiple "/" characters in message
  - [ ] Empty arguments after command

**Time**: ~1 hour

---

### 3.3 UI Polish

- [ ] Ensure autocomplete styling matches VS Code theme
- [ ] Test dropdown positioning (not cut off by chat input)
- [ ] Add smooth animations/transitions
- [ ] Test on mobile/responsive
- [ ] Test dark/light mode compatibility

**Time**: ~30 mins

---

### 3.4 Error Handling

- [ ] Handle missing `Knowledge/prompts/` directory gracefully
- [ ] Handle API failures when fetching files
- [ ] Handle malformed markdown files
- [ ] Show appropriate error messages/fallbacks

**Time**: ~30 mins

---

## Phase 4: Documentation & Cleanup (Optional)

### 4.1 Code Documentation

- [ ] Add JSDoc comments to all functions
- [ ] Document component props
- [ ] Add inline comments for complex logic

**Time**: ~15 mins

---

### 4.2 Demo/Example

- [ ] Create demo or screenshot of feature in action
- [ ] Document how users can add custom commands
- [ ] Add to release notes

**Time**: ~15 mins

---

## Timeline Summary

| Phase | Tasks | Estimated Time |
|-------|-------|-----------------|
| Phase 1 | Core utilities, Hook, Autocomplete component | 2 hours |
| Phase 2 | Chat input integration, Create examples | 1.75 hours |
| Phase 3 | Testing, Polish, Error handling | 2.5 hours |
| **Total** | **All phases** | **~6 hours** |

**Can be completed in**: 1-2 days with 1 developer

---

## Files to Create

```
frontend/src/
├─ lib/
│  └─ slashCommands.ts
├─ hooks/
│  └─ useSlashCommands.ts
├─ components/slash-commands/
│  └─ SlashCommandAutocomplete.tsx
└─ __tests__/
   ├─ lib/slashCommands.test.ts
   └─ hooks/useSlashCommands.test.ts

Knowledge/prompts/
├─ summarize.md
├─ draft-email.md
├─ brainstorm.md
├─ explain-simple.md
├─ code-review.md
└─ create-todo.md
```

---

## Files to Modify

- `frontend/src/components/chat/ChatInput.tsx` - Add autocomplete integration

---

## Success Criteria

- ✅ Typing "/" triggers autocomplete
- ✅ Autocomplete filters commands in real-time
- ✅ Arrow keys navigate the dropdown
- ✅ Enter selects a command
- ✅ Command prompt is injected into message
- ✅ Message sent successfully to agent with full prompt
- ✅ All edge cases handled gracefully
- ✅ No console errors
- ✅ Tests passing

---

## Rollout

1. Merge to `feature/slash-commands` branch
2. Test in staging environment
3. Gather user feedback
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
