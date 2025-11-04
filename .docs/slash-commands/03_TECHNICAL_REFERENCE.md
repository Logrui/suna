# Slash Commands - Technical Reference

## API Reference

### Types

```typescript
// types/slashCommands.ts

export interface SlashCommand {
  id: string;                    // Unique identifier (UUID or hash)
  name: string;                  // Command name (e.g., "summarize")
  prompt: string;                // Full prompt template text
  description?: string;          // Short description for UI
  createdAt: string;            // ISO8601 timestamp
  modifiedAt: string;           // ISO8601 timestamp
  usage_count?: number;         // Optional: track usage
}

export interface SlashCommandError {
  code: string;                 // Error code (e.g., "DUPLICATE_NAME")
  message: string;              // Human readable message
  field?: string;               // Field that caused error
}

export interface SlashCommandContextType {
  commands: SlashCommand[];
  isLoading: boolean;
  error: SlashCommandError | null;
  createCommand: (name: string, prompt: string, description?: string) => Promise<void>;
  updateCommand: (id: string, updates: Partial<SlashCommand>) => Promise<void>;
  deleteCommand: (id: string) => Promise<void>;
  getCommand: (name: string) => SlashCommand | undefined;
  exportCommands: () => string; // JSON export
  importCommands: (json: string) => Promise<void>;
}
```

---

## Storage API

### `lib/slash-commands/storage.ts`

```typescript
// Load all commands for a user from LocalStorage
export function loadCommands(userId: string): SlashCommand[] {
  // Returns array of commands, empty array if none exist
}

// Save commands to LocalStorage
export function saveCommands(userId: string, commands: SlashCommand[]): void {
  // Throws error if quota exceeded
}

// Get single command by name
export function getCommand(userId: string, name: string): SlashCommand | null {
  // Case-insensitive search
}

// Add new command
export function addCommand(userId: string, command: Omit<SlashCommand, 'id'>): SlashCommand {
  // Generates ID automatically
  // Throws if name already exists
}

// Update existing command
export function updateCommand(userId: string, id: string, updates: Partial<SlashCommand>): SlashCommand {
  // Throws if command not found
}

// Delete command
export function deleteCommand(userId: string, id: string): void {
  // Silent if not found (idempotent)
}

// Export commands as JSON string
export function exportCommands(userId: string): string {
  // Returns stringified JSON
}

// Import commands from JSON string
export function importCommands(userId: string, json: string): SlashCommand[] {
  // Merges with existing (doesn't overwrite)
  // Throws if invalid JSON
}

// Clear all commands for a user
export function clearAllCommands(userId: string): void {
  // Use with caution!
}

// Check if command name exists
export function commandNameExists(userId: string, name: string): boolean {
  // Case-insensitive check
}

// Get available storage space
export function getStorageStats(): {
  used: number;    // Bytes used
  available: number; // Bytes available (approx 5MB - used)
  percentUsed: number; // 0-100
}
```

---

## Message Processing API

### `lib/slash-commands/processor.ts`

```typescript
// Detect if message starts with slash command
export function detectCommand(message: string): {
  name: string;
  args: string;
} | null {
  // Returns null if no command detected
  // Example: "/summarize this article" -> { name: "summarize", args: "this article" }
}

// Process message and inject command prompt
export function processMessage(
  message: string,
  commands: SlashCommand[]
): {
  processed: string;
  commandUsed?: SlashCommand;
  error?: string;
} {
  // Injects prompt and appends rest of message
  // Returns error if command not found
}

// Simple text injection without command lookup
export function injectPrompt(prompt: string, userText: string): string {
  // Returns: prompt + "\n\n" + userText (or just prompt if userText empty)
}

// Escape markdown special characters
export function escapeMarkdown(text: string): string {
  // Escapes: *, _, `, [, ]
}
```

---

## Validation API

### `lib/slash-commands/validator.ts`

```typescript
// Validate command name
export function validateCommandName(name: string): {
  valid: boolean;
  error?: string;
} {
  // Rules:
  // - Required
  // - 1-32 characters
  // - Alphanumeric, hyphens, underscores only
  // - Lowercase
}

// Validate prompt template
export function validatePrompt(prompt: string): {
  valid: boolean;
  error?: string;
} {
  // Rules:
  // - Required (non-empty)
  // - Max 5000 characters
  // - No null bytes
}

// Check for duplicate name
export function checkDuplicateName(
  userId: string,
  name: string,
  excludeId?: string
): boolean {
  // Returns true if name exists (excluding specified ID)
}

// Get validation errors for command
export function validateCommand(
  userId: string,
  name: string,
  prompt: string
): SlashCommandError[] {
  // Returns array of all validation errors
}

// Suggest alternative name if duplicate
export function suggestAlternativeName(baseName: string, existingNames: string[]): string {
  // Example: "summarize" -> "summarize-2" or "summarize_v2"
}
```

---

## Hooks API

### `hooks/useSlashCommands.ts`

```typescript
// Get all commands
export function useSlashCommands(): {
  commands: SlashCommand[];
  isLoading: boolean;
  error: SlashCommandError | null;
}

// Example usage:
// const { commands } = useSlashCommands();
```

### `hooks/useSlashCommandManager.ts`

```typescript
// Manage commands (CRUD)
export function useSlashCommandManager(): {
  commands: SlashCommand[];
  isLoading: boolean;
  error: SlashCommandError | null;
  createCommand: (name: string, prompt: string, description?: string) => Promise<void>;
  updateCommand: (id: string, updates: Partial<SlashCommand>) => Promise<void>;
  deleteCommand: (id: string) => Promise<void>;
  exportCommands: () => string;
  importCommands: (json: string) => Promise<void>;
  clearError: () => void;
}

// Example usage:
// const { createCommand, commands, error } = useSlashCommandManager();
// await createCommand("summarize", "Summarize...");
```

### `hooks/useSlashCommandAutocomplete.ts`

```typescript
// Handle autocomplete logic
export function useSlashCommandAutocomplete(input: string): {
  matches: SlashCommand[];           // Filtered commands
  selectedIndex: number;              // Currently selected index
  selectedCommand: SlashCommand | null;
  setSelectedIndex: (index: number) => void;
  selectNext: () => void;
  selectPrevious: () => void;
  selectCurrent: () => void;
  isOpen: boolean;
}

// Example usage:
// const { matches, selectedIndex } = useSlashCommandAutocomplete("/sum");
```

---

## Component Props

### `SlashCommandAutocomplete`

```typescript
interface SlashCommandAutocompleteProps {
  isOpen: boolean;
  matches: SlashCommand[];
  selectedIndex: number;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  position?: 'top' | 'bottom';  // Position relative to input
  maxItems?: number;             // Max visible items (default: 8)
}
```

### `SlashCommandModal`

```typescript
interface SlashCommandModalProps {
  isOpen: boolean;
  onClose: () => void;
  commandToEdit?: SlashCommand;
  onSave: (command: Omit<SlashCommand, 'id'>) => Promise<void>;
  isLoading?: boolean;
  error?: SlashCommandError;
}
```

### `SlashCommandManager`

```typescript
interface SlashCommandManagerProps {
  commands: SlashCommand[];
  onEdit: (command: SlashCommand) => void;
  onDelete: (id: string) => Promise<void>;
  onCreateNew: () => void;
  isLoading?: boolean;
  error?: SlashCommandError;
}
```

---

## Context Usage

### Provider Setup

```typescript
// In app root (app/layout.tsx or _app.tsx)
import { SlashCommandProvider } from '@/contexts/SlashCommandContext';

export default function RootLayout() {
  return (
    <SlashCommandProvider>
      {/* Rest of app */}
    </SlashCommandProvider>
  );
}
```

### Usage in Components

```typescript
import { useSlashCommandManager } from '@/hooks/useSlashCommandManager';

export function MyComponent() {
  const { commands, createCommand } = useSlashCommandManager();
  
  return (
    <div>
      {commands.map(cmd => (
        <div key={cmd.id}>{cmd.name}</div>
      ))}
    </div>
  );
}
```

---

## Chat Input Integration

### Message Sending Flow

```typescript
// In ChatInput component
async function handleSendMessage(userMessage: string) {
  // 1. Get all commands
  const { commands } = useSlashCommands();
  
  // 2. Process message with command injection
  const { processed, commandUsed, error } = processMessage(userMessage, commands);
  
  // 3. Handle errors
  if (error) {
    showError(error);
    return;
  }
  
  // 4. Send processed message to agent
  await sendMessageToThread({
    content: processed,
    originalMessage: userMessage,
    commandUsed: commandUsed?.name,
  });
}
```

---

## LocalStorage Schema

### Storage Key

```
Key: slash_commands_<userId>
Value: JSON string of SlashCommand[]
```

### Example Storage

```json
[
  {
    "id": "cmd_summarize_001",
    "name": "summarize",
    "prompt": "Summarize the following content in bullet points:\n- Keep it concise (5-10 bullets max)\n- Highlight key takeaways\n- Include any important numbers or dates",
    "description": "Summarize content into bullet points",
    "createdAt": "2025-11-04T10:00:00Z",
    "modifiedAt": "2025-11-04T10:00:00Z"
  }
]
```

---

## Error Handling

### Common Errors

```typescript
// Duplicate command name
{
  code: 'DUPLICATE_NAME',
  message: 'A command with this name already exists',
  field: 'name'
}

// Invalid command name
{
  code: 'INVALID_NAME',
  message: 'Command name must be 1-32 characters, alphanumeric with hyphens',
  field: 'name'
}

// Empty prompt
{
  code: 'EMPTY_PROMPT',
  message: 'Prompt template cannot be empty',
  field: 'prompt'
}

// Prompt too long
{
  code: 'PROMPT_TOO_LONG',
  message: 'Prompt template must be under 5000 characters',
  field: 'prompt'
}

// LocalStorage quota exceeded
{
  code: 'STORAGE_QUOTA_EXCEEDED',
  message: 'Not enough space to save. Try deleting some commands.',
  field: null
}

// Command not found
{
  code: 'COMMAND_NOT_FOUND',
  message: 'Command "/summarize" not found',
  field: null
}
```

---

## Testing Examples

### Unit Test: Storage

```typescript
import { addCommand, loadCommands, deleteCommand } from '@/lib/slash-commands/storage';

describe('Storage', () => {
  it('should save and load commands', () => {
    const cmd = addCommand('user123', {
      name: 'test',
      prompt: 'Test prompt',
    });
    
    const loaded = loadCommands('user123');
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('test');
  });
  
  it('should throw error for duplicate names', () => {
    addCommand('user123', { name: 'test', prompt: 'Prompt 1' });
    expect(() => {
      addCommand('user123', { name: 'test', prompt: 'Prompt 2' });
    }).toThrow();
  });
});
```

### Unit Test: Processor

```typescript
import { processMessage } from '@/lib/slash-commands/processor';

describe('Processor', () => {
  it('should inject prompt correctly', () => {
    const commands = [{
      id: '1',
      name: 'summarize',
      prompt: 'Summarize this:',
      createdAt: '2025-01-01T00:00:00Z',
      modifiedAt: '2025-01-01T00:00:00Z',
    }];
    
    const result = processMessage('/summarize my article', commands);
    expect(result.processed).toBe('Summarize this:\n\nmy article');
    expect(result.commandUsed?.name).toBe('summarize');
  });
});
```

### Component Test: Autocomplete

```typescript
import { render, screen } from '@testing-library/react';
import { SlashCommandAutocomplete } from '@/components/slash-commands';

describe('SlashCommandAutocomplete', () => {
  it('should render matching commands', () => {
    const commands = [
      { id: '1', name: 'summarize', prompt: '...', createdAt: '...', modifiedAt: '...' },
    ];
    
    render(
      <SlashCommandAutocomplete
        isOpen={true}
        matches={commands}
        selectedIndex={0}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />
    );
    
    expect(screen.getByText('summarize')).toBeInTheDocument();
  });
});
```

---

## Performance Considerations

### Optimization Tips

1. **Memoize command lists**
   ```typescript
   const commands = useMemo(() => 
     commandList.filter(c => c.name.includes(input)),
     [commandList, input]
   );
   ```

2. **Debounce autocomplete**
   ```typescript
   const debouncedFilter = useCallback(
     debounce((value) => setFilteredCommands(value), 200),
     []
   );
   ```

3. **Lazy load command manager**
   ```typescript
   const CommandManager = lazy(() => import('@/components/slash-commands/CommandManager'));
   ```

4. **Paginate large command lists**
   - Show first 10, load more on scroll

### Performance Targets

- **Autocomplete filter**: < 50ms
- **Command display**: < 100ms
- **Save command**: < 200ms
- **Delete command**: < 100ms

---

## Browser Compatibility

- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support
- **Mobile browsers**: Supported (testing needed for UX)

### Fallbacks

- If LocalStorage not available: Use in-memory storage (commands lost on refresh)
- If JSON.stringify fails: Log error, show user-friendly message

---

## Security Considerations

- **Command prompt injection**: Commands only affect message content, not system
- **XSS prevention**: Sanitize command names before display
- **LocalStorage per-domain**: Commands are domain-specific, no cross-domain access
- **No sensitive data**: Prompts are user-created, no PII or secrets stored by default

---

## Debugging

### Enable Debug Logging

```typescript
// In SlashCommandContext
const DEBUG = process.env.NEXT_PUBLIC_DEBUG_SLASH_COMMANDS === 'true';

if (DEBUG) {
  console.log('[SlashCommand]', 'Loading commands for user:', userId);
}
```

### Common Issues

| Issue | Solution |
|-------|----------|
| Commands not showing in autocomplete | Check `useSlashCommands()` is inside Provider |
| LocalStorage quota exceeded | Export commands, clear old ones, import back |
| Command prompt not injecting | Check regex pattern matching in `detectCommand()` |
| Autocomplete dropdown off-screen | Adjust positioning logic, use different position |

---

## Backward Compatibility

- **v1.0**: Commands stored in LocalStorage (current)
- **v1.1** (future): Can add migration path to backend
- **Upgrade path**: Export from v1.0, import to v1.1 with server sync enabled

