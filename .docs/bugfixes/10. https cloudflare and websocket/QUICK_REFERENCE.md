# WebSocket WSS - Quick Reference

## The Problem
```
❌ Browser (HTTPS) + WebSocket ws:// = Mixed Content Error
```

## The Solution (3 Steps)

### 1. Update docker-compose.yaml
```yaml
build:
  args:
    - NEXT_PUBLIC_REALTIME_URL=https://kong.kortix.syhc.dev/
environment:
  - NEXT_PUBLIC_REALTIME_URL=https://kong.kortix.syhc.dev/
```

### 2. Update frontend/Dockerfile
```dockerfile
ARG NEXT_PUBLIC_REALTIME_URL
ENV NEXT_PUBLIC_REALTIME_URL=${NEXT_PUBLIC_REALTIME_URL}
```

### 3. Deploy
```bash
docker compose build --no-cache frontend
docker compose up -d frontend
```

## Verification
```javascript
// Browser Console should show:
[createRealtimeClient] expectedProtocol: "wss://"
[createRealtimeClient] shouldBeSecure: true
```

```
Browser Network tab:
✅ WebSocket: wss://kong.kortix.syhc.dev/realtime/v1/websocket
```

## Configuration Matrix
| Context | URL Config | Protocol | Status |
|---------|-----------|----------|--------|
| Local Dev (HTTP) | `http://localhost:8888` | `ws://` | ✅ Works |
| Production (HTTPS) | `https://kong...` | `wss://` | ✅ Works |
| HTTPS + HTTP URL | `http://kong...` | `ws://` | ❌ Error |

## Common Quick Fixes
| Issue | Fix |
|-------|-----|
| Still ws:// instead of wss:// | Rebuild with `--no-cache` |
| Env var not found | Check Dockerfile has both `ARG` and `ENV` |
| Can't connect to Kong | Verify Kong running: `docker compose ps kong` |
| Mixed content warning | Must use `https://` in NEXT_PUBLIC_REALTIME_URL |

## Key Facts
1. `NEXT_PUBLIC_*` variables are **build-time**, not runtime
2. HTTPS pages **require `wss://`** protocol for WebSocket
3. Docker build args must be **declared in Dockerfile with `ARG`**
4. Cloudflare handles HTTP→HTTPS for regular requests, **NOT WebSocket**
5. Protocol selection is automatic: `https://` → `wss://`, `http://` → `ws://`

---

**Need more details?** See [COMPLETE_GUIDE.md](./COMPLETE_GUIDE.md)  
**Debugging issues?** See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
