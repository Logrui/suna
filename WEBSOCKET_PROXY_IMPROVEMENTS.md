# WebSocket Proxy Security & Robustness Improvements

## Changes Made (Code Review Fixes)

### 1. ✅ Added Authentication/Authorization
**Issue**: WebSocket endpoint was accepting connections without verifying user access
**Fix**:
- Added `user_id: Optional[str] = Depends(get_optional_user_id)` parameter
- Verify access BEFORE accepting WebSocket connection
- Matches security pattern used in HTTP proxy endpoint

```python
# Verify access BEFORE accepting the WebSocket connection
client = await db.client
await verify_sandbox_access_optional(client, sandbox_id, user_id)

# Accept WebSocket connection after authorization
await websocket.accept()
```

### 2. ✅ Moved websockets Import to Module Level
**Issue**: `import websockets` was inside function (bad practice)
**Fix**: Moved to top-level imports at line 11

```python
import asyncio
import websockets  # Now at module level
```

### 3. ✅ Fixed Race Condition in Cleanup Logic
**Issue**: Both relay tasks could try to close connections simultaneously without state tracking
**Fix**:
- Added `client_closed` and `upstream_closed` flags
- Check flags before attempting to close connections
- Wrap all close operations in try/except to handle already-closed connections
- Use `nonlocal` to share state between relay tasks

```python
# Flags to track connection state and prevent double-close
client_closed = False
upstream_closed = False

# In relay_client_to_upstream finally block:
if not upstream_closed and upstream_ws and not upstream_ws.closed:
    upstream_closed = True
    try:
        await upstream_ws.close()
    except Exception:
        pass  # Already closed or error during close
```

### 4. ✅ Improved Error Handling
**Issue**: Attempting to close WebSocket that might already be closed
**Fix**:
- Wrap all `websocket.close()` calls in try/except
- Gracefully handle cases where connection isn't accepted yet (auth failures)
- Prevent exceptions from propagating during cleanup

```python
except HTTPException as e:
    logger.error(f"HTTP error in WebSocket proxy: {e}")
    try:
        await websocket.close(code=1008, reason=str(e.detail))
    except Exception:
        pass  # Connection may not be accepted yet
```

### 5. ✅ Fixed URL Protocol Replacement Edge Case
**Issue**: Using `.replace()` could incorrectly replace protocol strings in URL parameters
**Example Bug**: `https://example.com?redirect=https://other.com` → `wss://example.com?redirect=wss://other.com`
**Fix**: Use proper prefix checking with string slicing

```python
# Before (buggy):
ws_url = base_target_url.replace('https://', 'wss://').replace('http://', 'ws://')

# After (correct):
if base_target_url.startswith('https://'):
    ws_url = 'wss://' + base_target_url[8:]
elif base_target_url.startswith('http://'):
    ws_url = 'ws://' + base_target_url[7:]
else:
    ws_url = base_target_url  # Already a ws:// or wss:// URL
```

## Security Improvements

### Before
- ❌ No authentication - anyone with sandbox_id could connect
- ❌ No authorization checks
- ❌ Potential unauthorized access to sandbox VNC streams

### After
- ✅ User authentication via dependency injection
- ✅ Authorization verified before accepting connection
- ✅ Matches security pattern of HTTP proxy
- ✅ Access control enforced for both public and private projects

## Reliability Improvements

### Race Condition Prevention
- ✅ State flags prevent double-close attempts
- ✅ Graceful handling of simultaneous disconnections
- ✅ No crashes from attempting to close already-closed connections

### Error Handling
- ✅ All WebSocket operations wrapped in try/except
- ✅ Handles auth failures before connection acceptance
- ✅ Proper cleanup even when errors occur
- ✅ No exception propagation during cleanup

### Code Quality
- ✅ Imports at module level (Python best practice)
- ✅ Proper URL parsing without edge case bugs
- ✅ Clear separation of concerns (auth → accept → relay)
- ✅ Comprehensive logging for debugging

## Testing Recommendations

### Security Testing
1. **Unauthorized access**: Try connecting without valid user_id
2. **Wrong sandbox**: Try accessing sandbox owned by different user
3. **Public vs Private**: Verify public projects allow access, private require auth

### Reliability Testing
1. **Abrupt disconnects**: Close browser tab during VNC session
2. **Network interruption**: Simulate network loss during streaming
3. **Concurrent disconnects**: Test both ends disconnecting simultaneously
4. **Rapid reconnects**: Quickly connect/disconnect multiple times

### Edge Cases
1. **URL with protocol in params**: Test with redirect URLs containing `http://`
2. **Already-closed connections**: Ensure no crashes when closing closed connections
3. **Auth during connection**: Test auth failures at different stages

## Performance Impact

- **Minimal overhead**: State flags add negligible memory
- **Same latency**: Auth check happens before accept (no added latency to relay)
- **Improved reliability**: Fewer errors means better user experience

## Files Modified

- `backend/core/sandbox/api.py` - All improvements applied

## Backward Compatibility

✅ **Fully backward compatible**
- Existing functionality unchanged
- Same endpoint path
- Same WebSocket protocol
- Only adds security and reliability improvements
