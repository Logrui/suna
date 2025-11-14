# Workspace Files Preview System - High-Level Overview

**Document**: Architecture of File Preview Components in Suna  
**Date**: November 5, 2025  
**Purpose**: Understand how the Suna frontend renders file previews in workspace/threads

---

## Executive Summary

The Suna application has a comprehensive file preview system used in threads/conversations that displays various file types (Markdown, code, PDF, images, CSV, XLSX, etc.) through a centralized rendering architecture. This system can be adapted or referenced for Knowledge Base file previews.

**Key Components**:
- **FileViewerModal** - Main modal that manages file browsing and display (1605 lines)
- **FileRenderer** - Central dispatcher that routes files to type-specific renderers
- **Type-Specific Renderers** - Individual components for each file type
- **React Query Integration** - Caching and data fetching for file content

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────┐
│           FileViewerModal                               │
│  (Main UI, navigation, file selection)                  │
│  - File browser (directory listing)                     │
│  - File content display area                            │
│  - Navigation controls (up/down directories)            │
└────────────────┬────────────────────────────────────────┘
                 │ passes file path & content
                 │
┌────────────────▼────────────────────────────────────────┐
│           FileRenderer                                  │
│  (Central dispatcher)                                   │
│  - Determines file type from extension                  │
│  - Selects appropriate renderer                         │
│  - Routes content + metadata                            │
└────────────────┬────────────────────────────────────────┘
                 │
        ┌────────┼────────┬───────────┬──────────┬───────────┐
        │        │        │           │          │           │
        ▼        ▼        ▼           ▼          ▼           ▼
    ┌───────┐┌───────┐┌───────┐┌────────┐┌────────┐┌────────┐
    │ Code  ││Markdown││Images ││ PDFs   ││ CSV    ││ XLSX   │
    │Render ││Renderer││Render ││Renderer││Renderer││Renderer│
    └───────┘└───────┘└───────┘└────────┘└────────┘└────────┘
        │        │        │         │        │        │
        └────────┴────────┴─────────┴────────┴────────┘
                        │
                  ┌─────▼─────┐
                  │ Browser   │
                  │ Rendering │
                  └───────────┘
```

---

## Core Components Detailed

### 1. **FileViewerModal** (`file-viewer-modal.tsx`)
**File**: `frontend/src/components/thread/file-viewer-modal.tsx` (1605 lines)

**Responsibilities**:
- Display modal dialog for file browsing and viewing
- Manage navigation between directories
- Track selected file path and content
- Fetch file content via React Query hooks
- Handle upload/download operations
- Display loading and error states

**Key State**:
```typescript
const [currentPath, setCurrentPath] = useState('/workspace');
const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
const [textContentForRenderer, setTextContentForRenderer] = useState<string | null>(null);
const [blobUrlForRenderer, setBlobUrlForRenderer] = useState<string | null>(null);
```

**Key Props**:
```typescript
interface FileViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sandboxId: string;
  initialFilePath?: string | null;
  project?: Project;
  filePathList?: string[];
}
```

**Data Fetching**:
- Uses `useDirectoryQuery()` - React Query hook for directory listings
- Uses `useFileContentQuery()` - React Query hook for file content
- Auto-detects content type (text vs binary)

---

### 2. **FileRenderer** (`file-renderers/index.tsx`)
**File**: `frontend/src/components/file-renderers/index.tsx` (294 lines)

**Responsibilities**:
- Central routing component - determines file type from extension
- Selects and renders appropriate type-specific renderer
- Handles project/sandbox metadata
- Manages file type mapping

**File Type Detection** (`getFileTypeFromExtension()`):
```typescript
Markdown: .md, .markdown
Code: .js, .ts, .jsx, .tsx, .py, .java, .go, .rs, etc. (50+ languages)
Images: .png, .jpg, .jpeg, .gif, .webp, .svg, .bmp, .ico
PDF: .pdf
CSV: .csv, .tsv
XLSX: .xlsx, .xls
Text: .txt, .log, .env, .ini
Binary: (default for unknown types)
```

**Main Props**:
```typescript
interface FileRendererProps {
  content: string | null;              // Text content for text files
  binaryUrl: string | null;            // Blob URL for binary files
  fileName: string;
  filePath?: string;
  className?: string;
  project?: FileRendererProject;       // For sandbox URLs, auth
  markdownRef?: React.RefObject<HTMLDivElement>;
  onDownload?: () => void;
  isDownloading?: boolean;
}
```

**Routing Logic**:
```typescript
const fileType = getFileTypeFromExtension(fileName);

switch(fileType) {
  case 'markdown': return <MarkdownRenderer />;
  case 'code': return <CodeRenderer />;
  case 'image': return <ImageRenderer />;
  case 'pdf': return <PdfRenderer />;
  case 'csv': return <CsvRenderer />;
  case 'xlsx': return <XlsxRenderer />;
  case 'text': return <CodeRenderer />;
  default: return <BinaryRenderer />;
}
```

---

### 3. **Type-Specific Renderers**

#### **MarkdownRenderer** (`file-renderers/authenticated-markdown-renderer.tsx`)
- Uses `react-markdown` with plugins:
  - `remarkGfm` - GitHub Flavored Markdown
  - `rehypeRaw` - HTML support
  - `rehypeSanitize` - XSS protection
- Custom code block rendering with syntax highlighting
- Authenticated image loading (handles sandbox URLs)
- Mermaid diagram support
- Unicode content processing

#### **CodeRenderer** (`file-renderers/code-renderer.tsx`)
- Syntax highlighting via `highlight.js`
- Language detection from file extension
- Line numbering
- Copy-to-clipboard functionality
- Supports 50+ programming languages

#### **ImageRenderer** (`file-renderers/image-renderer.tsx`)
- Direct image display
- Handles sandbox authenticated URLs
- Responsive sizing
- Error fallback

#### **PdfRenderer** (`file-renderers/pdf-renderer.tsx`)
- PDF.js for rendering
- Page navigation
- Zoom controls
- Handles large files efficiently

#### **CsvRenderer** (`file-renderers/csv-renderer.tsx`)
- Parses CSV content
- Displays as interactive table
- Column headers, row scrolling

#### **XlsxRenderer** (`file-renderers/xlsx-renderer.tsx`)
- Excel file parsing
- Sheet navigation
- Formula support
- Formatted cell display

---

### 4. **FileBrowser** (`file-browser.tsx`)
**File**: `frontend/src/components/thread/file-browser.tsx` (323 lines)

**Responsibilities**:
- Lightweight file browser component
- Simpler than FileViewerModal
- Lists files in current directory
- Supports file selection and drag-drop

**Features**:
- Breadcrumb navigation
- Draggable file items (for drag-drop UI patterns)
- File content fetching
- Directory traversal

---

### 5. **React Query Integration**

**Hooks Used**:
```typescript
// Directory listing with caching
const { data: files = [], isLoading, error } = useDirectoryQuery(
  sandboxId, 
  currentPath,
  { staleTime: 30 * 1000 } // 30 second cache
);

// File content with caching
const { data: fileContent, isLoading } = useFileContentQuery(
  sandboxId,
  selectedFilePath,
  { staleTime: 5 * 60 * 1000 } // 5 minute cache
);
```

**Benefits**:
- Automatic caching prevents refetches
- Loading states for UI feedback
- Error handling built-in
- Memory-efficient with stale time

---

## Data Flow for File Preview

```
User clicks file in FileViewerModal
        │
        ▼
File path stored in state
        │
        ▼
useFileContentQuery fetches content via API
        │
        ├─ Text file? → setTextContentForRenderer(content)
        │
        └─ Binary file? → Create blob URL → setBlobUrlForRenderer(url)
        │
        ▼
FileRenderer receives content + blobUrl + fileName
        │
        ▼
getFileTypeFromExtension(fileName) determines type
        │
        ▼
Route to type-specific renderer
        │
        ▼
Renderer displays content in browser
```

---

## File Content API Response Flow

**Current Knowledge Base Issue**:
When fetching Knowledge Base entries, the console logs show:
```
hasContent: false,
contentLength: 0
```

This suggests the Knowledge Base API returns:
```typescript
{
  filename: 'summarize.md',
  summary: 'Summarize content...',  // ✅ Description available
  content: null or empty              // ❌ Content NOT being returned
}
```

**Needed for File Preview**:
The FileRenderer needs:
```typescript
{
  fileName: 'summarize.md',
  content: 'Summarize the following...',  // ✅ Full prompt text
  filePath: 'suna/knowledge-base/Suna/summarize.md'
}
```

---

## Key Technologies & Libraries

| Technology | Purpose | Usage |
|-----------|---------|-------|
| **React** | UI framework | Component-based architecture |
| **React Query** | Data caching & fetching | useDirectoryQuery, useFileContentQuery |
| **React Markdown** | Markdown rendering | Markdown files (.md) |
| **Highlight.js** | Code syntax highlighting | Code files (.js, .ts, .py, etc.) |
| **PDF.js** | PDF rendering | PDF files (.pdf) |
| **SheetJS** | Excel parsing | XLSX/XLS files |
| **Papa Parse** | CSV parsing | CSV/TSV files |
| **Mermaid** | Diagram rendering | Mermaid diagrams in markdown |
| **DND Kit** | Drag-and-drop | File drag operations |

---

## File Preview Implementation Path for Knowledge Base

To add file previews to Knowledge Base files in Suna App:

### Option 1: Reuse FileViewerModal
```tsx
<FileViewerModal
  open={isPreviewOpen}
  onOpenChange={setIsPreviewOpen}
  sandboxId={knowledgeBaseFolderId}
  initialFilePath={selectedFilePath}
/>
```

### Option 2: Create KnowledgeBaseFilePreview Component
```tsx
// New component using same FileRenderer pattern
<KnowledgeBaseFilePreview
  file={knowledgeBaseEntry}
  onClose={() => setIsOpen(false)}
/>
```

### Option 3: Lightweight Preview Popup
```tsx
// Simple popup using FileRenderer directly
<FileRenderer
  content={entry.content}
  fileName={entry.filename}
  className="max-h-96 w-full"
/>
```

---

## Current Limitations & Observations

### For Slash Commands (Current Issue)

**Problem**: Console logs show Knowledge Base entries have `content: null`

**Why It Matters**:
- FileRenderer expects `content` parameter to be the actual file text
- Without content, markdown/code renderers have nothing to display
- Prompt injection for slash commands depends on having content

**Next Investigation Steps**:
1. Check if Knowledge Base API has separate endpoint for file content
2. Verify upload stored file content correctly
3. Check if `entry.content` vs `entry.prompt` vs separate fetch needed
4. May need additional API call to retrieve full content

---

## Component Dependency Tree

```
FileViewerModal (1605 lines)
├── React Query Hooks
│   ├── useDirectoryQuery
│   └── useFileContentQuery
├── FileRenderer (294 lines)
│   ├── MarkdownRenderer (296 lines)
│   │   └── react-markdown + plugins
│   ├── CodeRenderer (260+ lines)
│   │   └── highlight.js
│   ├── ImageRenderer
│   ├── PdfRenderer
│   ├── CsvRenderer
│   └── XlsxRenderer
├── FileBrowser (323 lines)
├── File system APIs
│   ├── listSandboxFiles()
│   ├── getSandboxFileContent()
│   └── useDirectoryQuery hook
└── UI Components
    ├── Dialog, ScrollArea
    ├── Button, Skeleton
    └── Icons from lucide-react
```

---

## Summary

The Workspace Files Preview system in Suna is a well-architected, modular system that:
1. **Handles multiple file types** through type detection and routing
2. **Uses React Query** for efficient caching and data fetching
3. **Provides specialized renderers** for each file type with appropriate UX
4. **Manages large files** with pagination/lazy loading where appropriate
5. **Authenticates binary content** for sandbox/secure environments

**For Knowledge Base**:
- Can directly adapt FileRenderer component
- Needs to ensure Knowledge Base API returns full `content` field
- May need to create KnowledgeBaseFileViewer wrapper component
- Would integrate with existing FileBrowser or create new modal

---

## File Locations

| Component | Path | Lines | Purpose |
|-----------|------|-------|---------|
| FileViewerModal | `components/thread/file-viewer-modal.tsx` | 1605 | Main file browser & viewer |
| FileRenderer | `components/file-renderers/index.tsx` | 294 | Central routing dispatcher |
| MarkdownRenderer | `components/file-renderers/authenticated-markdown-renderer.tsx` | 296 | Markdown rendering |
| CodeRenderer | `components/file-renderers/code-renderer.tsx` | 260+ | Syntax highlighting |
| FileBrowser | `components/thread/file-browser.tsx` | 323 | Lightweight browser |
| Preview Renderers | `components/thread/preview-renderers/` | Various | Additional renderers |
| React Query Hooks | `hooks/react-query/files/` | Various | Data fetching hooks |

