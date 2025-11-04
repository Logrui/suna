# Slash Commands - Complete Implementation Guide

## Overview

Slash commands are custom prompts stored as **Markdown files** in a designated folder. Users type `/command` in chat → frontend reads the MD file → injects content into message → sends to agent.

---

## How It Works

```
1. User creates command "summarize"
   ↓
2. Saved as: Knowledge/prompts/summarize.md
   ↓
3. User types: /summarize this article
   ↓
4. Frontend scans Knowledge/prompts/
   ↓
5. Finds summarize.md and reads content
   ↓
6. Injects content into message
   ↓
7. Agent receives: [prompt content]\n\nthis article
```

---

## Storage

**Location:** `Knowledge/prompts/{command-name}.md`

**File format:** Plain markdown

```markdown
# Summarize

Summarize this in 5 bullet points, focusing on key takeaways and important numbers.
```

The filename (without `.md`) becomes the command name.

---

## Implementation

### Step 1: Message Processing (`lib/slashCommands.ts`)

```typescript
export interface SlashCommand {
  name: string;
  content: string;
  fileName: string;
}

// Detect "/command args" pattern
export function detectCommand(message: string): { name: string; args: string } | null {
  const match = message.match(/^\/(\w+(?:-\w+)*)\s*(.*)/);
  return match ? { name: match[1], args: match[2] } : null;
}

// Inject command content into message
export function processMessage(message: string, commands: SlashCommand[]): string {
  const detection = detectCommand(message);
  if (!detection) return message;

  const command = commands.find(c => c.name === detection.name);
  if (!command) return message;

  if (detection.args) {
    return `${command.content}\n\n${detection.args}`.trim();
  }
  return command.content;
}

// Validate command name
export function validateCommandName(name: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(name) && name.length <= 32;
}
```

### Step 2: Fetch Hook (`hooks/useSlashCommands.ts`)

```typescript
import { useQuery } from '@tanstack/react-query';
import { API_URL } from '@/lib/api';

export interface SlashCommand {
  name: string;
  content: string;
  fileName: string;
}

export function useSlashCommands() {
  return useQuery({
    queryKey: ['slash-commands'],
    queryFn: async (): Promise<SlashCommand[]> => {
      try {
        // List files in Knowledge/prompts folder
        const res = await fetch(`${API_URL}/files?path=Knowledge/prompts`);
        if (!res.ok) return [];
        
        const files = await res.json();
        
        // Load each .md file
        const commands = await Promise.all(
          files
            .filter((f: any) => f.name.endsWith('.md'))
            .map(async (f: any) => {
              try {
                const contentRes = await fetch(
                  `${API_URL}/files/content?path=Knowledge/prompts/${f.name}`
                );
                const content = await contentRes.text();
                
                return {
                  name: f.name.replace('.md', ''),
                  content: content.trim(),
                  fileName: f.name
                };
              } catch (err) {
                console.error(`Failed to load ${f.name}:`, err);
                return null;
              }
            })
        );
        
        return commands.filter(Boolean) as SlashCommand[];
      } catch (error) {
        console.error('Error loading slash commands:', error);
        return [];
      }
    }
  });
}
```

### Step 3: Manager Hook (`hooks/useSlashCommandManager.ts`)

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_URL } from '@/lib/api';

export function useSlashCommandManager() {
  const qc = useQueryClient();

  const createCommand = useMutation({
    mutationFn: async ({ name, content }: { name: string; content: string }) => {
      const path = `Knowledge/prompts/${name.toLowerCase()}.md`;
      
      const res = await fetch(`${API_URL}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content })
      });
      
      if (!res.ok) throw new Error('Failed to save command');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['slash-commands'] })
  });

  const updateCommand = useMutation({
    mutationFn: async ({ name, content }: { name: string; content: string }) => {
      const path = `Knowledge/prompts/${name}.md`;
      
      const res = await fetch(`${API_URL}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content })
      });
      
      if (!res.ok) throw new Error('Failed to update command');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['slash-commands'] })
  });

  const deleteCommand = useMutation({
    mutationFn: async (name: string) => {
      const path = `Knowledge/prompts/${name}.md`;
      
      const res = await fetch(`${API_URL}/files`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });
      
      if (!res.ok) throw new Error('Failed to delete command');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['slash-commands'] })
  });

  return { createCommand, updateCommand, deleteCommand };
}
```

### Step 4: Autocomplete Component

```typescript
// components/slash-commands/SlashCommandAutocomplete.tsx
import { useState } from 'react';
import type { SlashCommand } from '@/hooks/useSlashCommands';

interface Props {
  isOpen: boolean;
  input: string;
  commands: SlashCommand[];
  onSelect: (name: string) => void;
  onClose: () => void;
}

export function SlashCommandAutocomplete({ isOpen, input, commands, onSelect, onClose }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Extract command name from input
  const inputCommand = input.match(/\/(\w*)/)?.[1] || '';
  
  // Filter commands
  const filtered = commands.filter(c => c.name.includes(inputCommand));

  if (!isOpen || filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto z-50">
      {filtered.map((cmd, i) => (
        <button
          key={cmd.name}
          onClick={() => {
            onSelect(cmd.name);
            onClose();
          }}
          className={`w-full text-left px-4 py-3 border-b border-gray-200 last:border-b-0 transition ${
            i === selectedIndex ? 'bg-blue-500 text-white' : 'hover:bg-gray-50'
          }`}
        >
          <div className="font-mono font-medium text-sm">/{cmd.name}</div>
          <div className={`text-xs ${i === selectedIndex ? 'text-blue-100' : 'text-gray-500'} line-clamp-1`}>
            {cmd.content.split('\n')[0]}
          </div>
        </button>
      ))}
    </div>
  );
}
```

### Step 5: Create/Edit Modal

```typescript
// components/slash-commands/SlashCommandModal.tsx
import { useState } from 'react';
import { validateCommandName } from '@/lib/slashCommands';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialName?: string;
  initialContent?: string;
  onSave: (name: string, content: string) => Promise<void>;
  isLoading?: boolean;
}

export function SlashCommandModal({
  isOpen,
  onClose,
  initialName = '',
  initialContent = '',
  onSave,
  isLoading = false
}: Props) {
  const [name, setName] = useState(initialName);
  const [content, setContent] = useState(initialContent);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    
    if (!name.trim()) {
      setError('Command name required');
      return;
    }
    
    if (!validateCommandName(name)) {
      setError('Name: alphanumeric + hyphens only, max 32 chars');
      return;
    }
    
    if (!content.trim()) {
      setError('Content required');
      return;
    }

    try {
      await onSave(name.toLowerCase(), content);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">
          {initialName ? 'Edit' : 'Create'} Slash Command
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Command Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="summarize"
              disabled={!!initialName}
              className="w-full px-3 py-2 border rounded font-mono"
            />
            <div className="text-xs text-gray-500 mt-1">
              lowercase, alphanumeric + hyphens
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Summarize in 5 bullet points..."
              className="w-full px-3 py-2 border rounded font-mono h-32 resize-none"
            />
            <div className="text-xs text-gray-500 mt-1">
              {content.length} characters
            </div>
          </div>

          {error && <div className="text-red-500 text-sm">{error}</div>}
        </div>

        <div className="flex gap-2 mt-6 justify-end">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Step 6: Command Manager (for Settings)

```typescript
// components/slash-commands/SlashCommandManager.tsx
import { useState } from 'react';
import { useSlashCommands } from '@/hooks/useSlashCommands';
import { useSlashCommandManager } from '@/hooks/useSlashCommandManager';
import { SlashCommandModal } from './SlashCommandModal';

export function SlashCommandManager() {
  const { data: commands = [] } = useSlashCommands();
  const { createCommand, updateCommand, deleteCommand } = useSlashCommandManager();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<string | null>(null);

  const editingCmd = editingCommand ? commands.find(c => c.name === editingCommand) : null;

  const handleSave = async (name: string, content: string) => {
    if (editingCommand) {
      await updateCommand.mutateAsync({ name: editingCommand, content });
      setEditingCommand(null);
    } else {
      await createCommand.mutateAsync({ name, content });
    }
  };

  const handleDelete = async (name: string) => {
    if (confirm(`Delete "/${name}" command?`)) {
      await deleteCommand.mutateAsync(name);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold">Slash Commands</h2>
        <button
          onClick={() => {
            setEditingCommand(null);
            setIsModalOpen(true);
          }}
          className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
        >
          + New
        </button>
      </div>

      {commands.length === 0 ? (
        <p className="text-gray-500 text-sm">No commands yet. Create one!</p>
      ) : (
        <div className="space-y-2">
          {commands.map((cmd) => (
            <div key={cmd.name} className="p-3 border rounded hover:bg-gray-50">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="font-mono font-medium text-sm">/{cmd.name}</div>
                  <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                    {cmd.content.split('\n')[0]}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingCommand(cmd.name);
                      setIsModalOpen(true);
                    }}
                    className="px-2 py-1 text-sm border rounded hover:bg-gray-100"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(cmd.name)}
                    className="px-2 py-1 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <SlashCommandModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCommand(null);
        }}
        initialName={editingCmd?.name}
        initialContent={editingCmd?.content}
        onSave={handleSave}
        isLoading={createCommand.isPending || updateCommand.isPending}
      />
    </div>
  );
}
```

### Step 7: Chat Input Integration

```typescript
// In your ChatInput component
import { useState } from 'react';
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
      <textarea
        value={messageText}
        onChange={(e) => {
          setMessageText(e.target.value);
          setShowAutocomplete(e.target.value.includes('/'));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
          }
        }}
        placeholder="Message... (type / for commands)"
        className="w-full px-4 py-3 border rounded resize-none"
        rows={3}
      />
      
      <SlashCommandAutocomplete
        isOpen={showAutocomplete}
        input={messageText}
        commands={commands}
        onSelect={(name) => {
          // Replace typed command
          const parts = messageText.split('/');
          const beforeSlash = parts[0];
          setMessageText(`${beforeSlash}/${name} `);
        }}
        onClose={() => setShowAutocomplete(false)}
      />

      <button
        onClick={handleSendMessage}
        className="absolute right-3 bottom-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Send
      </button>
    </div>
  );
}
```

---

## Files to Create

```
frontend/src/
├─ lib/
│  └─ slashCommands.ts
├─ hooks/
│  ├─ useSlashCommands.ts
│  └─ useSlashCommandManager.ts
└─ components/slash-commands/
   ├─ SlashCommandAutocomplete.tsx
   ├─ SlashCommandModal.tsx
   └─ SlashCommandManager.tsx
```

---

## Testing

```typescript
import { processMessage, detectCommand } from '@/lib/slashCommands';

// Test detection
const result = detectCommand('/summarize this article');
// → { name: 'summarize', args: 'this article' }

// Test processing
const commands = [
  {
    name: 'summarize',
    content: 'Summarize in 5 bullet points',
    fileName: 'summarize.md'
  }
];

const processed = processMessage('/summarize this article', commands);
// → 'Summarize in 5 bullet points\n\nthis article'
```

---

## Summary

✅ Reads MD files from `Knowledge/prompts/` folder  
✅ Frontend handles scanning and loading  
✅ Uses existing file storage API  
✅ ~2-3 days to implement  
✅ No backend changes needed  
