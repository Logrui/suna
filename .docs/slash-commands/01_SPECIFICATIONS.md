# Slash Commands Feature Specification

## Overview

Slash commands are custom prompts that users create and save. When typed in chat with `/` prefix, they auto-complete and inject the full prompt into the message before sending to the agent.

**Example**: User types `/summarize this article` → System injects saved prompt → Sends full message to agent.

---

## 1. Core Concept

### What Happens?

1. User types `/` in chat
2. Autocomplete dropdown shows saved commands matching input
3. User selects a command (e.g., `summarize`)
4. Command's prompt is injected into message
5. Message sent to agent with full injected text

### Example

**Saved Command:**
```
name: summarize
prompt: Summarize this in 5 bullet points, focusing on key takeaways
```

**User Input:** `/summarize this article about AI`

**What Agent Receives:** 
```
Summarize this in 5 bullet points, focusing on key takeaways

this article about AI
```

---

## 2. User-Facing Features

### 2.1 Creating Commands

**Location**: New UI component in chat interface or settings

**Workflow**:
1. User clicks "Create Command" or types `/` + enters command creation mode
2. User provides:
   - **Command Name** (alphanumeric, no spaces, e.g., `summarize`, `draft-email`)
   - **Prompt Template** (markdown text that will be injected)
3. Command is saved as a `.md` file in user's command directory
4. User is notified of successful creation

### 2.2 Using Commands

**In Chat Interface**:
1. User types `/` to trigger command mode
2. **Autocomplete dropdown** appears showing:
   - Command names matching typed text
   - Command icons/labels (VS Code style)
   - Quick preview of command on hover (optional)
3. User selects command or continues typing
4. Command name resolves/autocompletes
5. User can edit the injected prompt before sending (optional)
6. Message is sent with full prompt context

**Injection Behavior**:
```
User message: /summarize this article
↓
Resolved to: [COMMAND_PROMPT_CONTENT] this article
↓
Sent to agent as: "Summarize the following content in bullet points:
- Keep it concise (5-10 bullets max)
- Highlight key takeaways
- Include any important numbers or dates

this article"
```

### 2.3 Managing Commands

**Location**: Settings or dedicated Command Manager UI

**Features**:
- List all user's commands
- Edit existing commands
- Delete commands
- (Future) Star/favorite commands for frequent use
- (Future) Share commands with team

---

## 3. Technical Architecture

### 3.1 Storage Structure

**MVP Approach**: Local markdown files in user-accessible directory

```
Frontend (Client-side storage options):
├─ LocalStorage (preferred for MVP)
│  └─ Key: `slash_commands_<userId>`
│  └─ Value: JSON array of command objects
│
├─ IndexedDB (if commands become complex)
│  └─ Table: `slash_commands`
│  └─ Schema: { id, name, prompt, created_at, modified_at }
│
└─ Files (future: server-side persistence)
   └─ /api/user/slash-commands
   └─ GET, POST, PATCH, DELETE endpoints
```

**For Frontend-Only MVP**: Use **LocalStorage with JSON serialization**

### 3.2 Command Object Schema

```typescript
interface SlashCommand {
  id: string;                    // UUID or hash of command name
  name: string;                  // e.g., "summarize"
  prompt: string;                // Full markdown prompt template
  description?: string;          // Short description for autocomplete
  createdAt: ISO8601;           // Creation timestamp
  modifiedAt: ISO8601;          // Last modification timestamp
  usage_count?: number;          // Optional: track usage
}
```

### 3.3 Storage Format (LocalStorage)

```json
{
  "slash_commands_user123": [
    {
      "id": "cmd_summarize_001",
      "name": "summarize",
      "prompt": "Summarize the following content in bullet points:\n- Keep it concise (5-10 bullets max)\n- Highlight key takeaways\n- Include any important numbers or dates",
      "description": "Summarize content into bullet points",
      "createdAt": "2025-11-04T10:00:00Z",
      "modifiedAt": "2025-11-04T10:00:00Z"
    },
    {
      "id": "cmd_email_001",
      "name": "draft-email",
      "prompt": "Draft a professional email for the following scenario:\n- Be concise (2-3 paragraphs)\n- Use formal tone\n- Include clear call-to-action",
      "description": "Draft professional emails",
      "createdAt": "2025-11-04T10:30:00Z",
      "modifiedAt": "2025-11-04T10:30:00Z"
    }
  ]
}
```

---

## 4. Frontend Components

### 4.1 Required Components

#### `SlashCommandProvider` (Context)
- Manages global slash command state
- Handles CRUD operations on commands
- Provides hooks for command access

#### `SlashCommandInput` (Chat Input Enhancement)
- Extends existing chat input
- Detects `/` character
- Triggers autocomplete on demand

#### `SlashCommandAutocomplete` (Dropdown)
- VS Code style autocomplete dropdown
- Shows matching commands as user types
- Displays command name and description
- Keyboard navigation (arrow keys, enter to select)

#### `SlashCommandManager` (Settings/Management UI)
- List all commands
- Create new command
- Edit existing command
- Delete command
- Modal/form for command creation/editing

#### `SlashCommandModal` (Creation/Editing)
- Form with fields: Command Name, Prompt Template
- Live preview of how prompt will be injected
- Save/Cancel buttons
- Validation (name uniqueness, etc.)

### 4.2 Hook Interfaces

```typescript
// Hook to access all commands
useSlashCommands(): SlashCommand[]

// Hook to get single command
useSlashCommand(name: string): SlashCommand | null

// Hook to manage commands
useSlashCommandManager(): {
  createCommand: (name: string, prompt: string) => Promise<void>
  updateCommand: (id: string, updates: Partial<SlashCommand>) => Promise<void>
  deleteCommand: (id: string) => Promise<void>
  getCommand: (name: string) => SlashCommand | null
}

// Hook for autocomplete
useSlashCommandAutocomplete(input: string): {
  matches: SlashCommand[]
  selectedIndex: number
  setSelectedIndex: (index: number) => void
}
```

---

## 5. Integration with Chat Interface

### 5.1 Message Sending Flow

**Current Flow** (to be modified):
```
User types message → Send button clicked → Message sent to agent
```

**New Flow with Slash Commands**:
```
User types: "/summarize this article"
↓
Chat input detects "/" character
↓
Autocomplete appears with matching commands
↓
User selects "summarize" command
↓
Command name is resolved to full prompt
↓
Message becomes: "[PROMPT_CONTENT] this article"
↓
Send button clicked
↓
Full message sent to agent
```

### 5.2 Injection Logic

```typescript
// Pseudocode for message processing
function processMessageWithCommands(userMessage: string, commands: SlashCommand[]): string {
  const commandMatch = userMessage.match(/^\/(\w+)\s*(.*)/);
  
  if (!commandMatch) {
    return userMessage; // No command, return as-is
  }
  
  const [, commandName, restOfMessage] = commandMatch;
  const command = commands.find(c => c.name === commandName);
  
  if (!command) {
    return userMessage; // Command not found, return as-is
  }
  
  // Inject prompt and append rest of message
  return `${command.prompt}\n\n${restOfMessage}`.trim();
}
```

---

## 6. User Interface Design (VS Code Style)

### 6.1 Autocomplete Dropdown

```
┌─────────────────────────────────────┐
│ /sum                                │
├─────────────────────────────────────┤
│ 🔹 summarize                        │
│    Summarize content into bullets   │
├─────────────────────────────────────┤
│ 🔹 summarize-detailed               │
│    Create detailed summary report   │
└─────────────────────────────────────┘
```

**Styling**:
- Dark theme matching VS Code
- Monospace font for command names
- Subtle description text in secondary color
- Highlight selected item with background color
- Arrow keys to navigate
- Enter to select
- Escape to close

### 6.2 Command Manager UI

**Location**: Settings → Slash Commands

```
┌────────────────────────────────────────┐
│ My Slash Commands              [+ New] │
├────────────────────────────────────────┤
│ summarize                      [✎ 🗑]  │
│ Summarize content into bullets        │
│ Created: Nov 4, 2025                  │
├────────────────────────────────────────┤
│ draft-email                    [✎ 🗑]  │
│ Draft professional emails             │
│ Created: Nov 4, 2025                  │
├────────────────────────────────────────┤
│ brainstorm                     [✎ 🗑]  │
│ Generate creative ideas                │
│ Created: Nov 3, 2025                  │
└────────────────────────────────────────┘
```

### 6.3 Command Creation Modal

```
┌──────────────────────────────────────┐
│ Create New Slash Command        [×]  │
├──────────────────────────────────────┤
│                                      │
│ Command Name:                        │
│ [summarize                        ]  │
│                                      │
│ Prompt Template:                     │
│ ┌──────────────────────────────────┐ │
│ │ Summarize the following content  │ │
│ │ in bullet points:                │ │
│ │ - Keep it concise (5-10 bullets) │ │
│ │ - Highlight key takeaways        │ │
│ └──────────────────────────────────┘ │
│                                      │
│             [Save]  [Cancel]         │
└──────────────────────────────────────┘
```

---

## 7. Implementation Phases

### Phase 1: MVP (Frontend-Only)
- ✅ SlashCommandProvider context + LocalStorage
- ✅ Chat input enhancement with autocomplete
- ✅ Autocomplete dropdown component
- ✅ Simple command manager (CRUD)
- ✅ Message injection logic
- **Deliverable**: Users can create, save, and use custom slash commands

### Phase 2: Enhancement (Future)
- Backend persistence (sync across devices)
- Command sharing with teams
- Command analytics/usage tracking
- Advanced templates with variables/parameters
- Command categories/organization

### Phase 3: Advanced (Future)
- Command versioning
- Import/export commands
- Community command marketplace
- Conditional logic in commands

---

## 8. File Structure

```
frontend/src/
├─ components/
│  ├─ slash-commands/
│  │  ├─ index.ts
│  │  ├─ SlashCommandAutocomplete.tsx
│  │  ├─ SlashCommandModal.tsx
│  │  └─ SlashCommandManager.tsx
│  │
│  └─ chat/
│     └─ ChatInput.tsx (modified to support slash commands)
│
├─ contexts/
│  └─ SlashCommandContext.tsx
│
├─ hooks/
│  ├─ useSlashCommands.ts
│  ├─ useSlashCommandManager.ts
│  └─ useSlashCommandAutocomplete.ts
│
├─ lib/
│  ├─ slash-commands/
│  │  ├─ storage.ts (LocalStorage utilities)
│  │  ├─ processor.ts (message injection logic)
│  │  └─ validator.ts (validation logic)
│  │
│  └─ utils/
│     └─ slashCommandUtils.ts
│
└─ types/
   └─ slashCommands.ts
```

---

## 9. Data Persistence Strategy

### MVP: LocalStorage + JSON

**Advantages**:
- ✅ No backend changes needed
- ✅ Fast and simple
- ✅ Works offline
- ✅ User data stays local

**Disadvantages**:
- ⚠️ Data lost if local storage cleared
- ⚠️ Not synced across devices
- ⚠️ Limited to ~5-10MB per domain

**Mitigation**:
- Add export/backup functionality later
- Show warning before clearing browser data
- Plan migration to backend in Phase 2

---

## 10. Validation & Error Handling

### Command Name Validation
- **Required**: Non-empty, alphanumeric + hyphens only
- **Unique**: No duplicate names per user
- **Reserved**: Prevent conflicting with system commands (future-proofing)
- **Max Length**: 32 characters

### Prompt Template Validation
- **Required**: Non-empty
- **Max Length**: 5000 characters (MVP limit)
- **Allowed**: Plain text + markdown formatting

### Error States
- Command name already exists → Show error, suggest alternative
- Empty prompt → Show validation error
- LocalStorage quota exceeded → Show warning, offer cleanup

---

## 11. Example Commands for MVP Testing

```markdown
### summarize
Summarize the following content in 5-10 bullet points. Highlight key takeaways and important numbers or dates.

### draft-email
Draft a professional email for the following scenario. Keep it to 2-3 paragraphs, use formal tone, and include a clear call-to-action.

### brainstorm
Generate 10 creative ideas for the following topic. Be diverse, think outside the box, and explain each idea briefly.

### explain-simple
Explain the following in simple terms that a 10-year-old could understand. Avoid technical jargon.

### code-review
Review the following code. Check for bugs, performance issues, security vulnerabilities, and suggest improvements.

### create-todo
Create a structured TODO list for the following task. Break it down into smaller, actionable steps.
```

---

## 12. Future Considerations

- **Parameters**: Commands with variables like `/summarize length=short style=bullets`
- **Conditionals**: If/else logic within commands
- **Macros**: Commands that reference other commands
- **AI Training**: Learn user preferences from command usage
- **Mobile Support**: Touch-friendly command selection
- **Voice Input**: Voice commands that map to slash commands

---

## 13. Success Criteria

✅ Users can create custom slash commands
✅ Commands are persisted in LocalStorage
✅ Autocomplete dropdown appears and functions correctly
✅ Commands are injected properly into messages
✅ Users can edit/delete their commands
✅ No backend changes required for MVP
✅ VS Code-like visual design implemented

