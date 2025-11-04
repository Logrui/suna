# Slash Commands: Feature Specification

## 1. Overview

Slash commands are user-defined, reusable prompt templates stored as Markdown files. When a user types `/` followed by a command name in the chat, an autocomplete menu appears. Selecting a command injects its content into the message, ready to be sent to the agent.

This allows users to save and quickly reuse common prompts for repetitive tasks.

---

## 2. Storage Mechanism

- **Format**: Markdown (`.md`) files.
- **Location**: Commands are stored in a designated directory within the user's workspace, specifically under `Knowledge/prompts/`.
- **Discovery**: The frontend will scan this directory to discover available commands. The filename (without the `.md` extension) serves as the command name.

### Example File: `Knowledge/prompts/summarize.md`

```markdown
---
description: "Summarize content into 5 bullet points."
---

Summarize the following content in 5 bullet points, focusing on key takeaways and important numbers or dates.
```

- **Frontmatter**: The Markdown file contains YAML frontmatter for metadata.
  - `description`: A short description shown in the autocomplete menu.
- **Body**: The main body of the file is the prompt text that will be injected.

---

## 3. User Workflow

1.  **Trigger**: User types `/` in the chat input.
2.  **Autocomplete**: An autocomplete dropdown appears, listing all commands found in `Knowledge/prompts/`.
3.  **Filter**: The list filters as the user types the command name (e.g., `/sum`).
4.  **Select**: User selects a command using arrow keys and `Enter`, or by clicking.
5.  **Inject**: The content of the selected `.md` file is injected into the chat input, replacing the `/command-name`.
6.  **Append**: The user can add more text after the injected prompt.
7.  **Send**: The user sends the complete message to the agent.

### Example Interaction

- **User types**: `/summarize`
- **Autocomplete shows**:
  - `summarize` - "Summarize content into 5 bullet points."
  - `draft-email` - "Draft a professional email."
- **User selects `summarize` and types**: ` this article about AI`
- **Chat input becomes**: `Summarize the following content in 5 bullet points... this article about AI`
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