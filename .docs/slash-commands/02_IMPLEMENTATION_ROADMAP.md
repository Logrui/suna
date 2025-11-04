# Slash Commands - Implementation Roadmap

## Quick Reference

**Feature**: User-created custom prompts (slash commands) for reuse in chat
**Scope**: Frontend-only MVP using LocalStorage
**Estimated Timeline**: 2-3 weeks
**Team**: Frontend developers
**Dependencies**: None (no backend changes)

---

## Phase 1: MVP Implementation (Weeks 1-2)

### Week 1: Core Infrastructure

**Task 1.1: Type Definitions & Interfaces**
- [ ] Create `types/slashCommands.ts`
- [ ] Define `SlashCommand`, `SlashCommandError` types
- [ ] Define hook interfaces

**Task 1.2: Storage Layer**
- [ ] Create `lib/slash-commands/storage.ts`
- [ ] Implement LocalStorage read/write functions
- [ ] Add validation and error handling
- [ ] Add export/import utilities (for backup)

**Task 1.3: Message Processing**
- [ ] Create `lib/slash-commands/processor.ts`
- [ ] Implement command regex matching
- [ ] Implement prompt injection logic
- [ ] Add unit tests

**Task 1.4: Context & Hooks**
- [ ] Create `contexts/SlashCommandContext.tsx`
- [ ] Implement `useSlashCommands()` hook
- [ ] Implement `useSlashCommandManager()` hook
- [ ] Implement `useSlashCommandAutocomplete()` hook

### Week 1 Deliverable
- ✅ Core infrastructure complete
- ✅ Storage working with LocalStorage
- ✅ Message processing logic tested
- ✅ All hooks functional

---

### Week 2: UI Components & Integration

**Task 2.1: Chat Input Enhancement**
- [ ] Modify `components/chat/ChatInput.tsx`
- [ ] Detect `/` character in input
- [ ] Trigger autocomplete on command detection
- [ ] Integrate command processing in message sending

**Task 2.2: Autocomplete Component**
- [ ] Create `components/slash-commands/SlashCommandAutocomplete.tsx`
- [ ] VS Code-style dropdown UI
- [ ] Keyboard navigation (arrows, enter, escape)
- [ ] Display command name + description
- [ ] Hover preview (optional)

**Task 2.3: Command Manager UI**
- [ ] Create `components/slash-commands/SlashCommandManager.tsx`
- [ ] List view of all commands
- [ ] Edit/Delete action buttons
- [ ] Navigate to creation flow

**Task 2.4: Command Creation Modal**
- [ ] Create `components/slash-commands/SlashCommandModal.tsx`
- [ ] Form for command name + prompt
- [ ] Real-time validation
- [ ] Live preview of injection
- [ ] Save/Cancel buttons

**Task 2.5: Integration**
- [ ] Wire up SlashCommandProvider in app root
- [ ] Add Command Manager to settings
- [ ] Test end-to-end workflow

### Week 2 Deliverable
- ✅ All UI components working
- ✅ Full user workflow tested
- ✅ VS Code-style autocomplete functional
- ✅ Ready for QA

---

## Phase 2: Polish & Testing (Week 3)

**Task 3.1: Testing**
- [ ] Unit tests for storage layer
- [ ] Unit tests for message processor
- [ ] Component tests for autocomplete
- [ ] E2E testing of full workflow

**Task 3.2: UX Polish**
- [ ] Smooth transitions/animations
- [ ] Loading states
- [ ] Error messages
- [ ] Empty states

**Task 3.3: Performance**
- [ ] Optimize LocalStorage access
- [ ] Memoize components
- [ ] Test with large command lists (100+ commands)

**Task 3.4: Documentation**
- [ ] User guide: How to create commands
- [ ] User guide: How to use commands
- [ ] Developer guide: How to extend
- [ ] Add example commands to repo

### Week 3 Deliverable
- ✅ Feature complete and polished
- ✅ Comprehensive test coverage
- ✅ User documentation
- ✅ Ready for production

---

## Detailed Task Breakdown

### File Checklist

#### Frontend Files to Create
```
frontend/src/
├─ types/slashCommands.ts                          # Type definitions
├─ lib/slash-commands/
│  ├─ storage.ts                                   # LocalStorage utils
│  ├─ processor.ts                                 # Message injection
│  └─ validator.ts                                 # Validation logic
├─ contexts/SlashCommandContext.tsx                # Context provider
├─ hooks/
│  ├─ useSlashCommands.ts                         # Get all commands
│  ├─ useSlashCommandManager.ts                   # CRUD operations
│  └─ useSlashCommandAutocomplete.ts              # Autocomplete logic
└─ components/slash-commands/
   ├─ index.ts                                     # Barrel export
   ├─ SlashCommandAutocomplete.tsx                # Dropdown component
   ├─ SlashCommandModal.tsx                       # Create/Edit form
   └─ SlashCommandManager.tsx                     # Settings UI
```

#### Files to Modify
```
frontend/src/
├─ components/chat/ChatInput.tsx                   # Add slash command support
├─ app/layout.tsx (or app root)                    # Add SlashCommandProvider
└─ (Optional) settings page                        # Add Command Manager link
```

---

## Testing Strategy

### Unit Tests
```typescript
// storage.ts
✓ Load commands from LocalStorage
✓ Save commands to LocalStorage
✓ Handle LocalStorage quota exceeded
✓ Export commands as JSON
✓ Import commands from JSON

// processor.ts
✓ Match slash command regex
✓ Inject prompt correctly
✓ Handle non-command messages
✓ Handle unknown commands
✓ Preserve rest of message after command

// validator.ts
✓ Validate command name (alphanumeric, hyphens)
✓ Detect duplicate names
✓ Validate prompt length
✓ Reject empty prompts
```

### Component Tests
```typescript
// SlashCommandAutocomplete
✓ Show dropdown on command match
✓ Filter commands by input
✓ Keyboard navigation
✓ Select command on enter
✓ Close on escape

// SlashCommandModal
✓ Validate form inputs
✓ Save new command
✓ Update existing command
✓ Show live preview
✓ Handle errors

// SlashCommandManager
✓ List all commands
✓ Delete command
✓ Edit command
✓ Empty state
```

### E2E Tests
```
User Journey 1: Create Command
✓ Open command manager
✓ Click "New Command"
✓ Enter name "summarize"
✓ Enter prompt
✓ Save command
✓ Command appears in list

User Journey 2: Use Command
✓ Type "/" in chat
✓ Autocomplete shows commands
✓ Select "summarize"
✓ Type additional text
✓ Send message
✓ Command prompt is injected
✓ Agent receives full message

User Journey 3: Edit Command
✓ Open command manager
✓ Click edit on command
✓ Modify prompt
✓ Save changes
✓ Changes reflected in autocomplete

User Journey 4: Delete Command
✓ Open command manager
✓ Click delete on command
✓ Confirm deletion
✓ Command removed from list
✓ Autocomplete updated
```

---

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| **LocalStorage** for MVP storage | No backend changes needed, fast, offline-capable |
| **Context API** for state management | Already used in Suna, simpler than Redux for this scope |
| **Regex matching** for command detection | Fast, efficient pattern matching |
| **MD files** reference in docs | Easy to understand, documented in spec |
| **VS Code autocomplete** styling | Familiar to developers, clean UI |
| **5000 char limit** on prompts | Balance between flexibility and LocalStorage limits |

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| LocalStorage quota exceeded | Users can't save more commands | Show warning, offer cleanup utility, add export/import |
| Command name conflicts | Confusion, lost commands | Validate uniqueness, show error with suggestions |
| Message injection fails | Commands don't work | Test regex thoroughly, add error handling, fallback to plain text |
| Poor autocomplete UX | Commands not discovered | Implement VS Code-like keyboard nav, fuzzy matching |
| Data loss on browser clear | User frustration | Add export feature, show warning, migrate to backend in Phase 2 |

---

## Success Metrics

- **Adoption**: % of users who create at least 1 command
- **Usage**: Average commands created per user
- **Frequency**: Commands used in X% of messages
- **Satisfaction**: User feedback on usefulness
- **Performance**: Autocomplete latency < 100ms
- **Stability**: No crashes or data loss reports

---

## Future Enhancements (Post-MVP)

1. **Backend Persistence**
   - Sync commands across devices
   - Enable sharing with team
   - Track usage analytics

2. **Advanced Features**
   - Command parameters: `/summarize length=short`
   - Conditional logic: `if topic == 'code' then ...`
   - Command composition: Reference other commands
   - Variable substitution: `{{selection}}`, `{{date}}`

3. **Community**
   - Public command marketplace
   - Clone/fork popular commands
   - Ratings and reviews

4. **Integration**
   - Slash commands in all input fields
   - Mobile app support
   - Voice command triggering

---

## Questions Before Starting

1. ✅ Default set of example commands to seed users with?
   - Answer: Will create standard set (summarize, draft-email, brainstorm, etc.)

2. ✅ Should commands support markdown formatting in prompts?
   - Answer: Yes, basic markdown allowed

3. ✅ Keyboard shortcut to open command manager?
   - Answer: Future enhancement, not needed for MVP

4. ✅ Analytics/tracking of command usage?
   - Answer: Not needed for MVP, can add in Phase 2

5. ✅ Mobile support?
   - Answer: Not priority for MVP, backend needed for mobile anyway

---

## Sign-Off Checklist

Before marking MVP complete:

- [ ] All type definitions finalized
- [ ] Storage layer fully tested
- [ ] Message processing tested with edge cases
- [ ] All 4 components built and tested
- [ ] Chat input integration complete
- [ ] Autocomplete working smoothly
- [ ] Command manager accessible from settings
- [ ] Create, read, update, delete all working
- [ ] E2E workflow tested multiple times
- [ ] VS Code UI styling complete
- [ ] Error handling comprehensive
- [ ] Performance acceptable (< 100ms for autocomplete)
- [ ] Documentation written
- [ ] Code reviewed and approved
- [ ] Ready for user testing

