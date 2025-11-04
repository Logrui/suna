# ✅ Slash Commands Documentation - CORRECTED

## What Changed

Fixed the implementation to use **Markdown files** instead of JSON/LocalStorage.

### Before (❌ Wrong)
- Commands stored as JSON files  
- Used LocalStorage  
- Complex storage logic

### Now (✅ Correct)
- Commands stored as **Markdown files** in `Knowledge/prompts/` folder
- Frontend scans the folder for `.md` files
- Uses existing file storage API
- Simple, straightforward approach

---

## How It Works

```
User creates command "summarize"
  ↓
Saved as: Knowledge/prompts/summarize.md
  ↓
User types: /summarize this article
  ↓
Frontend scans Knowledge/prompts/
  ↓
Finds summarize.md, reads content
  ↓
Injects content into message
  ↓
Agent receives full message
```

---

## Quick Start

### Main Documentation
👉 **`README_SIMPLE.md`** - Full working code examples (copy/paste ready)

Contains all 7 steps:
1. Message processor helper functions
2. Hook to fetch commands (scan folder)
3. Hook to manage commands (CRUD)
4. Autocomplete component
5. Modal component (create/edit)
6. Manager component (settings)
7. Chat input integration

### Detailed Spec
👉 **`01_SPECIFICATIONS_SIMPLE.md`** - Feature spec with examples

---

## File Structure

```
Knowledge/prompts/
├─ summarize.md
├─ draft-email.md
└─ brainstorm.md
```

Each `.md` file is one command. The filename (without `.md`) is the command name.

---

## Implementation Checklist

- [ ] Create `lib/slashCommands.ts` - Message processing
- [ ] Create `hooks/useSlashCommands.ts` - Fetch & scan folder
- [ ] Create `hooks/useSlashCommandManager.ts` - Create/Edit/Delete
- [ ] Create `SlashCommandAutocomplete.tsx` - Dropdown UI
- [ ] Create `SlashCommandModal.tsx` - Create/Edit form
- [ ] Create `SlashCommandManager.tsx` - Settings list
- [ ] Add to `ChatInput.tsx` - Autocomplete integration
- [ ] Add to Settings page - Command manager

---

## Code Example

### Scanning Folder (Hook)

```typescript
// Frontend scans Knowledge/prompts for .md files
const res = await fetch(`${API_URL}/files?path=Knowledge/prompts`);
const files = await res.json();

// Load each .md file
const commands = await Promise.all(
  files
    .filter(f => f.name.endsWith('.md'))
    .map(async f => {
      const content = await fetch(
        `${API_URL}/files/content?path=Knowledge/prompts/${f.name}`
      ).then(r => r.text());
      
      return {
        name: f.name.replace('.md', ''),
        content: content.trim()
      };
    })
);
```

### Message Injection

```typescript
function processMessage(message, commands) {
  const match = message.match(/^\/(\w+)\s*(.*)/);
  if (!match) return message;
  
  const [, cmdName, args] = match;
  const cmd = commands.find(c => c.name === cmdName);
  if (!cmd) return message;
  
  return `${cmd.content}\n\n${args}`.trim();
}

// Usage
processMessage('/summarize this article', commands);
// → "Summarize in 5 bullets\n\nthis article"
```

---

## Timeline

**~2-3 days** for one developer

- Day 1: Hooks + message processor
- Day 2: Components
- Day 3: Integration + testing

---

## Next Steps

1. Read `README_SIMPLE.md` (30 minutes)
2. Create the 6 files (follow checklist)
3. Implement step-by-step
4. Test

---

## Files to Use

**Read:**
- `README_SIMPLE.md` - Complete implementation
- `01_SPECIFICATIONS_SIMPLE.md` - Detailed spec

**Ignore (Legacy):**
- All other files in this directory

---

Done! 🎉

The documentation is now correct and uses Markdown files stored in `Knowledge/prompts/`.

