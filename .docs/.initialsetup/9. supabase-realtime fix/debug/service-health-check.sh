#!/bin/bash
# Diagnostic script to check if services are running and responding

echo "========================================"
echo "Service Health Check"
echo "========================================"
echo ""

# Check if Docker is running
echo "1. Checking Docker containers..."
docker ps --filter "label=com.docker.compose.project=suna" --format "table {{.Names}}\t{{.Status}}"
echo ""

# Check Kong
echo "2. Testing Kong connectivity..."
echo "   Testing HTTP port 8000..."
curl -s -o /dev/null -w "   Status: %{http_code}\n" http://localhost:8000/status || echo "   ERROR: Cannot connect to Kong on port 8000"
echo ""

# Check Realtime service port
echo "3. Testing Supabase Realtime..."
curl -s -o /dev/null -w "   HTTP Status: %{http_code}\n" http://localhost:8888/realtime/v1/websocket || echo "   ERROR: Cannot connect to Realtime"
echo ""

# Check if Cloudflare Tunnel is running
echo "4. Checking Cloudflare Tunnel daemon..."
ps aux | grep -i cloudflared | grep -v grep
if [ $? -ne 0 ]; then
    echo "   WARNING: cloudflared process not found"
else
    echo "   ✓ cloudflared is running"
fi
echo ""

# Check Kong logs for recent errors
echo "5. Recent Kong errors (last 20 lines)..."
docker logs --tail 20 suna-kong-1 2>/dev/null | grep -i error || echo "   No recent errors found"
echo ""

# Check Realtime logs
echo "6. Recent Realtime errors (last 20 lines)..."
docker logs --tail 20 suna-realtime-1 2>/dev/null | grep -i error || echo "   No recent errors found"
echo ""

# Check Supabase network
echo "7. Checking Supabase Docker network..."
docker network ls | grep supabase
echo ""

echo "========================================"
echo "Diagnostics Complete"
echo "========================================"
