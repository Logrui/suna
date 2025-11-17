# Browser View & VNC Live Desktop Streaming

## 🖥️ Overview

**Browser View** is a real-time desktop streaming feature that allows you to watch your AI agent navigate and interact with applications as if you were looking over its shoulder. It's powered by **VNC (Virtual Network Computing)**, a mature remote desktop protocol that's been used for decades.

**Short Answer**: Yes, there is full built-in support for streaming a live desktop. It works by:
1. Running a VNC server in the sandbox container
2. Exposing the VNC port through a public preview link
3. Embedding a web-based VNC client (noVNC) in the frontend
4. Streaming real-time desktop updates to your browser

---

## 🏗️ Architecture: How It Works

### System Stack

```
┌──────────────────────────────────────────────────────┐
│                    Frontend Browser                   │
│                                                       │
│  ┌────────────────────────────────────────────────┐ │
│  │  Tool Call Side Panel Component                │ │
│  │  (tool-call-side-panel.tsx)                    │ │
│  │                                                │ │
│  │  - Detects when user switches to Browser View │ │
│  │  - Creates embedded iframe with noVNC client  │ │
│  │  - Passes VNC URL + password                  │ │
│  └────────────────────────────────────────────────┘ │
│                     │                                 │
│  ┌────────────────────────────────────────────────┐ │
│  │  HealthCheckedVncIframe Component              │ │
│  │  (HealthCheckedVncIframe.tsx)                  │ │
│  │                                                │ │
│  │  - Preloads VNC connection                    │ │
│  │  - Shows loading spinner while connecting     │ │
│  │  - Handles retries with exponential backoff   │ │
│  │  - Renders noVNC web client in iframe         │ │
│  └────────────────────────────────────────────────┘ │
│                     │                                 │
└─────────────────────┼────────────────────────────────┘
                      │ WebSocket (over HTTPS)
                      │ Real-time video streaming
                      ↓
┌──────────────────────────────────────────────────────┐
│               noVNC Web Client (Port 6080)            │
│                                                       │
│  - Embedded in iframe                               │
│  - Speaks VNC protocol                              │
│  - Renders desktop framebuffer                      │
│  - Handles user input (mouse, keyboard)             │
└──────────────────────────────────────────────────────┘
                      │ VNC Protocol (TCP/WebSocket)
                      │ Binary protocol, optimized
                      ↓
┌──────────────────────────────────────────────────────┐
│         VNC Server in Docker Container               │
│                  (Port 5901)                         │
│                                                       │
│  - Listens for VNC client connections               │
│  - Captures desktop/window framebuffer              │
│  - Encodes screen updates                           │
│  - Receives and executes mouse/keyboard input       │
└──────────────────────────────────────────────────────┘
                      │ Local socket
                      ↓
┌──────────────────────────────────────────────────────┐
│           X11 Display Server                          │
│              (DISPLAY=:99)                            │
│                                                       │
│  - Running in the container                         │
│  - Renders desktop                                  │
│  - Chrome browser window                            │
│  - All agent applications                           │
└──────────────────────────────────────────────────────┘
```

### Communication Flow

```
You clicking in Browser View:
  1. Your mouse click on noVNC iframe
  2. noVNC JavaScript client captures it
  3. VNC protocol encodes: "Mouse click at (x, y)"
  4. Sent via WebSocket to VNC server
  5. VNC server translates to X11 input
  6. X11 routes to Chrome browser
  7. Chrome receives click event
  8. Webpage responds (navigation, form submission, etc.)
  9. Desktop renders new state
  10. VNC captures new framebuffer
  11. Encodes changed pixels
  12. Sends delta to client over WebSocket
  13. Browser sees updated desktop in real-time

All of this happens typically in 100-300ms!
```

---

## 🖼️ Core Components

### 1. HealthCheckedVncIframe Component

**Location**: `frontend/src/components/thread/HealthCheckedVncIframe.tsx`

**Purpose**: Manages the VNC iframe lifecycle and connection health

```typescript
interface HealthCheckedVncIframeProps {
  sandbox: {
    id: string;                  // Sandbox identifier
    vnc_preview: string;         // Base URL for noVNC (e.g., https://preview-12345.example.com)
    pass: string;                // VNC password (UUID)
  };
  className?: string;
}
```

**Features**:

1. **Preloading System**
   - Creates hidden iframe to preload VNC connection
   - Tests connection before showing to user
   - Prevents showing broken/loading state

2. **Health Checking**
   - Monitors VNC server availability
   - Retries with exponential backoff (1s → 1.5s → 2.25s → 3.38s → 5s)
   - Max 5 retry attempts

3. **Status States**
   - `idle` - Not yet started
   - `loading` - Connecting to VNC server
   - `ready` - Connected and displaying
   - `error` - Failed to connect after retries

4. **User Feedback**
   ```
   "Connecting to browser..."
   "Testing VNC connection"
   "🔄 Attempt 2/5"
   
   OR
   
   "Connection Failed"
   "Unable to connect to VNC server after 5 attempts"
   [Try Again] button
   ```

### 2. VNC Preloader Hook

**Location**: `frontend/src/hooks/useVncPreloader.ts`

**Purpose**: Handles the technical details of VNC connection management

```typescript
interface VncPreloaderOptions {
  maxRetries?: number;        // Default: 5
  initialDelay?: number;      // Default: 1000ms
  timeoutMs?: number;         // Default: 5000ms per attempt
}

interface VncPreloaderResult {
  status: VncStatus;          // Current connection status
  retryCount: number;         // How many retries have occurred
  retry: () => void;          // Manual retry function
  isPreloaded: boolean;       // true when status === 'ready'
  preloadedIframe: HTMLIFrameElement | null;
}
```

**Key Logic**:

```typescript
// Preloading strategy
1. Create hidden iframe with noVNC URL
2. Set timeout (5 seconds default)
3. If iframe loads before timeout:
   - Status = "ready"
   - Show iframe to user
   - Done!

4. If iframe doesn't load (timeout or error):
   - Remove iframe from DOM
   - Calculate exponential backoff delay
   - Retry: delay = Math.min(2000 * (1.5 ^ retryCount), 10000)
   - Max 10 seconds between retries

5. After 5 failed attempts:
   - Status = "error"
   - Show error message with retry button
```

### 3. noVNC Web Client

**What It Is**: Open-source web-based VNC viewer
- **Embedded in**: iframe element
- **URL Format**: `https://preview-12345.example.com/vnc_lite.html?password=xyz&autoconnect=true&scale=local`
- **Protocol**: WebSocket over HTTPS
- **Features**:
  - Keyboard and mouse input
  - Screen zoom/scaling
  - Connection quality indicators
  - Password-protected (passed via URL param)

---

## 🌐 VNC Server Setup in Docker

### Docker Configuration

**File**: `backend/core/sandbox/docker/docker-compose.yml`

```yaml
services:
  kortix-suna:
    ports:
      - "5901:5901"   # VNC protocol port (raw TCP)
      - "6080:6080"   # noVNC web interface port
      - "9222:9222"   # Chrome remote debugging
      - "8004:8004"   # Browser API server
      - "8080:8080"   # HTTP server
    
    environment:
      - DISPLAY=:99                          # X11 display
      - VNC_PASSWORD=${VNC_PASSWORD:-vncpassword}
      - RESOLUTION=${RESOLUTION:-1024x768x24}
      - RESOLUTION_WIDTH=${RESOLUTION_WIDTH:-1024}
      - RESOLUTION_HEIGHT=${RESOLUTION_HEIGHT:-768}
    
    healthcheck:
      test: ["CMD", "nc", "-z", "localhost", "5901"]  # Verify VNC is listening
      interval: 10s
      timeout: 5s
      retries: 3
```

### Port Responsibilities

| Port | Service | Protocol | Purpose |
|------|---------|----------|---------|
| **5901** | VNC Server | TCP | Raw VNC protocol (client-server) |
| **6080** | noVNC | HTTP/WebSocket | Web-based VNC client |
| **8004** | Browser API | HTTP | REST API for browser automation |
| **8080** | HTTP Server | HTTP | Testing/serving files |
| **9222** | Chrome Debug | HTTP | Chrome DevTools protocol |

---

## 🔌 Data Flow: From Backend to Frontend

### Step 1: Sandbox Creation

When a new thread/project is created:

```python
# backend/core/threads.py or backend/core/agent_runs.py

# Create sandbox container
sandbox = await create_sandbox(sandbox_pass, project_id)

# Get preview links (exposed via Daytona framework)
vnc_link = await sandbox.get_preview_link(6080)      # noVNC web client
website_link = await sandbox.get_preview_link(8080)  # Website server

# Extract URLs from Daytona's LinkObject
vnc_url = vnc_link.url  # e.g., https://preview-abc123.example.com
pass = sandbox_pass     # UUID string
```

### Step 2: Store in Database

```python
# Update projects table with sandbox info
update_result = await client.table('projects').update({
    'sandbox': {
        'id': sandbox_id,                    # UUID of sandbox
        'pass': sandbox_pass,                # VNC password
        'vnc_preview': vnc_url,              # https://preview-abc123.example.com
        'sandbox_url': website_url,          # https://website-abc123.example.com
        'token': token                       # Optional auth token
    }
}).eq('project_id', project_id).execute()
```

### Step 3: Frontend Receives Data

When user opens chat:

```typescript
// Frontend API call retrieves project data
const response = await fetch(`/api/threads/${threadId}?include_project=true`);
const thread = await response.json();

// Extract sandbox info
const sandbox = thread.project.sandbox;
/*
{
  id: "uuid-12345",
  pass: "password-uuid",
  vnc_preview: "https://preview-abc123.example.com",
  sandbox_url: "https://website-abc123.example.com",
  token: "optional-token"
}
*/

// Pass to ToolCallSidePanel
<ToolCallSidePanel
  project={thread.project}
  // ...
/>
```

### Step 4: Embedded in Panel

```typescript
// Inside ToolCallSidePanel
const persistentVncIframe = useMemo(() => {
  if (!sandbox) return null;
  
  return (
    <HealthCheckedVncIframe 
      sandbox={{
        id: sandbox.id,
        vnc_preview: sandbox.vnc_preview,
        pass: sandbox.pass
      }}
    />
  );
}, [sandbox, vncRefreshKey]);

// When Browser View is selected:
{currentView === 'browser' && persistentVncIframe}
```

---

## 📊 Data Structures

### Sandbox Object (Database)

```python
# projects table -> sandbox column (JSONB)
{
    "id": "uuid-12345",                           # Daytona sandbox ID
    "pass": "550e8400-e29b-41d4-a716-446655440000",  # VNC password
    "vnc_preview": "https://preview-abc123.example.com",
    "sandbox_url": "https://website-abc123.example.com",
    "token": "auth-token-if-needed"
}
```

### VNC URL Format

```
Base: https://preview-abc123.example.com
Full: https://preview-abc123.example.com/vnc_lite.html
      ?password=550e8400-e29b-41d4-a716-446655440000
      &autoconnect=true
      &scale=local

URL Parameters:
- password:    VNC password (URL-encoded)
- autoconnect: true = auto-connect on load
- scale:       local = scale to window size
```

---

## 🎯 When Browser View Activates

The system **automatically switches** to Browser View when:

```typescript
// 1. User navigates to a browser tool in the most recent call
if (isCurrentSnapshotBrowserTool && isLatestToolCall) {
  setCurrentView('browser');
}

// 2. A browser tool starts streaming/executing
const streamingTool = toolCallSnapshots.find(s => 
  s.toolCall.toolResult?.content === 'STREAMING'
);
if (isBrowserTool(streamingTool.name)) {
  setCurrentView('browser');  // Show live desktop
}

// 3. OR user manually clicks browser toggle button
<ViewToggle currentView={currentView} onViewChange={setCurrentView} />
```

Browser tools recognized:
- `browser-navigate-to` - Going to a URL
- `browser-act` - Clicking, typing, scrolling
- `browser-extract-content` - Reading page content
- `browser-screenshot` - Taking screenshot

---

## 🔄 VNC Reconnection Flow

### Automatic Retry Strategy

```
User opens Browser View (or agent starts browser task)
    ↓
HealthCheckedVncIframe starts preloading
    ↓
useVncPreloader creates hidden iframe
    ↓
iframe attempts to load noVNC client from VNC server
    ↓
Timeout = 5 seconds (set in options)
    ↓
┌─────────────────────────────────────────┐
│         What happens?                    │
├─────────────────────────────────────────┤
│ ✅ noVNC loads              │ ❌ Timeout or error
│    within 5s?              │
│      ↓                      │     ↓
│ Status = "ready"           │ Delay 1s, retry
│ Show iframe                │ Attempt 2/5
│ User sees live desktop     │
│                            │ Delay 1.5s, retry
│                            │ Attempt 3/5
│                            │
│                            │ Delay 2.25s, retry
│                            │ Attempt 4/5
│                            │
│                            │ Delay 3.38s, retry
│                            │ Attempt 5/5
│                            │
│                            │ All retries exhausted
│                            │ Status = "error"
│                            │ Show error message
│                            │ Offer [Try Again] button
└─────────────────────────────────────────┘
```

### Manual Refresh/Retry

```typescript
// User clicks refresh button or manual retry
const handleVncRefresh = useCallback(() => {
  setVncRefreshKey(prev => prev + 1);  // Force iframe remount
}, []);

// This causes HealthCheckedVncIframe to reset and retry
```

---

## 🎮 User Interactions in Browser View

### What You Can Do

| Action | How | Works? |
|--------|-----|--------|
| **Move mouse** | Move mouse in iframe | ✅ Yes, sent to VNC server |
| **Click** | Click in iframe | ✅ Yes, coordinates sent to X11 |
| **Type** | Type while iframe focused | ✅ Yes, keyboard input to Chrome |
| **Scroll** | Scroll wheel | ✅ Yes, sent as scroll events |
| **Select text** | Click and drag to select | ✅ Yes, selection works |
| **Copy/Paste** | Ctrl+C / Ctrl+V | ⚠️ Partial - depends on VNC client |
| **Touch (mobile)** | Not supported | ❌ No - desktop protocol |
| **Zoom** | Browser zoom (Ctrl + scroll) | ⚠️ Affects whole panel, not VNC |

### Performance

- **Latency**: Typically 100-300ms from click to on-screen response
- **Bandwidth**: Low (only sends screen deltas, compressed)
- **Frame Rate**: 10-30 FPS typically (depends on agent activity)
- **Responsive**: Quite smooth for web browsing scenarios

---

## 🖥️ What You See in Browser View

### Typical Screen Content

```
┌─────────────────────────────────────────────┐
│         Agent's Virtual Desktop              │
├─────────────────────────────────────────────┤
│                                             │
│  Desktop Background (Linux/Ubuntu)          │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  Google Chrome                      │   │
│  │  (or Chromium)                      │   │
│  │                                     │   │
│  │  https://www.example.com           │   │
│  │                                     │   │
│  │  [Content being browsed...]        │   │
│  │                                     │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Taskbar at bottom                          │
│                                             │
└─────────────────────────────────────────────┘

Resolution: 1024x768 (configurable)
Color Depth: 24-bit (16 million colors)
```

### During Agent Task

```
Example: Agent searching LinkedIn

1. Initial desktop load
   - Black/gray screen
   - Desktop background

2. Chrome launches
   - Browser window appears
   - Blank page

3. Agent navigates
   - LinkedIn homepage loads
   - Search box appears

4. Agent interacts
   - Search box gets focus
   - Text appears as typed
   - Search results load
   - Agent clicks on profiles

You see ALL of this in real-time!
```

---

## ⚙️ Configuration & Customization

### Resolution

```yaml
# In docker-compose.yml
environment:
  RESOLUTION_WIDTH: 1024      # Change this
  RESOLUTION_HEIGHT: 768      # And this
  RESOLUTION: 1024x768x24     # WIDTHxHEIGHTxCOLOR_DEPTH
```

Common resolutions:
- `1024x768x24` - Standard (default)
- `1280x720x24` - HD
- `1920x1080x24` - Full HD
- `2560x1440x24` - 2K

### VNC Password

```yaml
# In docker-compose.yml
environment:
  VNC_PASSWORD: vncpassword  # Set to strong password
```

### Display Server

```bash
# Inside container
DISPLAY=:99  # X11 display number (fixed)
```

---

## 🐛 Troubleshooting Browser View

### Problem: "Connecting to browser..." stuck indefinitely

**Causes**:
1. VNC server crashed
2. Network connectivity issue
3. Preview URL unreachable

**Solutions**:
```bash
# Check if VNC port is open
docker exec [container] nc -zv localhost 5901

# Check noVNC is running
docker exec [container] curl -s http://localhost:6080/index.html | head -5

# Check container health
docker ps --format "table {{.Names}}\t{{.Status}}"

# Restart container if needed
docker restart [container-name]
```

### Problem: Error after 5 retry attempts

**Causes**:
1. Preview URL is wrong (check database)
2. VNC server not fully initialized
3. Firewall blocking connection

**Solutions**:
1. Wait 10-15 seconds longer (VNC server startup takes time)
2. Click [Try Again] button
3. Check that `vnc_preview` URL in database is correct
4. Verify preview URL is publicly accessible

```bash
# Test from your machine
curl -s https://preview-abc123.example.com/vnc_lite.html | head -1

# Should return HTML starting with "<!DOCTYPE"
```

### Problem: Mouse/keyboard input not working

**Causes**:
1. iframe lost focus
2. VNC authentication failed
3. X11 input not configured

**Solutions**:
1. Click in the VNC iframe to ensure focus
2. Try manual refresh (refresh button)
3. Check VNC password in database matches config

### Problem: Desktop is frozen/not updating

**Causes**:
1. Agent process crashed
2. X11 display server crashed
3. Chrome browser crashed

**Solutions**:
```bash
# Check processes in container
docker exec [container] ps aux | grep -E "chrome|X|vnc"

# Restart X display server
docker exec [container] pkill -f Xvfb

# Wait for container to auto-restart

# Manual restart
docker restart [container-name]
```

---

## 📊 Performance Metrics

### Typical Latency

```
User clicks in Browser
  ↓ 10-50ms: Click travels to server
Browser input → X11 server
  ↓ 5-10ms: X11 processes
Chrome processes event
  ↓ 50-100ms: Chrome rendering
Desktop updated
  ↓ VNC captures frame
Screen delta encoded
  ↓ 10-50ms: Compression
Data sent to client
  ↓ 10-50ms: Network
Frontend receives
  ↓ Client renders
You see result

Total: ~150-300ms typical
Network: 100-150ms of this
Processing: 50-150ms of this
```

### Bandwidth Usage

```
Idle (no activity):
  - Very low (only keeping connection alive)
  - ~1KB/s or less

Agent actively browsing:
  - Screen updates: 50-100KB/s
  - Compressed VNC encoding
  - Depends on resolution and color changes

Example: 1 hour session with active browsing:
  - 200-300MB transferred
  - Highly dependent on content
```

---

## 🔐 Security Considerations

### Password Protection

- VNC password is a **UUID** (128-bit random)
- Generated fresh for each sandbox
- Stored in database `projects.sandbox.pass`
- Passed to noVNC via URL parameter (HTTPS only)

### Access Control

- Daytona framework handles preview link generation
- Includes authentication tokens in preview URL
- Only accessible over HTTPS in production

### Display Server Security

```
X11 server runs in container:
  ✓ Isolated from host
  ✓ Only Chrome has access
  ✓ No network listener (Unix socket only)
  
VNC server:
  ✓ Listens on 0.0.0.0:5901
  ✓ Password-protected
  ✓ Reverse proxied through preview URL
```

---

## 🚀 Advanced: Custom VNC Configuration

### X11 Display Server Setup

```dockerfile
# In Dockerfile
ENV DISPLAY=:99

# Start X server
RUN apt-get install -y xvfb x11-utils x11-apps

# Start it (usually in entrypoint)
Xvfb :99 -screen 0 1024x768x24 &
```

### VNC Server Setup

```bash
# Inside container, VNC server typically runs as:
vncserver :99 -geometry 1024x768 -depth 24 -password <password>

# Or using supervisor config:
[program:vnc]
command=vncserver :99 -geometry 1024x768 -depth 24 -nolisten tcp -listen unix
autorestart=true
```

### noVNC Configuration

```bash
# Port 6080 usually runs noVNC proxy that connects to VNC server
/noVNC/utils/launch.sh \
  --vnc localhost:5901 \
  --listen 6080
```

---

## 📚 Related Components & Files

### Frontend
- `HealthCheckedVncIframe.tsx` - VNC iframe component
- `useVncPreloader.ts` - VNC connection management
- `tool-call-side-panel.tsx` - Panel containing Browser View
- `ViewToggle` component - Switching between views

### Backend
- `threads.py` - Creates sandbox and gets preview link
- `agent_runs.py` - Updates project with sandbox info
- `sandbox/sandbox.py` - Sandbox lifecycle management
- `docker-compose.yml` - VNC configuration

### Infrastructure
- Docker container with Xvfb + VNC server
- Daytona framework (handles preview link generation)
- noVNC client (web-based VNC viewer)

---

## 🎓 Learning Resources

### Key Concepts to Understand

1. **VNC Protocol**: Client-server model for remote desktop
2. **X11**: Display server (Linux GUI framework)
3. **WebSocket**: Bidirectional communication over HTTP
4. **Frame Buffer**: Representation of screen image
5. **RFB (Remote Frame Buffer)**: Protocol VNC uses

### How to Experiment

1. **Watch Browser View in Action**
   - Start agent with browser task
   - Open Browser View
   - Watch agent navigate in real-time

2. **Monitor Network Traffic**
   - Open DevTools (F12)
   - Network tab
   - See WebSocket connection to preview URL
   - Watch bandwidth usage

3. **Check VNC Server Status**
   ```bash
   docker exec suna ps aux | grep vnc
   docker exec suna netstat -tlnp | grep 5901
   ```

4. **Test VNC Manually**
   ```bash
   # Install vncviewer on your machine
   vncviewer preview-abc123.example.com:5901
   # Enter password when prompted
   ```

---

## ✅ Summary

**Browser View** provides:

✅ **Live desktop streaming** - See agent's desktop in real-time  
✅ **Web-based** - Works in any modern browser (via noVNC)  
✅ **Low latency** - 100-300ms typical response time  
✅ **Interactive** - Mouse and keyboard work  
✅ **Automatic** - Switches to Browser View for browser tasks  
✅ **Resilient** - Auto-retries VNC connection with backoff  
✅ **Scalable** - Uses efficient VNC protocol with compression  
✅ **Secure** - Password-protected, HTTPS only  

The combination of:
- VNC (for efficient remote desktop)
- noVNC (for web-based access)
- Daytona (for preview URLs)
- React (for smart view switching)

...creates a seamless experience where you can literally watch your AI agent work!
