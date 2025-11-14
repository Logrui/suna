# 🔍 DETAILED FILE COMPARISON: Main vs Feature/Slash-Commands

## Summary of Changes
A **MASSIVE restructuring** of the frontend API layer occurred in the `feature/slash-commands` branch.

---

## 📊 BIG PICTURE CHANGES

### Files Added (Completely New):
```
frontend/src/lib/api-server.ts                    (98 lines)
frontend/src/lib/api.ts                           (2319 lines!) ⚠️
frontend/src/lib/api/billing-v2.ts               (342 lines)
frontend/src/lib/api/models.ts                   (105 lines)
frontend/src/lib/cache-init.ts                   (138 lines)
frontend/src/lib/api/streaming.ts                (41 lines - just cleanup helpers)
frontend/src/lib/actions/                        (Multiple new server actions)
```

### Files HEAVILY Modified:
```
frontend/src/lib/config.ts                        (+344 -389 = massive changes)
frontend/src/lib/home.tsx                         (+1565 lines!)
frontend/src/lib/api-client.ts                    (+405 ---)
frontend/src/lib/supabase/client.ts               (+175 changes)
```

### Root Cause: API Layer Consolidation
The 2319-line `frontend/src/lib/api.ts` file appears to consolidate MANY API calls into a single location, replacing the distributed approach.

---

## 🚨 CRITICAL FINDING: The New api.ts

The new `frontend/src/lib/api.ts` includes:
1. The `streamAgent` function (MOVED from agents.ts)
2. All EventSource cleanup logic
3. The `nonRunningAgentRuns` Set
4. The `activeStreams` Map

**Problem:** This massive consolidation MIGHT have introduced timing issues:
- Initialization order could be wrong
- Cleanup logic might be racing
- EventSource connection handling might have changed

---

## 📋 KEY FILES TO COMPARE LINE-BY-LINE

### PRIORITY 1: Streaming Implementation
```bash
# Check if streamAgent function changed
git diff origin/main HEAD -- frontend/src/lib/api.ts | grep -A 100 "streamAgent ="

# Check the exact implementation differences
diff <(git show origin/main:frontend/src/lib/api/agents.ts | grep -A 100 "streamAgent =") \
     <(cat frontend/src/lib/api/agents.ts | grep -A 100 "streamAgent =")
```

### PRIORITY 2: EventSource Timeout Configuration
The NEW `frontend/src/lib/api.ts` might have CHANGED the EventSource initialization:
- No `timeout` parameter?
- Different error handling?
- Different message parsing?

### PRIORITY 3: Frontend API Client Changes
```
frontend/src/lib/api-client.ts                    (+405 changes)
```
Could include request timeout changes affecting streaming.

---

## 🔴 HYPOTHESIS: API Layer Refactoring Broke Streaming

### Timeline of Issue:
1. **Before:** Streaming logic in `frontend/src/lib/api/agents.ts` (stable)
2. **Change:** Massive refactor consolidating everything into `frontend/src/lib/api.ts`
3. **Result:** Streaming now broken with 5-second timeout

### Common Refactoring Mistakes:
- ❌ Changed EventSource timeout settings
- ❌ Removed or shortened keepalive logic
- ❌ Changed error handling for inactivity
- ❌ Added cleanup that happens too early
- ❌ Changed state management causing premature finalization
- ❌ Modified polling interval for liveness checks

---

## 🎯 IMMEDIATE NEXT STEPS

### 1. Compare streamAgent Function
```bash
# Get the streamAgent from main
git show origin/main:frontend/src/lib/api.ts | sed -n '/export const streamAgent/,/^}/p' > /tmp/main_stream.ts

# Compare with current
sed -n '/export const streamAgent/,/^}/p' frontend/src/lib/api.ts > /tmp/current_stream.ts

# Show diff
diff /tmp/main_stream.ts /tmp/current_stream.ts
```

### 2. Check for Timeout Constants
```bash
grep -n "timeout\|5000\|5000ms\|1500" frontend/src/lib/api.ts | head -20
grep -n "timeout\|5000\|5000ms\|1500" frontend/src/hooks/useAgentStream.ts
```

### 3. Look for Cleanup Race Conditions
```bash
grep -n "cleanupEventSource\|cleanup(" frontend/src/lib/api.ts
```

### 4. Check Error Handling Changes
```bash
git diff origin/main HEAD -- frontend/src/lib/error-handler.ts
```

---

## 📝 DEBUGGING COMMANDS TO RUN

```powershell
# 1. See exact size differences
cd d:\Homelab\suna
git diff --stat origin/main HEAD

# 2. Show only changed streaming-related code
git diff origin/main HEAD --  \
  frontend/src/lib/api.ts \
  frontend/src/lib/api/agents.ts \
  frontend/src/hooks/useAgentStream.ts | \
  grep -E "(^@@|streamAgent|EventSource|timeout|cleanup)" | head -50

# 3. Count lines by type of change
git diff --numstat origin/main HEAD | awk '{a+=$1; d+=$2} END {print "Added:", a, "Deleted:", d}'
```

---

## 💡 LIKELY FIX

### If streaming API was changed:
The issue is in the NEW `frontend/src/lib/api.ts` `streamAgent` function.
- Restore the working version from `main` branch
- OR carefully compare timeout/cleanup logic

### If useAgentStream was changed:
The 1500ms timeout check (line 781-793) might need adjustment:
```typescript
// Increase timeout for tool execution
setTimeout(..., 5000);  // Was: 1500
```

### If no direct changes:
The issue might be in **indirect dependencies**:
- `frontend/src/lib/config.ts` (+344 changes)
- `frontend/src/lib/supabase/client.ts` (auth token handling?)
- `frontend/src/lib/api-client.ts` (HTTP client config)

---

## ✅ VERIFICATION

After applying fixes, verify:
1. Browser DevTools shows streaming continues >5s
2. Tools can complete long operations (10+s)
3. No "Stream closed unexpectedly" errors
4. EventSource stays OPEN until agent completes
5. No premature cleanup messages in console

