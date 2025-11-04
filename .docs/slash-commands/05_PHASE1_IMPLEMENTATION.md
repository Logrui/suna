# Phase 1: Implementation - Basic Slash Commands Working

This guide will walk you through implementing the entire Phase 1 to get a working autocomplete dropdown showing example commands.

**Goal**: Type `/` in chat input and see autocomplete with example commands.

---

## Step 1: Create Core Utilities

**File**: `frontend/src/lib/slashCommands.ts`

Create this new file with the following content:

```typescript
// frontend/src/lib/slashCommands.ts

export interface SlashCommand {
  name: string;
  description?: string;
  prompt: string;
}

/**
 * Parses a markdown string to extract frontmatter and content.
 * Frontmatter is YAML wrapped in --- delimiters.
 */
export function parseMarkdownCommand(filename: string, markdownContent: string): SlashCommand {
  const name = filename.replace('.md', '');
  let description: string | undefined;
  let prompt = markdownContent;

  // Check if markdown starts with frontmatter (---)
  if (markdownContent.startsWith('---')) {
    const endIndex = markdownContent.indexOf('---', 3);
    if (endIndex !== -1) {
      const frontmatter = markdownContent.substring(3, endIndex);
      prompt = markdownContent.substring(endIndex + 3).trim();

      // Parse YAML frontmatter (simple extraction of description field)
      const descMatch = frontmatter.match(/description:\s*["']([^"']+)["']/);
      if (descMatch) {
        description = descMatch[1];
      }
    }
  }

  return {
    name,
    description,
    prompt,
  };
}

/**
 * Detects if a message starts with a slash command pattern.
 * Returns the command name and any arguments.
 */
export function detectCommand(message: string): { name: string; args: string } | null {
  const match = message.match(/^\/(\w+(?:-\w+)*)\s*(.*)/);
  return match ? { name: match[1], args: match[2] } : null;
}

/**
 * Injects a command's prompt into a user's message.
 */
export function injectPrompt(promptContent: string, userArgs: string): string {
  return `${promptContent}\n\n${userArgs}`.trim();
}
```

---

## Step 2: Create Initialization & Data Fetching Hook

This hook will:
1. Auto-create the `/Knowledge/prompts/` directory on first load
2. Create 4 example markdown files if they don't exist
3. Fetch and cache all commands

**File**: `frontend/src/hooks/useSlashCommands.ts`

Create this new file:

```typescript
// frontend/src/hooks/useSlashCommands.ts

import { useQuery } from '@tanstack/react-query';
import { API_URL } from '@/lib/api';
import { parseMarkdownCommand, SlashCommand } from '@/lib/slashCommands';

const EXAMPLE_COMMANDS = [
  {
    filename: 'summarize.md',
    content: `---
description: "Summarize content into 5 bullet points."
---

Summarize the following content in 5 bullet points, focusing on key takeaways and important numbers or dates.`,
  },
  {
    filename: 'draft-email.md',
    content: `---
description: "Draft a professional email."
---

Draft a professional email for the following scenario. Keep it to 2-3 paragraphs, use a formal tone, and include a clear call-to-action.`,
  },
  {
    filename: 'brainstorm.md',
    content: `---
description: "Generate 10 creative ideas."
---

Generate 10 creative ideas for the following topic. Be diverse, think outside the box, and explain each idea briefly.`,
  },
  {
    filename: 'explain-simple.md',
    content: `---
description: "Explain complex concepts simply."
---

Explain the following in simple terms that a 10-year-old could understand. Avoid technical jargon and use real-world examples if possible.`,
  },
];

/**
 * Initialize example commands if they don't exist
 */
async function initializeExampleCommands() {
  try {
    // First, try to list files in the directory (this will tell us if it exists)
    const listRes = await fetch(`${API_URL}/files?path=Knowledge/prompts`);
    
    if (!listRes.ok) {
      // Directory likely doesn't exist, we need to create files
      console.log('Initializing example slash commands...');
      
      // Create each example file
      for (const example of EXAMPLE_COMMANDS) {
        try {
          const createRes = await fetch(`${API_URL}/files`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              path: `Knowledge/prompts/${example.filename}`,
              content: example.content,
            }),
          });

          if (createRes.ok) {
            console.log(`✓ Created example command: ${example.filename}`);
          } else {
            console.error(`Failed to create ${example.filename}:`, await createRes.text());
          }
        } catch (err) {
          console.error(`Error creating example command ${example.filename}:`, err);
        }
      }
    }
  } catch (err) {
    console.error('Error during initialization:', err);
  }
}

export function useSlashCommands() {
  return useQuery<SlashCommand[], Error>({
    queryKey: ['slash-commands'],
    queryFn: async () => {
      try {
        // Initialize example commands on first load
        await initializeExampleCommands();

        // 1. List files in the designated prompts directory
        const listRes = await fetch(`${API_URL}/files?path=Knowledge/prompts`);
        if (!listRes.ok) {
          console.error('Failed to list slash command files', await listRes.text());
          return [];
        }
        
        const files: Array<{ name: string; path: string }> = await listRes.json();

        // Filter for .md files
        const markdownFiles = files.filter(file => file.name.endsWith('.md'));

        // 2. Fetch content for each markdown file and parse it
        const commands = await Promise.all(
          markdownFiles.map(async (file) => {
            try {
              const contentRes = await fetch(`${API_URL}/files/content?path=${file.path}`);
              if (!contentRes.ok) {
                console.error(`Failed to fetch content for ${file.name}`, await contentRes.text());
                return null;
              }
              const markdownContent = await contentRes.text();
              return parseMarkdownCommand(file.name, markdownContent);
            } catch (err) {
              console.error(`Error loading command ${file.name}:`, err);
              return null;
            }
          })
        );

        // Filter out any nulls from failed fetches
        return commands.filter((cmd): cmd is SlashCommand => cmd !== null);
      } catch (err) {
        console.error('Error in useSlashCommands:', err);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    retry: 2,
  });
}
```

---

## Step 3: Create Autocomplete Component

**File**: `frontend/src/components/slash-commands/SlashCommandAutocomplete.tsx`

Create the directory `frontend/src/components/slash-commands/` first, then create this file:

```typescript
// frontend/src/components/slash-commands/SlashCommandAutocomplete.tsx

'use client';

import React, { useEffect, useRef } from 'react';
import { SlashCommand } from '@/lib/slashCommands';
import { cn } from '@/lib/utils';

interface SlashCommandAutocompleteProps {
  isOpen: boolean;
  commands: SlashCommand[];
  selectedIndex: number;
  onSelect: (commandName: string) => void;
  onClose: () => void;
}

export function SlashCommandAutocomplete({
  isOpen,
  commands,
  selectedIndex,
  onSelect,
  onClose,
}: SlashCommandAutocompleteProps) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (isOpen && selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [isOpen, selectedIndex]);

  if (!isOpen || commands.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        'absolute bottom-full left-0 right-0 z-50 mb-2 max-h-60 overflow-y-auto rounded-md border bg-white shadow-md',
        'dark:bg-slate-950 dark:border-slate-700'
      )}
      role="listbox"
    >
      {commands.map((command, index) => (
        <button
          key={command.name}
          ref={(el) => (itemRefs.current[index] = el)}
          onClick={() => {
            onSelect(command.name);
            onClose();
          }}
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            'flex w-full cursor-pointer flex-col items-start gap-1 rounded-sm px-3 py-2 text-left text-sm outline-none transition-colors',
            selectedIndex === index
              ? 'bg-blue-500 text-white dark:bg-blue-600'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800'
          )}
          role="option"
          aria-selected={selectedIndex === index}
        >
          <span className="font-mono font-medium">/{command.name}</span>
          {command.description && (
            <span
              className={cn(
                'text-xs',
                selectedIndex === index ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
              )}
            >
              {command.description}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
```

---

## Step 4: Integrate with Chat Input

Find your existing `ChatInput` component (usually in `frontend/src/components/chat/ChatInput.tsx` or similar).

Add slash command support by modifying it. Here's the updated version:

```typescript
// frontend/src/components/chat/ChatInput.tsx

'use client';

import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useSlashCommands } from '@/hooks/useSlashCommands';
import { detectCommand, injectPrompt } from '@/lib/slashCommands';
import { SlashCommandAutocomplete } from '@/components/slash-commands/SlashCommandAutocomplete';
import { Button } from '@/components/ui/button';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
}

export function ChatInput({ onSendMessage, isLoading = false }: ChatInputProps) {
  const [messageText, setMessageText] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: allCommands = [] } = useSlashCommands();

  // Filter commands based on current input
  const filteredCommands = useMemo(() => {
    if (!messageText.includes('/')) {
      return [];
    }

    // Find the last / and get text after it
    const lastSlashIndex = messageText.lastIndexOf('/');
    const afterSlash = messageText.substring(lastSlashIndex + 1);

    // Don't show autocomplete if there's a space after /
    if (afterSlash.includes(' ')) {
      return [];
    }

    // Filter commands
    return allCommands.filter(cmd => cmd.name.startsWith(afterSlash));
  }, [messageText, allCommands]);

  // Reset selected index when filtered commands change
  React.useEffect(() => {
    setAutocompleteIndex(0);
  }, [filteredCommands]);

  const handleSendMessage = useCallback(async () => {
    if (!messageText.trim() || isLoading) return;

    const commandDetection = detectCommand(messageText);
    let finalMessage = messageText;

    if (commandDetection) {
      const selectedCommand = allCommands.find(cmd => cmd.name === commandDetection.name);
      if (selectedCommand) {
        finalMessage = injectPrompt(selectedCommand.prompt, commandDetection.args);
      }
    }

    onSendMessage(finalMessage);
    setMessageText('');
    setShowAutocomplete(false);
    setAutocompleteIndex(0);
  }, [messageText, allCommands, onSendMessage, isLoading]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Handle autocomplete navigation
      if (showAutocomplete && filteredCommands.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setAutocompleteIndex(prev =>
            Math.min(prev + 1, filteredCommands.length - 1)
          );
          return;
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setAutocompleteIndex(prev => Math.max(prev - 1, 0));
          return;
        } else if (e.key === 'Enter') {
          e.preventDefault();
          if (filteredCommands[autocompleteIndex]) {
            const selectedCommandName = filteredCommands[autocompleteIndex].name;
            const lastSlashIndex = messageText.lastIndexOf('/');
            const beforeSlash = messageText.substring(0, lastSlashIndex);
            setMessageText(`${beforeSlash}/${selectedCommandName} `);
            setShowAutocomplete(false);
          }
          return;
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setShowAutocomplete(false);
          return;
        }
      }

      // Handle send message
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [showAutocomplete, filteredCommands, autocompleteIndex, messageText, handleSendMessage]
  );

  const handleAutocompleteSelect = useCallback(
    (commandName: string) => {
      const lastSlashIndex = messageText.lastIndexOf('/');
      const beforeSlash = messageText.substring(0, lastSlashIndex);
      setMessageText(`${beforeSlash}/${commandName} `);
      setShowAutocomplete(false);
      inputRef.current?.focus();
    },
    [messageText]
  );

  return (
    <div className="relative w-full">
      <textarea
        ref={inputRef}
        value={messageText}
        onChange={(e) => {
          setMessageText(e.target.value);
          // Show autocomplete if text contains /
          if (e.target.value.includes('/')) {
            setShowAutocomplete(true);
          } else {
            setShowAutocomplete(false);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder="Message... (type / for commands)"
        rows={3}
        disabled={isLoading}
        className="min-h-[80px] w-full resize-none rounded-md border border-input bg-background px-4 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      />

      {showAutocomplete && filteredCommands.length > 0 && (
        <SlashCommandAutocomplete
          isOpen={showAutocomplete}
          commands={filteredCommands}
          selectedIndex={autocompleteIndex}
          onSelect={handleAutocompleteSelect}
          onClose={() => setShowAutocomplete(false)}
        />
      )}

      <Button
        onClick={handleSendMessage}
        disabled={!messageText.trim() || isLoading}
        className="absolute right-2 bottom-2"
      >
        {isLoading ? 'Sending...' : 'Send'}
      </Button>
    </div>
  );
}
```

---

## Step 5: Create Example Markdown Files

Create the directory: `Knowledge/prompts/`

Then create these files:

**File**: `Knowledge/prompts/summarize.md`
```markdown
---
description: "Summarize content into 5 bullet points."
---

Summarize the following content in 5 bullet points, focusing on key takeaways and important numbers or dates.
```

**File**: `Knowledge/prompts/draft-email.md`
```markdown
---
description: "Draft a professional email."
---

Draft a professional email for the following scenario. Keep it to 2-3 paragraphs, use a formal tone, and include a clear call-to-action.
```

**File**: `Knowledge/prompts/brainstorm.md`
```markdown
---
description: "Generate 10 creative ideas."
---

Generate 10 creative ideas for the following topic. Be diverse, think outside the box, and explain each idea briefly.
```

**File**: `Knowledge/prompts/explain-simple.md`
```markdown
---
description: "Explain complex concepts simply."
---

Explain the following in simple terms that a 10-year-old could understand. Avoid technical jargon and use real-world examples if possible.
```

---

## Step 6: Test the Implementation

1. **Start your frontend**: `npm run dev` in the `frontend` directory
2. **Open the chat interface**
3. **Type `/`** - You should see the autocomplete dropdown appear with the 4 example commands
4. **Type `/sum`** - The list should filter to show only "summarize"
5. **Use arrow keys** to navigate, **Enter** to select
6. **Type additional text**: `/summarize this article about AI`
7. **Press Enter to send** - The full prompt should be injected

---

## What You Should See

```
Chat input: /su
            ↓
            Autocomplete appears:
            ┌──────────────────────────────┐
            │ /summarize                   │
            │  Summarize content into...   │
            │                              │
            │ /explain-simple              │
            │  Explain complex concepts... │
            └──────────────────────────────┘
```

---

## Troubleshooting

**Autocomplete doesn't appear:**
- Check that `/` is typed in the input
- Check browser console for errors
- Verify `useSlashCommands` is fetching commands (check Network tab)

**Commands not loading:**
- Ensure `Knowledge/prompts/` directory exists in your workspace
- Check that markdown files have `.md` extension
- Check API logs for file fetch errors

**Keyboard navigation not working:**
- Make sure textarea is focused
- Try pressing Escape first, then try again

---

## Success Checklist

- [ ] Can type `/` and see autocomplete
- [ ] Autocomplete shows example commands
- [ ] Arrow keys navigate the list
- [ ] Enter selects a command
- [ ] Selected command inserted into input with space
- [ ] Can continue typing after command
- [ ] Enter sends message with injected prompt
- [ ] Message arrives at agent with full prompt content

✅ When all checked, Phase 1 is complete!
