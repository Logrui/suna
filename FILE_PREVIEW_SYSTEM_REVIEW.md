# File Preview System in Suna Threads - Comprehensive Review

## Overview

Suna has a sophisticated file preview system in Threads that handles displaying files in multiple ways:

1. **Inline Previews** - Files shown directly in thread with content rendered
2. **Grid Previews** - Files displayed in grid layout with rich preview capabilities
3. **Modal Viewer** - Full-screen file viewer for detailed inspection
4. **Inline Renderers** - Type-specific renderers for HTML, Markdown, CSV, XLSX, PDF

---

## Architecture & Components

### Core Components

#### 1. **FileViewerModal** (`file-viewer-modal.tsx`)
The main full-screen file preview dialog triggered when users click on files.

**Key Props:**
- `open: boolean` - Controls modal visibility
- `onOpenChange: (open: boolean) => void` - Callback to close modal
- `sandboxId: string` - ID of the sandbox containing files
- `initialFilePath?: string` - Optional file to open on modal load
- `project?: Project` - Project metadata with sandbox info
- `filePathList?: string[]` - Array of file paths for batch viewing

**Key Features:**
- File browser with directory navigation
- File content loading with React Query (`useFileContentQuery`, `useDirectoryQuery`)
- File navigation arrows when viewing multiple files from a list
- Support for special file types (Markdown documents with TipTap editor)
- Download progress tracking
- Authentication-aware file fetching via `useAuth()`
- Content type detection (images, PDFs, text, binary)

**File State Management:**
- `selectedFilePath` - Currently viewed file path
- `currentPath` - Current directory being browsed
- `isFileListMode` - Boolean indicating batch file viewing
- `currentFileIndex` - Index in file list for navigation
- `rawContent` - Fetched file content (string or Blob)
- `textContentForRenderer` - Text content prepared for rendering components
- `blobUrlForRenderer` - Object URL for binary files (images, PDFs, XLSX)
- `contentError` - Error message if file fails to load

**Content Processing Flow:**
```
File Selected
    ↓
useFileContentQuery loads content
    ↓
Detect file type (image, PDF, text, etc.)
    ↓
For images/PDFs: Create blob URL → setBlobUrlForRenderer
For text: Parse and format → setTextContentForRenderer
    ↓
FileRenderer component displays content
```

#### 2. **FileAttachment** (`file-attachment.tsx`)
Individual file attachment component used within threads.

**Key Props:**
- `filepath: string` - Path to file
- `onClick?: (path: string) => void` - Triggered when file is clicked (typically opens modal)
- `sandboxId?: string` - Sandbox ID for file access
- `showPreview?: boolean` - Whether to load/show preview
- `localPreviewUrl?: string` - Pre-generated preview URL (bypasses API fetch)
- `collapsed?: boolean` - Controls whether HTML/MD/CSV content is rendered inline
- `project?: Project` - Project info
- `isSingleItemGrid?: boolean` - Detects single file scenarios
- `standalone?: boolean` - Minimal styling mode

**Key Features:**
- Multi-format file type detection (images, code, text, PDF, spreadsheets, archives)
- Inline preview rendering for HTML, Markdown, CSV, XLSX, PDF when `collapsed={false}`
- Image preview with custom aspect ratio handling
- Binary content fetching for PDFs and XLSX via `useImageContent`
- XLSX sheet name parsing and sheet selection dropdown
- Error handling with retry and "Open in viewer" buttons
- Download functionality with proper MIME type handling

**Display Logic:**
```
isImage && showPreview
    → Render <img> with imageUrl
    
isHtmlOrMd || isCsv || isXlsx || isPdf
    if collapsed === false && isGridLayout
        → Use appropriate renderer (HtmlRenderer, MarkdownRenderer, CsvRenderer, XlsxRenderer, PdfRenderer)
    else
        → Show as collapsed file thumbnail
        
Default
    → Generic file icon with type label and size
```

#### 3. **AttachmentGroup** (`attachment-group.tsx`)
Container component that groups multiple file attachments.

**Key Props:**
- `files: (string | UploadedFile)[]` - Array of file paths or file objects
- `layout: 'inline' | 'grid'` - Display layout
- `onFileClick?: (path: string, filePathList?: string[]) => void` - File click handler
- `collapsed?: boolean` - Inline preview toggle
- `showPreviews?: boolean` - Enable preview loading

**Key Features:**
- Deduplicates file paths
- Mobile-responsive layout (max 2 files on mobile, 5 on desktop)
- Modal dialog for viewing all files if exceeds visible limit
- Passes file list context to clicks for batch navigation
- Responsive grid layout with proper height calculations

### Preview Renderers

Located in `preview-renderers/` directory:

| Renderer | File | Purpose |
|----------|------|---------|
| `HtmlRenderer` | `html-renderer.tsx` | Renders HTML with iframe sandbox |
| `MarkdownRenderer` | `file-preview-markdown-renderer.tsx` | Renders Markdown with syntax highlighting |
| `CsvRenderer` | `csv-renderer.tsx` | Displays CSV as interactive table |
| `XlsxRenderer` | `xlsx-renderer.tsx` | Displays Excel sheets with sheet navigation |
| `PdfRenderer` | `pdf-renderer.tsx` | PDF viewer using pdf.js or similar |
| `FileRenderer` | `index.tsx` | Main dispatcher that selects appropriate renderer |

---

## Data Flow: From Click to Display

### Scenario 1: Quick Preview in Thread (Inline)

```
User clicks file in AttachmentGroup
    ↓
AttachmentGroup.handleFileClick(path)
    ↓
Calls onFileClick callback (passed from ThreadComponent)
    ↓
ThreadComponent.handleFileClick
    ↓
Sets initialFilePath & opens FileViewerModal
```

### Scenario 2: Inline Expanded Preview (No Modal)

```
FileAttachment with collapsed={false}
    ↓
useFileContent/useImageContent load content
    ↓
Renderer component (HtmlRenderer, MarkdownRenderer, etc.) displays content
    ↓
Content shown directly in thread grid
```

### Scenario 3: Full Modal View

```
FileViewerModal opens with initialFilePath
    ↓
useDirectoryQuery loads /workspace directory
    ↓
FileCache (React Query) caches files
    ↓
useFileContentQuery loads file content
    ↓
Content type detected (image, PDF, text, binary)
    ↓
Appropriate handler processes content:
    - Images/PDFs: Create Blob URL via useImageContent
    - Text: Format for text renderer
    - XLSX: Parse sheets
    ↓
FileRenderer displays with proper component
```

---

## State Management & Hooks

### React Query Hooks

#### `useFileContentQuery(sandboxId, filePath, options)`
- **Purpose:** Load text file content
- **Cache:** 5 minutes stale time
- **Used by:** FileViewerModal, FileAttachment
- **Returns:** `{ data: string | null, isLoading, error }`

#### `useImageContent(sandboxId, filePath, options)`
- **Purpose:** Load binary content as Blob URL (images, PDFs, XLSX)
- **Returns:** Blob URL ready for `<img>`, `<embed>`, fetch
- **Used by:** FileAttachment for images and PDFs

#### `useDirectoryQuery(sandboxId, path, options)`
- **Purpose:** List files/directories at given path
- **Cache:** 30 seconds stale time
- **Returns:** File tree for directory browser

### FileCache Utilities

Located in `hooks/react-query/files.ts`:

```typescript
export class FileCache {
  static isImageFile(path: string): boolean
  static isPdfFile(path: string): boolean
  static isMarkdownFile(path: string): boolean
  static isOfficeFile(path: string): boolean
  // ...
}
```

---

## File Preview Popup Flow

### Entry Point: `ThreadComponent.tsx`

```tsx
// State
const [fileViewerOpen, setFileViewerOpen] = useState(false);
const [selectedFile, setSelectedFile] = useState<string | null>(null);
const [filePathList, setFilePathList] = useState<string[]>([]);

// Handler - triggered by AttachmentGroup.onFileClick
const handleFileClick = (filePath: string, pathList?: string[]) => {
  setSelectedFile(filePath);
  setFilePathList(pathList || [filePath]);
  setFileViewerOpen(true);  // ← Opens popup!
};

// Render
<FileViewerModal
  open={fileViewerOpen}
  onOpenChange={setFileViewerOpen}
  sandboxId={project?.sandbox?.sandbox_id}
  initialFilePath={selectedFile}
  project={project}
  filePathList={filePathList}
/>
```

### FileViewerModal Internals

**Modal Opening Sequence:**

1. **Modal State:**
   ```tsx
   const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
   ```

2. **Initial Load Effect:** On `open={true}`:
   ```tsx
   useEffect(() => {
     if (open && safeInitialFilePath && !initialPathProcessed) {
       // Set selected file to show content
       setSelectedFilePath(safeInitialFilePath);
       setInitialPathProcessed(true);
     }
   }, [open]);
   ```

3. **Content Loading:** Automatic via React Query:
   ```tsx
   const { data: cachedFileContent, isLoading, error } = useFileContentQuery(
     sandboxId,
     selectedFilePath,
     { enabled: !!selectedFilePath }
   );
   ```

4. **Content Processing:**
   ```tsx
   useEffect(() => {
     if (cachedFileContent && !isCachedFileLoading) {
       // Detect type
       const isImageFile = FileCache.isImageFile(selectedFilePath);
       const isPdfFile = FileCache.isPdfFile(selectedFilePath);
       
       // Process content
       if (isImageFile || isPdfFile) {
         // Binary content → Blob URL
         setBlobUrlForRenderer(cachedFileContent);
       } else {
         // Text content → Format for renderer
         setTextContentForRenderer(processContent(cachedFileContent));
       }
     }
   }, [cachedFileContent, isCachedFileLoading]);
   ```

5. **Rendering:**
   ```tsx
   <FileRenderer
     content={textContentForRenderer}
     binaryUrl={blobUrlForRenderer}
     fileName={selectedFilePath?.split('/').pop()}
     filePath={selectedFilePath}
   />
   ```

---

## Supported File Types & Preview Capabilities

| Type | Extension(s) | Preview Method | Renderer |
|------|--------------|-----------------|----------|
| **Images** | `.jpg`, `.png`, `.gif`, `.webp`, `.svg`, `.bmp` | `<img>` with Blob URL | Native img |
| **Markdown** | `.md`, `.markdown` | Rendered HTML | MarkdownRenderer |
| **HTML** | `.html`, `.htm` | Iframe sandbox | HtmlRenderer |
| **CSV/TSV** | `.csv`, `.tsv` | Table display | CsvRenderer |
| **Excel** | `.xlsx`, `.xls` | Sheet viewer + tabs | XlsxRenderer |
| **PDF** | `.pdf` | PDF viewer | PdfRenderer |
| **Code** | `.js`, `.ts`, `.py`, etc. | Syntax highlighting | CodeRenderer (via type-specific) |
| **Text** | `.txt`, `.log`, `.env` | Plain text | TextRenderer |
| **Other** | Any other | Icon + metadata | Generic file attachment |

---

## Key Design Patterns

### 1. **Lazy Loading with React Query**
- Files aren't fetched until modal opens
- Content cached for 5 minutes
- Prevents duplicate network requests

### 2. **Content Type Detection**
```tsx
function getFileType(filename: string): FileType {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  if (['png', 'jpg', ...].includes(ext)) return 'image';
  if (['md', 'markdown'].includes(ext)) return 'markdown';
  // etc...
}
```

### 3. **Authentication-Aware Fetching**
```tsx
const { session } = useAuth();

// In fetch headers
headers: {
  'Authorization': `Bearer ${session.access_token}`
}
```

### 4. **Responsive Grid Layout**
- Desktop: Shows up to 5 file previews
- Mobile: Shows up to 2 file previews
- "More" button opens modal dialog for hidden files

### 5. **Batch File Navigation**
- When clicking a file, entire `filePathList` is passed
- Modal enables previous/next navigation arrows
- Smooth transition between files in list

---

## Performance Optimizations

1. **React Query Caching**
   - File content: 5 minute stale time
   - Directory listings: 30 second stale time
   - Prevents refetches during modal open/close cycles

2. **Content Containment**
   ```tsx
   contain: (isPdf || isHtmlOrMd) ? 'layout size' : undefined
   containIntrinsicSize: (isPdf || isHtmlOrMd) ? '100% 500px' : undefined
   ```

3. **Lazy Renderer Loading**
   ```tsx
   // Dynamic import for large libraries
   const XLSX = await import('xlsx');
   ```

4. **Blob URL Management**
   - URLs created and cleaned up properly
   - `URL.revokeObjectURL()` after use

---

## Error Handling

### FileAttachment Error States:

```tsx
{hasError && (
  <div className="h-full w-full flex flex-col items-center justify-center p-4">
    <div className="text-red-500 mb-2">Error loading content</div>
    {/* Download and Open in Viewer fallbacks */}
  </div>
)}
```

### FileViewerModal Error Handling:

```tsx
if (cachedFileError) {
  setContentError(`Failed to load file: ${cachedFileError.message}`);
  // Show retry button
}
```

---

## Authentication & Security

### Session-Based Access

```tsx
const { session } = useAuth();

// All file fetches include auth token
const response = await fetch(fileUrl, {
  headers: {
    'Authorization': `Bearer ${session.access_token}`
  }
});
```

### Sandbox Isolation

- Files only accessible via sandbox API endpoints
- Path validation prevents directory traversal
- `/workspace` prefix enforced for file paths

### HTML Preview Sandboxing

```tsx
// HtmlRenderer uses iframe with restricted permissions
<iframe
  sandbox="allow-same-origin"
  srcDoc={htmlContent}
/>
```

---

## Common Issues & Solutions

### Issue 1: File Not Showing Preview
**Cause:** `collapsed={true}` (default) - inline previews disabled  
**Solution:** Set `collapsed={false}` in FileAttachment or AttachmentGroup

### Issue 2: Image Shows Broken
**Cause:** Missing authentication or wrong blob URL  
**Solution:** Check `session.access_token` is valid, verify `useImageContent` hook

### Issue 3: Modal Opens Slowly
**Cause:** First-time fetch, no React Query cache  
**Solution:** Stale cache is reused, second open is instant

### Issue 4: XLSX Displays Wrong Sheet
**Cause:** Sheet index mismatch  
**Solution:** Use sheet dropdown to select; index persists during modal open

---

## File Organization

```
frontend/src/components/thread/
├── file-viewer-modal.tsx          # Full-screen file viewer modal
├── file-attachment.tsx            # Individual file attachment component
├── attachment-group.tsx           # Group of file attachments
├── file-browser.tsx               # File browser dialog
├── preview-renderers/
│   ├── index.tsx                  # Main FileRenderer dispatcher
│   ├── html-renderer.tsx          # HTML preview component
│   ├── file-preview-markdown-renderer.tsx  # Markdown preview
│   ├── csv-renderer.tsx           # CSV table preview
│   ├── xlsx-renderer.tsx          # Excel sheet preview
│   ├── pdf-renderer.tsx           # PDF viewer
│   └── [other renderers]
├── tool-views/
│   └── file-operation/
│       ├── FileOperationToolView.tsx
│       └── FileEditToolView.tsx
└── tiptap-document-modal.tsx      # Document editor (Markdown)
```

---

## Summary

The file preview system in Suna Threads is:

✅ **Modular** - Each component has clear responsibility  
✅ **Performant** - React Query caching, lazy loading  
✅ **Accessible** - Full keyboard navigation, ARIA labels  
✅ **Secure** - Authentication required, sandbox isolation  
✅ **User-Friendly** - Inline previews + modal viewer + batch navigation  
✅ **Extensible** - Easy to add new file type renderers  

The core flow is: **Click File → ThreadComponent.handleFileClick → FileViewerModal Opens → React Query Loads Content → FileRenderer Displays → User Can Navigate**
