# 🚀 Slash Commands Documentation

## Start Here

Choose your documentation level:

### **Quick Start** ⚡ (30 minutes)
👉 Read **`README_SIMPLE.md`**

Contains everything you need to implement:
- Overview
- 5 step-by-step code examples
- Testing code
- Files to create

This is the **full, working implementation** - copy/paste ready.

---

### **Detailed Spec** 📖 (1 hour)
👉 Read **`01_SPECIFICATIONS_SIMPLE.md`**

More details on:
- How it works
- Storage via file API
- Features breakdown
- More examples

---

## What Are Slash Commands?

Users create custom prompts and reuse them in chat:

```
User creates:
  name: summarize
  prompt: Summarize in 5 bullet points

User types in chat:
  /summarize this article about AI

Agent receives:
  Summarize in 5 bullet points
  
  this article about AI
```

---

## Implementation Overview

### Storage
Commands stored in user's workspace as JSON files in `/slash-commands/` folder

### API
Uses existing Suna file storage API

### Components Needed
1. `SlashCommandAutocomplete` - Dropdown UI
2. `SlashCommandModal` - Create/Edit form
3. `SlashCommandManager` - List commands in settings
4. Two hooks for fetching and managing commands
5. Message processor function

### Effort
**~2-3 days** for one developer

---

## Legacy Documentation

These are the original (overly complex) docs - you don't need them:
- `00_README.md` - Complex overview
- `01_SPECIFICATIONS.md` - 2000+ line spec
- `02_IMPLEMENTATION_ROADMAP.md` - Week-by-week plan
- `03_TECHNICAL_REFERENCE.md` - API reference
- `04_UI_UX_DESIGN_GUIDE.md` - Design system
- `DOCUMENTATION_SUMMARY.md` - Meta guide

**Why not use these?**
- Too complicated for MVP
- Assume LocalStorage instead of file API
- Overly detailed

---

## Quick File Reference

### Read These
1. `README_SIMPLE.md` - **All the code you need**
2. `01_SPECIFICATIONS_SIMPLE.md` - **Background + examples**

### Ignore These (Legacy)
- `00_README.md`
- `01_SPECIFICATIONS.md`
- `02_IMPLEMENTATION_ROADMAP.md`
- `03_TECHNICAL_REFERENCE.md`
- `04_UI_UX_DESIGN_GUIDE.md`
- `DOCUMENTATION_SUMMARY.md`

---

## TL;DR

1. Create 2 hooks (fetch commands, CRUD operations)
2. Create message processor (inject prompt into message)
3. Create 3 components (autocomplete, modal, manager)
4. Add to chat input
5. Commands stored in `/workspace/slash-commands/`
6. Uses existing Suna file storage API

Done! ✅

