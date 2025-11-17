# Suna Custom Streaming: Daytona + VNC Architecture

## Overview

Daytona provides the **infrastructure layer** (container hosting), but all the GUI streaming capabilities are custom-built by Suna. This document explains what's native Daytona vs. what Suna engineered.

---

## What Daytona Provides Natively

Daytona is a **"sandbox-as-a-service"** platform that provides:

1. **Container Infrastructure**
   - Spin up Docker containers from snapshots on-demand
   - Manages container lifecycle across distributed regions
   - Regions: `us`, `eu`, `ap`

2. **Public Preview URLs**
   - Automatic reverse proxy with public domains
   - Format: `https://preview-ABC123.daytona.io/...`
   - No need to manage firewall rules or port forwarding yourself

3. **Port Forwarding**
   - Expose any container port publicly through the preview URL
   - Daytona handles the networking/tunneling automatically
   - In Suna's case: ports 6080 (noVNC), 5901 (VNC), 9222 (Chrome debugging)

4. **Lifecycle Management**
   - Start/stop/delete containers via API
   - Accessed through `daytona_sdk` (Python SDK)
   - Authenticated with `DAYTONA_API_KEY`

5. **Auto-archiving & Cleanup**
   - Automatically stops sandboxes after idle period
   - Automatically archives (further reduced state) after another period
   - In Suna config: `auto_stop_interval=15`, `auto_archive_interval=30` (minutes)

---

## What Suna Engineered

**All the GUI streaming is Suna's custom work.** This includes:

### 1. **VNC Server Infrastructure**
- Installed in Docker image: `x11vnc`, `tigervnc-tools`
- Listens on port 5901 (raw TCP VNC protocol)
- Captures framebuffer of the virtual X11 desktop
- Encodes screen deltas (only changed pixels, not full frames)
- Supports VNC authentication with password

### 2. **noVNC Web Client**
- Web-based VNC viewer running on port 6080
- Converts VNC protocol to WebSocket for browser compatibility
- Allows mouse/keyboard input from browser to remote desktop
- No browser plugins required—pure HTML/JavaScript
- Embedded in Suna frontend via iframe

### 3. **Virtual Desktop Environment**
- **X11 Display Server**: `xvfb` (X virtual framebuffer)
- Environment variable: `DISPLAY=:99`
- Provides a headless virtual desktop for Linux GUI applications
- 1024x768 resolution configurable via environment variables

### 4. **Chrome Browser Instance**
- Chrome running inside the container, rendered to X11 virtual display
- Headless but visible to VNC server
- Chrome Remote Debugging Protocol (CDP) on port 9222
- Persistent session support for stateful interactions
- User-data directory for cookies, cache, history

### 5. **Process Supervisor**
- `supervisor` manages all background processes
- Ensures VNC server stays running even if it crashes
- Ensures X11 display server stays running
- Ensures Chrome process stays running
- Config: `/etc/supervisor/conf.d/supervisord.conf`

### 6. **React Frontend Integration**
- `tool-call-side-panel.tsx` (~1,052 lines)
  - Main component managing the "Suna's Computer" UI
  - Embeds noVNC iframe
  - Handles view switching (Tools ↔ Browser)
  
- `HealthCheckedVncIframe.tsx`
  - Wraps the noVNC iframe with connection health checks
  - Shows loading spinner during connection attempts
  - Displays retry count (Attempt X/5)
  - Shows error messages with recovery options

- `useVncPreloader.ts` (Hook)
  - Manages VNC connection retry logic
  - Exponential backoff strategy (1s → 1.5s → 2.25s → 3.38s → 5s)
  - Max 5 retries with 5-second timeout per attempt
  - Handles connection failures gracefully

---

## The Custom Docker Image

Suna built a **completely custom Docker image** from scratch: `notlogrui/suna:0.1.3.23`

### Base Layer
```dockerfile
FROM python:3.11-slim-bookworm
```
Python-based, Debian Linux foundation for agent code execution.

### Core GUI Components (Suna's Addition)
```dockerfile
xvfb              # Virtual framebuffer (headless X11)
x11vnc            # VNC server
tigervnc-tools    # VNC utilities
supervisor        # Process manager
dbus, xauth       # X11 utilities
```

### Browser Environment
```dockerfile
google-chrome     # Full Chrome installation
fonts-*           # Font packages for proper rendering
libatk*, libgtk*  # UI rendering libraries
```

### Agent Capabilities
```dockerfile
git               # Version control
python3-numpy     # Numerical computing
poppler-utils     # PDF processing
wkhtmltopdf       # HTML to PDF conversion
antiword, catdoc  # Document processing
jq, csvkit        # Data processing
```

### Docker Compose Configuration
```yaml
image: notlogrui/suna:0.1.3.23
ports:
  - "6080:6080"   # noVNC web interface
  - "5901:5901"   # VNC raw protocol
  - "9222:9222"   # Chrome Remote Debugging
  - "8004:8004"   # Browser API server
  - "8080:8080"   # HTTP server
environment:
  - DISPLAY=:99
  - VNC_PASSWORD=<password>
  - RESOLUTION=1048x768x24
  - CHROME_CDP=http://localhost:9222
```

---

## Data Flow: From Sandbox to Browser

### 1. **Backend: Sandbox Creation**
```python
# File: backend/core/sandbox/sandbox.py

from daytona_sdk import AsyncDaytona, CreateSandboxFromSnapshotParams

daytona = AsyncDaytona(DaytonaConfig(
    api_key=DAYTONA_API_KEY,
    api_url="https://app.daytona.io/api",
    target="us"  # Region selection
))

# Create sandbox from custom Suna image
sandbox = await daytona.create(CreateSandboxFromSnapshotParams(
    snapshot="notlogrui/suna:0.1.3.23",  # Custom image
    public=True,  # Make preview URL public
    env_vars={
        "VNC_PASSWORD": password,
        "RESOLUTION": "1048x768x24",
        "CHROME_PERSISTENT_SESSION": "true"
    },
    auto_stop_interval=15,      # Auto-stop after 15 min idle
    auto_archive_interval=30    # Archive after 30 min
))

# Daytona returns: sandbox.id, sandbox.state, preview URLs
```

### 2. **Backend: Get Preview URL**
```python
# File: backend/core/services/threads.py or agent_runs.py

vnc_link = await sandbox.get_preview_link(6080)  # Get port 6080 public URL
vnc_url = vnc_link.url  # e.g., "https://preview-abc123.daytona.io"

# Store in database
project.sandbox.vnc_preview = vnc_url
project.sandbox.password = password
project.sandbox.token = sandbox.id
```

### 3. **Sandbox Container: Startup**
- Daytona pulls `notlogrui/suna:0.1.3.23`
- Starts container with env vars and port forwarding
- Supervisor starts all processes:
  1. **X11**: `Xvfb :99 -screen 0 1024x768x24`
  2. **VNC**: `x11vnc -display :99 -auth /root/.Xauthority -port 5901`
  3. **noVNC**: `websockify --web=/usr/share/novnc localhost:6080 localhost:5901`
  4. **Chrome**: `google-chrome --display=:99 ...`

### 4. **VNC Connection Chain**
```
Browser
   ↓
Daytona Preview URL (HTTPS)
   ↓ Reverse proxy
noVNC WebSocket Interface (port 6080)
   ↓ WebSocket tunnel
VNC Server (port 5901)
   ↓ VNC protocol
X11 Display (:99)
   ↓ 
Chrome browser visible on virtual display
```

### 5. **Frontend: React Component**
```typescript
// File: frontend/src/components/tool-call-side-panel.tsx

<HealthCheckedVncIframe
  sandbox={sandbox}
  vnc_url={project.sandbox.vnc_preview}
  password={project.sandbox.password}
/>
```

```typescript
// File: frontend/src/hooks/useVncPreloader.ts

const { status, retryCount, isPreloaded } = useVncPreloader(sandbox, {
  maxRetries: 5,
  initialDelay: 1000,  // 1 second
  timeoutMs: 5000      // 5 second timeout per attempt
});

// Exponential backoff:
// Attempt 1: 1.0s delay
// Attempt 2: 1.5s delay
// Attempt 3: 2.25s delay
// Attempt 4: 3.38s delay
// Attempt 5: 5.0s delay (capped)
```

### 6. **Frontend: Render VNC**
```typescript
// Embed noVNC in iframe pointing to Daytona preview URL
<iframe
  src={`${vnc_url}/vnc_lite.html?path=?token=${password}`}
  style={{ width: '100%', height: '100%' }}
/>
```

---

## Architecture Comparison

### Daytona's Role
```
┌─────────────────────────────────┐
│      Daytona Platform           │
│  - Container orchestration      │
│  - Public preview URLs          │
│  - Port forwarding              │
│  - Lifecycle management         │
│  - Region selection (us/eu/ap)  │
└─────────────────────────────────┘
         ↓
  Provides infrastructure
```

### Suna's Role
```
┌─────────────────────────────────┐
│    Suna Custom Docker Image     │
│  - VNC server (x11vnc)          │
│  - Virtual display (Xvfb)       │
│  - Chrome browser instance      │
│  - noVNC web client (6080)      │
│  - Process supervisor           │
│  - Document processing tools    │
│  - Python agent runtime         │
└─────────────────────────────────┘
         ↓
  Provides the GUI experience
```

### The Integration
```
Suna sends:
  1. Docker image to Daytona
  2. API call to create sandbox

Daytona does:
  1. Provisions container from image
  2. Starts port forwarding
  3. Returns public preview URL

Suna frontend receives:
  1. Preview URL from backend
  2. Embeds it in iframe
  3. User sees live desktop GUI
```

---

## Key Technologies

| Component | Purpose | Technology |
|-----------|---------|-----------|
| Container Hosting | Infrastructure as a Service | Daytona |
| Container Registry | Store Docker images | Docker Hub (`notlogrui/suna`) |
| Virtual Display | Headless GUI rendering | Xvfb (X virtual framebuffer) |
| Remote Desktop Protocol | Desktop streaming | VNC (Virtual Network Computing) |
| WebSocket Bridge | Browser-compatible streaming | noVNC (web-based VNC client) |
| Desktop Environment | GUI application host | X11 |
| Browser | Web automation & rendering | Google Chrome/Chromium |
| Process Management | Ensure services stay up | Supervisor |
| Backend SDK | Daytona integration | daytona_sdk (Python) |
| Frontend Integration | Display streaming GUI | React + TypeScript |

---

## Configuration

### Backend Environment Variables

```bash
# Daytona Configuration
DAYTONA_API_KEY=<your-api-key>           # From https://app.daytona.io
DAYTONA_SERVER_URL=https://app.daytona.io/api
DAYTONA_TARGET=us                         # us, eu, or ap

# Sandbox Configuration
SANDBOX_SNAPSHOT_NAME=notlogrui/suna:0.1.3.23
```

### Docker Environment Variables (passed to container)

```bash
DISPLAY=:99                               # X11 display number
VNC_PASSWORD=<random-password>            # VNC authentication
RESOLUTION=1048x768x24                    # Desktop resolution
CHROME_PERSISTENT_SESSION=true            # Keep Chrome state between requests
CHROME_CDP=http://localhost:9222          # Chrome Remote Debugging Protocol
ANONYMIZED_TELEMETRY=false                # Disable telemetry
AUTO_STOP_INTERVAL=15                     # Minutes before auto-stop
AUTO_ARCHIVE_INTERVAL=30                  # Minutes before auto-archive
```

---

## Customization & Extension

### Building a Custom Image

```bash
cd backend/core/sandbox/docker
docker compose build
docker tag suna:custom notlogrui/suna:0.1.3.24
docker push notlogrui/suna:0.1.3.24
```

### Publishing Updates

1. Update version in `docker-compose.yml`
2. Build new image
3. Push to Docker Hub
4. Create snapshot in Daytona
5. Update `SANDBOX_SNAPSHOT_NAME` in `backend/core/utils/config.py`
6. Reference in `backend/core/sandbox/sandbox.py`

### Adding New Tools

Add to Dockerfile:
```dockerfile
RUN apt-get install -y \
    ffmpeg \          # Video processing
    imagemagick \     # Image manipulation
    tesseract-ocr     # OCR
```

The agent can then use these tools via shell commands in the sandbox.

---

## Performance Characteristics

### Connection Latency
- VNC protocol: optimized for screen deltas (only changed pixels)
- Typical latency: 50-200ms depending on region
- WebSocket tunneling adds negligible overhead

### Resolution & Refresh Rate
- Default: 1024x768 at 24-bit color
- Configurable via `RESOLUTION` environment variable
- VNC handles dynamic resolution changes

### Bandwidth
- Minimal bandwidth usage due to delta encoding
- Typical range: 100KB-2MB per second depending on activity
- Idle connection uses almost no bandwidth

### Auto-cleanup
- Daytona automatically stops sandbox after 15 minutes idle
- Further archived after 30 minutes
- User can manually delete sandbox via API

---

## Troubleshooting

### VNC Connection Fails

**Symptom**: "Attempt 5/5 failed" in UI

**Root Causes**:
- noVNC port (6080) not exposed in Daytona preview URL
- VNC server crashed in container
- Network connectivity issue between browser and Daytona

**Solutions**:
- Check Daytona sandbox health
- Verify `auto_stop_interval` hasn't been exceeded
- Restart sandbox: `await daytona.start(sandbox)`
- Check supervisor logs in container

### Desktop Not Rendering

**Symptom**: Black/blank screen in VNC

**Root Causes**:
- X11 display crashed
- Chrome process exited
- Resolution mismatch

**Solutions**:
- Restart supervisor: `supervisorctl restart all`
- Check `/tmp` directory permissions
- Verify `DISPLAY=:99` environment variable

### Slow Performance

**Symptom**: Laggy mouse/keyboard response

**Root Causes**:
- High latency to Daytona region
- Low bandwidth connection
- Desktop resolution too high

**Solutions**:
- Switch to closer region (DAYTONA_TARGET)
- Reduce resolution in `RESOLUTION` env var
- Check network throughput

---

## Summary

**Daytona** = Infrastructure (compute, networking, container orchestration)  
**Suna** = Experience (VNC, GUI, real desktop streaming to AI agents)  
**Together** = Remote desktop for autonomous agents

Daytona doesn't know or care about VNC—it just provides a box where Suna's custom environment can run. Suna leveraged that infrastructure to build a complete, browser-accessible remote desktop experience.
