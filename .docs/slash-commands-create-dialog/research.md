# Add to Knowledge Base Modal - Construction & Architecture Research

## Overview

The "Add to Knowledge Base" modal is a comprehensive multi-tab dialog component located at:
**`frontend/src/components/knowledge-base/unified-kb-entry-modal.tsx`** (820 lines)

This research documents how the modal is constructed, rendered, and integrated to serve as a template for building a similar slash command creation dialog.

---

## 1. Component Structure & Architecture

### 1.1 File Organization

```
unified-kb-entry-modal.tsx
├── Imports (shadcn/ui components, lucide-react icons, utilities)
├── Type Definitions
│   ├── FileUploadStatus interface
│   └── UnifiedKbEntryModalProps interface
├── Component Definition
│   ├── Props destructuring
│   ├── State declarations (11 state variables)
│   ├── Event handlers (7 async functions)
│   └── Return JSX (Dialog wrapper)
└── Export (default export)
```

### 1.2 Component Props Interface

```typescript
interface UnifiedKbEntryModalProps {
    folders: Folder[];                      // Available folders for selection
    onUploadComplete: () => void;           // Callback to refresh parent data
    trigger?: React.ReactNode;              // Custom trigger element (optional)
    defaultTab?: 'upload' | 'text' | 'git'; // Initial tab to display
}
```

**Key Pattern**: Props allow customization of the trigger element and default tab, making the component reusable for different workflows.

---

## 2. Dialog Container Structure

### 2.1 Outer Dialog Wrapper

```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
    <DialogTrigger asChild>
        {trigger || <Button>...</Button>}
    </DialogTrigger>
    <DialogContent>
        {/* Modal content */}
    </DialogContent>
</Dialog>
```

**Key Details:**
- `Dialog` manages `isOpen` state and `onOpenChange` callback
- `DialogTrigger` can accept custom trigger element via `trigger` prop
- Default trigger: Button with "Add to Knowledge Base" text and Plus icon
- `asChild` prop prevents wrapper div creation

### 2.2 DialogContent Specifications

```tsx
<DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
```

**Sizing & Layout:**
- **Width**: `sm:max-w-4xl` (responsive, max 56rem at sm breakpoint)
- **Height**: `max-h-[90vh]` (90% of viewport height)
- **Overflow**: `hidden` on container (managed by children)
- **Layout**: `flex flex-col` (vertical stack with header, content, footer)

### 2.3 Header Section

```tsx
<DialogHeader className="flex-shrink-0">
    <DialogTitle className="text-xl font-semibold">
        Add to Knowledge Base
    </DialogTitle>
    <p className="text-sm text-muted-foreground">
        Upload files, create text entries, or clone repositories
    </p>
</DialogHeader>
```

**Characteristics:**
- `flex-shrink-0` prevents header from shrinking when content grows
- Title and description clearly communicate modal purpose
- Subtitle explains available actions

---

## 3. State Management Architecture

### 3.1 State Variables Breakdown

```typescript
// Modal visibility
const [isOpen, setIsOpen] = useState(false);
const [activeTab, setActiveTab] = useState(defaultTab);

// Folder selection & creation
const [selectedFolder, setSelectedFolder] = useState<string>('');
const [isCreatingFolder, setIsCreatingFolder] = useState(false);
const [newFolderName, setNewFolderName] = useState('');
const [isEditingNewFolder, setIsEditingNewFolder] = useState(false);

// File upload state
const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
const [uploadStatuses, setUploadStatuses] = useState<FileUploadStatus[]>([]);
const [isDragOver, setIsDragOver] = useState(false);
const [isUploading, setIsUploading] = useState(false);

// Text entry state
const [filename, setFilename] = useState('');
const [content, setContent] = useState('');
const [isCreatingText, setIsCreatingText] = useState(false);

// Git clone state
const [gitUrl, setGitUrl] = useState('');
const [gitBranch, setGitBranch] = useState('main');
const [isCloning, setIsCloning] = useState(false);

// Refs for DOM access
const fileInputRef = useRef<HTMLInputElement>(null);
const newFolderInputRef = useRef<HTMLInputElement>(null);
```

**State Organization Pattern:**
- **Modal State**: visibility and active tab
- **Folder State**: selection, creation, editing
- **Tab-Specific State**: separate state for upload/text/git modes
- **Loading States**: boolean flags for async operations
- **Validation**: computed from input values

### 3.2 Validation Hooks

```typescript
const existingFolderNames = folders.map(f => f.name);
const folderValidation = useNameValidation(newFolderName, 'folder', existingFolderNames);
const filenameValidation = useNameValidation(filename, 'file');
```

**Custom Hook Pattern**: `useNameValidation` checks:
- Empty strings
- Duplicate names (for folders)
- Special characters
- Length constraints

Returns object with: `isValid`, `friendlyError`, etc.

---

## 4. Tab System Implementation

### 4.1 Tab Configuration

```tsx
<Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
    <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="upload" className="gap-2">
            <CloudUpload className="h-4 w-4" />
            Upload Files
        </TabsTrigger>
        <TabsTrigger value="text" className="gap-2">
            <FileText className="h-4 w-4" />
            Text Entry
        </TabsTrigger>
        <TabsTrigger value="git" className="gap-2" disabled>
            <GitBranch className="h-4 w-4" />
            Git Clone
            <span className="text-xs text-muted-foreground ml-1">(Coming Soon)</span>
        </TabsTrigger>
    </TabsList>
```

**Tab Features:**
- **Icons**: Each tab has a lucide-react icon
- **Labels**: Descriptive names for each mode
- **Disabled State**: Can disable unavailable tabs (e.g., Git Clone marked "Coming Soon")
- **Grid Layout**: `grid-cols-3` distributes tabs evenly

### 4.2 Tab Content Structure

Each tab has a `TabsContent` wrapper:

```tsx
<TabsContent value="upload" className="space-y-4 mt-6">
    {/* Tab-specific content */}
</TabsContent>
```

**Styling Pattern:**
- `space-y-4` for vertical rhythm between elements
- `mt-6` for spacing below tabs
- Each tab is independent - only visible when active

---

## 5. Folder Selection UI

### 5.1 Two-State Folder Selector

**Normal State** (displaying folder dropdown):
```tsx
<div className="flex gap-2">
    <select 
        value={selectedFolder}
        onChange={(e) => setSelectedFolder(e.target.value)}
        className="flex-1 h-10 px-3 py-2 text-sm border border-input bg-background rounded-md"
        disabled={folders.length === 0}
    >
        <option value="">
            {folders.length === 0 ? 'No folders available' : 'Choose a folder...'}
        </option>
        {folders.map((folder) => (
            <option key={folder.folder_id} value={folder.folder_id}>
                {folder.name} ({folder.entry_count} files)
            </option>
        ))}
    </select>
    <Button 
        type="button" 
        variant="outline"
        className="h-10"
        onClick={() => {
            setIsEditingNewFolder(true);
            setTimeout(() => newFolderInputRef.current?.focus(), 100);
        }}
    >
        <FolderPlus className="h-4 w-4" />
    </Button>
</div>
```

**Create Folder State** (displaying input field):
```tsx
<div className="flex items-center gap-2">
    <Input
        ref={newFolderInputRef}
        placeholder="Enter folder name..."
        value={newFolderName}
        onChange={(e) => setNewFolderName(e.target.value)}
        onKeyDown={(e) => {
            if (e.key === 'Enter' && folderValidation.isValid) {
                handleFolderCreation();
            } else if (e.key === 'Escape') {
                setIsEditingNewFolder(false);
                setNewFolderName('');
            }
        }}
        className={cn(
            "flex-1",
            !folderValidation.isValid && newFolderName && "border-red-500"
        )}
        disabled={isCreatingFolder}
    />
    <Button
        size="sm"
        onClick={handleFolderCreation}
        disabled={!folderValidation.isValid || isCreatingFolder}
        className="gap-1"
    >
        {isCreatingFolder ? (
            <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
            <Check className="h-3 w-3" />
        )}
    </Button>
    <Button
        size="sm"
        variant="ghost"
        onClick={() => {
            setIsEditingNewFolder(false);
            setNewFolderName('');
        }}
        disabled={isCreatingFolder}
    >
        <X className="h-3 w-3" />
    </Button>
</div>
```

**Key Patterns:**
- Conditional rendering based on `isEditingNewFolder` state
- Keyboard support (Enter to submit, Escape to cancel)
- Focus management via `useRef` and `setTimeout`
- Inline validation with visual feedback (red border)
- Loading state during async creation

---

## 6. Upload Tab Implementation

### 6.1 Drag-and-Drop Zone

```tsx
<div
    className={cn(
        "relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200",
        isDragOver 
            ? "border-foreground bg-muted/50" 
            : "border-border hover:border-muted-foreground hover:bg-muted/30"
    )}
    onDragOver={handleDragOver}
    onDragLeave={handleDragLeave}
    onDrop={handleDrop}
>
    <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={isUploading}
    />
    <div className="flex flex-col items-center gap-4">
        <CloudUpload className="h-8 w-8 text-muted-foreground" />
        <div>
            <p className="font-medium">
                {isDragOver ? 'Drop files here' : 'Drag & drop files here'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
                or <button 
                    type="button"
                    className="underline font-medium"
                    onClick={() => fileInputRef.current?.click()}
                >
                    browse files
                </button> to upload
            </p>
        </div>
        <p className="text-xs text-muted-foreground">
            Supports PDF, DOC, TXT, MD, CSV, and more • Max 50MB total
        </p>
    </div>
</div>
```

**Techniques:**
- Hidden file input (`opacity-0`) positioned absolutely over the zone
- Drag state feedback: color and background changes
- Multiple file support
- Helper text with file browsing option
- File type and size hints

### 6.2 File Progress Display

```tsx
{selectedFiles.length > 0 && (
    <div className="space-y-3">
        <Label className="text-sm font-medium">
            Selected Files ({selectedFiles.length})
        </Label>
        <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
            {uploadStatuses.map((status, index) => (
                <div key={index} className="flex items-center gap-3 text-sm">
                    <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1 truncate">{status.file.name}</span>
                    
                    {status.status === 'queued' && (
                        <span className="text-muted-foreground">Queued</span>
                    )}
                    {status.status === 'uploading' && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    {status.status === 'success' && (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                    {status.status === 'error' && (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    
                    {status.status === 'error' && (
                        <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="ml-1"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            ))}
        </div>
    </div>
)}
```

**Patterns:**
- Scrollable list (`max-h-48 overflow-y-auto`)
- Status indicators with icons
- Remove button for failed uploads
- Filename truncation for long names

---

## 7. Text Entry Tab

### 7.1 Form Fields

```tsx
<div className="space-y-4">
    <div className="space-y-2">
        <Label htmlFor="filename" className="text-sm font-medium">
            Filename (optional extension)
        </Label>
        <Input
            id="filename"
            placeholder="e.g., my-notes"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            disabled={isCreatingText}
            className={cn(
                "font-mono text-sm",
                !filenameValidation.isValid && filename && "border-red-500"
            )}
        />
        {!filenameValidation.isValid && filename && (
            <p className="text-sm text-red-600">{filenameValidation.friendlyError}</p>
        )}
        <p className="text-xs text-muted-foreground">
            Files will be saved as .txt • Duplicates auto-rename
        </p>
    </div>

    <div className="space-y-2">
        <Label htmlFor="content" className="text-sm font-medium">
            Content
        </Label>
        <Textarea
            id="content"
            placeholder="Enter your text content here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-48 font-mono text-sm resize-none"
            disabled={isCreatingText}
        />
        <p className="text-xs text-muted-foreground">
            This content will be saved as a searchable text file in your knowledge base
        </p>
    </div>
</div>
```

**Design Patterns:**
- Separate input for filename and content
- Validation feedback inline
- Monospace font for code-like content
- Large textarea with `min-h-48`
- Helper text explaining behavior

---

## 8. API Integration Patterns

### 8.1 Authentication Pattern

```typescript
const supabase = createClient();
const { data: { session } } = await supabase.auth.getSession();

if (!session?.access_token) {
    throw new Error('No session found');
}

const response = await fetch(`${API_URL}/knowledge-base/folders/${selectedFolder}/upload`, {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${session.access_token}`,
    },
    body: formData
});
```

**Key Points:**
- Gets session from Supabase client
- Extracts Bearer token from session
- Sends in Authorization header
- Handles missing session gracefully

### 8.2 Error Handling

```typescript
try {
    // Async operation
    const response = await fetch(...);
    
    if (response.ok) {
        // Success handling
        toast.success('Upload completed');
    } else {
        // Check for specific error codes
        const errorData = await response.json().catch(() => null);
        
        if (response.status === 413) {
            toast.error('Knowledge base limit (50MB) exceeded');
        } else {
            toast.error(errorData?.detail || 'Upload failed');
        }
    }
} catch (error) {
    console.error('Error:', error);
    toast.error('An error occurred');
} finally {
    setIsUploading(false);
}
```

**Patterns:**
- Try-catch-finally structure
- Response validation before JSON parsing
- Specific error messages for known codes
- Fallback generic messages
- Always reset loading state in finally

### 8.3 File Upload with Progress

```typescript
const handleFileUpload = async () => {
    setIsUploading(true);
    let completedFiles = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];

        // Update status to uploading
        setUploadStatuses(prev => prev.map((status, index) =>
            index === i ? { ...status, status: 'uploading', progress: 0 } : status
        ));

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(
                `${API_URL}/knowledge-base/folders/${selectedFolder}/upload`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: formData
                }
            );

            if (response.ok) {
                // Update to success
                setUploadStatuses(prev => prev.map((status, index) =>
                    index === i ? { ...status, status: 'success', progress: 100 } : status
                ));
                completedFiles++;
            } else {
                // Update to error with message
                setUploadStatuses(prev => prev.map((status, index) =>
                    index === i ? {
                        ...status,
                        status: 'error',
                        error: await response.json().then(d => d.detail)
                    } : status
                ));
            }
        } catch (error) {
            // Network error
            setUploadStatuses(prev => prev.map((status, index) =>
                index === i ? {
                    ...status,
                    status: 'error',
                    error: `Upload failed: ${error}`
                } : status
            ));
        }
    }

    // Final results
    if (completedFiles === selectedFiles.length) {
        toast.success(`Successfully uploaded ${completedFiles} file(s)`);
    } else if (completedFiles > 0) {
        toast.success(`Uploaded ${completedFiles} of ${selectedFiles.length} files`);
    }

    onUploadComplete(); // Refresh parent
    setIsUploading(false);
};
```

**Patterns:**
- Sequential file processing (not parallel)
- Status tracking per file
- Final callback to refresh parent data
- Toast notifications for results

---

## 9. Action Buttons & Modal Footer

### 9.1 Footer Structure

```tsx
<div className="flex justify-end gap-3 pt-4 border-t">
    <Button
        variant="outline"
        onClick={() => setIsOpen(false)}
        disabled={isUploading || isCreatingText || isCloning}
    >
        Cancel
    </Button>
    {activeTab === 'upload' && (
        <Button
            onClick={handleFileUpload}
            disabled={!selectedFolder || selectedFiles.length === 0 || isUploading}
            className="gap-2"
        >
            {isUploading ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                </>
            ) : (
                <>
                    <Upload className="h-4 w-4" />
                    Upload {selectedFiles.length} file(s)
                </>
            )}
        </Button>
    )}
    {activeTab === 'text' && (
        <Button
            onClick={handleTextCreate}
            disabled={!selectedFolder || !filename.trim() || !content.trim() || !filenameValidation.isValid || isCreatingText}
            className="gap-2"
        >
            {isCreatingText ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                </>
            ) : (
                <>
                    <FileText className="h-4 w-4" />
                    Create Entry
                </>
            )}
        </Button>
    )}
    {activeTab === 'git' && (
        <Button
            onClick={handleGitClone}
            disabled={!selectedFolder || !gitUrl.trim() || isCloning}
            className="gap-2"
        >
            {isCloning ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cloning...
                </>
            ) : (
                <>
                    <GitBranch className="h-4 w-4" />
                    Clone Repository
                </>
            )}
        </Button>
    )}
</div>
```

**Button Patterns:**
- Always-visible Cancel button
- Tab-specific action buttons (conditional rendering)
- Loading states with spinner icons
- Dynamic button text (e.g., "Upload 3 file(s)")
- Comprehensive disable conditions per tab
- Consistent styling with icons and text

---

## 10. Drag-and-Drop Event Handlers

### 10.1 Handler Implementation

```typescript
const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
        addFiles(files);
    }
}, []);

const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
}, []);

const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
}, []);
```

**Key Patterns:**
- `useCallback` to prevent recreating functions
- `preventDefault()` on all drag events
- Extract files from `e.dataTransfer.files`
- State feedback during drag operations

---

## 11. Integration into Parent Component

### 11.1 Usage in KnowledgeBaseManager

The modal is used in `knowledge-base-manager.tsx`:

```tsx
// In KnowledgeBaseManager component
import { UnifiedKbEntryModal } from './unified-kb-entry-modal';

export function KnowledgeBaseManager(props: KnowledgeBaseManagerProps) {
    const { data: folders } = useFolders();

    const handleUploadComplete = () => {
        queryClient.invalidateQueries({ 
            queryKey: ['folders'] 
        });
    };

    return (
        <>
            {/* Other KB manager content */}
            
            <UnifiedKbEntryModal
                folders={folders || []}
                onUploadComplete={handleUploadComplete}
                defaultTab="upload"
            />
        </>
    );
}
```

**Integration Pattern:**
- Pass `folders` array from parent data
- `onUploadComplete` invalidates React Query cache
- Optional `defaultTab` to control initial state
- Omit `trigger` prop to use default button

---

## 12. Key UI/UX Patterns

### 12.1 Responsive Design
- **Modal Width**: `sm:max-w-4xl` (responsive)
- **Height Management**: `max-h-[90vh]` with scrollable content
- **Flex Shrinking**: Header and footer use `flex-shrink-0`

### 12.2 Loading States
- Show spinner icons during async operations
- Disable buttons during processing
- Change button text to reflect action (e.g., "Uploading...")
- Always provide visual feedback

### 12.3 Validation Feedback
- Inline error messages below inputs
- Visual feedback (red border, error icon)
- Disable actions when validation fails
- Show friendly error messages

### 12.4 Accessibility
- All inputs have associated labels with `htmlFor`
- Keyboard support (Enter, Escape)
- Focus management via refs
- Semantic HTML structure

### 12.5 Error Recovery
- Remove button for failed uploads
- Ability to retry operations
- Clear error messages
- Toast notifications for user feedback

---

## 13. Technical Stack & Dependencies

### 13.1 UI Library
```typescript
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
```

All from **shadcn/ui** (pre-configured in project)

### 13.2 Icons
```typescript
import {
    Plus,
    CloudUpload,
    FileText,
    GitBranch,
    FolderPlus,
    X,
    CheckCircle,
    AlertCircle,
    Loader2,
    Upload,
    Check,
    FileIcon,
} from 'lucide-react';
```

From **lucide-react** (icon library)

### 13.3 Utilities
```typescript
import { toast } from 'sonner';                              // Toast notifications
import { createClient } from '@/lib/supabase/client';        // Supabase client
import { FileNameValidator, useNameValidation } from '@/lib/validation'; // Validation hook
import { cn } from '@/lib/utils';                            // Class name utility
import { type Folder } from '@/hooks/react-query/knowledge-base/use-folders';
import { getApiUrl } from '@/lib/get-api-url';              // API URL config
```

### 13.4 Imports Summary
- **7** UI components from shadcn/ui
- **12** icons from lucide-react
- **3** custom utilities
- **1** custom validation hook
- **3** API/config utilities

---

## 14. Recommendations for Slash Command Creation Modal

### 14.1 Simplification Opportunities

For a slash command creation modal, consider:

1. **Fewer Tabs**: Only need "text" mode (no upload/git)
   - Slash commands are just name + description
   - File storage not needed (store in database)

2. **Simpler Form**:
   - Name/title input
   - Description input
   - Optional: prompt template textarea

3. **No Folder Selection**:
   - Slash commands could be organized differently
   - Or use single "Slash Commands" folder

4. **Streamlined Buttons**:
   - Single "Create Command" button
   - Simpler validation logic

### 14.2 Reusable Patterns to Keep

1. **Modal Structure**: Dialog wrapper with trigger
2. **State Management**: Separate state for each input
3. **Validation**: Use `useNameValidation` hook
4. **API Integration**: Same auth pattern with Supabase
5. **Error Handling**: Toast notifications and try-catch
6. **Button States**: Loading spinner and disabled states
7. **Header Section**: Clear title and description

### 14.3 New Considerations

1. **Slash Command Naming**: Validate "no spaces, no special chars"
2. **Database Storage**: POST to `/slash-commands/create` endpoint
3. **Instant Availability**: Command appears immediately in autocomplete
4. **Integration Point**: Button in SlashCommandAutocomplete dropdown

---

## 15. File Location Reference

**Primary Modal Component:**
- `frontend/src/components/knowledge-base/unified-kb-entry-modal.tsx` (820 lines)

**Related Files:**
- `frontend/src/components/knowledge-base/knowledge-base-manager.tsx` (1252 lines) - Parent component
- `frontend/src/lib/validation.ts` - Contains `useNameValidation` hook
- `frontend/src/lib/supabase/client.ts` - Supabase client initialization
- `frontend/src/hooks/react-query/knowledge-base/use-folders.ts` - Folders data hook

**Shadcn/ui Components:**
- Dialog: `frontend/src/components/ui/dialog.tsx`
- Button: `frontend/src/components/ui/button.tsx`
- Input: `frontend/src/components/ui/input.tsx`
- Textarea: `frontend/src/components/ui/textarea.tsx`
- Tabs: `frontend/src/components/ui/tabs.tsx`

---

## Summary

The "Add to Knowledge Base" modal demonstrates a well-architected React component with:
- ✅ Clear separation of concerns (state, handlers, JSX)
- ✅ Comprehensive error handling and validation
- ✅ Accessibility considerations
- ✅ Reusable patterns (tabs, validation, API integration)
- ✅ Professional UX with loading states and feedback
- ✅ Responsive design
- ✅ Extensible architecture (props-based customization)

This component serves as an excellent template for building similar modal dialogs, particularly the planned slash command creation dialog.
