# 🖥️ Suna's Computer Feature - Complete Guide

## Overview

**"Suna's Computer"** (or **"[AgentName]'s Computer"** for custom agents) is an integrated real-time visualization and control panel that allows you to see and monitor what your AI agent is doing on its virtual desktop. It provides two complementary views:

1. **Tools View** - Displays the results and details of each tool execution
2. **Browser View** - Shows a live VNC preview of the agent's desktop, including the browser and any active applications

---

## 🎯 Purpose & Use Cases

### Why Does It Exist?

When an AI agent like Suna performs tasks (browsing the web, manipulating files, running commands), you need visibility into what's happening. "Suna's Computer" provides:

- **Real-time visualization** of agent actions
- **Debugging capability** when something goes wrong
- **Transparency** for understanding agent decision-making
- **Verification** that the agent is doing what you asked

### Real-World Scenarios

```
User: "Search for job listings on LinkedIn and create a summary"
         ↓
Suna starts working...
         ↓
Your browser shows in "Browser View":
  - Suna navigating to linkedin.com
  - Searching for positions
  - Extracting job details
         ↓
Your computer panel shows the results
```

---

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React/Next.js)                    │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Tool Call Side Panel Component                          │  │
│  │  (tool-call-side-panel.tsx)                              │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │ View Toggle (Tools ↔ Browser)                  │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │ TOOLS VIEW                                      │   │  │
│  │  │ • Tool Call Results                             │   │  │
│  │  │ • Browser Screenshots                           │   │  │
│  │  │ • File Operations                               │   │  │
│  │  │ • Command Output                                │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │ BROWSER VIEW (VNC Preview)                      │   │  │
│  │  │ • Live desktop environment                      │   │  │
│  │  │ • Active browser window                         │   │  │
│  │  │ • Running applications                          │   │  │
│  │  │ • Real-time updates                             │   │  │
│  │  └─────────────────────────────────────────────────┘   │  │
│  │                                                          │  │
│  │  Navigation Controls:                                   │  │
│  │  • Previous/Next tool call                             │  │
│  │  • Auto-scroll to latest                               │  │
│  │  • Manual navigation                                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└────────────────┬────────────────────────────────────────────────┘
                 │ HTTP Requests
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI/Python)                    │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Browser Tool (browser_tool.py)                          │  │
│  │  • Navigate to URLs                                      │  │
│  │  • Perform actions (click, type, scroll)               │  │
│  │  • Extract page content                                 │  │
│  │  • Take screenshots                                     │  │
│  │  • Validate & compress images                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└────────────────┬────────────────────────────────────────────────┘
                 │ API Calls (localhost:8004)
                 ↓
┌─────────────────────────────────────────────────────────────────┐
│           SANDBOX CONTAINER (Docker/Daytona)                    │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Browser API Server (browserApi.ts)                      │  │
│  │  • REST endpoints for browser operations                │  │
│  │  • Stagehand integration                                │  │
│  │  • Screenshot capture & encoding                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Stagehand (Browser Automation)                          │  │
│  │  • Chrome/Chromium browser instance                      │  │
│  │  • Playwright under the hood                            │  │
│  │  • AI-powered understanding of page                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  VNC Server                                              │  │
│  │  • Port 5901 (VNC protocol)                             │  │
│  │  • noVNC web interface (port 6080)                      │  │
│  │  • Real-time desktop streaming                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  File System & Shell                                     │  │
│  │  • Workspace directory (/workspace)                     │  │
│  │  • Command execution                                    │  │
│  │  • File creation/modification                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Example

```
1. User Message:
   "Search for Python jobs on Indeed"
   ↓

2. Suna (Agent) decides to use browser_tool
   ↓

3. Frontend sends tool call to Backend
   → POST /api/threads/{id}/tool-result
   ↓

4. Backend Browser Tool executes action via Sandbox Browser API
   → POST http://localhost:8004/navigate
   ↓

5. Sandbox Browser API uses Stagehand
   → Navigates to indeed.com
   → Takes screenshot
   → Encodes to base64
   ↓

6. Screenshot returned to Backend
   ↓

7. Backend uploads screenshot to S3
   → Returns image URL
   ↓

8. Frontend receives result and displays in Tool View
   OR displays VNC preview of desktop in Browser View
   ↓

9. User sees "Suna's Computer" showing:
   • Browser screenshot in Tools View
   • OR live desktop in Browser View
```

---

## 💻 The Two Views

### View 1: Tools View (Default)

**Location**: Left sidebar or modal in chat interface

**Shows**:
- **Tool Results**: Output from each tool execution
- **Browser Screenshots**: Captured snapshots with URL and page title
- **File Operations**: Created/modified files
- **Command Output**: Shell command results
- **Status**: Success/failure indicators

**Key Components**:
- `ToolView` wrapper component
- Tool-specific view components (BrowserToolView, SeeImageToolView, etc.)
- Base64 image preview capability

**Example Content**:
```
Tool: browser-screenshot
Status: ✅ Success
URL: https://www.indeed.com/jobs?q=python
Title: "Python Developer Jobs - Indeed.com"
Screenshot: [Image Preview]
```

### View 2: Browser View (VNC Preview)

**Location**: Right side of Tool Call Panel

**Shows**:
- **Live Desktop**: Real-time view of agent's virtual desktop
- **Active Browser Window**: Currently open web page
- **Desktop Applications**: Any open files, terminals, etc.
- **Mouse Cursor & Interactions**: See where the agent is clicking

**Technology**:
- **VNC (Virtual Network Computing)**: Remote desktop protocol
- **noVNC**: Web-based VNC client
- **HealthCheckedVncIframe**: Custom component that verifies VNC health

**Example Session**:
```
Agent is performing: browser_navigate_to
VNC shows:
  - Chromium browser opening
  - URL bar changes to "https://www.linkedin.com"
  - Page loads in real-time
  - Search form appears
  - (Agent typing in search box)
  - Results loading...
```

---

## 🔄 View Switching Logic

The system intelligently switches between Views based on agent activity:

### Automatic Switching Rules

```python
IF agent_status == "running":
    IF tool_is_browser_operation:
        → Switch to "Browser View"
        (Show live desktop while agent navigates)
    ELSE:
        → Switch to "Tools View"
        (Show tool results for file ops, commands, etc.)

IF agent_status == "idle":
    IF user_navigated_to_browser_tool:
        AND it's the most recent tool:
        → Switch to "Browser View"
    ELSE:
        → Keep "Tools View"
```

### Browser Tool Detection

The system recognizes these as "browser tools":
- `browser-navigate-to` - Going to URLs
- `browser-act` - Clicking, typing, scrolling
- `browser-extract-content` - Reading page text
- `browser-screenshot` - Taking screenshots

### Manual Override

Users can manually toggle between views using the **View Toggle Button**:
```
┌─────────────────────┐
│ [🔧] [🌐]          │  ← Toggle Control
│   Tools   Browser   │
└─────────────────────┘
```

---

## 🖼️ Screenshots & Image Handling

### How Screenshots Work

```python
1. Browser Tool receives action request
   ↓
2. Calls _execute_stagehand_api("screenshot", ...)
   ↓
3. Stagehand captures page as PNG
   ↓
4. Encodes to base64 string
   ↓
5. Validates:
   ✓ Valid base64 format
   ✓ Valid image format (PNG, JPEG, etc.)
   ✓ Size < 10MB
   ✓ Dimensions within limits
   ↓
6. Uploads to S3 bucket: "browser-screenshots"
   ↓
7. Returns HTTPS URL
   ↓
8. Frontend displays in Tools View
```

### Image Validation Pipeline

```typescript
// backend/core/tools/browser_tool.py
_validate_base64_image(base64_string):
  ✓ Check format is valid base64
  ✓ Verify contains valid image data
  ✓ Check file size limits
  ✓ Validate with PIL (Python Imaging Library)
  ✓ Verify supported format (JPEG, PNG, etc.)
  ✓ Return (is_valid, error_message)
```

### Compression Settings

```python
# Default compression settings
DEFAULT_MAX_WIDTH = 1920 pixels
DEFAULT_MAX_HEIGHT = 1080 pixels
DEFAULT_JPEG_QUALITY = 85%
DEFAULT_PNG_COMPRESS_LEVEL = 6/9
MAX_IMAGE_SIZE = 10 MB
MAX_COMPRESSED_SIZE = 5 MB
```

---

## 🎮 User Interaction & Keyboard Shortcuts

### Opening "Suna's Computer"

**Method 1**: Click the Computer Icon
- Usually appears in chat toolbar during agent execution

**Method 2**: Keyboard Shortcut
- Press `CMD+I` (Mac) or `CTRL+I` (Windows)
- Toggles Computer Preview on/off

### Navigating Tool Calls

When multiple tool calls exist:

```
Navigation Buttons:
  ◀ Previous Tool  |  X Close  |  Next Tool ▶

OR

Automatic Scrolling:
  • Live mode: Always shows latest tool
  • Manual mode: Navigate yourself, then resume auto-scroll
```

### Refreshing VNC

If the desktop view gets stuck:
- Manually click refresh button
- Or agent will refresh on next action

---

## 🛠️ Technical Details

### Frontend Implementation

**Main Component**: `tool-call-side-panel.tsx`
- Location: `frontend/src/components/thread/tool-call-side-panel.tsx`
- Size: ~1000 lines
- Handles: View management, VNC display, tool navigation

**Key State Management**:
```typescript
const [currentView, setCurrentView] = useState<'tools' | 'browser'>('tools');
const [internalIndex, setInternalIndex] = useState(0);
const [navigationMode, setNavigationMode] = useState<'live' | 'manual'>('live');
const [toolCallSnapshots, setToolCallSnapshots] = useState<ToolCallSnapshot[]>([]);
const [vncRefreshKey, setVncRefreshKey] = useState(0);
```

**VNC Integration**: `HealthCheckedVncIframe.tsx`
- Embeds noVNC web client in iframe
- Monitors VNC connection health
- Handles reconnection logic

### Backend Implementation

**Browser Tool**: `backend/core/tools/browser_tool.py`
- Implements 4 core functions:
  - `browser_navigate_to(url)` - Go to page
  - `browser_act(action, selector)` - Perform action
  - `browser_extract_content()` - Get page text
  - `browser_screenshot(name)` - Take screenshot

**Browser API Server**: `backend/core/sandbox/docker/browserApi.ts`
- Express server on port 8004
- Endpoints:
  - `POST /navigate` - Navigate URL
  - `POST /screenshot` - Capture screen
  - `POST /act` - Perform action
  - `POST /extract` - Extract content
  - `POST /convert-svg` - Convert SVG to PNG

**Stagehand Integration**:
```typescript
// Uses Stagehand for AI-powered browser automation
const stagehand = new Stagehand({
  env: "LOCAL",
  modelName: "google/gemini-2.5-pro",
  viewport: { width: 1024, height: 768 }
});
```

### Docker Configuration

**VNC Setup** (in docker-compose.yml):
```yaml
ports:
  - "5901:5901"   # VNC server port
  - "6080:6080"   # noVNC web interface
  - "9222:9222"   # Chrome remote debugging
  - "8004:8004"   # Browser API server
```

**Environment**:
```bash
CHROME_PATH=/usr/bin/google-chrome
CHROME_USER_DATA=/app/data/chrome_data
CHROME_PERSISTENT_SESSION=false
```

---

## 📊 Data Structures

### Tool Call Input

```typescript
interface ToolCallInput {
  assistantCall: {
    content?: string;
    name?: string;           // e.g., "browser-screenshot"
    timestamp?: string;
  };
  toolResult?: {
    content?: string;        // Screenshot URL or tool result
    isSuccess?: boolean;
    timestamp?: string;
  };
  messages?: ApiMessageType[];
}
```

### Tool Call Snapshot

```typescript
interface ToolCallSnapshot {
  id: string;
  toolCall: ToolCallInput;
  index: number;
  timestamp: number;
}
```

### Browser Data

```typescript
interface BrowserData {
  url: string | null;
  operation: string;
  screenshotUrl: string | null;
  screenshotBase64: string | null;
  messageId: string | null;
  parameters: Record<string, any> | null;
  result: Record<string, any> | null;
}
```

---

## ⚙️ Configuration & Customization

### Enabling/Disabling Features

**In backend/core/suna_config.py**:
```python
SUNA_CONFIG = {
    "agentpress_tools": {
        "sb_shell_tool": True,              # Enable shell commands
        "sb_files_tool": True,              # Enable file operations
        "web_search_tool": True,            # Enable web search
        "sb_vision_tool": True,             # Enable image analysis
        # ... more tools
    }
}
```

### Viewport Size

Control agent's desktop resolution:
```typescript
// In browserApi.ts
localBrowserLaunchOptions: {
  viewport: {
    width: 1024,    // Change this
    height: 768     // And this
  }
}
```

### Screenshot Limits

Adjust in `backend/core/tools/browser_tool.py`:
```python
MAX_IMAGE_SIZE = 10 * 1024 * 1024      # 10 MB
MAX_COMPRESSED_SIZE = 5 * 1024 * 1024  # 5 MB
DEFAULT_JPEG_QUALITY = 85               # 0-100%
DEFAULT_PNG_COMPRESS_LEVEL = 6          # 0-9 (9 = highest)
```

---

## 🔍 Troubleshooting

### VNC Preview Not Showing

**Problem**: "Suna's Computer" shows blank or frozen

**Solutions**:
1. **Refresh VNC**
   - Click refresh button in Browser View
   - Or wait for next agent action

2. **Check Docker Container**
   ```bash
   docker ps | grep suna
   # Verify container is running
   ```

3. **Verify VNC Port**
   ```bash
   nc -zv localhost 5901
   # Should show: Connection succeeded
   ```

4. **Check Browser Tool**
   ```bash
   # In backend logs, look for:
   # "Stagehand initialized"
   # "Browser screenshot taken"
   ```

### Screenshots Not Appearing

**Problem**: Tool results show no image

**Solutions**:
1. **Check S3 Bucket**
   - Verify "browser-screenshots" bucket exists
   - Check AWS credentials

2. **Check Browser API**
   - Verify port 8004 is accessible
   - Check container logs: `docker logs [container-id]`

3. **Verify Image Encoding**
   - Check backend logs for validation errors
   - Ensure base64 decoding works

### Agent Freezes

**Problem**: Agent stops responding during browser automation

**Solutions**:
1. **Increase Timeouts**
   ```typescript
   // In browserApi.ts
   timeout: 30000  // 30 seconds
   ```

2. **Check Memory**
   ```bash
   docker stats
   ```

3. **Reset Browser**
   ```typescript
   // Will auto-reset on next action
   // Or manually restart container
   ```

---

## 🚀 Performance Optimization

### Screenshot Performance

```python
# Faster screenshots (lower quality)
DEFAULT_JPEG_QUALITY = 75  # Default: 85
DEFAULT_MAX_WIDTH = 1280   # Default: 1920

# Slower but better quality
DEFAULT_JPEG_QUALITY = 95
DEFAULT_PNG_COMPRESS_LEVEL = 9
```

### VNC Streaming

```typescript
// Reduce update frequency for slow connections
// (Implemented in HealthCheckedVncIframe)
vnc_refresh_interval: 500ms  // Default: varies by connection
```

### Caching

```typescript
// Stagehand caches selectors and page understanding
enableCaching: true,  // Already enabled by default
```

---

## 📚 Related Files

### Frontend
- `frontend/src/components/thread/tool-call-side-panel.tsx` - Main panel
- `frontend/src/components/thread/HealthCheckedVncIframe.tsx` - VNC display
- `frontend/src/components/thread/tool-views/BrowserToolView.tsx` - Browser results
- `frontend/src/components/thread/utils.ts` - Tool utilities

### Backend
- `backend/core/tools/browser_tool.py` - Browser automation tool
- `backend/core/sandbox/docker/browserApi.ts` - Browser API server
- `backend/core/prompts/prompt.py` - Agent instructions for browser use
- `backend/core/suna_config.py` - Tool configuration

### Configuration
- `docker-compose.yml` - VNC & browser setup
- `.env` - Environment variables
- `backend/pyproject.toml` - Python dependencies

---

## 🎓 Learning Path

**To understand "Suna's Computer"**:

1. **Start Here**
   - Read this document overview section
   - Understand the two views (Tools vs Browser)

2. **Frontend Deep Dive**
   - Study `tool-call-side-panel.tsx`
   - Understand view switching logic
   - Learn VNC iframe integration

3. **Backend Architecture**
   - Review `browser_tool.py`
   - Understand browser API endpoints
   - Study screenshot pipeline

4. **Hands-On**
   - Start Suna with a web task
   - Watch "Suna's Computer" in action
   - Try toggling between views
   - Inspect browser screenshots

5. **Advanced**
   - Modify viewport size
   - Adjust screenshot quality
   - Implement custom tool views
   - Enhance VNC performance

---

## 🔗 Integration Points

### How It Connects to Other Features

```
Suna's Computer
    │
    ├─→ Browser Tool
    │   └─→ Stagehand (AI-powered automation)
    │       └─→ Playwright (browser control)
    │
    ├─→ VNC Server
    │   └─→ Desktop Environment
    │       └─→ Chrome Browser
    │
    ├─→ Tool View System
    │   └─→ Tool Result Display
    │       └─→ S3 Upload (screenshots)
    │
    └─→ Agent Thread Manager
        └─→ Tool Execution Pipeline
            └─→ LLM (Claude) Decision Making
```

---

## 📝 Summary

**"Suna's Computer"** is your window into what your AI agent is doing:

- **Tools View**: See what happened (screenshots, results, outputs)
- **Browser View**: See it happening live (desktop streaming via VNC)
- **Auto-switching**: System intelligently shows the right view
- **Real-time**: Updates as agent works
- **Transparent**: Understand agent reasoning and actions
- **Debuggable**: Identify issues and failures
- **Powerful**: Combines multiple technologies (Stagehand, VNC, React, S3)

It's the visual foundation that makes AI agents feel less like a black box and more like a collaborative partner you can actually watch work!
