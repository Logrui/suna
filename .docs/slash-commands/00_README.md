# Slash Commands - Quick Start Guide

## Documentation Overview

This directory contains comprehensive documentation for implementing the Slash Commands feature in Kortix/Suna.

### Files in This Directory

1. **01_SPECIFICATIONS.md** ← START HERE
   - Complete feature overview
   - User-facing features
   - Technical architecture
   - UI/UX design specifications
   - File structure overview

2. **02_IMPLEMENTATION_ROADMAP.md**
   - Week-by-week implementation plan
   - Detailed task breakdown
   - Testing strategy
   - Risk mitigation
   - Success criteria

3. **03_TECHNICAL_REFERENCE.md**
   - API reference for all hooks and components
   - Storage layer documentation
   - Message processing logic
   - Type definitions
   - Testing examples

4. **04_UI_UX_DESIGN_GUIDE.md**
   - Visual design system
   - Component styling specs
   - Color schemes and typography
   - Example commands
   - Accessibility guidelines

---

## Feature Summary

**Slash Commands** are user-created, reusable prompt templates that enable task automation within the chat interface.

### In Plain English

Users can create commands like:
- `/summarize` - Quickly summarize any content
- `/draft-email` - Write professional emails
- `/brainstorm` - Generate creative ideas

When they type `/summarize this article`, the system automatically injects a saved prompt:
```
Summarize the following content in 5-10 bullet points.
Highlight key takeaways and include any important numbers or dates.

this article
```

The full text is sent to the agent, saving users from retyping the same instructions.

---

## Key Decisions

✅ **Frontend-only MVP** - No backend changes needed  
✅ **LocalStorage for persistence** - Fast, simple, local  
✅ **VS Code autocomplete style** - Familiar, modern UI  
✅ **Simple prompt templates** - User-friendly creation  
✅ **Per-user commands** - Not shared initially  

---

## Architecture at a Glance

```
┌─────────────────────────────────────────┐
│ Chat Interface                          │
│  ┌───────────────────────────────────┐  │
│  │ /summarize this article           │  │ ← User types
│  │ ▼ Autocomplete suggestions        │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                    ↓
        ┌───────────────────────────┐
        │ Message Processor         │
        │ (lib/slash-commands/)     │
        │ - Detect command          │
        │ - Inject prompt           │
        │ - Validate                │
        └───────────────────────────┘
                    ↓
        ┌───────────────────────────┐
        │ LocalStorage              │
        │ (Browser storage)         │
        │ - Save commands           │
        │ - Load commands           │
        │ - Export/Import           │
        └───────────────────────────┘
                    ↓
        ┌───────────────────────────┐
        │ Full processed message    │
        │ sent to Agent             │
        └───────────────────────────┘
```

---

## File Structure

```
frontend/src/
├─ types/
│  └─ slashCommands.ts              # Type definitions
│
├─ lib/slash-commands/
│  ├─ storage.ts                    # LocalStorage utilities
│  ├─ processor.ts                  # Message injection logic
│  └─ validator.ts                  # Validation logic
│
├─ contexts/
│  └─ SlashCommandContext.tsx        # Global context provider
│
├─ hooks/
│  ├─ useSlashCommands.ts           # Read commands
│  ├─ useSlashCommandManager.ts     # CRUD operations
│  └─ useSlashCommandAutocomplete.ts # Autocomplete logic
│
└─ components/slash-commands/
   ├─ index.ts                      # Barrel export
   ├─ SlashCommandAutocomplete.tsx  # Dropdown UI
   ├─ SlashCommandModal.tsx         # Create/Edit modal
   └─ SlashCommandManager.tsx       # Settings UI
```

---

## Implementation Phases

### Phase 1: MVP (Weeks 1-2)
**Deliverable**: Core functionality working

- [ ] Create types and interfaces
- [ ] Implement storage layer (LocalStorage)
- [ ] Implement message processor
- [ ] Create React context + hooks
- [ ] Build autocomplete component
- [ ] Build command manager UI
- [ ] Integrate with chat input
- [ ] Test end-to-end

### Phase 2: Polish (Week 3)
**Deliverable**: Production-ready

- [ ] Comprehensive testing
- [ ] Error handling
- [ ] Performance optimization
- [ ] User documentation
- [ ] QA and bug fixes

### Phase 3: Future Enhancements
**Not in MVP scope**

- Backend persistence
- Command sharing
- Analytics
- Advanced templates with parameters
- Mobile app support

---

## Getting Started

### 1. Read the Specifications
Start with `01_SPECIFICATIONS.md` to understand:
- What slash commands are
- How users create and use them
- Technical architecture
- UI/UX design

### 2. Review the Roadmap
Check `02_IMPLEMENTATION_ROADMAP.md` for:
- Week-by-week tasks
- Detailed breakdown of each task
- Testing strategy
- Success criteria

### 3. Reference the Technical Docs
Use `03_TECHNICAL_REFERENCE.md` while coding:
- API reference
- Hook signatures
- Component props
- Storage schema
- Type definitions

### 4. Follow the Design Guide
Implement UI using `04_UI_UX_DESIGN_GUIDE.md`:
- Color schemes
- Component styling
- Layout specifications
- Example commands

---

## Development Commands

```bash
cd frontend

# Install dependencies (if needed)
npm install

# Start development server
npm run dev

# Run tests
npm run test

# Build for production
npm run build

# Format code
npm run format
```

---

## Testing Checklist

### Unit Tests
- [ ] Storage layer (save, load, delete)
- [ ] Message processor (injection logic)
- [ ] Validator (command name, prompt)

### Component Tests
- [ ] Autocomplete (display, navigation, selection)
- [ ] Modal (validation, save, cancel)
- [ ] Manager (CRUD operations)

### Integration Tests
- [ ] Create command → Save → Use in chat
- [ ] Edit command → Updates reflected
- [ ] Delete command → No longer available
- [ ] Autocomplete filters correctly
- [ ] Message sends with injected prompt

### E2E Tests
- [ ] Full user journey: Create → Use → Edit → Delete

---

## Common Questions

### Q: Where is data stored?
**A:** LocalStorage in the browser. Each user's commands are stored in their local browser storage.

### Q: Can commands have parameters?
**A:** Not in MVP. This is a Phase 2 enhancement (e.g., `/summarize length=short`).

### Q: Can users share commands?
**A:** Not in MVP. Sharing requires backend support in Phase 2.

### Q: What happens if browser storage is cleared?
**A:** Commands are lost. Users can export commands for backup (future feature).

### Q: How many commands can a user create?
**A:** Theoretically unlimited, but LocalStorage has ~5MB limit per domain. Average is 50-100 commands.

### Q: Can users edit or delete commands?
**A:** Yes, both are supported in the Command Manager UI.

### Q: Do commands work on mobile?
**A:** MVP targets web/desktop. Mobile support depends on backend integration.

---

## Key Components

### SlashCommandProvider
Wraps the app to provide global slash command context.

```tsx
<SlashCommandProvider>
  <App />
</SlashCommandProvider>
```

### useSlashCommands Hook
Get all available commands.

```tsx
const { commands } = useSlashCommands();
```

### useSlashCommandManager Hook
Create, update, delete commands.

```tsx
const { createCommand, deleteCommand } = useSlashCommandManager();
```

### SlashCommandAutocomplete
Dropdown showing matching commands.

```tsx
<SlashCommandAutocomplete
  isOpen={isOpen}
  matches={matches}
  selectedIndex={selectedIndex}
  onSelect={handleSelect}
  onClose={handleClose}
/>
```

### SlashCommandModal
Form for creating/editing commands.

```tsx
<SlashCommandModal
  isOpen={isOpen}
  onClose={handleClose}
  onSave={handleSave}
/>
```

---

## Integration Points

### Chat Input Component
Modify `components/chat/ChatInput.tsx`:

```tsx
import { useSlashCommands } from '@/hooks/useSlashCommands';
import { processMessage } from '@/lib/slash-commands/processor';

function ChatInput() {
  const { commands } = useSlashCommands();
  
  async function handleSend(userMessage: string) {
    // Process message with slash commands
    const { processed } = processMessage(userMessage, commands);
    
    // Send to agent
    await sendMessageToThread(processed);
  }
  
  return (
    <input
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          handleSend(e.currentTarget.value);
        }
      }}
    />
  );
}
```

### Settings Page
Add Command Manager link:

```tsx
<button onClick={() => setShowCommandManager(true)}>
  ⚙️ Manage Slash Commands
</button>

<SlashCommandManager isOpen={showCommandManager} />
```

---

## Performance Tips

1. **Memoize commands list**
   ```tsx
   const filteredCommands = useMemo(
     () => commands.filter(c => c.name.includes(input)),
     [commands, input]
   );
   ```

2. **Debounce autocomplete**
   ```tsx
   const debouncedSearch = useCallback(
     debounce((value) => setFiltered(value), 200),
     []
   );
   ```

3. **Lazy load modal**
   ```tsx
   const CommandModal = lazy(() => import('./CommandModal'));
   ```

4. **Use React.memo for autocomplete items**
   ```tsx
   const CommandItem = React.memo(({ command, selected }) => (...));
   ```

---

## Debugging

### Enable Debug Logging
```tsx
// In SlashCommandContext.tsx
const DEBUG = process.env.NEXT_PUBLIC_DEBUG_SLASH_COMMANDS === 'true';

if (DEBUG) {
  console.log('[SlashCommand]', 'Action:', action);
}
```

### Check LocalStorage
```javascript
// In browser console
JSON.parse(localStorage.getItem('slash_commands_user123'))
```

### Test Message Processing
```javascript
import { processMessage } from '@/lib/slash-commands/processor';

const result = processMessage('/summarize my article', commands);
console.log(result.processed);
```

---

## Deployment Checklist

Before pushing to production:

- [ ] All tests passing
- [ ] No console errors or warnings
- [ ] Autocomplete responsive and smooth
- [ ] Commands persist after page refresh
- [ ] Commands work across different threads
- [ ] Error messages clear and helpful
- [ ] Performance acceptable (< 100ms autocomplete)
- [ ] Accessibility checked (ARIA labels, keyboard nav)
- [ ] Mobile layout tested
- [ ] Dark/light mode working
- [ ] Documentation complete
- [ ] Code reviewed and approved

---

## Support & Questions

For questions during implementation:

1. **Specifications questions** → Check `01_SPECIFICATIONS.md`
2. **API/Type questions** → Check `03_TECHNICAL_REFERENCE.md`
3. **Design questions** → Check `04_UI_UX_DESIGN_GUIDE.md`
4. **Task/Timeline questions** → Check `02_IMPLEMENTATION_ROADMAP.md`

---

## Success Criteria

✅ Users can create custom slash commands  
✅ Commands are saved and persisted  
✅ Autocomplete works smoothly (< 100ms)  
✅ Commands are injected into messages correctly  
✅ Full end-to-end workflow tested  
✅ VS Code-like UI implemented  
✅ No backend changes required  
✅ Ready for user testing  

---

## Next Steps

1. **Review** this documentation with the team
2. **Discuss** any questions or concerns
3. **Finalize** any design or architecture decisions
4. **Assign** tasks based on `02_IMPLEMENTATION_ROADMAP.md`
5. **Start coding** with specifications in mind
6. **Test thoroughly** following the testing strategy
7. **Deploy** when all criteria are met

---

Good luck with implementation! 🚀

