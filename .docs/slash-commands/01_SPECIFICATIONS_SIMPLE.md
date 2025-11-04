# Slash Commands - Simplified Specification

## Overview

Slash commands are user-created custom prompts. Type `/command-name` in chat → autocomplete shows matching commands → select one → prompt injected into message → sent to agent.

---

## How It Works

### User Perspective

```
1. Type "/" in chat input
   ↓
2. See dropdown with matching commands
   ↓
3. Select a command (e.g., "summarize")
   ↓
4. Type additional text
   ↓
5. Message sent with command prompt injected
```

### Example

**Saved command:**
- **name**: `summarize`
- **prompt**: `Summarize this in 5 bullet points focusing on key takeaways`

**User types**: `/summarize this article about AI`

**Agent receives**: `Summarize this in 5 bullet points focusing on key takeaways\n\nthis article about AI`

---

## Storage

Commands are stored as **Markdown files** in a designated folder.

**Storage location:** `Knowledge/prompts/` folder

**File format:** Plain markdown

```markdown
# Summarize

Summarize in 5 bullet points, focusing on key takeaways
```

**Filename:** `{command-name}.md` (e.g., `summarize.md`)

---

## Features

### 1. Create Command
- UI form: Command name + prompt text
- Validate: Name alphanumeric + hyphens only
- Save: Post to file storage API
- Instant availability in autocomplete

### 2. Use Command
- Type "/" triggers autocomplete
- Filter commands by name (case-insensitive)
- Show: name + description
- Select: Enter/Arrow keys
- Inject prompt into message

### 3. List Commands
- Show all user's saved commands
- Edit button: Open modal to change prompt
- Delete button: Remove from storage
- Empty state: Prompt to create first command

### 4. Edit Command
- Open modal with existing prompt
- Modify name/prompt
- Save overwrites file

### 5. Delete Command
- Confirm deletion
- Remove from storage
- Update UI

---

## File Structure

### Frontend Code

```
frontend/src/
├─ components/slash-commands/
│  ├─ SlashCommandAutocomplete.tsx    # Dropdown
│  ├─ SlashCommandModal.tsx           # Create/Edit form
│  └─ SlashCommandManager.tsx         # Settings UI (list, edit, delete)
│
├─ hooks/
│  ├─ useSlashCommands.ts            # Fetch commands from storage
│  └─ useSlashCommandManager.ts       # Create/Edit/Delete mutations
│
└─ lib/
   └─ slashCommands.ts                # Helper functions (injection, validation)
```

### Data Files (User Workspace)

```
/workspace/
├─ slash-commands/
│  ├─ summarize.json
│  ├─ draft-email.json
│  └─ brainstorm.json
```

---

## API Integration

### Fetch Commands

```typescript
// List files in Knowledge/prompts folder
const response = await fetch('/api/files?path=Knowledge/prompts');
const files = await response.json();

// Load each MD file
const commands = await Promise.all(
  files
    .filter(f => f.name.endsWith('.md'))
    .map(file => 
      fetch(`/api/files/content?path=Knowledge/prompts/${file.name}`)
        .then(r => r.text())
    )
);
```

### Save Command

```typescript
// Create or update command file
await fetch('/api/files', {
  method: 'POST',
  body: JSON.stringify({
    path: `Knowledge/prompts/${commandName}.md`,
    content: commandContent
  })
});
```

### Delete Command

```typescript
// Delete command file
await fetch('/api/files', {
  method: 'DELETE',
  body: JSON.stringify({
    path: `Knowledge/prompts/${commandName}.md`
  })
});
```

---

## UI Components

### 1. Autocomplete Dropdown (VS Code Style)

```
/summarize
┌─────────────────────────────┐
│ 🔹 summarize                │
│    Summarize in 5 bullets   │
├─────────────────────────────┤
│ 🔹 summarize-detailed       │
│    Detailed summary report  │
└─────────────────────────────┘
```

**Features:**
- Shows on "/" input
- Filters by typed text
- Keyboard navigation (arrow keys, enter, escape)
- Selected item highlighted

### 2. Command Manager (in Settings)

```
My Slash Commands           [+ New]
─────────────────────────────────
summarize                   [✎ 🗑]
  Summarize in 5 bullets
  Created: Nov 4, 2025

draft-email                 [✎ 🗑]
  Draft professional emails
  Created: Nov 3, 2025
```

**Features:**
- List all commands
- Edit: Opens modal
- Delete: Removes command
- New: Create new command

### 3. Create/Edit Modal

```
Command Name: [summarize        ]
Prompt:       [Summarize in...  ]
Description:  [Quick summary    ]

[Cancel] [Save]
```

**Validation:**
- Name: Required, 1-32 chars, alphanumeric + hyphens
- Prompt: Required, 1-2000 chars
- No duplicate names

---

## Message Processing

### Detection

```typescript
function detectCommand(message: string): { name: string; args: string } | null {
  const match = message.match(/^\/(\w+(?:-\w+)*)\s*(.*)/);
  return match ? { name: match[1], args: match[2] } : null;
}
```

### Injection

```typescript
function processMessage(message: string, commands: Command[]): string {
  const detection = detectCommand(message);
  if (!detection) return message;

  const command = commands.find(c => c.name === detection.name);
  if (!command) return message;

  return `${command.prompt}\n\n${detection.args}`.trim();
}
```

---

## Code Examples

### Hook: Load Commands

```typescript
// hooks/useSlashCommands.ts
import { useQuery } from '@tanstack/react-query';
import { API_URL } from '@/lib/api';

export function useSlashCommands() {
  return useQuery({
    queryKey: ['slash-commands'],
    queryFn: async () => {
      // List files in /slash-commands folder
      const res = await fetch(`${API_URL}/files?path=/slash-commands`);
      if (!res.ok) return [];
      
      const files = await res.json();
      
      // Load each command JSON file
      const commands = await Promise.all(
        files.map(file =>
          fetch(`${API_URL}/files?path=/slash-commands/${file.name}`)
            .then(r => r.json())
        )
      );
      
      return commands;
    }
  });
}
```

### Hook: Manage Commands

```typescript
// hooks/useSlashCommandManager.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/lib/api';

export function useSlashCommandManager() {
  const qc = useQueryClient();

  const createCommand = useMutation({
    mutationFn: async (cmd: { name: string; prompt: string; description?: string }) => {
      const res = await fetch(`${API_URL}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `/slash-commands/${cmd.name}.json`,
          content: JSON.stringify(cmd)
        })
      });
      if (!res.ok) throw new Error('Failed to save command');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['slash-commands'] })
  });

  const deleteCommand = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`${API_URL}/files`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `/slash-commands/${name}.json`
        })
      });
      if (!res.ok) throw new Error('Failed to delete command');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['slash-commands'] })
  });

  return { createCommand, deleteCommand };
}
```

### Component: Autocomplete

```typescript
// components/slash-commands/SlashCommandAutocomplete.tsx
import { useState, useEffect } from 'react';
import { useSlashCommands } from '@/hooks/useSlashCommands';

interface Props {
  isOpen: boolean;
  input: string;
  onSelect: (commandName: string) => void;
  onClose: () => void;
}

export function SlashCommandAutocomplete({ isOpen, input, onSelect, onClose }: Props) {
  const { data: commands = [] } = useSlashCommands();
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter commands by input
  const filtered = commands.filter(c => c.name.includes(input));

  if (!isOpen || filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 w-full bg-white border rounded shadow-lg">
      {filtered.map((cmd, i) => (
        <button
          key={cmd.name}
          onClick={() => onSelect(cmd.name)}
          className={`w-full text-left px-3 py-2 ${
            i === selectedIndex ? 'bg-blue-500 text-white' : ''
          }`}
        >
          <div className="font-mono text-sm">{cmd.name}</div>
          <div className="text-xs text-gray-500">{cmd.description}</div>
        </button>
      ))}
    </div>
  );
}
```

### Component: Chat Integration

```typescript
// In ChatInput component
import { processMessage } from '@/lib/slashCommands';

function ChatInput() {
  const { data: commands = [] } = useSlashCommands();
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  function handleSendMessage(userInput: string) {
    // Process command injection
    const processedMessage = processMessage(userInput, commands);
    
    // Send to agent
    sendMessageToThread(processedMessage);
  }

  function handleInputChange(value: string) {
    setShowAutocomplete(value.includes('/'));
  }

  return (
    <div>
      <input
        value={messageText}
        onChange={(e) => {
          setMessageText(e.target.value);
          handleInputChange(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleSendMessage(messageText);
            setMessageText('');
          }
        }}
      />
      <SlashCommandAutocomplete
        isOpen={showAutocomplete}
        input={messageText}
        onSelect={(cmd) => {
          // Insert command name
          setMessageText(messageText.replace(/\/\w*$/, `/${cmd} `));
        }}
        onClose={() => setShowAutocomplete(false)}
      />
    </div>
  );
}
```

---

## Example Commands (Pre-built)

Users can create these common commands:

1. **summarize**
   - Prompt: `Summarize in 5 bullet points, focusing on key takeaways`

2. **draft-email**
   - Prompt: `Draft a professional email. Keep to 2-3 paragraphs, formal tone, clear CTA`

3. **brainstorm**
   - Prompt: `Generate 10 creative ideas. Be diverse, think outside the box, explain briefly`

4. **explain-simple**
   - Prompt: `Explain in simple terms a 10-year-old could understand. Avoid jargon`

5. **code-review**
   - Prompt: `Review this code. Check for bugs, performance, security, and suggest improvements`

---

## Implementation Checklist

### Phase 1: Core (2 days)
- [ ] Create hook to fetch commands from storage
- [ ] Create hook to save/delete commands
- [ ] Implement message processor function
- [ ] Build autocomplete component
- [ ] Integrate autocomplete with chat input

### Phase 2: Management UI (1 day)
- [ ] Create command modal (create/edit form)
- [ ] Create command manager (list view)
- [ ] Add settings navigation

### Phase 3: Polish (1 day)
- [ ] Test autocomplete keyboard nav
- [ ] Handle edge cases
- [ ] Add error messages
- [ ] Performance testing

---

## Success Criteria

✅ User can create custom commands  
✅ Commands saved to file storage  
✅ "/" triggers autocomplete  
✅ Autocomplete filters and shows commands  
✅ Command injection works correctly  
✅ User can edit/delete commands  
✅ No backend changes needed  
✅ Ready for testing  

