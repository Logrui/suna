# GitHub-Compatible Slash Commands - Quick Start

**Version**: 1.0  
**Status**: ✅ Implemented & Ready  
**Date**: November 12, 2025

---

## What's New

The slash commands system now supports **GitHub-compatible `.prompt.md` files** alongside traditional command files. This allows you to create commands that reference instruction files instead of embedding prompts directly.

### Two Command Types

| Type | File Pattern | Behavior | Example |
|------|--------------|----------|---------|
| **Standard** | `[name].md` | Injects full prompt text | `summarize.md` |
| **GitHub-Compatible** | `[name].prompt.md` | Injects file reference only | `feature.prompt.md` |

---

## Quick Example

### Standard Command
**File**: `summarize.md`  
**Content**: `Summarize the following in 5 bullet points...`

**When used**:
```
User types: /summarize Create a summary of this document
Agent receives: Summarize the following in 5 bullet points...

Create a summary of this document
```

### GitHub-Compatible Command
**File**: `feature.prompt.md`  
**Content**: `Instructions for implementing a feature...` (any content)

**When used**:
```
User types: /feature Create a login form
Agent receives: Follow instructions in feature.prompt.md

Create a login form
```

---

## Usage

### 1. Create a Command File in Knowledge Base

Upload to the **`Suna`** folder in your Knowledge Base:

**For GitHub-format**:
- Filename: `[command-name].prompt.md`
- Content: Any instructions (they're not injected)
- Example: `feature.prompt.md`, `bugfix.prompt.md`, `docs.prompt.md`

**For Standard format**:
- Filename: `[command-name].md`
- Content: The prompt to inject
- Example: `summarize.md`, `explain-simple.md`

### 2. Use the Command in Chat

Type `/` to open autocomplete and select your command:

```
/feature Create a form component
```

GitHub-format commands show a **GITHUB** badge:
```
/feature        [GITHUB]
Follow instructions in feature.prompt.md
```

### 3. What Gets Sent to the Agent

**Standard commands** inject the prompt:
```
Summarize the following...
<user message>
```

**GitHub commands** inject the reference:
```
Follow instructions in feature.prompt.md

<user message>
```

---

## Visual Indicators

### In the Autocomplete Menu

GitHub-compatible commands display a distinct badge:

```
┌─────────────────────────────────────┐
│ /summarize                          │
│ Summarize content into 5 bullet ... │
├─────────────────────────────────────┤
│ /feature                   [GITHUB] │  ← Shows badge
│ Follow instructions in fea...        │
├─────────────────────────────────────┤
│ /bugfix                    [GITHUB] │
│ Follow instructions in bug...        │
└─────────────────────────────────────┘
```

---

## File Organization

All commands live in the **`Suna`** folder in Knowledge Base:

```
Knowledge Base/
└── Suna/
    ├── summarize.md              (Standard)
    ├── explain-simple.md         (Standard)
    ├── feature.prompt.md         (GitHub-format)
    ├── bugfix.prompt.md          (GitHub-format)
    ├── docs.prompt.md            (GitHub-format)
    └── review.prompt.md          (GitHub-format)
```

---

## Keyboard Navigation

Same as standard commands:

| Key | Action |
|-----|--------|
| `/` | Open autocomplete |
| `↑` / `↓` | Navigate commands |
| `Enter` | Select command |
| `Esc` | Close autocomplete |
| `Type` | Filter commands |

---

## Common Patterns

### Documentation Command
```
Filename: docs.prompt.md
Content: (Can be blank or contain internal notes)

Usage:
/docs Write documentation for the API
Agent receives: "Follow instructions in docs.prompt.md\n\nWrite documentation for the API"
```

### Feature Request Command
```
Filename: feature.prompt.md
Content: (Can be blank)

Usage:
/feature Build a dark mode toggle
Agent receives: "Follow instructions in feature.prompt.md\n\nBuild a dark mode toggle"
```

### Bug Fix Command
```
Filename: bugfix.prompt.md
Content: (Can be blank)

Usage:
/bugfix The login button doesn't respond to clicks
Agent receives: "Follow instructions in bugfix.prompt.md\n\nThe login button doesn't respond to clicks"
```

---

## Troubleshooting

### Command Not Showing?
- ✓ Check filename: must be `[name].prompt.md` (exact format)
- ✓ Upload to **Suna** folder in Knowledge Base
- ✓ Refresh the browser (clear React Query cache if needed)
- ✓ Check browser console for errors

### Badge Not Showing?
- ✓ Filename must end with `.prompt.md` (case-insensitive)
- ✓ Refresh and check again

### Wrong Injection?
- ✓ Standard `.md` files inject the full content
- ✓ `.prompt.md` files inject only the reference
- ✓ This is by design - check your filename pattern

---

## API Details

### Endpoint Used
```
GET /knowledge-base/entries/{entry_id}/content
```

Retrieves the full file content (though GitHub-format ignores it and uses the reference instead).

### Detection Logic
Files are automatically categorized on the frontend:

```typescript
const isGitHubFormat = /\.prompt\.md$/i.test(filename);

if (isGitHubFormat) {
  // Use: "Follow instructions in [filename]"
  message = `Follow instructions in ${filename}\n\n${userMessage}`;
} else {
  // Use: Full file content
  message = `${fileContent}\n\n${userMessage}`;
}
```

---

## Next Steps

- ✅ Create your first `.prompt.md` command file
- ✅ Upload to the Suna folder
- ✅ Open chat and try it with `/command-name`
- ✅ Mix and match standard and GitHub-format commands

For more details, see **COMPLETE_GUIDE.md**.
