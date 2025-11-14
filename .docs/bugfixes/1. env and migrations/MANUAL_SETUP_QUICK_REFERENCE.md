# Suna Manual Mode Setup - Quick Reference

## 🎯 What You Have Now

```
Your Computer
├── Docker Desktop (Running)
│   └── suna-supabase (13 containers)
│       ├── Kong (API Gateway) → localhost:8002
│       ├── PostgreSQL → localhost:5434
│       ├── Auth Service
│       ├── Storage
│       ├── Real-time
│       └── ... (other services)
│
└── Suna (Manual Mode - to be started)
    ├── .env files (configured ✅)
    ├── Backend (FastAPI) → needs to run
    ├── Frontend (Next.js) → needs to run
    ├── Worker (Dramatiq) → needs to run
    └── Redis → needs to run
```

---

## 📋 Three .env Files Explained

| File | Purpose | Critical? | Used By |
|------|---------|-----------|---------|
| `suna/.env` | Root config (informational) | ❌ No | Docker Compose (not used in manual) |
| `backend/.env` | ⭐ Backend API config | ✅ YES | Python backend, workers |
| `frontend/.env.local` | ⭐ Frontend config | ✅ YES | Next.js frontend |

**What changed**:
- Both `.env` files now point to your suna-supabase instance at `localhost:8002`
- Both use the same credentials from suna-supabase's `.env`

---

## 🔑 Credentials Explained

### From: `suna-supabase/docker/.env`

```
ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
- **What**: Public API key for Supabase
- **Used by**: Frontend (in browser) - cannot access secrets
- **In Suna**: Backend `.env` and Frontend `.env.local`

```
SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
- **What**: Admin/private API key for Supabase
- **Used by**: Backend only - can do admin operations
- **In Suna**: Backend `.env` only (never in frontend!)

```
JWT_SECRET = your-super-secret-jwt-token-with-at-least-32-characters-long
```
- **What**: Secret for signing/validating JWT tokens
- **Used by**: Auth service validates tokens with this
- **In Suna**: Backend `.env`

### Connection URLs

```
SUPABASE_URL=http://localhost:8002
```
- **What**: Kong API Gateway - the main entry point
- **Why localhost:8002**: That's where Kong listens (configured in docker-compose.yml)
- **In Suna**: Both backend and frontend use this

---

## 🚀 Next: How to Run Everything

### Terminal 1: Start Redis
```powershell
docker run -d -p 6379:6379 --name suna-redis redis:7-alpine
```

### Terminal 2: Backend API
```powershell
cd d:\Homelab\suna\backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -e .
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

### Terminal 3: Background Worker
```powershell
cd d:\Homelab\suna\backend
# Use same .venv from Terminal 2
.\.venv\Scripts\activate
python -m dramatiq run_agent_background --processes 4 --threads 4
```

### Terminal 4: Frontend
```powershell
cd d:\Homelab\suna\frontend
npm install
npm run dev
```

### Then Visit
- **Suna UI**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs
- **Supabase Studio**: http://localhost:8002 (through Kong)

---

## ✅ Verification Checklist

After starting everything, verify each connection:

### 1. Supabase is Running
```bash
curl http://localhost:8002/health
# Should return 200 OK
```

### 2. Backend Can Reach Supabase
- Terminal 2 (Backend) should show no errors
- Look for successful database connections in logs

### 3. Frontend Can Load
- Visit http://localhost:3000
- Should load without CORS errors
- Try signing up (uses Supabase auth)

### 4. Redis is Running
```bash
docker exec suna-redis redis-cli ping
# Should respond: PONG
```

---

## ⚠️ Important: Manual Mode Specifics

**MUST USE `localhost` FOR REDIS** in `backend/.env`:
```properties
REDIS_HOST=localhost  # ✅ Correct for manual mode
REDIS_HOST=redis      # ❌ Wrong - that's for Docker Compose
```

**Backend REDIS_SSL should be false**:
```properties
REDIS_SSL=false       # ✅ Correct for local development
```

---

## 🔍 Understanding the Data Flow

### Frontend Sign-Up Flow:
1. User enters email/password on http://localhost:3000
2. Frontend sends to `localhost:8002/auth/v1/signup` (Supabase Auth)
3. Supabase stores in PostgreSQL at `localhost:5434`
4. Supabase returns JWT token
5. Frontend stores token, uses for future requests

### Backend API Flow:
1. Frontend calls `localhost:8000/api/...`
2. Backend validates JWT with `JWT_SECRET`
3. Backend calls `localhost:8002/rest/v1/...` (Supabase REST API)
4. Supabase queries PostgreSQL
5. Returns data to frontend

---

## 📁 Files You Modified

```
suna-supabase/
└── docker/
    └── docker-compose.yml  ← Added ports: ["5434:5432"] to db service

suna/
├── backend/
│   └── .env  ← Updated Supabase credentials ✅
├── frontend/
│   └── .env.local  ← Updated Supabase credentials ✅
└── SETUP_CONFIGURATION_SUMMARY.md  ← This detailed guide ✅
```

---

## 💡 Pro Tips

1. **Keep terminals organized**:
   - Terminal 1: Redis
   - Terminal 2: Backend
   - Terminal 3: Worker
   - Terminal 4: Frontend
   - Terminal 5: Debugging/commands

2. **Check logs first** when something breaks:
   ```bash
   # Backend logs show connection errors
   # Worker logs show task failures  
   # Frontend browser console shows API errors
   ```

3. **API Documentation** is built-in:
   - http://localhost:8000/docs (Swagger UI)
   - http://localhost:8000/redoc (ReDoc)

4. **Supabase Dashboard**:
   - Access at http://localhost:3000 (Supabase Studio, not Suna)
   - Username: `supabase` (from docker .env)
   - Password: `this_password_is_insecure_and_should_be_updated`

---

## 🆘 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| "Connection refused to localhost:8002" | Check `docker ps` to verify suna-supabase containers are running |
| "Redis connection error" | Make sure Redis is running (Terminal 1) and REDIS_HOST=localhost in backend/.env |
| "CORS errors in browser" | Check NEXT_PUBLIC_BACKEND_URL in frontend/.env.local is correct |
| "Can't sign up" | Check Supabase auth settings (may need ENABLE_EMAIL_AUTOCONFIRM=true) |
| "Port already in use" | Use `netstat -ano` to find what's using it, or change port in config |

