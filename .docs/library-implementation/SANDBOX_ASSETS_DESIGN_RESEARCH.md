# Sandbox Assets & Design Research for Library Page
## How to Access Images, Links, and "Suna's Computer" Renders

**Document Version:** 1.0  
**Date:** November 3, 2025  
**Scope:** Research on accessing sandbox assets, desktop previews, and design render capabilities available for the /library page implementation

---

## Executive Summary

Suna App has **three distinct preview/display mechanisms** available through the Daytona sandbox infrastructure:

1. **File System Access** - Direct access to all files in sandbox (images, documents, code)
2. **VNC Preview** - Live desktop environment rendering at port 6080
3. **Web Preview** - Exposed HTTP services (typically dev servers at ports 3000, 8080, etc.)

All three are accessible to the /library page, providing rich design options for displaying thread/project assets.

---

## Part 1: File System Assets Access

### Overview
Every sandbox has a complete `/workspace` directory hierarchy that contains all project files, generated assets, and outputs.

### Architecture
```
Sandbox File Access Flow:
User Request → Frontend API Call → Backend Sandbox API → Daytona SDK → Sandbox FS → File Content
```

### Key Endpoints

#### 1. **List Files** - `GET /sandboxes/{sandboxId}/files`
```typescript
// Frontend API (lib/api.ts)
export const listSandboxFiles = async (
  sandboxId: string,
  path: string = '/workspace'
): Promise<FileInfo[]>

// Response Structure
{
  "files": [
    {
      "name": "screenshot.png",
      "path": "/workspace/screenshot.png",
      "is_dir": false,
      "size": 2048576,
      "mod_time": "2024-11-03T10:30:00Z",
      "permissions": "644"
    }
  ]
}
```

#### 2. **Get File Content** - `GET /sandboxes/{sandboxId}/files/content`
```typescript
// Frontend API (lib/api.ts)
export const getSandboxFileContent = async (
  sandboxId: string,
  path: string
): Promise<string | Blob>

// URL Construction
${API_URL}/sandboxes/{sandboxId}/files/content?path={encodedPath}

// Returns Blob for binary files (images, PDFs)
// Returns string for text files (JSON, markdown, code)
```

**Key Features:**
- ✅ Returns raw file content as Blob or string
- ✅ Automatically handles UTF-8 encoding for Unicode filenames
- ✅ Supports binary files (images, PDFs, etc.)
- ✅ Cached for 10 minutes (React Query)
- ✅ Requires authentication token

### Current Implementation in Gallery View

The gallery view currently uses this for image preview:
```typescript
// Image detection & fetching
const firstImageFile = files.find((file: any) => {
  const fileName = file.name?.toLowerCase() || '';
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].some(ext => fileName.endsWith(`.${ext}`));
});

// Fetch image content and convert to blob URL
const { data: imagePreviewUrl = '' } = useQuery({
  queryKey: ['image-preview', sandboxId, firstImageFile?.path],
  queryFn: async () => {
    const content = await getSandboxFileContent(sandboxId, firstImageFile.path);
    const blob = content instanceof Blob ? content : new Blob([content]);
    return URL.createObjectURL(blob);
  },
  enabled: !!sandboxId && !!firstImageFile?.path,
  staleTime: 10 * 60 * 1000,
});
```

### Available File Types

**Images:** jpg, jpeg, png, gif, webp, svg  
**Documents:** pdf, docx, xlsx, pptx  
**Code:** js, ts, py, java, go, rust, etc.  
**Data:** json, yaml, xml, csv  
**Media:** mp3, mp4, webm, ogg  
**Archives:** zip, tar, gz  

---

## Part 2: "Suna's Computer" - VNC Desktop Preview

### Overview
Suna sandboxes come with a **full desktop environment** accessible via VNC (Virtual Network Computing) at port 6080. This is the "Suna's Computer" interface visible in the app.

### How It Works

**Backend Setup (execution_service.py):**
```python
# Create sandbox with desktop environment
sandbox = await create_sandbox(sandbox_pass, project_id)
sandbox_id = sandbox.id

# Get VNC preview link from Daytona
vnc_link = await sandbox.get_preview_link(6080)
website_link = await sandbox.get_preview_link(8080)

# Extract URL and token
vnc_url = self._extract_url(vnc_link)      # https://{hostname}/vnc/{token}
website_url = self._extract_url(website_link)
token = self._extract_token(vnc_link)

# Store in project metadata
update_result = await client.table('projects').update({
    'sandbox': {
        'id': sandbox_id,
        'pass': sandbox_pass,
        'vnc_preview': vnc_url,        # VNC preview link
        'sandbox_url': website_url,    # Web server URL
        'token': token                 # Authentication token
    }
}).eq('project_id', project_id).execute()
```

### VNC Link Structure
```
vnc_preview: https://{daytona-host}/vnc/{token}
              
Where:
- {daytona-host} = Daytona deployment hostname
- {token} = Session authentication token
- Port 6080 = VNC server port in sandbox
```

### Key Capabilities

**Desktop Features Available:**
- ✅ Full X11 desktop environment
- ✅ Firefox browser (for web browsing)
- ✅ Text editors (VS Code, nano, vim)
- ✅ File manager (for visual file browsing)
- ✅ Terminal emulator
- ✅ GUI applications (GIMP, Inkscape, etc.)
- ✅ Display server with GPU acceleration available

**Desktop Resolution:**
- Default: 1920x1080 (configurable)
- Browser-based viewing (no client download needed)
- Real-time rendering with mouse/keyboard input

### Design Opportunity: Desktop Screenshots

**Potential Use Cases for /library:**
1. **Automatic screenshots** - Capture desktop state after agent runs
2. **GUI app renders** - Show GIMP designs, Inkscape SVGs rendered
3. **Web app previews** - Firefox showing local web apps
4. **Dashboard displays** - System monitoring/status screens

**How to Capture Desktop Screenshots:**
```python
# Using Daytona SDK
screenshot_bytes = await sandbox.take_screenshot()

# Store in sandbox
await sandbox.fs.upload_file(screenshot_bytes, '/workspace/screenshots/preview.png')

# Access from frontend using getSandboxFileContent()
const screenshotUrl = `/sandboxes/${sandboxId}/files/content?path=/workspace/screenshots/preview.png`
```

**Not Yet Implemented But Possible:**
- VNC link embedding (iframe with preview)
- Screenshot capture on thread completion
- Desktop state snapshots

---

## Part 3: Web Preview - Exposed Services

### Overview
Agents can start web servers, dev servers, or other HTTP services in the sandbox. These are automatically exposed and accessible.

### How It Works

**Backend - Expose Port Tool:**
```python
# Agent can expose any port in sandbox
# Common ports: 3000 (Node dev), 8080 (HTTP), 5173 (Vite), 3001, 4200 (Angular)

# Gets public URL
port_url = await sandbox.get_preview_link(port)
# Result: https://{hostname}/port/{token}
```

**Frontend Access:**
```typescript
// From execution_service.py, stored in project.sandbox.sandbox_url
// Example: https://daytona.example.com/port/xyz123

// Can be embedded directly in iframe or opened in browser
<iframe 
  src={project.sandbox.sandbox_url}
  className="w-full h-full"
/>
```

### Supported Scenarios

**Web Applications:**
- ✅ React dev servers (localhost:3000)
- ✅ Next.js dev servers (localhost:3000)
- ✅ Vue dev servers (localhost:5173)
- ✅ Python Flask/Django (localhost:8000/8080)
- ✅ Node.js Express (localhost:3000)
- ✅ Static HTTP servers

**Use for /library:**
- Display live web previews in gallery view
- Show documentation sites
- Render interactive demos
- Display dashboards/reports

---

## Part 4: Design Assets - Graphics & Rendering Tools

### Available Tools in Sandbox

Suna provides AI tools that can **generate design assets** within the sandbox:

#### 1. **Design & Graphics Tool** (sb_design_tool.py)
```python
@tool_metadata(
    display_name="Design & Graphics",
    description="Generate images and graphics for social media, websites, and more",
    icon="Palette",
    color="bg-rose-100 dark:bg-rose-800/50",
)
class SandboxDesignerTool(SandboxToolsBase):
    """Generates SVG, PNG graphics, and design assets"""
```

**Capabilities:**
- ✅ SVG generation (vector graphics)
- ✅ PNG/JPEG generation
- ✅ Image composition and editing
- ✅ Social media graphics
- ✅ Diagrams and charts

**Output Location:**
- Generated files saved to `/workspace` directory
- Accessible via `getSandboxFileContent()`

#### 2. **Image Vision Tool** (sb_vision_tool.py)
```python
@tool_metadata(
    display_name="Image Vision",
    description="View and analyze images to understand their content",
    icon="Eye",
)
class SandboxVisionTool(SandboxToolsBase):
    """Allows agent to load and analyze images"""
```

**Capabilities:**
- ✅ Load local images from `/workspace`
- ✅ Load images from URLs
- ✅ SVG to PNG conversion
- ✅ Image compression (max 5MB)
- ✅ Up to 3 images in context

#### 3. **Image Edit Tool** (sb_image_edit_tool.py)
```python
# Allows agents to:
# - Edit existing images
# - Apply filters and transformations
# - Generate new variations
# - Create thumbnails
```

### Asset Generation Flow
```
Agent Request → Design Tool → Generate/Edit Assets → Save to /workspace
                                                            ↓
                                          Frontend accesses via:
                                          getSandboxFileContent('/workspace/outputs/image.png')
                                                            ↓
                                          Display in /library gallery view
```

---

## Part 5: Integration Architecture for /library Page

### Current Data Flow

```
ThreadCard Component
    ↓
Files Query: listSandboxFiles('/workspace')
    ↓ (returns first 4 files)
Detect Image File
    ↓
Image Preview Query: getSandboxFileContent(path)
    ↓
Convert to Blob URL
    ↓
Render in Gallery View (2x2 grid or thumbnail)
```

### Available Data Points

**From Project Metadata (database):**
```typescript
project.sandbox = {
  id: string,              // Sandbox ID
  pass: string,            // Sandbox password
  vnc_preview: string,     // VNC preview URL (6080)
  sandbox_url: string,     // Web service URL (8080)
  token: string            // Auth token
}
```

**From File System:**
```typescript
files = [
  {
    name: string,          // Filename
    path: string,          // Full path: /workspace/...
    is_dir: boolean,
    size: number,          // File size in bytes
    mod_time: string,      // ISO timestamp
    permissions: string    // Unix permissions
  }
]
```

---

## Part 6: Design Opportunities for /library

### Option A: Rich File Previews (Current Implementation)
```
Gallery Card:
┌─────────────────────────┐
│  ⭐ (favorite button)    │
├─────────────────────────┤
│                         │
│  [Real Image Preview]   │  ← From /workspace/images/
│      OR                 │
│  [2x2 File Icon Grid]   │  ← Fallback to first 4 files
│                         │
├─────────────────────────┤
│ Thread Name        Date │
└─────────────────────────┘
```

### Option B: Desktop Screenshot Integration
```
1. Agent generates/captures desktop screenshot
2. Stored at /workspace/screenshots/latest.png
3. Access in /library via getSandboxFileContent()
4. Display as gallery preview thumbnail

Benefits:
- Shows actual app/GUI state
- Visual representation of work done
- Rich context about thread contents
```

### Option C: Web Preview Thumbnail
```
1. Agent runs web server (port 8080)
2. Screenshot web preview
3. Store as /workspace/web-preview.png
4. Use as gallery thumbnail

Example flow:
- Agent builds React app
- Starts dev server
- Takes screenshot via Playwright/Puppeteer
- Saves screenshot to workspace
- /library displays screenshot
```

### Option D: Generated Asset Display
```
1. Design tool creates graphics
2. Saved to /workspace/outputs/
3. Query lists generated files
4. /library displays with asset metadata

Supports:
- SVG rendering
- PNG/JPEG display
- Vector graphics
- Design mockups
```

---

## Part 7: Technical Implementation Details

### Authentication & Authorization

**File Access Requirements:**
```typescript
// Automatic via Supabase session
const supabase = createClient();
const { data: { session } } = await supabase.auth.getSession();

// Token added to API request
headers['Authorization'] = `Bearer ${session.access_token}`;

// Backend verifies access
await verify_sandbox_access(client, sandbox_id, user_id);
```

### Caching Strategy

**React Query Caching:**
```typescript
// Files list: 5 minute cache
queryKey: ['sandbox-files', sandboxId]
staleTime: 5 * 60 * 1000

// Image content: 10 minute cache
queryKey: ['image-preview', sandboxId, filePath]
staleTime: 10 * 60 * 1000

// Markdown preview: 10 minute cache
queryKey: ['markdown-preview', sandboxId, filePath]
staleTime: 10 * 60 * 1000
```

### Error Handling

**Common Errors:**
- `404` - Sandbox doesn't exist / file not found
- `500` - Sandbox not started / corrupted
- `403` - User unauthorized to access
- Network timeout - Sandbox unresponsive

**Mitigation:**
```typescript
try {
  const content = await getSandboxFileContent(sandboxId, path);
} catch (error) {
  // Gracefully degrade to icon grid
  return <IconGrid files={files.slice(0, 4)} />;
}
```

---

## Part 8: Limitations & Constraints

### File System Limits
- **Max file size**: Depends on Daytona config (typically 1-5GB per sandbox)
- **Storage limit**: Sandbox storage quota
- **Access time**: ~100-500ms per file request (network latency)

### VNC Preview Limits
- **Port**: Fixed at 6080
- **Resolution**: Configurable (default 1920x1080)
- **Latency**: Real-time streaming (50-200ms)
- **Viewers**: Browser-based (Chrome, Firefox, Safari)
- **Limitations**: Cannot access clipboard, limited file drag-drop

### Web Preview Limits
- **Ports**: Limited by firewall (typically 3000-9999)
- **TLS**: Automatic (no HTTP, always HTTPS)
- **Bandwidth**: Shared sandbox resource
- **Session**: Expires after inactivity

---

## Part 9: Recommended Implementation Path

### Phase 1: Optimize Current Image Preview (Done ✅)
- ✅ Detect first image file
- ✅ Fetch and display as thumbnail
- ✅ Fallback to 2x2 icon grid
- ✅ Show loading spinner

### Phase 2: Enhance with Metadata (Recommended Next)
- [ ] Display file type count (3 images, 2 docs, 1 code file)
- [ ] Show total file size
- [ ] Display recent files metadata
- [ ] Add file type badges

### Phase 3: Desktop Screenshot Integration (Future)
- [ ] Implement screenshot capture in agents
- [ ] Store to `/workspace/screenshots/`
- [ ] Query and display in gallery
- [ ] Add screenshot timestamp

### Phase 4: Web Preview Thumbnails (Future)
- [ ] Capture web server screenshots
- [ ] Display as gallery preview
- [ ] Link to live preview modal
- [ ] Support multiple port detection

### Phase 5: Design Asset Gallery (Future)
- [ ] List generated design assets
- [ ] Create asset showcase view
- [ ] Display with generation metadata
- [ ] Enable asset reuse/sharing

---

## Part 10: Code References

### Key Files to Review

**Frontend:**
- `lib/api.ts` - File access API functions
- `components/library/thread-card.tsx` - Gallery view implementation
- `components/thread/tool-views/expose-port-tool/` - Port exposure UI

**Backend:**
- `core/sandbox/api.py` - Sandbox REST API
- `core/sandbox/sandbox.py` - Daytona integration
- `core/triggers/execution_service.py` - VNC/preview link generation
- `core/tools/sb_design_tool.py` - Design asset generation

### API Endpoints Summary

```
GET  /sandboxes/{sandboxId}/files                 # List files
GET  /sandboxes/{sandboxId}/files/content         # Get file
POST /sandboxes/{sandboxId}/files                 # Create file
PUT  /sandboxes/{sandboxId}/files                 # Update file
DELETE /sandboxes/{sandboxId}/files               # Delete file
```

---

## Conclusion

Suna's sandbox infrastructure provides **three complementary access paths** to design and preview assets:

1. **File System** (✅ Ready) - Direct access to all generated files, images, documents
2. **VNC Desktop** (✅ Available) - Full desktop environment with GUI apps
3. **Web Services** (✅ Available) - Live HTTP services and dev servers

The current implementation uses File System access to display image previews in gallery view. Future enhancements can leverage VNC screenshots and web preview captures to create richer visual representations of project contents in the /library page.

**Recommended Next Step:** Phase 2 - Add file metadata display (file counts, sizes, types) to provide more context about each thread's contents in the gallery view.
