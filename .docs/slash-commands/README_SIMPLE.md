# Slash Commands - Simple Implementation Guide

## Quick Summary

**Slash commands** are custom prompts users create and save. When they type `/command-name` in chat, the full prompt gets injected into the message before sending to the agent.

### Example
- User creates command: `name: summarize`, `prompt: Summarize in 5 bullet points`
- User types: `/summarize this article`
- Agent receives: `Summarize in 5 bullet points\n\nthis article`

---

## Storage

Commands are stored as **JSON files in user's workspace** using the existing Suna file storage API.

**Location**: `/workspace/slash-commands/{command-name}.json`

**File format**:
```json
{
  "name": "summarize",
  "prompt": "Summarize in 5 bullet points...",
  "description": "Quick summarization"
}
```

---

## Implementation Steps

### Step 1: Create Hooks

**`hooks/useSlashCommands.ts`** - Load commands from storage

```typescript
import { useQuery } from '@tanstack/react-query';
import { API_URL } from '@/lib/api';

export function useSlashCommands() {
  return useQuery({
    queryKey: ['slash-commands'],
    queryFn: async () => {
      // List /slash-commands folder
      const res = await fetch(`${API_URL}/files?path=/slash-commands`);
      if (!res.ok) return [];
      
      const files = await res.json();
      
      // Load each JSON file
      return Promise.all(
        files.map(file =>
          fetch(`${API_URL}/files?path=/slash-commands/${file.name}`)
            .then(r => r.json())
        )
      );
    }
  });
}
```

**`hooks/useSlashCommandManager.ts`** - Create/Edit/Delete

```typescript
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
      if (!res.ok) throw new Error('Save failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['slash-commands'] })
  });

  const deleteCommand = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`${API_URL}/files`, {
        method: 'DELETE',
        body: JSON.stringify({ path: `/slash-commands/${name}.json` })
      });
      if (!res.ok) throw new Error('Delete failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['slash-commands'] })
  });

  return { createCommand, deleteCommand };
}
```

---

### Step 2: Message Processing

**`lib/slashCommands.ts`** - Inject prompts

```typescript
export interface SlashCommand {
  name: string;
  prompt: string;
  description?: string;
}

export function detectCommand(message: string): { name: string; args: string } | null {
  const match = message.match(/^\/(\w+(?:-\w+)*)\s*(.*)/);
  return match ? { name: match[1], args: match[2] } : null;
}

export function processMessage(message: string, commands: SlashCommand[]): string {
  const detection = detectCommand(message);
  if (!detection) return message;

  const command = commands.find(c => c.name === detection.name);
  if (!command) return message;

  return `${command.prompt}\n\n${detection.args}`.trim();
}

export function validateCommandName(name: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(name) && name.length <= 32;
}
```

---

### Step 3: Components

**`components/slash-commands/SlashCommandAutocomplete.tsx`**

```typescript
import { useState, useEffect } from 'react';

interface Props {
  isOpen: boolean;
  input: string;
  commands: Array<{ name: string; description?: string }>;
  onSelect: (name: string) => void;
}

export function SlashCommandAutocomplete({ isOpen, input, commands, onSelect }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = commands.filter(c => c.name.includes(input.replace('/', '')));

  if (!isOpen || filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto z-50">
      {filtered.map((cmd, i) => (
        <button
          key={cmd.name}
          onClick={() => onSelect(cmd.name)}
          className={`w-full text-left px-4 py-3 border-b border-gray-200 last:border-b-0 ${
            i === selectedIndex ? 'bg-blue-500 text-white' : 'hover:bg-gray-50'
          }`}
        >
          <div className="font-mono font-medium text-sm">/{cmd.name}</div>
          {cmd.description && (
            <div className={`text-xs ${i === selectedIndex ? 'text-blue-100' : 'text-gray-500'}`}>
              {cmd.description}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
```

**`components/slash-commands/SlashCommandModal.tsx`**

```typescript
import { useState } from 'react';
import { validateCommandName } from '@/lib/slashCommands';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cmd: { name: string; prompt: string; description?: string }) => Promise<void>;
}

export function SlashCommandModal({ isOpen, onClose, onSave }: Props) {
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    
    if (!name.trim()) {
      setError('Command name required');
      return;
    }
    
    if (!validateCommandName(name)) {
      setError('Name: alphanumeric/hyphens only, max 32 chars');
      return;
    }
    
    if (!prompt.trim()) {
      setError('Prompt required');
      return;
    }

    await onSave({ name: name.toLowerCase(), prompt, description });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 max-h-96 overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">Create Slash Command</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Command Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="summarize"
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter the prompt template..."
              className="w-full px-3 py-2 border rounded h-24 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Quick summary"
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          {error && <div className="text-red-500 text-sm">{error}</div>}
        </div>

        <div className="flex gap-2 mt-6 justify-end">
          <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
```

**`components/slash-commands/SlashCommandManager.tsx`**

```typescript
import { useState } from 'react';
import { useSlashCommands } from '@/hooks/useSlashCommands';
import { useSlashCommandManager } from '@/hooks/useSlashCommandManager';
import { SlashCommandModal } from './SlashCommandModal';

export function SlashCommandManager() {
  const { data: commands = [] } = useSlashCommands();
  const { createCommand, deleteCommand } = useSlashCommandManager();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">My Slash Commands</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
        >
          + New
        </button>
      </div>

      {commands.length === 0 ? (
        <p className="text-gray-500 text-sm">No commands yet. Create one to get started!</p>
      ) : (
        <div className="space-y-2">
          {commands.map((cmd) => (
            <div key={cmd.name} className="p-3 border rounded hover:bg-gray-50">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-mono font-medium">/{cmd.name}</div>
                  {cmd.description && <div className="text-xs text-gray-500">{cmd.description}</div>}
                </div>
                <button
                  onClick={() => deleteCommand.mutate(cmd.name)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <SlashCommandModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={(cmd) => createCommand.mutate(cmd)}
      />
    </div>
  );
}
```

---

### Step 4: Chat Input Integration

In your `ChatInput` component, add slash command support:

```typescript
import { processMessage } from '@/lib/slashCommands';
import { useSlashCommands } from '@/hooks/useSlashCommands';
import { SlashCommandAutocomplete } from '@/components/slash-commands';

function ChatInput() {
  const [messageText, setMessageText] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const { data: commands = [] } = useSlashCommands();

  const handleSendMessage = async () => {
    // Process command injection
    const processedMessage = processMessage(messageText, commands);
    
    // Send to thread/agent
    await sendMessageToThread(processedMessage);
    
    setMessageText('');
    setShowAutocomplete(false);
  };

  return (
    <div className="relative">
      <input
        value={messageText}
        onChange={(e) => {
          setMessageText(e.target.value);
          setShowAutocomplete(e.target.value.includes('/'));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            handleSendMessage();
          }
        }}
        placeholder="Message... (type / for commands)"
        className="w-full px-4 py-3 border rounded"
      />
      
      <SlashCommandAutocomplete
        isOpen={showAutocomplete}
        input={messageText}
        commands={commands}
        onSelect={(name) => {
          // Replace typed command with selected one
          const beforeSlash = messageText.split('/')[0];
          setMessageText(`${beforeSlash}/${name} `);
        }}
      />

      <button
        onClick={handleSendMessage}
        className="absolute right-2 bottom-3 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
      >
        Send
      </button>
    </div>
  );
}
```

---

## Testing

```typescript
import { processMessage, detectCommand } from '@/lib/slashCommands';

// Test detection
const detection = detectCommand('/summarize this article');
// → { name: 'summarize', args: 'this article' }

// Test processing
const commands = [
  { name: 'summarize', prompt: 'Summarize in 5 bullets' }
];

const result = processMessage('/summarize this article', commands);
// → 'Summarize in 5 bullets\n\nthis article'
```

---

## Files to Create

```
frontend/src/
├─ hooks/
│  ├─ useSlashCommands.ts
│  └─ useSlashCommandManager.ts
├─ lib/
│  └─ slashCommands.ts
└─ components/slash-commands/
   ├─ SlashCommandAutocomplete.tsx
   ├─ SlashCommandModal.tsx
   └─ SlashCommandManager.tsx
```

---

## Done! 🎉

That's it. The implementation uses:
- ✅ Existing file storage API
- ✅ React hooks + React Query
- ✅ Simple message processing
- ✅ No backend changes needed

