#!/bin/bash
# Comprehensive WebSocket Diagnostics Script
# Tests the entire connection chain from browser to Realtime

ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvcnRpeHN1cGFiYXNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjAyNDU3MDAsImV4cCI6MTczNTg5NzcwMH0.fvJQjMvqQhqiKEYn-JC7mCaVxEI8V8PQq1jxAEkJKdE"

echo "======================================"
echo "WebSocket Full Chain Diagnostics"
echo "======================================"
echo ""

# 1. Check containers are running
echo "1. Container Status"
echo "==================="
docker ps --filter "name=supabase-kong\|realtime-dev\|suna-frontend" --format "table {{.Names}}\t{{.Status}}"
echo ""

# 2. Get container IPs
echo "2. Container IPs"
echo "================="
KONG_IP=$(docker inspect -f '{{.NetworkSettings.Networks.supabase.IPAddress}}' supabase-kong)
REALTIME_IP=$(docker inspect -f '{{.NetworkSettings.Networks.supabase.IPAddress}}' realtime-dev.supabase-realtime)
FRONTEND_IP=$(docker inspect -f '{{.NetworkSettings.Networks.suna.IPAddress}}' suna-frontend-1)

echo "Kong IP: $KONG_IP"
echo "Realtime IP: $REALTIME_IP"
echo "Frontend IP: $FRONTEND_IP"
echo ""

# 3. Test Kong health
echo "3. Kong Health"
echo "=============="
docker exec supabase-kong kong health
echo ""

# 4. Test connectivity from host to Kong
echo "4. Host to Kong (localhost:8000)"
echo "================================="
if command -v wget &> /dev/null; then
    wget -O /dev/null -q http://localhost:8000/auth/v1/user?apikey=$ANON_KEY && echo "✓ Connected" || echo "✗ Failed"
elif command -v curl &> /dev/null; then
    curl -s -o /dev/null http://localhost:8000/auth/v1/user?apikey=$ANON_KEY && echo "✓ Connected" || echo "✗ Failed"
else
    echo "No wget/curl available"
fi
echo ""

# 5. Test Kong from inside its container
echo "5. Kong Internal Routes"
echo "======================="
docker exec supabase-kong sh -c 'wget -O - -q http://localhost:8000/auth/v1/user?apikey=$ANON_KEY 2>&1 | head -5'
echo ""

# 6. Check Kong configuration has realtime
echo "6. Kong Realtime Configuration"
echo "=============================="
docker exec supabase-kong grep -A 5 "realtime-v1-ws" /home/kong/kong.yml
echo ""

# 7. Test Realtime container
echo "7. Realtime Container Health"
echo "============================="
docker inspect realtime-dev.supabase-realtime --format '{{.State.Status}}'
echo ""

# 8. Check Realtime logs for errors
echo "8. Recent Realtime Logs (last 10 lines)"
echo "========================================"
docker logs --tail 10 realtime-dev.supabase-realtime 2>&1 | grep -i error || echo "No errors found"
echo ""

# 9. Test connectivity to Realtime directly
echo "9. Test Realtime (direct)"
echo "========================"
if command -v wget &> /dev/null; then
    wget -O /dev/null -q http://$REALTIME_IP:4000/health 2>&1 && echo "✓ Realtime responds" || echo "✗ Failed"
else
    docker exec supabase-kong sh -c "wget -O /dev/null -q http://$REALTIME_IP:4000/health 2>&1" && echo "✓ Realtime responds" || echo "✗ Failed"
fi
echo ""

# 10. Check Kong routes  
echo "10. Kong Routes Configured"
echo "============================"
docker exec supabase-kong grep "name:" /home/kong/kong.yml | grep -E "auth|rest|realtime|storage" | head -10
echo ""

# 11. Check Frontend can reach Kong
echo "11. Frontend to Kong (internal network)"
echo "========================================"
if [ ! -z "$FRONTEND_IP" ]; then
    docker exec suna-frontend-1 wget -O - -q http://kong:8000/auth/v1/user?apikey=$ANON_KEY 2>&1 | head -3 && echo "✓ Frontend can reach Kong" || echo "✗ Failed"
else
    echo "Frontend not on supabase network"
fi
echo ""

echo "======================================"
echo "Diagnostics Complete"
echo "======================================"
