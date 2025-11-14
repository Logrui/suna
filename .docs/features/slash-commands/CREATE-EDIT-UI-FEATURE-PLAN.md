# Slash Commands: Create/Edit UI Feature Plan

## Overview

Users should be able to create and edit slash commands through a new UI/UX, saving them as Markdown files to the Knowledge Base.

---

## Feature Requirements

### Create New Command
1. Open dialog/modal to create new slash command
2. Fill in:
   - **Name** (required): Command name (e.g., "summarize")
   - **Description** (required): Short description for autocomplete
   - **Content** (required): The actual prompt/instruction (Markdown)
3. Save as `.md` file to Knowledge Base
4. File appears immediately in slash command autocomplete

### Edit Existing Command
1. Open existing command from autocomplete
2. Modify name, description, or content
3. Save changes (updates file in Knowledge Base)
4. Changes reflect immediately in autocomplete

### File Structure
```
Knowledge Base (Suna folder)
├─ summarize.md       (existing example)
├─ draft-email.md     (existing example)
├─ my-new-command.md  (user created)
└─ ...
```

---

## UI/UX Design

### 1. Create Command Button
**Location**: Near chat input or in a menu
```
Quick access button to create new slash command
Icon: + or Create
Action: Opens create dialog
```

### 2. Create Dialog
```
┌─────────────────────────────────────────┐
│ Create Slash Command                    │
├─────────────────────────────────────────┤
│                                         │
│ Name*                                   │
│ [________] (e.g., "summarize")         │
│                                         │
│ Description*                            │
│ [________________________________________] │
│ (Short description for autocomplete)    │
│                                         │
│ Content (Markdown)*                     │
│ [                                       │
│   You are an expert at...               │
│   Your task is to...                    │
│                                         │
│ ]                                       │
│                                         │
│ [Cancel] [Preview] [Save]               │
│                                         │
└─────────────────────────────────────────┘
```

### 3. Edit Command
Open from autocomplete long-press or right-click:
```
Context Menu on Command
├─ Edit
├─ Duplicate
├─ Delete
└─ Cancel
```

---

## Implementation Plan

### Phase 1: Backend (Optional - only if using API)

Currently, file uploads are handled via:
- `POST /knowledge-base/folders/{folder_id}/upload` (existing)

No new backend endpoints needed - reuse existing upload endpoint.

### Phase 2: Frontend Components

#### 2a. Create Dialog Component
**File**: `frontend/src/components/slash-commands/CreateSlashCommandDialog.tsx`

```typescript
interface CreateSlashCommandDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (command: {
    name: string;
    description: string;
    content: string;
  }) => Promise<void>;
  initialCommand?: SlashCommand; // For edit mode
}

export const CreateSlashCommandDialog: React.FC<...> = (...) => {
  // Form state management
  // Validation
  // Preview tab
  // Save/cancel handlers
}
```

#### 2b. Command Context Menu Component
**File**: `frontend/src/components/slash-commands/CommandContextMenu.tsx`

```typescript
interface CommandContextMenuProps {
  command: SlashCommand;
  onEdit: (command: SlashCommand) => void;
  onDuplicate: (command: SlashCommand) => void;
  onDelete: (command: SlashCommand) => void;
}
```

#### 2c. Add Create Button to Chat Input
**File**: `frontend/src/components/thread/chat-input/chat-input.tsx`

```typescript
// Add button near other chat input actions
<Tooltip>
  <TooltipTrigger asChild>
    <Button
      size="icon"
      variant="ghost"
      onClick={() => setIsCreateDialogOpen(true)}
      title="Create slash command"
    >
      <Plus className="w-4 h-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>Create slash command</TooltipContent>
</Tooltip>
```

### Phase 3: Integration with Existing Hooks

#### 3a. Update `useSlashCommands` hook
**File**: `frontend/src/hooks/useSlashCommands.ts`

Add functions:
```typescript
// Create new command
async function createSlashCommand(folderIdcontext, command: {
  name: string;
  description: string;
  content: string;
}) {
  // 1. Create .md file content
  // 2. Upload via POST /knowledge-base/folders/{id}/upload
  // 3. Return newly created entry
}

// Update existing command
async function updateSlashCommand(entryId: string, updates: {
  description?: string;
  content?: string;
}) {
  // 1. Update metadata (description) via PATCH
  // 2. Upload new file content via upload endpoint
  // 3. Return updated entry
}

// Delete command
async function deleteSlashCommand(entryId: string) {
  // Call DELETE /knowledge-base/entries/{id}
}
```

---

## User Workflow

### Creating a New Command

```
1. User clicks "+" button (Create)
   ↓
2. Dialog opens with form
   ├─ Name field (empty)
   ├─ Description field (empty)
   ├─ Content field (empty)
   └─ Buttons: Cancel, Preview, Save
   ↓
3. User fills in:
   - Name: "extract-dates"
   - Description: "Extract all dates from text"
   - Content: "Extract all dates from the following text..."
   ↓
4. User clicks Preview
   ├─ Shows how it will appear in autocomplete
   └─ Shows what the prompt will be
   ↓
5. User clicks Save
   ├─ Validates form
   ├─ Creates markdown file
   ├─ Uploads to Knowledge Base
   ├─ Invalidates React Query cache
   └─ Dialog closes
   ↓
6. User types "/" in chat
   ├─ Autocomplete appears
   └─ New command "extract-dates" visible ✅
```

### Editing Existing Command

```
1. User types "/" → selects command
2. Right-click or long-press → Context menu
3. Click "Edit"
   ↓
4. Dialog opens with existing data
   - Name: "summarize"
   - Description: "Summarize content..."
   - Content: "You are a world-class summarizer..."
   ↓
5. User modifies content
6. Clicks Save
   ├─ Updates file in Knowledge Base
   ├─ Invalidates cache
   └─ Dialog closes
   ↓
7. Changes reflect immediately ✅
```

---

## Technical Details

### File Format
Commands are saved as Markdown files in the format:

```markdown
# Command Name

## Description
Short description for the autocomplete

## Content
The actual prompt/instruction that will be injected into messages
```

**Example: summarize.md**
```markdown
# Summarize

## Description
Summarize content into 5 bullet points

## Content
Summarize the following content in 5 bullet points, focusing on key takeaways and important numbers or dates.
```

### Form Validation
```
Name:
  - Required
  - Min 1, Max 50 characters
  - Must be valid file name (alphanumeric, -, _)
  - Must be unique in Knowledge Base

Description:
  - Required
  - Min 5, Max 200 characters
  - Plain text (no markdown)

Content:
  - Required
  - Min 20 characters
  - Max 10,000 characters
  - Can be markdown
```

### State Management
```
Component Level (Local):
├─ formValues (name, description, content)
├─ isOpen (dialog visibility)
├─ isLoading (during save/upload)
└─ errors (form validation errors)

Application Level (React Query):
├─ Slash commands list (cached, 5 min TTL)
├─ invalidate on create/update/delete
└─ Automatic refetch triggers UI update
```

---

## Testing Checklist

### Create Command
- [ ] Dialog opens when clicking create button
- [ ] Form validation works (required fields, character limits)
- [ ] Preview shows how command appears in autocomplete
- [ ] Save uploads file to Knowledge Base
- [ ] New command appears in autocomplete immediately
- [ ] Can type "/" and see new command
- [ ] New command's prompt injects correctly

### Edit Command
- [ ] Can right-click/long-press command to edit
- [ ] Edit dialog opens with existing data
- [ ] Can modify description and content
- [ ] Save updates file in Knowledge Base
- [ ] Changes appear immediately in autocomplete
- [ ] Old prompt is replaced with new one

### Delete Command
- [ ] Can delete command from context menu
- [ ] Confirmation dialog appears
- [ ] Deletion works (command disappears from autocomplete)
- [ ] Can't delete when autocomplete is open

### Edge Cases
- [ ] Create command with special characters
- [ ] Create command with very long description/content
- [ ] Upload fails - error handling
- [ ] Duplicate command names - validation
- [ ] Edit while another user edits same command
- [ ] Cancel dialog without saving
- [ ] Keyboard shortcuts (Ctrl+Enter to save?)

---

## Timeline

| Phase | Task | Est. Time |
|-------|------|-----------|
| 1 | Create dialog component | 60 min |
| 2 | Form validation & preview | 30 min |
| 3 | Context menu & edit mode | 45 min |
| 4 | Hook integration | 30 min |
| 5 | Chat input button | 15 min |
| 6 | Testing & bug fixes | 60 min |
| | **Total** | **4 hours** |

---

## Future Enhancements

### Nice to Have Later
- [ ] Keyboard shortcut (Ctrl+K) to create command
- [ ] Import/export commands
- [ ] Command versioning/history
- [ ] Share commands with team
- [ ] Template library (starter commands)
- [ ] Command categories/folders
- [ ] Bulk edit/delete
- [ ] Analytics (command usage)
- [ ] AI-assisted command generation

---

## Implementation Notes

### Do NOT Need to Change
- Backend API endpoints (use existing)
- Database schema (no changes)
- Knowledge Base structure
- Authentication

### DO Need to Change
- Frontend components (new dialog, context menu)
- Chat input component (add button)
- useSlashCommands hook (add CRUD functions)
- No database migrations
- No sync debt ✅

---

## Success Criteria

✅ User can create new slash command through UI  
✅ User can edit existing command  
✅ User can delete command  
✅ New commands appear in autocomplete immediately  
✅ New commands can be selected and used  
✅ Prompts inject correctly  
✅ Form has proper validation  
✅ Error handling works gracefully  
✅ No database schema changes  

---

**Status**: Ready to implement  
**Priority**: High (enhances user experience significantly)  
**Dependencies**: None - can start immediately
