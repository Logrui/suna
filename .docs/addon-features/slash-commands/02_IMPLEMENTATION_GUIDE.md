# Slash Commands: Implementation Guide

This guide provides the necessary code and steps to implement the Slash Commands feature.

## 1. File Structure

```
frontend/src/
├─ hooks/
│  └─ useSlashCommands.ts            # Fetches and parses commands
├─ lib/
│  └─ slashCommands.ts               # Helper functions (parsing, injection)
└─ components/
   ├─ chat/
   │  └─ ChatInput.tsx               # Modified to integrate autocomplete
   └─ slash-commands/
      └─ SlashCommandAutocomplete.tsx # Autocomplete dropdown UI
```

---

## 2. Core Logic: `lib/slashCommands.ts`

This file will contain utilities for parsing Markdown files and injecting prompts. No external dependencies needed!

```typescript
// frontend/src/lib/slashCommands.ts

export interface SlashCommand {
  name: string; // e.g., "summarize"
  description?: string; // From frontmatter
  prompt: string; // The main content of the markdown file
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

## 3. Data Fetching: `hooks/useSlashCommands.ts`

This hook will fetch and parse your Markdown command files.

```typescript
// frontend/src/hooks/useSlashCommands.ts

import { useQuery } from '@tanstack/react-query';
import { API_URL } from '@/lib/api'; // Assuming API_URL is defined here
import { parseMarkdownCommand, SlashCommand } from '@/lib/slashCommands';

export function useSlashCommands() {
  return useQuery<SlashCommand[], Error>({
    queryKey: ['slash-commands'],
    queryFn: async () => {
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
          const contentRes = await fetch(`${API_URL}/files/content?path=${file.path}`);
          if (!contentRes.ok) {
            console.error(`Failed to fetch content for ${file.name}`, await contentRes.text());
            return null; // Skip this file if content fetch fails
          }
          const markdownContent = await contentRes.text();
          return parseMarkdownCommand(file.name, markdownContent);
        })
      );

      // Filter out any nulls from failed fetches
      return commands.filter((cmd): cmd is SlashCommand => cmd !== null);
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    // You might want to add refetchOnWindowFocus: false if commands don't change often
  });
}
```

---

## 4. UI Component: `components/slash-commands/SlashCommandAutocomplete.tsx`

This component displays the filtered list of commands.

```typescript
// frontend/src/components/slash-commands/SlashCommandAutocomplete.tsx

import React, { useEffect, useRef } from 'react';
import { SlashCommand } from '@/lib/slashCommands';
import { cn } from '@/lib/utils'; // Assuming you have a utility for class names

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
      itemRefs.current[selectedIndex]?.focus();
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
        "absolute bottom-full left-0 right-0 z-50 mb-2 max-h-60 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        "dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100"
      )}
      role="listbox"
    >
      {commands.map((command, index) => (
        <button
          key={command.name}
          ref={(el) => (itemRefs.current[index] = el)}
          onClick={() => onSelect(command.name)}
          onMouseDown={(e) => e.preventDefault()} // Prevent input blur
          className={cn(
            "flex w-full cursor-pointer flex-col items-start gap-1 rounded-sm px-2 py-1.5 text-left text-sm outline-none",
            selectedIndex === index && "bg-accent text-accent-foreground dark:bg-blue-600 dark:text-white",
            "hover:bg-accent hover:text-accent-foreground dark:hover:bg-blue-700 dark:hover:text-white"
          )}
          role="option"
          aria-selected={selectedIndex === index}
        >
          <span className="font-mono font-medium">/{command.name}</span>
          {command.description && (
            <span className="text-xs text-muted-foreground dark:text-gray-300">
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

## 5. Integration: `components/chat/ChatInput.tsx`

Modify your existing chat input component to include the autocomplete logic.

```typescript
// frontend/src/components/chat/ChatInput.tsx

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSlashCommands } from '@/hooks/useSlashCommands';
import { detectCommand, injectPrompt } from '@/lib/slashCommands';
import { SlashCommandAutocomplete } from '@/components/slash-commands/SlashCommandAutocomplete';

// Assuming sendMessageToThread is a prop or imported function
interface ChatInputProps {
  sendMessageToThread: (message: string) => Promise<void>;
}

export function ChatInput({ sendMessageToThread }: ChatInputProps) {
  const [messageText, setMessageText] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null); // Use textarea for multi-line

  const { data: allCommands = [] } = useSlashCommands();

  // Filter commands based on current input after '/'
  const filteredCommands = React.useMemo(() => {
    const commandMatch = detectCommand(messageText);
    if (commandMatch) {
      return allCommands.filter(cmd =>
        cmd.name.startsWith(commandMatch.name)
      );
    }
    return [];
  }, [messageText, allCommands]);

  useEffect(() => {
    if (showAutocomplete && filteredCommands.length > 0) {
      setAutocompleteIndex(0);
    }
  }, [showAutocomplete, filteredCommands.length]);

  const handleSendMessage = useCallback(async () => {
    if (!messageText.trim()) return;

    const commandDetection = detectCommand(messageText);
    let finalMessage = messageText;

    if (commandDetection) {
      const selectedCommand = allCommands.find(
        (cmd) => cmd.name === commandDetection.name
      );
      if (selectedCommand) {
        finalMessage = injectPrompt(
          selectedCommand.prompt,
          commandDetection.args
        );
      }
    }

    await sendMessageToThread(finalMessage);
    setMessageText('');
    setShowAutocomplete(false);
    setAutocompleteIndex(0);
  }, [messageText, allCommands, sendMessageToThread]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === '/' && messageText.length === 0) {
        setShowAutocomplete(true);
        setAutocompleteIndex(0);
      } else if (e.key === 'Escape') {
        setShowAutocomplete(false);
        e.preventDefault();
      } else if (showAutocomplete && filteredCommands.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setAutocompleteIndex((prev) =>
            Math.min(prev + 1, filteredCommands.length - 1)
          );
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setAutocompleteIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (filteredCommands[autocompleteIndex]) {
            const selectedCommandName = filteredCommands[autocompleteIndex].name;
            const currentInputBeforeCommand = messageText.substring(0, messageText.lastIndexOf('/'));
            setMessageText(`${currentInputBeforeCommand}/${selectedCommandName} `);
            setShowAutocomplete(false);
          }
        }
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [messageText, showAutocomplete, filteredCommands, autocompleteIndex, handleSendMessage]
  );

  const handleAutocompleteSelect = useCallback(
    (commandName: string) => {
      const currentInputBeforeCommand = messageText.substring(0, messageText.lastIndexOf('/'));
      setMessageText(`${currentInputBeforeCommand}/${commandName} `);
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
          if (e.target.value.includes('/')) {
            setShowAutocomplete(true);
          } else {
            setShowAutocomplete(false);
          }
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setShowAutocomplete(false), 100)} // Delay to allow click on autocomplete
        placeholder="Message... (type / for commands)"
        rows={1}
        className="min-h-[48px] w-full resize-none rounded-md border border-input bg-background px-4 py-[10px] text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
      {showAutocomplete && (
        <SlashCommandAutocomplete
          isOpen={showAutocomplete}
          commands={filteredCommands}
          selectedIndex={autocompleteIndex}
          onSelect={handleAutocompleteSelect}
          onClose={() => setShowAutocomplete(false)}
        />
      )}
      <button
        onClick={handleSendMessage}
        className="absolute right-2 bottom-2 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2"
      >
        Send
      </button>
    </div>
  );
}
```

---

## 6. Testing

### `lib/slashCommands.ts` Tests

```typescript
// Example tests for frontend/src/lib/slashCommands.ts

import { parseMarkdownCommand, detectCommand, injectPrompt } from './slashCommands';

describe('slashCommands utilities', () => {
  const mockMarkdown = `---
description: "A test command description."
---

This is the prompt content.`;

  it('should parse markdown command correctly', () => {
    const command = parseMarkdownCommand('test-command.md', mockMarkdown);
    expect(command.name).toBe('test-command');
    expect(command.description).toBe('A test command description.');
    expect(command.prompt).toBe('This is the prompt content.');
  });

  it('should handle markdown without frontmatter', () => {
    const simpleMarkdown = 'Just plain prompt content';
    const command = parseMarkdownCommand('simple.md', simpleMarkdown);
    expect(command.name).toBe('simple');
    expect(command.description).toBeUndefined();
    expect(command.prompt).toBe('Just plain prompt content');
  });

  it('should detect command and arguments', () => {
    const detected = detectCommand('/summarize this article');
    expect(detected).toEqual({ name: 'summarize', args: 'this article' });
  });

  it('should return null if no command detected', () => {
    const detected = detectCommand('just a regular message');
    expect(detected).toBeNull();
  });

  it('should inject prompt correctly', () => {
    const result = injectPrompt('My prompt content', 'user\'s additional text');
    expect(result).toBe('My prompt content\n\nuser\'s additional text');
  });

  it('should inject prompt without extra newlines if args are empty', () => {
    const result = injectPrompt('My prompt content', '');
    expect(result).toBe('My prompt content');
  });
});
```

---

## 7. Next Steps

1.  **Create** the new files: `useSlashCommands.ts`, `slashCommands.ts`, `SlashCommandAutocomplete.tsx`.
2.  **Modify** `ChatInput.tsx` as shown above.
3.  **Create** example Markdown files in `Knowledge/prompts/` (see `03_COMMAND_EXAMPLES.md`).
4.  **Test** the functionality.