# VNC Streaming Issue Analysis & Fix

## Problem Summary
Users cannot view the Daytona sandbox browser in the frontend (computer view/browser use view). They see "connecting" then just a gray screen.

## Root Cause Analysis

### Architecture Flow
```
Frontend (VNC iframe)
  → Backend Proxy (/api/sandboxes/{id}/proxy/6080/vnc_lite.html)
    → Daytona Sandbox (noVNC + websockify on port 6080)
```

### Issue Identified
**The backend proxy is missing WebSocket support, which is required for VNC streaming.**

#### Current Implementation (Broken)
Location: `backend/core/sandbox/api.py` lines 515-634

- **HTTP proxy only**: Uses `httpx.AsyncClient` with `StreamingResponse`
- **No WebSocket support**: Cannot handle bidirectional WebSocket connections
- **Works for**: Loading initial HTML page (`vnc_lite.html`)
- **Fails for**: WebSocket connection that noVNC client makes to communicate with VNC server

#### How VNC Actually Works
1. **Initial page load** (HTTP): Frontend requests `/vnc_lite.html` → Works ✅
2. **WebSocket connection** (WS/WSS): noVNC JavaScript opens WebSocket to communicate with VNC server → **Fails ❌**

The noVNC client embedded in `vnc_lite.html` tries to open a WebSocket connection to the same host/path, but our backend proxy doesn't have a WebSocket endpoint, so the connection fails and users see a gray screen.

### When Did This Break?
Commit: `c7ff62e` - "ported over resizeable UI from upstream/PRODUCTION"

**Changes made:**
- Updated HTTP proxy to dynamically get Daytona preview URLs
- Improved content-type sniffing and streaming
- **Did NOT add WebSocket proxy support**

**Previous implementation:**
- Also lacked WebSocket support
- Used hardcoded Daytona URLs

**Conclusion**: The proxy has NEVER properly supported WebSocket connections. The issue likely became visible after other changes (URL generation, Cloudflare tunneling, etc.) made the HTTP part work better, exposing the WebSocket gap.

## Solution Required

### Add WebSocket Proxy Endpoint

We need to implement a WebSocket proxy at:
```
@router.websocket("/sandboxes/{sandbox_id}/proxy/{port}/websockify")
```

This endpoint must:
1. Accept WebSocket connections from frontend
2. Establish WebSocket connection to Daytona VNC server
3. Bidirectionally relay data between frontend ↔ Daytona
4. Inject `X-Daytona-Skip-Preview-Warning` header
5. Handle connection lifecycle (open, message, close, error)

### Configuration Check
Verify `WEBHOOK_BASE_URL` is set correctly in production:
- Development: `http://localhost:9990`
- Production (Cloudflare Tunnel): `https://kortix.syhc.dev`

Currently defaults to `http://localhost:8000` which won't work from frontend.

## Technical Details

### WebSocket Protocol Flow
```
1. Frontend iframe loads: {WEBHOOK_BASE_URL}/api/sandboxes/{id}/proxy/6080/vnc_lite.html
2. vnc_lite.html JavaScript connects: ws(s)://{WEBHOOK_BASE_URL}/api/sandboxes/{id}/proxy/6080/websockify
3. Backend proxy forwards to: wss://{port}-{id}.proxy.daytona.work/websockify
4. Bidirectional data relay begins
```

### Libraries Needed
- **FastAPI**: Already has WebSocket support (`from fastapi import WebSocket`)
- **websockets**: Python library for WebSocket client connections
  - Install: `pip install websockets` or add to requirements
- **asyncio**: Already available for async WebSocket relay

## Implementation Plan

1. Add WebSocket proxy endpoint to `backend/core/sandbox/api.py`
2. Implement bidirectional relay using `asyncio.create_task` for concurrent read/write
3. Add proper error handling and connection cleanup
4. Test with actual Daytona sandbox
5. Verify WEBHOOK_BASE_URL configuration

## Files to Modify

1. **backend/core/sandbox/api.py**
   - Add `@router.websocket("/sandboxes/{sandbox_id}/proxy/{port}/websockify")`
   - Implement WebSocket relay logic

2. **backend/requirements.txt** (if needed)
   - Add `websockets` library

3. **Configuration** (environment variables)
   - Ensure `WEBHOOK_BASE_URL` is set correctly in production

## Next Steps

1. ✅ Analysis complete
2. ⏳ Verify WEBHOOK_BASE_URL configuration
3. ⏳ Implement WebSocket proxy endpoint
4. ⏳ Test VNC connection
5. ⏳ Document changes
