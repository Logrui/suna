# Slash Commands: Feature Specification

## 1. Overview

Slash commands are user-defined, reusable prompt templates stored as text files in the Knowledge Base. When a user types `/` followed by a command name in the chat, an autocomplete menu appears. Selecting a command injects its content into the message, ready to be sent to the agent.

This allows users to save and quickly reuse common prompts for repetitive tasks.

---

## 2. Storage Mechanism

- **Format**: Markdown (`.md`) files.
- **Location**: Commands are stored in the Knowledge Base under a folder named `Suna`.
- **Discovery**: The frontend uses the Knowledge Base API to fetch all entries from the `Suna` folder.
- **Metadata**: 
  - Command name: Derived from filename (without `.md` extension)
  - Description: Stored in the entry's `summary` field
  - Prompt content: Stored in the entry's `content` field

### Example Entry in Knowledge Base

**Filename**: `summarize.md`  
**Summary**: "Summarize content into 5 bullet points."  
**Content**:
```
Summarize the following content in 5 bullet points, focusing on key takeaways and important numbers or dates.
```

### Auto-initialization

On first use, the system automatically:
1. Creates a `Suna` folder in Knowledge Base (if it doesn't exist)
2. Uploads 4 example command files:
   - `summarize.md`
   - `draft-email.md`
   - `brainstorm.md`
   - `explain-simple.md`

---

## 3. User Workflow

1.  **Trigger**: User types `/` in the chat input.
2.  **Autocomplete**: A compact dropdown appears below the input, listing all commands from the `Suna` folder.
3.  **Filter**: The list filters as the user types the command name (e.g., `/sum`).
4.  **Select**: User selects a command using arrow keys (↑↓) and `Enter`, or by clicking.
5.  **Visual Highlight**: The `/command-name` appears in the input with a special highlight (colored background).
6.  **User adds text**: The user can type their specific content after the command.
7.  **Prompt Injection**: When the user presses Send, the `/command-name` is replaced with the full prompt text before being sent to the agent.
8.  **Agent receives**: The full prompt + user's text.

### Example Interaction

- **User types**: `/sum`
- **Autocomplete shows**: `summarize` - "Summarize content into 5 bullet points."
- **User selects** (press Enter or click)
- **Input shows**: <span style="background: rgba(var(--primary), 0.1); color: var(--primary); padding: 0 4px; border-radius: 3px; font-weight: 500;">/summarize</span> (with highlight)
- **User types**: ` this article about AI`
- **Input now shows**: <span style="background: rgba(var(--primary), 0.1); color: var(--primary); padding: 0 4px; border-radius: 3px; font-weight: 500;">/summarize</span>  this article about AI
- **User presses Send**
- **Agent receives**: `Summarize the following content in 5 bullet points, focusing on key takeaways and important numbers or dates.\n\nthis article about AI`

The user sees the friendly `/summarize` command, but the agent receives the full prompt.
- **Agent receives**: The full, combined text.

---

## 4. Frontend Components

### `SlashCommandAutocomplete.tsx`

- A dropdown menu that appears when `/` is typed.
- Fetches and displays commands from the `useSlashCommands` hook.
- Handles keyboard navigation (`Up`, `Down`, `Enter`, `Escape`).
- Renders the command name and its description from the frontmatter.

### Chat Input Integration

- The existing chat input component will be modified to:
  - Detect the `/` character to show/hide the autocomplete component.
  - Pass the current input to the autocomplete component for filtering.
  - Handle the `onSelect` event from the autocomplete to inject the prompt text.

### (Optional) `SlashCommandManager.tsx`

- A UI in the settings or "Knowledge" section to view available commands.
- For this simplified MVP, managing commands is done by adding/editing/deleting `.md` files directly in the `Knowledge/prompts/` directory. A UI manager is not required initially.

---

## 5. API and Data Flow

- **No Backend Changes**: This feature is frontend-only and relies on the existing file storage API.
- **Data Fetching**: A new hook, `useSlashCommands`, will be created.
  1.  It will call the API to list all files in the `Knowledge/prompts/` directory.
  2.  For each `.md` file found, it will fetch its content.
  3.  It will parse the frontmatter and the body of each file.
  4.  The parsed commands will be cached using React Query.

This approach ensures that any changes to the `.md` files are automatically reflected in the UI after a refetch.