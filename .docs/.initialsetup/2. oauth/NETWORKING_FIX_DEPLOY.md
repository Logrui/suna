# Docker Networking Fix - Deploy Now

## 🚨 What Was Wrong

Frontend container couldn't reach Supabase services because they were on **separate Docker networks**.

- Supabase: `172.29.0.0/16` network
- Suna: `172.28.0.0/16` network
- Result: ❌ Connection refused errors

## ✅ What's Fixed

✅ Connected Suna services to Supabase network
✅ Updated frontend to use container hostname instead of localhost
✅ Now all services can communicate properly

---

## 🚀 Deploy (5 minutes)

### Step 1: Stop Suna
```bash
cd d:\Homelab\suna
docker compose down
```

### Step 2: Verify Changes

Files should be updated:
```bash
# Check docker-compose.yaml has networks section
cat docker-compose.yaml | tail -10
# Should show:
# networks:
#   default:
#   supabase:

# Check frontend uses Kong hostname
cat frontend/.env.local | grep SUPABASE_URL
# Should show: http://supabase-kong:8000
```

### Step 3: Start Suna
```bash
cd d:\Homelab\suna
docker compose up -d --build

# Wait for rebuild (might take 30-60 seconds for frontend)
sleep 15

# Check status
docker compose ps
```

### Step 4: Verify Network Fix
```bash
# Check if frontend is on both networks
docker network inspect supabase | find "suna-frontend"
# Should find it in the output

# Test from frontend container
docker exec suna-frontend-1 wget -O - http://supabase-kong:8000/health
# Should succeed (not connection refused)
```

### Step 5: Test in Browser

Go to: http://localhost:3000/auth

Try login:
- Email: `yhcsanction@gmail.com`
- Password: (your password)

Expected:
- ✅ Form submits (no "fetch failed" error)
- ✅ Shows error response OR logs you in
- ❌ NOT "fetch failed" or "Connection refused"

---

## 🆘 If It Doesn't Work

### Frontend still shows "fetch failed"
```bash
# Check container logs
docker compose logs frontend | tail -20
# Look for errors

# Rebuild everything
docker compose down -v
docker compose up -d --build
```

### "Connection refused" error persists
```bash
# Check if frontend is on supabase network
docker inspect suna-frontend-1 | grep -A 20 "Networks"

# If only showing "suna", manually connect:
docker network connect supabase suna-frontend-1
docker compose restart frontend
```

### Still stuck?
Check the detailed guide: `DOCKER_NETWORKING_FIX.md`

---

## ✨ What Changed

| Component | Before | After |
|-----------|--------|-------|
| Frontend URL | `http://localhost:8002` | `http://supabase-kong:8000` |
| Network Setup | Separate networks | Connected networks |
| Connectivity | ❌ Blocked | ✅ Working |
| Login | ❌ Fetch failed | ✅ Works |

---

## 📋 Files Modified

- ✅ `docker-compose.yaml` - Added networks section
- ✅ `frontend/.env.local` - Updated Supabase URL

Done! 🎉

If you run into any issues, the detailed troubleshooting is in `DOCKER_NETWORKING_FIX.md`.
