# ✅ Suna Self-Hosted Setup - Complete & Working

## 🎉 Status: OPERATIONAL

Your Suna self-hosted installation is now fully functional with OAuth and dashboard working.

---

## 🚀 Quick Start

### Access Suna
- **Dashboard:** http://localhost:3000/dashboard
- **Login:** Email/password authentication via Supabase

### Services Ports
| Service | Port | Purpose |
|---------|------|---------|
| Suna Frontend | 3000 | Web dashboard |
| Suna Backend API | 8000 | Backend services |
| Redis | 6380 | Cache/worker queue |
| Supabase Kong | 8002 | Database + Auth gateway |
| Supabase Auth (GoTrue) | 8100 | OAuth provider |

---

## 🔧 What Was Fixed Today

### Issue 1: Vercel Analytics Blocking Dashboard
**Problem:** 404 errors for `/vercelinsightsscript.js` preventing dashboard from loading

**Solution:** Removed Vercel analytics from `frontend/src/app/layout.tsx`
```tsx
// Removed:
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
// ... and their JSX components
```

**File Modified:** `frontend/src/app/layout.tsx`

### Issue 2: Missing Environment Variables in Container
**Problem:** Frontend container didn't have `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLIC_URL`

**Solution:** Added environment variables to Docker configuration

**Files Modified:**
1. `docker-compose.yaml` - Added build args and environment section
2. `frontend/Dockerfile` - Added ARG declarations and ENV settings

**Configuration:**
```yaml
# docker-compose.yaml
frontend:
  build:
    args:
      - NEXT_PUBLIC_SUPABASE_URL=http://supabase-kong:8000
      - NEXT_PUBLIC_SUPABASE_PUBLIC_URL=http://localhost:8002
      - NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
  environment:
    - NEXT_PUBLIC_SUPABASE_URL=http://supabase-kong:8000
    - NEXT_PUBLIC_SUPABASE_PUBLIC_URL=http://localhost:8002
    - NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### Why Two Supabase URLs?

Your setup uses **server-side rendering** in Next.js which creates a unique problem:

- **Inside Docker (Server):** Services see each other by hostname (e.g., `supabase-kong:8000`)
- **In Browser (Client):** Can only access services via localhost (e.g., `localhost:8002`)

**Solution:** Two environment variables
- `NEXT_PUBLIC_SUPABASE_URL` → Server uses internal container hostname
- `NEXT_PUBLIC_SUPABASE_PUBLIC_URL` → Browser uses localhost port

---

## ✅ Complete Fixes Applied (Previous Sessions)

### Fix 1: OAuth Port Exposure ✅
**File:** `suna-supabase/docker/docker-compose.yml`
```yaml
auth:
  ports:
    - "8100:9999"  # Expose Auth service to host
```

### Fix 2: Docker Network Connectivity ✅
**File:** `suna/docker-compose.yaml`
```yaml
networks:
  default:
    name: suna
  supabase:
    name: supabase
    external: true
```
All services now connect to both networks for cross-network communication.

### Fix 3: Frontend Environment Setup ✅
**File:** `frontend/.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL=http://supabase-kong:8000
NEXT_PUBLIC_SUPABASE_PUBLIC_URL=http://localhost:8002
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

---

## 🧪 Verification Checklist

### ✅ Services Running
```bash
# All containers should be up
docker compose ps

# Output should show:
# suna-backend-1        Up
# suna-frontend-1       Up
# suna-redis-1          Up (healthy)
# suna-worker-1         Up
```

### ✅ Environment Variables Set
```bash
# Frontend should have these variables
docker exec suna-frontend-1 env | grep NEXT_PUBLIC_SUPABASE

# Output should include:
# NEXT_PUBLIC_SUPABASE_URL=http://supabase-kong:8000
# NEXT_PUBLIC_SUPABASE_PUBLIC_URL=http://localhost:8002
```

### ✅ Services Responding
- **Frontend:** `curl http://localhost:3000/dashboard` → Status 200
- **Auth:** `curl http://localhost:8100/health` → Status 200

### ✅ Dashboard Loading
1. Open http://localhost:3000/dashboard
2. No errors in browser console (press F12)
3. Should see agents and accounts sections

---

## 🧑‍💻 How to Use

### Login to Dashboard
```
URL: http://localhost:3000
Email: yhcsanction@gmail.com
Password: [Your password]
```

### View Agents & Accounts
After login, dashboard shows:
- **Agents:** List of AI agents configured
- **Accounts:** Associated account information

### Backend Operations
Backend runs on `localhost:8000` and handles:
- OAuth flows
- Agent execution
- Data persistence via Supabase

---

## 🐳 Docker Management

### View Logs
```bash
# Frontend logs
docker logs suna-frontend-1 -f

# Backend logs
docker logs suna-backend-1 -f

# All services
docker compose logs -f
```

### Restart Services
```bash
# Restart one service
docker compose restart frontend

# Restart all
docker compose restart

# Rebuild and restart
docker compose up -d --build frontend
```

### Stop All Services
```bash
docker compose down
```

---

## 🛠️ Troubleshooting

### Dashboard Shows Blank Page
1. Clear browser cache: **Ctrl+Shift+Delete**
2. Check environment variables: `docker exec suna-frontend-1 env | grep NEXT_PUBLIC`
3. Rebuild frontend: `docker compose up -d --build frontend`

### API Calls Failing
1. **From browser:** Check browser console (F12 → Console tab)
2. **Common error:** "ERR_NAME_NOT_RESOLVED" means DNS lookup failed
3. **Solution:** Ensure frontend has correct environment variables
4. **Verify:** `curl http://localhost:8002/rest/v1/` should work

### Login Not Working
1. Check auth service: `docker logs suna-supabase-auth-1`
2. Verify backend: `docker logs suna-backend-1 | tail -20`
3. Check network: `docker network inspect supabase`

### Port Already in Use
```bash
# Find what's using port 3000
netstat -ano | findstr :3000

# Kill process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Or change docker-compose port mapping
```

---

## 📚 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Your Machine                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Docker (Internal Network)           │   │
│  │                                                  │   │
│  │  Suna Network (172.28.0.0/16)                   │   │
│  │  ├─ Frontend (3000 → localhost:3000)            │   │
│  │  ├─ Backend (8000)                              │   │
│  │  ├─ Worker (dramatiq)                           │   │
│  │  └─ Redis (6380)                                │   │
│  │                                                  │   │
│  │  Supabase Network (172.29.0.0/16)               │   │
│  │  ├─ Kong Gateway (8002 → localhost:8002)        │   │
│  │  ├─ Auth/OAuth (8100 → localhost:8100)          │   │
│  │  ├─ PostgreSQL Database                         │   │
│  │  ├─ Storage Service                             │   │
│  │  └─ Realtime Service                            │   │
│  │                                                  │   │
│  │  Cross-Network Bridges: ✅ Enabled              │   │
│  └──────────────────────────────────────────────────┘   │
│                         ↕ (mapped ports)                 │
│  Browser: http://localhost:3000                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🔐 Security Notes

### For Production Deployment
1. **Change default credentials** in Supabase
2. **Enable HTTPS** with valid certificate
3. **Set environment variables** for sensitive data
4. **Configure OAuth** with your provider credentials
5. **Restrict network access** (firewall rules)
6. **Enable database backups** regularly

### For Local Development (Current Setup)
✅ All security measures appropriate for local testing
✅ Default credentials acceptable for development
⚠️ Not suitable for production without hardening

---

## 📝 Configuration Reference

### Frontend Environment Variables
| Variable | Value | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | `http://supabase-kong:8000` | Server-side Supabase access |
| `NEXT_PUBLIC_SUPABASE_PUBLIC_URL` | `http://localhost:8002` | Browser-side Supabase access |
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:8000` | Backend API calls |

### Backend Configuration
- Location: `backend/.env`
- Database: PostgreSQL (via Supabase)
- Cache: Redis (`redis:6379`)
- Auth: Supabase Auth (`supabase-kong:8000/auth`)

### Supabase Configuration
- Location: `suna-supabase/docker/docker-compose.yml`
- Database: PostgreSQL 15
- Kong Gateway: API routing layer
- Auth: GoTrue (OAuth provider)

---

## 🎯 Next Steps

### Optional Enhancements
1. **Configure Google OAuth:**
   - Get OAuth credentials from Google Cloud Console
   - Add to Supabase Auth settings
   - Test OAuth flow at http://localhost:8100

2. **Set up monitoring:**
   - Use `docker stats` for resource usage
   - Set up alerts for service failures
   - Monitor disk space for database growth

3. **Enable backups:**
   - Configure database backup schedule
   - Set up automated backup storage
   - Test restore procedure

4. **Performance tuning:**
   - Adjust Redis cache settings
   - Optimize database indexes
   - Monitor query performance

---

## 📞 Support Resources

### Documentation
- OAuth System: See `SUNA_AUTH_OVERVIEW.md`
- Networking: See `DOCKER_NETWORKING_FIX.md`
- Debugging: See `OAUTH_DEBUG_FIX.md`

### Key Files
- Frontend config: `frontend/.env.local`
- Docker config: `docker-compose.yaml`
- Supabase config: `suna-supabase/docker/docker-compose.yml`

### Commands Reference
```bash
# Development
docker compose up -d
docker compose logs -f

# Maintenance
docker compose restart
docker compose down

# Debugging
docker ps
docker exec <container> sh
docker network inspect supabase
```

---

## ✨ Summary

Your Suna self-hosted installation is **fully operational** with:
- ✅ OAuth system accessible at port 8100
- ✅ Frontend dashboard working at localhost:3000
- ✅ Backend API responding at localhost:8000
- ✅ Supabase database and auth services running
- ✅ Cross-network Docker communication enabled
- ✅ All environment variables properly configured
- ✅ Analytics removed to prevent dashboard blocking

**You can now:**
1. Access dashboard: http://localhost:3000/dashboard
2. Login with email/password
3. View and manage agents
4. Monitor account information
5. Build and test AI agent workflows

Enjoy your self-hosted Suna AI platform! 🚀

---

**Last Updated:** Oct 29, 2025  
**Documentation Version:** 2.0  
**Status:** ✅ Operational
