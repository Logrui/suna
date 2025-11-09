# Suna Real-Time Documentation Index

**Complete Real-Time System Documentation**  
**Last Updated**: November 5, 2025

---

## 📚 Documentation Overview

This folder contains complete documentation for understanding and debugging the Supabase Real-Time system in Suna. Each document serves a specific purpose:

### Core Documents

#### 1. **QUICK_START_GUIDE.md** ⭐ START HERE
- **Purpose**: High-level overview for getting up to speed quickly
- **Audience**: Anyone wanting to understand how real-time works
- **Contains**:
  - TL;DR summary (30 seconds)
  - 3 key files explanation
  - File communication map
  - Step-by-step data flow with files
  - Troubleshooting quick reference
  - Architecture diagram (simplified)
- **Read time**: 10 minutes

#### 2. **NETWORK_FLOW_DIAGRAM.md** 📊 COMPREHENSIVE REFERENCE
- **Purpose**: Complete detailed explanation of all data flows
- **Audience**: Developers, architects, debuggers
- **Contains**:
  - Example 1: Vapi call real-time flow
  - Example 2: Project sandbox real-time flow
  - Detailed network map (file-by-file)
  - Frontend communication layer (5 parts)
  - Backend communication layer (4 parts)
  - Supabase infrastructure layer
  - Complete request journey (7 steps)
  - Environment variables explained
  - Summary table
  - Common failures & root causes
- **Read time**: 30 minutes

#### 3. **VISUAL_ARCHITECTURE_DIAGRAM.md** 🎨 VISUAL LEARNERS
- **Purpose**: ASCII diagrams and visual representations
- **Audience**: Visual learners, presentation materials
- **Contains**:
  - Overview diagram
  - HTTP/REST flow (proxied)
  - WebSocket Realtime flow (direct)
  - Real-time event flow (backend → browser)
  - Browser-side processing
  - Complete request sequence
  - Directory structure with purposes
  - Why WebSocket can't be proxied (with diagram)
  - Key takeaways
- **Read time**: 15 minutes

#### 4. **CODE_EXECUTION_FLOW.md** 🔍 LINE-BY-LINE WALKTHROUGH
- **Purpose**: Exact code execution path with actual code
- **Audience**: Developers implementing or debugging
- **Contains**:
  - Step 1-10 with actual code snippets
  - Each file's exact role
  - HTTP request/response examples
  - SQL queries
  - WebSocket message format
  - Complete execution timeline table
  - Key code locations quick reference
- **Read time**: 20 minutes

#### 5. **IMPLEMENTATION_GUIDE.md** ⚙️ SETUP & CONFIGURATION
- **Purpose**: How to configure real-time in your environment
- **Audience**: DevOps, infrastructure engineers
- **Contains**:
  - Prerequisites checklist
  - Backend configuration (CORS, proxy)
  - Frontend configuration (environment variables)
  - Cloudflare Tunnel setup
  - Verification steps
  - Testing procedures
- **Read time**: 15 minutes

#### 6. **TROUBLESHOOTING.md** 🐛 PROBLEM SOLVING
- **Purpose**: Common issues and solutions
- **Audience**: Anyone experiencing problems
- **Contains**:
  - Quick diagnosis flowchart
  - 10+ common problems with solutions
  - Docker networking issues
  - Login failures
  - WebSocket connection problems
  - Real-time updates not appearing
  - High CPU/memory usage
  - Configuration not taking effect
- **Read time**: 20 minutes (reference document)

#### 7. **README.md** 📖 FEATURE OVERVIEW
- **Purpose**: What real-time is used for in Suna
- **Audience**: Product team, non-technical stakeholders
- **Contains**:
  - What is Realtime used for
  - Use cases (Vapi calls, project sandbox)
  - How Realtime works (high-level)
  - Database-to-frontend flow diagram
- **Read time**: 5 minutes

#### 8. **RealTimeFix_Plan.md** 📝 HISTORICAL CONTEXT
- **Purpose**: What was attempted to fix real-time
- **Audience**: Developers understanding the current state
- **Contains**:
  - Problem summary
  - Solution: dual client pattern
  - Implementation status (✅ completed)
  - Files requiring updates (which were updated)
  - Testing strategy
- **Read time**: 10 minutes (reference)

---

## 🗺️ How to Use This Documentation

### If you want to...

#### Understand how real-time works (5 minutes)
1. Read: **README.md**
2. Skim: **QUICK_START_GUIDE.md** → "TL;DR" section

#### Learn the complete architecture (30 minutes)
1. Read: **QUICK_START_GUIDE.md** (full)
2. Read: **NETWORK_FLOW_DIAGRAM.md** (full)
3. Reference: **VISUAL_ARCHITECTURE_DIAGRAM.md** (diagrams)

#### Trace a specific data flow (20 minutes)
1. Go to: **CODE_EXECUTION_FLOW.md**
2. Find: The step-by-step walkthrough
3. Find: The code at each stage

#### Debug a real-time issue (varies)
1. Check: **TROUBLESHOOTING.md** (quick diagnosis)
2. If stuck, consult: **CODE_EXECUTION_FLOW.md** (verify each step)
3. If infrastructure issue: **IMPLEMENTATION_GUIDE.md** (verify config)

#### Set up real-time in new environment (1 hour)
1. Follow: **IMPLEMENTATION_GUIDE.md** (step by step)
2. Verify: Each step's test section
3. Reference: **TROUBLESHOOTING.md** (if issues)

#### Implement a new real-time feature (2-3 hours)
1. Understand: **CODE_EXECUTION_FLOW.md** (how existing flow works)
2. Find: Which table needs to be published
3. Create: New hook based on useVapiCallRealtime.ts
4. Test: Verify WebSocket connection + cache invalidation

---

## 🎯 Key Concepts Explained in Each Document

| Concept | Document | Section |
|---------|----------|---------|
| What is real-time? | README.md | Overview |
| How does data flow? | NETWORK_FLOW_DIAGRAM.md | Complete Request Journey |
| What files do what? | CODE_EXECUTION_FLOW.md | Key Code Locations |
| Why WebSocket direct? | VISUAL_ARCHITECTURE_DIAGRAM.md | Why WebSocket Can't Be Proxied |
| HTTP vs WebSocket | QUICK_START_GUIDE.md | The 3 Key Files |
| Real-time trigger | CODE_EXECUTION_FLOW.md | Step 6: Database Update |
| React integration | QUICK_START_GUIDE.md | Step 8: Browser Hook Receives |
| Configuration | IMPLEMENTATION_GUIDE.md | Setup Steps |
| Common issues | TROUBLESHOOTING.md | Problems & Solutions |

---

## 🔧 Quick Reference: Files Changed in Real-Time Implementation

All these files were updated to make real-time work:

### Frontend (JavaScript/TypeScript)

```
✅ frontend/src/lib/supabase/client.ts
   └─ Added: createRealtimeClient() function
   └─ Reason: Separate WebSocket client (not proxied)

✅ frontend/src/hooks/useVapiCallRealtime.ts
   └─ Changed: from createClient() to createRealtimeClient()
   └─ Reason: Use direct Kong connection

✅ frontend/src/hooks/useProjectRealtime.ts
   └─ Changed: from createClient() to createRealtimeClient()
   └─ Reason: Use direct Kong connection

✅ frontend/src/components/thread/tool-views/vapi-call/MonitorCallToolView.tsx
   └─ Changed: Added createRealtimeClient() for subscription
   └─ Reason: Direct WebSocket subscription

✅ frontend/next.config.ts
   └─ Already configured: /realtime/v1/* rewrites
   └─ Note: Only for HTTP polling, not WebSocket

✅ frontend/.env.local
   └─ Added: NEXT_PUBLIC_REALTIME_URL
   └─ Value: http://kong.kortix.syhc.dev/

✅ docker-compose.yaml
   └─ Added: NEXT_PUBLIC_REALTIME_URL env var
   └─ Value: http://kong.kortix.syhc.dev/
```

### Backend (Python/FastAPI)

```
✅ backend/core/vapi_api.py
   └─ Already configured: Receives webhook POST
   └─ Calls: VapiWebhookHandler.handle_webhook()

✅ backend/core/vapi_webhooks.py
   └─ Already configured: Writes to database
   └─ Code: client.table("vapi_calls").update(...)

✅ backend/core/services/supabase.py
   └─ Already configured: Manages Supabase connection
   └─ Uses: SUPABASE_URL (internal Docker network)
```

### Infrastructure (Configuration)

```
✅ suna-supabase/docker/docker-compose.yml
   └─ Realtime service already running
   └─ Listens to: PostgreSQL WAL

✅ PostgreSQL migrations
   └─ vapi_calls in supabase_realtime publication
   └─ projects in supabase_realtime publication
```

---

## 🚨 Critical Issues & Where They're Documented

| Issue | Document | Section | Solution |
|-------|----------|---------|----------|
| WebSocket won't connect | TROUBLESHOOTING.md | WebSocket Connection Failed | Check NEXT_PUBLIC_REALTIME_URL |
| Real-time event never received | CODE_EXECUTION_FLOW.md | Step 7-8 | Verify table in publication |
| UI doesn't update | TROUBLESHOOTING.md | Realtime Updates Not Appearing | Check React Query cache key |
| Backend can't write to DB | IMPLEMENTATION_GUIDE.md | Step 2.1 | Check SUPABASE_URL is internal hostname |
| Auth fails on tunnel | IMPLEMENTATION_GUIDE.md | Step 3.1-3.2 | Configure Cloudflare SSL/TLS |
| Two clients confusion | QUICK_START_GUIDE.md | The 3 Key Files | createClient vs createRealtimeClient |
| Data flow not clear | VISUAL_ARCHITECTURE_DIAGRAM.md | Complete Flow | See ASCII diagram |
| Code execution unclear | CODE_EXECUTION_FLOW.md | Steps 1-10 | Line-by-line walkthrough |

---

## 📊 Documentation Structure

```
9. supabase-realtime/
├── README.md                              ← What it is for
├── QUICK_START_GUIDE.md                   ← Start here!
├── NETWORK_FLOW_DIAGRAM.md                ← Comprehensive reference
├── VISUAL_ARCHITECTURE_DIAGRAM.md         ← Diagrams & visuals
├── CODE_EXECUTION_FLOW.md                 ← Line-by-line code
├── IMPLEMENTATION_GUIDE.md                ← Setup & configuration
├── TROUBLESHOOTING.md                     ← Problem solving
├── RealTimeFix_Plan.md                    ← Historical context
└── DOCUMENTATION_INDEX.md                 ← This file!
```

---

## 🎓 Learning Path

### For Complete Beginners (1 hour total)
1. **README.md** (5 min) - What is it?
2. **QUICK_START_GUIDE.md** → TL;DR + 3 Key Files (10 min)
3. **VISUAL_ARCHITECTURE_DIAGRAM.md** → Overview + Complete Flow (15 min)
4. **QUICK_START_GUIDE.md** → Step-by-step flow (15 min)
5. **TROUBLESHOOTING.md** → Quick reference (10 min)

### For Intermediate Developers (2 hours total)
1. All of the above
2. **NETWORK_FLOW_DIAGRAM.md** (full) (30 min)
3. **CODE_EXECUTION_FLOW.md** (full) (30 min)
4. **IMPLEMENTATION_GUIDE.md** (20 min)

### For Advanced/Debugging (varies)
1. Specific section of **TROUBLESHOOTING.md**
2. Relevant section of **CODE_EXECUTION_FLOW.md**
3. Verify configuration in **IMPLEMENTATION_GUIDE.md**

---

## 🔍 Finding Specific Information

### I need to find...

**"Where does WebSocket connect?"**
→ QUICK_START_GUIDE.md → Client Factory section
→ CODE_EXECUTION_FLOW.md → Step 2

**"Why does real-time matter?"**
→ README.md → What Is Realtime Used For

**"How does the database trigger real-time?"**
→ VISUAL_ARCHITECTURE_DIAGRAM.md → Real-time Event Flow
→ CODE_EXECUTION_FLOW.md → Step 6

**"What files do I need to change for new feature?"**
→ CODE_EXECUTION_FLOW.md → Key Code Locations
→ RealTimeFix_Plan.md → Files Requiring Updates

**"How is the auth proxy configured?"**
→ NETWORK_FLOW_DIAGRAM.md → Auth Proxy Layer (5)
→ IMPLEMENTATION_GUIDE.md → Step 1.2

**"What environment variables matter?"**
→ QUICK_START_GUIDE.md → Environment Variables Explained
→ NETWORK_FLOW_DIAGRAM.md → Environment Variables

**"My WebSocket won't connect, what do I do?"**
→ TROUBLESHOOTING.md → Problem: WebSocket Connection Failed
→ CODE_EXECUTION_FLOW.md → Step 2

**"Is the issue in frontend or backend?"**
→ TROUBLESHOOTING.md → Quick Diagnosis
→ NETWORK_FLOW_DIAGRAM.md → Problem Summary

---

## ✅ Verification Checklist

Use this to verify real-time is working:

### Frontend Check
- [ ] Browser DevTools → Network → Filter "WS"
- [ ] WebSocket connection visible to wss://kong.../realtime/v1/websocket
- [ ] Status: 101 Switching Protocols
- [ ] Browser console shows: [createRealtimeClient] Configuration: {...}
- [ ] Browser console shows: [Vapi Realtime] Setting up subscription

### Backend Check
- [ ] Backend logs show webhook received: `Error processing Vapi webhook` (absent = ✅)
- [ ] Backend logs show database update (may not be logged, depends on config)
- [ ] Supabase shows the row was updated (check database directly)

### Database Check
- [ ] vapi_calls table has new data with updated_at timestamp
- [ ] projects table has new data if sandbox was updated
- [ ] Tables are in supabase_realtime publication

### Browser Response Check
- [ ] Browser console shows: [Vapi Realtime] Change received:
- [ ] Browser console shows: [React Query] Invalidating cache
- [ ] Browser console shows: HTTP GET /api/vapi/calls/{id} (in Network tab)
- [ ] UI updates automatically within 1 second

---

## 🆘 Help! I'm Stuck

1. **Check**: What step failed?
   → TROUBLESHOOTING.md → Quick Diagnosis flowchart

2. **Verify**: Configuration for that step
   → IMPLEMENTATION_GUIDE.md → Verify section

3. **Trace**: Code execution path
   → CODE_EXECUTION_FLOW.md → Relevant step

4. **Search**: Browser console logs
   → Look for: `[Vapi Realtime]`, `[createRealtimeClient]`, errors

5. **Check**: All connections working
   → Run: `curl http://kong.kortix.syhc.dev:8888` (should respond)
   → Run: Docker logs to verify services running

6. **Still stuck?**
   → Re-read: TROUBLESHOOTING.md (most complete reference)
   → Review: QUICK_START_GUIDE.md (might be missing context)
   → Check: IMPLEMENTATION_GUIDE.md (configuration might be wrong)

---

## 📞 Questions This Documentation Answers

✅ What is Supabase Realtime?  
✅ How does it work in Suna?  
✅ Which files are involved?  
✅ What's the exact data flow?  
✅ Why are two Supabase clients needed?  
✅ Why can't WebSocket be proxied?  
✅ How do I set it up?  
✅ How do I debug it?  
✅ What environment variables matter?  
✅ What happens if something breaks?  
✅ How do I implement a new real-time feature?  
✅ What's the difference between HTTP and WebSocket?  
✅ Where does the browser connect to?  
✅ Where does the backend write to?  
✅ How does React Query integrate?  
✅ What tables support real-time?  
✅ What migrations are needed?  
✅ How do I test it?  

---

## 📈 Last Updated

- **Documentation Created**: November 5, 2025
- **Complete**: ✅ Yes
- **Status**: Ready for production use
- **Accuracy**: High (based on actual code review)

---

## 🙏 Quick Thanks

This documentation was created to help you understand the complete real-time system in Suna. Each document serves a specific purpose and audience. Start with **QUICK_START_GUIDE.md** and go from there!

Happy debugging! 🚀

