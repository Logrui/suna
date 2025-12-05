# Daytona Sandbox Streaming Resolution Customization Guide

## Overview

This guide documents how to customize the streaming resolution for the Daytona sandbox environment in the Kortix (Suna) platform. The resolution affects the VNC streaming display that shows the browser automation in real-time.

## Current Configuration

**Resolution Updated To:** 1440 x 900 pixels

**Previous Resolution:** 1048 x 768 pixels (backend) / 1024 x 768 pixels (frontend & Docker)

## Architecture Overview

The streaming resolution is configured across three main components:

1. **Backend (Python)** - Creates and configures Daytona sandbox instances
2. **Frontend (TypeScript/React)** - Renders the VNC stream in the web UI
3. **Daytona Docker Image** - Runs the sandbox environment with X server and VNC

## Critical Files Modified

### 1. Backend Sandbox Configuration

**File:** `backend/core/sandbox/sandbox.py`

**Location:** Lines 99-101

**Purpose:** Sets environment variables when creating new Daytona sandbox instances

**Changes Made:**
```python
env_vars={
    "CHROME_PERSISTENT_SESSION": "true",
    "RESOLUTION": "1440x900x24",      # Changed from "1048x768x24"
    "RESOLUTION_WIDTH": "1440",        # Changed from "1048"
    "RESOLUTION_HEIGHT": "900",        # Changed from "768"
    "VNC_PASSWORD": password,
    # ... other env vars
}
```

**Impact:**
- Controls the resolution of newly created sandbox instances
- Must match frontend display dimensions for optimal rendering
- The `x24` suffix indicates 24-bit color depth

**How It Works:**
- When `create_sandbox()` is called, these environment variables are passed to the Daytona sandbox
- The sandbox Docker container reads these values and configures the X virtual framebuffer (Xvfb) accordingly
- Existing sandboxes retain their original resolution until recreated

---

### 2. Frontend VNC Preloader Hook

**File:** `frontend/src/hooks/files/useVncPreloader.ts`

**Location:** Lines 48-49

**Purpose:** Configures the hidden iframe used for preloading VNC connections

**Changes Made:**
```typescript
iframe.style.width = '1440px';   // Changed from '1024px'
iframe.style.height = '900px';   // Changed from '768px'
```

**Impact:**
- Ensures the preloader iframe matches the actual sandbox resolution
- Prevents scaling artifacts during initial connection
- Improves visual consistency when transitioning from loading to connected state

**How It Works:**
- Creates a hidden iframe to preload the VNC connection before displaying to the user
- The iframe dimensions should match the sandbox resolution for optimal rendering
- This hook handles retry logic and connection health checks

---

### 3. Daytona Docker Image

**File:** `backend/core/sandbox/docker/Dockerfile`

**Location:** Lines 124, 127-128

**Purpose:** Sets default environment variables for the sandbox container

**Changes Made:**
```dockerfile
ENV RESOLUTION=1440x900x24        # Changed from 1024x768x24
ENV RESOLUTION_WIDTH=1440         # Changed from 1024
ENV RESOLUTION_HEIGHT=900         # Changed from 768
```

**Impact:**
- Provides fallback resolution if not specified during sandbox creation
- Used by supervisord to configure Xvfb display server
- Affects all browser automation and visual tools in the sandbox

**How It Works:**
- These environment variables are referenced in `supervisord.conf`
- The Xvfb (X Virtual Framebuffer) command uses `%(ENV_RESOLUTION)s` to set the screen dimensions
- VNC server (x11vnc) captures this virtual display and streams it to clients

**Related Configuration:**

The `supervisord.conf` file (line 9) uses the RESOLUTION env var:
```ini
[program:xvfb]
command=bash -c "rm -f /tmp/.X99-lock /tmp/.X11-unix/X99 && Xvfb :99 -screen 0 %(ENV_RESOLUTION)s -ac +extension GLX +render -noreset"
```

---

## How to Customize Resolution

### Step 1: Choose Your Resolution

Common resolutions for sandbox streaming:
- **1024 x 768** - Legacy standard (4:3 aspect ratio)
- **1280 x 720** - HD ready (16:9 aspect ratio)
- **1440 x 900** - WXGA+ (16:10 aspect ratio) - **Current**
- **1920 x 1080** - Full HD (16:9 aspect ratio)
- **2560 x 1440** - QHD (16:9 aspect ratio)

**Considerations:**
- **Higher resolutions** = More detail, but larger bandwidth and memory usage
- **Aspect ratio** = Should match common display formats (16:9 or 16:10 recommended)
- **Performance** = Sandbox CPU/memory limits may affect higher resolutions

### Step 2: Update Backend Configuration

Edit `backend/core/sandbox/sandbox.py`:

```python
env_vars={
    "RESOLUTION": "WIDTH x HEIGHT x 24",
    "RESOLUTION_WIDTH": "WIDTH",
    "RESOLUTION_HEIGHT": "HEIGHT",
    # ... other vars
}
```

Replace `WIDTH` and `HEIGHT` with your chosen dimensions.

### Step 3: Update Frontend Configuration

Edit `frontend/src/hooks/files/useVncPreloader.ts`:

```typescript
iframe.style.width = 'WIDTHpx';
iframe.style.height = 'HEIGHTpx';
```

### Step 4: Update Docker Image Defaults

Edit `backend/core/sandbox/docker/Dockerfile`:

```dockerfile
ENV RESOLUTION=WIDTHxHEIGHTx24
ENV RESOLUTION_WIDTH=WIDTH
ENV RESOLUTION_HEIGHT=HEIGHT
```

### Step 5: Rebuild and Deploy

1. **Rebuild Docker image** (if using Docker-based Daytona):
   ```bash
   cd backend/core/sandbox/docker
   docker build -t your-registry/daytona-sandbox:latest .
   docker push your-registry/daytona-sandbox:latest
   ```

2. **Update Daytona snapshot** (if using Daytona cloud):
   - Create a new snapshot with the updated image
   - Update `SANDBOX_SNAPSHOT_NAME` in backend configuration

3. **Restart backend services**:
   ```bash
   docker compose restart backend worker
   ```

4. **Rebuild frontend** (for production):
   ```bash
   cd frontend
   npm run build
   docker compose restart frontend
   ```

### Step 6: Test

1. Create a new sandbox by starting a browser tool action
2. Verify the VNC stream displays at the correct resolution
3. Check for scaling artifacts or aspect ratio issues
4. Monitor sandbox resource usage (CPU/memory)

---

## Troubleshooting

### Issue: VNC stream appears stretched or distorted

**Cause:** Frontend dimensions don't match backend resolution

**Solution:** Ensure all three files use identical width/height values

---

### Issue: VNC connection fails to load

**Cause:** Resolution too high for sandbox resources

**Solution:**
- Reduce resolution to 1280x720 or lower
- Increase sandbox resource allocation in `sandbox.py` (uncomment Resources block)

---

### Issue: Existing sandboxes still use old resolution

**Cause:** Sandboxes created before the change retain their original settings

**Solution:**
- Delete old sandboxes and create new ones
- Or manually stop/start existing sandboxes (may update env vars)

---

### Issue: Browser content doesn't fit in viewport

**Cause:** Resolution aspect ratio doesn't match expected browser dimensions

**Solution:** Use standard aspect ratios (16:9 or 16:10) for better web compatibility

---

## Performance Considerations

### Resolution Impact on Resources

| Resolution | Approx. Memory | Bandwidth (streaming) | CPU Usage |
|-----------|----------------|----------------------|-----------|
| 1024x768  | ~100 MB        | ~2-4 Mbps           | Low       |
| 1440x900  | ~150 MB        | ~4-6 Mbps           | Medium    |
| 1920x1080 | ~250 MB        | ~6-10 Mbps          | High      |
| 2560x1440 | ~400 MB        | ~10-15 Mbps         | Very High |

**Recommendations:**
- For **cloud deployments** with bandwidth limits: Use 1440x900 or lower
- For **local development**: 1920x1080 is usually fine
- For **resource-constrained environments**: Stay at 1024x768

---

## Related Components

### Frontend Display Component

**File:** `frontend/src/components/thread/HealthCheckedVncIframe.tsx`

This component renders the actual VNC iframe. While it doesn't directly set resolution, it includes responsive aspect ratio classes:

```tsx
className='relative w-full aspect-[4/3] sm:aspect-[5/3] md:aspect-[16/11]'
```

**Note:** These aspect ratios control the iframe container size, not the VNC stream resolution. The container will scale the VNC content to fit.

### Sandbox Tool Base

**File:** `backend/core/sandbox/tool_base.py`

This base class handles sandbox lifecycle but doesn't directly configure resolution. However, it calls `create_sandbox()` which does set the resolution.

---

## Advanced Customization

### Per-User or Per-Agent Resolution

To allow different resolutions for different use cases:

1. Add resolution parameters to agent configuration
2. Pass resolution values to `create_sandbox()` function
3. Update function signature to accept optional width/height params:

```python
async def create_sandbox(
    password: str,
    project_id: str = None,
    resolution_width: int = 1440,
    resolution_height: int = 900
) -> AsyncSandbox:
    params = CreateSandboxFromSnapshotParams(
        # ...
        env_vars={
            "RESOLUTION": f"{resolution_width}x{resolution_height}x24",
            "RESOLUTION_WIDTH": str(resolution_width),
            "RESOLUTION_HEIGHT": str(resolution_height),
            # ...
        }
    )
```

### Dynamic Resolution Based on Client Display

For advanced implementations, you could:

1. Detect client screen resolution in frontend
2. Send preferred resolution to backend via API
3. Create sandbox with optimal resolution for that client
4. Cache resolution preference per user

---

## Summary

To customize Daytona sandbox streaming resolution, you must update **three critical files**:

1. **`backend/core/sandbox/sandbox.py`** - Lines 99-101 (env vars for sandbox creation)
2. **`frontend/src/hooks/files/useVncPreloader.ts`** - Lines 48-49 (iframe dimensions)
3. **`backend/core/sandbox/docker/Dockerfile`** - Lines 124, 127-128 (default env vars)

All three must use **identical dimensions** to ensure proper rendering without scaling artifacts.

**Current Configuration:** 1440 x 900 pixels (16:10 aspect ratio)

---

## Changelog

### 2025-12-05 - Resolution Update to 1440x900

- **Updated from:** Mixed resolutions (1048x768 in backend, 1024x768 in frontend/Docker)
- **Updated to:** Consistent 1440x900 across all components
- **Reason:** Standardize resolution and improve display quality for modern screens
- **Files modified:** 3 (sandbox.py, useVncPreloader.ts, Dockerfile)

---

## Additional Resources

- **Daytona SDK Documentation:** https://github.com/daytonaio/daytona
- **noVNC Documentation:** https://github.com/novnc/noVNC
- **Xvfb Documentation:** https://www.x.org/releases/X11R7.6/doc/man/man1/Xvfb.1.xhtml
- **VNC Protocol Specification:** https://github.com/rfbproto/rfbproto
