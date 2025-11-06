# Next Steps: Docker Networking & Database Setup

## Current Status

✅ **Configuration Ready**
- Two Docker stacks configured (suna-supabase and suna)
- Port assignments done (8002 for Kong, 8000 for backend, 3000 for frontend, 6005 for Studio)
- Credentials matched between stacks

⏳ **To Test**
1. Network connectivity between stacks
2. Database schema initialization
3. Docker Compose deployment

---

## Phase 1: Network Testing

### Test 1: Verify suna-supabase is Running
```bash
cd d:\Homelab\suna-supabase\docker
docker compose ps

# Expected output:
# supabase-kong - Up and healthy
# supabase-db - Up and healthy
# supabase-studio - Up
```

### Test 2: Verify Kong Gateway
```bash
# Test from host
curl http://localhost:8002/health

# Should return 200 OK with health status
```

### Test 3: Verify Ports
```bash
# Check all required ports are listening
netstat -ano | findstr "8002 8000 3000 6005 6379"

# Should show:
# 8002 - Kong
# 6005 - Studio
# Others not yet (until suna starts)
```

### Test 4: Inside Suna Container (After Starting)
```bash
# When suna starts, test from backend container
docker exec suna-backend curl http://localhost:8002/health

# This tests if container can reach Kong via localhost
```

---

## Phase 2: Understanding What Suna Needs

### Critical Questions to Answer:

1. **Database Migrations**
   - Does Suna auto-run migrations on startup?
   - Where are migrations stored? (`backend/supabase/migrations/`?)
   - Do we need to run them manually first?

2. **Auth Service**
   - Suna uses Supabase Auth - will it work out of the box?
   - Are there any seed users needed?
   - JWT tokens - do they need to be set up?

3. **Realtime Service**
   - Does Suna depend on Realtime?
   - Is it enabled in Kong gateway config?

4. **Storage Service**
   - Is file storage needed for core Suna functionality?
   - Any buckets that need to be created?

5. **API Keys & Secrets**
   - Match between suna-supabase JWT and Suna backend?
   - Current config has correct credentials loaded

---

## Phase 3: Docker Compose Deployment

### Before Running Docker Compose:

1. **Check backend Dockerfile**
   ```bash
   cat d:\Homelab\suna\backend\Dockerfile
   # Look for:
   # - Does it handle .env properly?
   # - Any database migrations in ENTRYPOINT?
   # - Build steps vs runtime steps
   ```

2. **Check frontend Dockerfile**
   ```bash
   cat d:\Homelab\suna\frontend\Dockerfile
   # Look for:
   # - When are .env vars evaluated?
   # - Build args vs env vars?
   ```

3. **Verify docker-compose.yaml**
   - All services have correct volume mounts
   - Environment variables properly passed
   - Depends_on relationships correct

### Startup Procedure:

```bash
# Step 1: Ensure suna-supabase is running
cd d:\Homelab\suna-supabase\docker
docker compose up -d
docker compose ps  # Wait for all healthy

# Step 2: Build and start suna
cd d:\Homelab\suna
docker compose up -d --build

# Step 3: Watch startup
docker compose logs -f

# Step 4: Verify services
docker compose ps
```

---

## Phase 4: Potential Issues & Solutions

### Issue 1: Backend Can't Connect to Supabase
**Symptom**: Backend logs show connection refused to localhost:8002

**Investigation**:
```bash
# Check if Kong is running
docker ps | grep kong

# Check if Kong is listening
curl http://localhost:8002/health

# Check backend .env is mounted correctly
docker exec suna-backend env | grep SUPABASE_URL

# Check backend logs for startup errors
docker compose logs backend
```

**Solution**:
- Ensure suna-supabase is healthy before starting suna
- Verify SUPABASE_URL=http://localhost:8002 in backend/.env
- Check for firewall/port blocking

### Issue 2: Frontend Can't Reach Backend
**Symptom**: Frontend loads but API calls fail

**Investigation**:
```bash
# Check backend is accessible
curl http://localhost:8000/health

# Check frontend env vars
docker exec suna-frontend env | grep NEXT_PUBLIC

# Check browser console for CORS errors
# Look for Access-Control-Allow-Origin headers
```

**Solution**:
- Ensure NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
- Check backend CORS configuration
- Verify backend is running: `docker compose ps backend`

### Issue 3: Database Connection Failed
**Symptom**: Backend errors about "cannot connect to database"

**Investigation**:
```bash
# Suna doesn't connect directly to DB
# It should go through Kong
# Check Kong logs for DB issues

docker compose -f d:\Homelab\suna-supabase\docker\docker-compose.yml logs kong

# Check if supabase-db is healthy
docker compose -f d:\Homelab\suna-supabase\docker\docker-compose.yml ps db
```

**Solution**:
- Ensure suna-supabase stack is fully healthy
- Check Kong logs for connection issues
- Verify SUPABASE_SERVICE_ROLE_KEY is correct

### Issue 4: Redis Connection Failed
**Symptom**: Backend/Worker can't connect to Redis

**Investigation**:
```bash
# Redis should be started by suna compose
docker compose ps redis

# Test Redis from host
docker exec suna-redis redis-cli ping

# Check backend logs
docker compose logs backend | grep redis
```

**Solution**:
- Verify redis service in docker-compose.yaml is running
- Check REDIS_HOST=redis and REDIS_PORT=6379
- Ensure no port conflicts on 6379

---

## Phase 5: First Run Checklist

Before declaring setup complete:

- [ ] `docker compose up -d` runs without errors
- [ ] All containers reach healthy state
- [ ] Kong is accessible at localhost:8002
- [ ] Frontend loads at localhost:3000
- [ ] Backend API docs accessible at localhost:8000/docs
- [ ] Studio accessible at localhost:6005
- [ ] Can create user via Supabase auth
- [ ] Can login to Suna frontend
- [ ] Suna can communicate with database

---

## Investigation Commands

### General Health Checks
```bash
# All suna-supabase services
cd d:\Homelab\suna-supabase\docker
docker compose ps
docker compose logs -f

# All suna services
cd d:\Homelab\suna
docker compose ps
docker compose logs -f

# Individual service logs
docker compose logs backend
docker compose logs frontend
docker compose logs worker
docker compose logs redis
```

### Network Testing
```bash
# From suna-backend container, test Kong
docker exec suna-backend curl -v http://localhost:8002/health

# From suna-frontend container, test backend
docker exec suna-frontend curl -v http://backend:8000/health

# From host, test all endpoints
curl http://localhost:3000      # Frontend
curl http://localhost:8000      # Backend
curl http://localhost:8002      # Kong
curl http://localhost:6005      # Studio
curl http://localhost:6379      # Redis (will fail, but shows if listening)
```

### Container Access
```bash
# Execute command in container
docker exec suna-backend bash

# View live logs
docker compose logs -f backend

# Inspect environment
docker exec suna-backend env

# Check file system
docker exec suna-backend ls -la /app/
```

---

## Questions to Ask When Troubleshooting

1. **Is the service container running?**
   - `docker compose ps`

2. **What port is it using?**
   - `docker compose ps` or `netstat -ano`

3. **Can you reach it from host?**
   - `curl http://localhost:PORT`

4. **Can other containers reach it?**
   - `docker exec container-name curl http://service:port`

5. **What do the logs say?**
   - `docker compose logs service-name`

6. **Is the configuration correct?**
   - `docker exec service-name env | grep CONFIG_VAR`

7. **Any permission issues?**
   - Check file ownership and mount permissions

---

## Next Documentation to Review

1. **Suna Backend README** (`backend/README.md`)
   - Database migration requirements
   - Auth setup
   - API documentation

2. **Suna Frontend README** (`frontend/README.md`)
   - Build process
   - Environment variable handling
   - Development server notes

3. **Docker Files**
   - `backend/Dockerfile` - Build process
   - `frontend/Dockerfile` - Build process
   - Entry points and startup commands

4. **Supabase Documentation**
   - Migrations
   - Auth service
   - API gateway (Kong)

---

## Success Indicators

✅ **Phase 1 Complete**: Both stacks run, Kong is accessible
✅ **Phase 2 Complete**: Understand Suna's database requirements
✅ **Phase 3 Complete**: Docker Compose starts all services
✅ **Phase 4 Complete**: Troubleshoot and fix any issues
✅ **Phase 5 Complete**: All services healthy and communicating

Then we can declare: **✅ Suna Docker + suna-supabase Docker Setup Complete!**

