# 🚀 Slash Commands - Start Here

## What Are Slash Commands?

Custom prompts stored as **Markdown files** that users can reuse in chat.

### Example

1. User creates command in settings
2. Saved as: `Knowledge/prompts/summarize.md`
3. User types in chat: `/summarize this article`
4. System reads the MD file and injects its content
5. Agent receives: `[prompt content]\n\nthis article`

---

## Which Files to Read?

### If you have 20 minutes: 
📖 Read **`README_SIMPLE.md`**
- Has all the code examples you need
- Step-by-step implementation
- Copy/paste ready

### If you have 5 minutes:
� Read **`CORRECTION_SUMMARY.md`**
- Quick overview of the approach
- How it actually works

### If you want details:
📖 Read **`01_SPECIFICATIONS_SIMPLE.md`**
- Detailed feature spec
- More examples

---

## Quick Summary

### Frontend Scans Folder
```
Knowledge/prompts/
├─ summarize.md
├─ draft-email.md
└─ brainstorm.md
```

### User Types Command
```
/summarize this article
```

### System Injects Content
```
[Read summarize.md]
[Inject content into message]
[Send to agent]
```

---

## Implementation (7 Steps)

1. **Message processor** - Parse `/command` and inject content
2. **Fetch hook** - Scan `Knowledge/prompts/` folder
3. **Manager hook** - Create/Edit/Delete MD files
4. **Autocomplete component** - Show matching commands
5. **Modal component** - Create/Edit form
6. **Manager component** - Settings UI
7. **Chat integration** - Add autocomplete to chat input

All code is in `README_SIMPLE.md`

---

## Files to Create

```
frontend/src/
├─ lib/slashCommands.ts
├─ hooks/
│  ├─ useSlashCommands.ts
│  └─ useSlashCommandManager.ts
└─ components/slash-commands/
   ├─ SlashCommandAutocomplete.tsx
   ├─ SlashCommandModal.tsx
   └─ SlashCommandManager.tsx
```

---

## Next Steps

1. ✅ Read `README_SIMPLE.md` (20 min)
2. ✅ Create the 6 files (copy code examples)
3. ✅ Add to chat input
4. ✅ Add to settings
5. ✅ Test

Done in ~2-3 days!

---

## Key Points

✅ Markdown files in `Knowledge/prompts/`  
✅ Frontend scans folder  
✅ Uses existing file storage API  
✅ No backend changes  
✅ Simple and straightforward  

---

👉 **Now go read `README_SIMPLE.md`** for the complete implementation!

