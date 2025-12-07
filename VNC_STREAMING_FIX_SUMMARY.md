# VNC Streaming Fix - Implementation Summary

## Changes Made

### 1. Backend: Added WebSocket Proxy for VNC Streaming

**File**: `backend/core/sandbox/api.py`

- **Added WebSocket endpoint**: `@router.websocket("/sandboxes/{sandbox_id}/proxy/{port}/websockify")`
- **Implemented bidirectional relay**: Forwards WebSocket traffic between frontend ↔ Daytona VNC server
- **Added required imports**: `WebSocket`, `WebSocketDisconnect`, `asyncio`
- **Features**:
  - Accepts WebSocket connections from noVNC client
  - Connects to upstream Daytona VNC WebSocket
  - Relays binary and text messages bidirectionally
  - Injects `X-Daytona-Skip-Preview-Warning` header
  - Proper error handling and connection cleanup
  - Ping/pong keepalive (20s interval)

### 2. Backend: Added websockets Dependency

**File**: `backend/pyproject.toml`

- Added `websockets>=12.0` to dependencies
- Required for WebSocket client connections to Daytona

### 3. Backend: Documented WEBHOOK_BASE_URL Configuration

**File**: `backend/.env.example`

- Added comprehensive documentation for `WEBHOOK_BASE_URL`
- Explained importance for VNC streaming
- Provided examples for development and production
- **CRITICAL**: Must be set to match frontend URL

### 4. Frontend: Updated VNC Path Parameter

**File**: `frontend/src/components/thread/HealthCheckedVncIframe.tsx`

- Added `&path=websockify` to noVNC URL parameters
- Ensures noVNC client connects to correct WebSocket endpoint
- Improved URL construction logic

## How the Fix Works

### Before (Broken)
```
Frontend iframe loads vnc_lite.html → Works ✅
noVNC tries to open WebSocket → No endpoint exists → Gray screen ❌
```

### After (Fixed)
```
Frontend iframe loads vnc_lite.html → Works ✅
noVNC opens WebSocket to /websockify → Backend relays to Daytona → VNC streams! ✅
```

### Complete Flow
1. **Frontend** requests: `{WEBHOOK_BASE_URL}/api/sandboxes/{id}/proxy/6080/vnc_lite.html?password=X&path=websockify`
2. **Backend HTTP proxy** forwards request to Daytona, returns HTML page
3. **noVNC JavaScript** (in HTML) connects to: `ws(s)://{WEBHOOK_BASE_URL}/api/sandboxes/{id}/proxy/6080/websockify`
4. **Backend WebSocket proxy** accepts connection, connects to Daytona VNC server
5. **Bidirectional relay** begins: Frontend ↔ Backend ↔ Daytona
6. **VNC streams** to user's browser!

## Configuration Required

### Critical: Set WEBHOOK_BASE_URL

**Development** (`backend/.env`):
```bash
WEBHOOK_BASE_URL=http://localhost:9990
```

**Production** (`backend/.env`):
```bash
WEBHOOK_BASE_URL=https://kortix.syhc.dev
```

**Or via Docker Compose**:
```yaml
services:
  backend:
    environment:
      - WEBHOOK_BASE_URL=https://kortix.syhc.dev
```

### Installation Steps

1. **Update backend dependencies**:
   ```bash
   cd backend
   uv sync  # or: pip install -r requirements.txt
   ```

2. **Set WEBHOOK_BASE_URL** in your backend `.env` file

3. **Restart backend services**:
   ```bash
   # Docker
   docker compose restart backend worker

   # Or manual
   pkill -f "uvicorn api:app"
   uv run uvicorn api:app --reload
   ```

4. **Test VNC connection** by opening a thread with browser tool

## Testing the Fix

### 1. Create/Open a Project with Sandbox
- Trigger any sandbox tool (browser, files, shell)
- Wait for sandbox to initialize

### 2. Open Browser View
- Click "Computer View" or "Browser Use View" button
- You should see:
  - ✅ "Connecting to browser..." status
  - ✅ VNC connection establishes
  - ✅ Live browser display appears

### 3. Check Backend Logs
Look for successful WebSocket connections:
```
WebSocket connection accepted for sandbox=abc123 port=6080
Connecting to upstream VNC WebSocket: wss://6080-abc123.proxy.daytona.work/websockify
Successfully connected to upstream VNC WebSocket for sandbox abc123
```

### 4. Verify in Browser DevTools
- Open Network tab → Filter by WS (WebSockets)
- Should see WebSocket connection to: `/api/sandboxes/{id}/proxy/6080/websockify`
- Status: 101 Switching Protocols → Connection: Upgrade

## Troubleshooting

### Still seeing gray screen?

1. **Check WEBHOOK_BASE_URL**:
   ```bash
   # In backend container/process
   echo $WEBHOOK_BASE_URL
   # Should output: http://localhost:9990 or https://kortix.syhc.dev
   ```

2. **Check backend logs** for WebSocket errors:
   ```bash
   docker compose logs backend | grep -i websocket
   ```

3. **Check browser console** for errors:
   - Open DevTools → Console
   - Look for WebSocket connection errors

4. **Verify websockets library installed**:
   ```bash
   cd backend
   python -c "import websockets; print(websockets.__version__)"
   ```

5. **Test WebSocket endpoint directly**:
   ```bash
   # Install wscat: npm install -g wscat
   wscat -c "ws://localhost:8000/api/sandboxes/{sandbox-id}/proxy/6080/websockify"
   ```

### Common Issues

**Issue**: `ModuleNotFoundError: No module named 'websockets'`
- **Fix**: Run `uv sync` or `pip install websockets>=12.0`

**Issue**: WebSocket connects but no video
- **Fix**: Check Daytona sandbox is running and VNC server is active
- **Fix**: Verify password in URL matches sandbox password

**Issue**: CORS errors in browser
- **Fix**: Ensure WEBHOOK_BASE_URL matches frontend URL exactly (including protocol)

**Issue**: 502 Bad Gateway on WebSocket
- **Fix**: Check Daytona sandbox preview link is accessible
- **Fix**: Verify `X-Daytona-Skip-Preview-Warning` header is working

## Files Modified

1. ✅ `backend/core/sandbox/api.py` - Added WebSocket proxy endpoint
2. ✅ `backend/pyproject.toml` - Added websockets dependency
3. ✅ `backend/.env.example` - Documented WEBHOOK_BASE_URL
4. ✅ `frontend/src/components/thread/HealthCheckedVncIframe.tsx` - Added path parameter

## Deployment Checklist

- [ ] Update backend dependencies (`uv sync`)
- [ ] Set `WEBHOOK_BASE_URL` in production environment
- [ ] Restart backend services
- [ ] Test VNC connection with sandbox
- [ ] Monitor backend logs for WebSocket connections
- [ ] Verify no errors in browser console

## Related Issues

This fix addresses the core issue where VNC streaming was broken due to missing WebSocket proxy support. The HTTP-only proxy could serve the vnc_lite.html page but couldn't handle the bidirectional WebSocket communication required for actual VNC streaming.

## Next Steps

- [ ] Test in production environment
- [ ] Monitor WebSocket connection stability
- [ ] Consider adding WebSocket connection metrics/logging
- [ ] Document for users in main README if needed
