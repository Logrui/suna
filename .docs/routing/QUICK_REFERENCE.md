# Suna Application - Quick Reference Guide

> **Quick Navigation:** Jump to any section using the links below

## 📚 Documentation Index

- **[NETWORK_MAP.md](./NETWORK_MAP.md)** - Comprehensive network map with all pages and APIs
- **[ARCHITECTURE_DIAGRAMS.md](./ARCHITECTURE_DIAGRAMS.md)** - Visual ASCII diagrams of system flows
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - This file

---

## 🚀 Quick Start Reference

### Finding Frontend Pages

**Need to find a specific page?** Check the route structure in `frontend/src/app`

**Common Frontend Routes:**
- Public/Landing: `/` (home page)
- Login: `/auth`
- Main Dashboard: `/dashboard`
- Agents: `/dashboard/agents`
- Settings: `/dashboard/settings/`
- Billing: `/checkout` or `/subscription`

**Route Pattern:**
```
Next.js App Router uses folder structure:
- Parentheses () = route groups (don't appear in URL)
- Brackets [] = dynamic segments
- page.tsx = route file
- layout.tsx = shared layout

Example:
frontend/src/app/(dashboard)/agents/page.tsx → /dashboard/agents
frontend/src/app/(dashboard)/agents/[threadId]/page.tsx → /dashboard/agents/123
```

---

### Finding Backend APIs

**Need an API endpoint?** Find it by category

**Common API Patterns:**
- `POST /endpoint` = Create
- `GET /endpoint` = Read/List
- `GET /endpoint/{id}` = Read specific
- `PUT /endpoint/{id}` = Update
- `DELETE /endpoint/{id}` = Delete

**Most Used Endpoints:**

```python
# Agent Management
POST   /agents
GET    /agents
PUT    /agents/{agent_id}
DELETE /agents/{agent_id}

# Running Agents
POST   /agent/start
GET    /agent-run/{agent_run_id}
GET    /agent-run/{agent_run_id}/stream

# Conversations
GET    /threads
POST   /threads
GET    /threads/{thread_id}/messages

# Billing
GET    /subscription
POST   /create-checkout-session
GET    /balance

# Tools
GET    /tools
GET    /agents/{agent_id}/tools
```

---

## 📊 Statistics at a Glance

| Component | Count | Location |
|-----------|-------|----------|
| Frontend Pages | 32+ | `frontend/src/app/**/*.tsx` |
| Backend APIs | 93+ | `backend/core/**/*.py` |
| API Categories | 15+ | Various modules |
| Mobile Screens | 6+ | `apps/mobile/app/**/*.tsx` |
| Database Tables | 10+ | Supabase |
| External Integrations | 6+ | Stripe, Google, Composio, etc |

---

## 🔍 How to Use This Documentation

### For Frontend Developers
1. Find your page in **NETWORK_MAP.md** under "Frontend Pages"
2. Look at similar pages for patterns
3. Check `frontend/src/app` folder structure
4. Reference **ARCHITECTURE_DIAGRAMS.md** for data flows

### For Backend Developers
1. Find your API in **NETWORK_MAP.md** under "Backend API"
2. Look in `backend/core/` for implementation
3. Check module's `api.py` file for route definitions
4. Reference **ARCHITECTURE_DIAGRAMS.md** for integration patterns

### For Mobile Developers
1. Check mobile pages in **NETWORK_MAP.md**
2. Review `apps/mobile/app/` structure
3. Share same API client as web frontend
4. Use AsyncStorage for local persistence

### For DevOps/System Design
1. Review system diagram in **ARCHITECTURE_DIAGRAMS.md**
2. Understand deployment flow
3. Check integration points
4. Monitor rate limiting and caching

---

## 🎯 Common Tasks

### Task: Add a New Page

**Steps:**
1. Decide route (e.g., `/dashboard/new-feature`)
2. Create folder: `frontend/src/app/(dashboard)/new-feature/`
3. Create `page.tsx` file
4. Add `layout.tsx` if needed for shared layout
5. Update NETWORK_MAP.md with new route

**File Structure:**
```
frontend/src/app/
└── (dashboard)/
    └── new-feature/
        ├── page.tsx      [Route handler]
        ├── layout.tsx    [Optional: Shared layout]
        └── components/   [Feature-specific components]
```

### Task: Add a New API Endpoint

**Steps:**
1. Decide category (agents, billing, etc)
2. Find relevant module in `backend/core/`
3. Add route to module's `api.py`:
   ```python
   @router.get("/new-endpoint", summary="Description")
   async def new_endpoint(...):
       # Implementation
       pass
   ```
4. Update NETWORK_MAP.md with new route
5. Register router in `backend/api.py` if new module

**File Pattern:**
```
backend/core/
└── module_name/
    ├── api.py          [Route definitions]
    ├── service.py      [Business logic]
    ├── models.py       [Data models]
    └── __init__.py
```

### Task: Find Where API is Called

**Steps:**
1. Open backend file: `backend/core/module/api.py`
2. Find the route definition
3. Look at route function
4. Trace through imported services
5. Check database operations
6. Look at external API calls

**Example Route Flow:**
```
@router.get("/agents")
async def list_agents(user_id: str, ...):
    # Step 1: Validate user
    user = await db.get_user(user_id)
    
    # Step 2: Get data
    agents = await db.get_user_agents(user_id)
    
    # Step 3: Format response
    return AgentsResponse(agents=agents)
```

### Task: Track Down a Frontend API Call

**Steps:**
1. Find the page: `frontend/src/app/...`
2. Search for `fetch`, `axios`, or custom API client
3. Look for `useQuery` or `useMutation` hooks
4. Check the endpoint URL
5. Match to backend API in NETWORK_MAP.md

**Common Client Patterns:**
```typescript
// React Query
const { data } = useQuery({
  queryKey: ['agents'],
  queryFn: () => fetch('/api/agents').then(r => r.json())
})

// Direct fetch
const response = await fetch('/api/agents', {
  headers: { 'Authorization': `Bearer ${token}` }
})

// Custom API client
import { apiClient } from '@/lib/api-client'
const agents = await apiClient.get('/agents')
```

---

## 🗄️ Database Schema Quick Reference

### Core Tables

```sql
-- Users & Accounts
users (id, email, created_at)
account (id, user_id, subscription_tier)

-- Agents
agents (id, user_id, name, config, created_at)
agent_versions (id, agent_id, version, config)

-- Conversations
threads (id, user_id, agent_id)
messages (id, thread_id, role, content)

-- Execution
agent_runs (id, agent_id, thread_id, status)
run_logs (id, run_id, log_entry)

-- Billing
subscriptions (id, user_id, stripe_id, tier)
transactions (id, user_id, amount, type)

-- Integrations
credentials (id, user_id, service, token)
triggers (id, agent_id, schedule_config)
```

---

## 🔐 Authentication Flows

### Web Flow (Standard)
```
1. User at /auth
2. Enter credentials or OAuth
3. Supabase Auth validates
4. JWT token returned
5. Frontend stores in cookie
6. Every request includes token
7. Backend validates with Supabase
```

### Mobile Flow (Same as Web)
```
1. User at /auth screen
2. OAuth or credentials
3. Token stored in AsyncStorage
4. API calls include token
5. Backend validates same way
```

### Admin Flow (Special)
```
1. User at /master-login
2. Enter special master credentials
3. Special JWT issued
4. Can access /admin routes
5. Additional logging for audit trail
```

---

## 🚨 Common Issues & Solutions

### Issue: API returns 401 Unauthorized
**Solution:**
- Check token is sent in Authorization header
- Verify token hasn't expired
- Check if user subscription is active
- Look at backend auth middleware

### Issue: Page doesn't load in dashboard
**Solution:**
- Check route file exists at correct path
- Verify `page.tsx` exists (not just layout)
- Check layout.tsx is in correct folder
- Check authentication redirect working

### Issue: Can't create agent
**Solution:**
- Check user has sufficient credits
- Verify API endpoint is receiving data
- Check database insert permissions
- Look for validation errors in response

### Issue: Rate limit exceeded
**Solution:**
- Wait for rate limit window to reset
- Check subscription tier (higher tier = more requests)
- Verify not making duplicate requests
- Use caching to reduce API calls

---

## 🔗 Key Integration Points

### Frontend ↔ Backend
- **Protocol**: HTTP/REST + WebSocket
- **Auth**: Bearer tokens
- **Format**: JSON request/response
- **Base URL**: `/api` (proxy) or `https://backend-url`

### Backend ↔ Database
- **Database**: Supabase PostgreSQL
- **Connection Pool**: Configured in backend
- **ORM/Query**: Direct async queries
- **Migrations**: SQL-based

### Backend ↔ External Services
- **Stripe**: Webhook + REST API
- **Supabase Auth**: JWT validation
- **Google APIs**: OAuth + REST
- **Composio**: REST + OAuth
- **LLM Providers**: REST API

---

## 📱 Mobile App Notes

### Key Differences from Web
- Uses Expo Router (file-based like Next.js)
- Runs natively on iOS/Android
- Uses AsyncStorage instead of cookies
- Has offline capabilities
- Can access device features (camera, audio)

### Shared Code
- Same API client library
- Same authentication flow
- Same data models
- Same business logic

### Mobile-Specific Screens
- Splash screen
- Onboarding flow
- Trigger detail view
- Optimized mobile UI

---

## 🏗️ Architecture Patterns

### Authentication Pattern
```
Every request:
1. Check token validity
2. Validate user account
3. Check subscription status
4. Verify permissions
5. Attach user context
6. Process request
```

### Data Fetching Pattern
```
Frontend:
1. useQuery hook
2. Sends GET request
3. Caches with React Query
4. Updates state
5. Re-renders component

Backend:
1. Validate auth
2. Query database
3. Format response
4. Return JSON
```

### Error Handling Pattern
```
Frontend catches errors:
1. Network error
2. 4xx client error
3. 5xx server error
4. Show user message
5. Log to monitoring

Backend returns:
{
  "error": "Error message",
  "status": 400,
  "details": {...}
}
```

---

## 📈 Performance Tips

### Frontend
- Use React Query for caching
- Lazy load pages with `next/dynamic`
- Optimize images
- Minimize bundle size
- Use CSS-in-JS efficiently

### Backend
- Query optimization with indexes
- Redis caching for frequent requests
- Connection pooling
- Async processing for long tasks
- Monitor query performance

### General
- Enable gzip compression
- Use CDN for static assets
- Implement rate limiting
- Monitor API response times
- Set up alerting for errors

---

## 🐛 Debugging Tips

### Frontend Debugging
```
1. Browser DevTools (F12)
2. Check Network tab for API calls
3. Check Console for JS errors
4. Check Application tab for cookies/storage
5. Check React DevTools extension
```

### Backend Debugging
```
1. Check logs in console/stdout
2. Add logging to trace execution
3. Use debugger breakpoints
4. Check database queries
5. Monitor external API calls
```

### Full Stack Debugging
```
1. Check frontend sends correct data
2. Check backend receives data
3. Check database stores data
4. Check business logic processes data
5. Check response sent correctly
```

---

## 📚 Related Documentation

- **Backend README**: `backend/README.md`
- **Frontend README**: `frontend/README.md`
- **Mobile README**: `apps/mobile/README.md`
- **Contributing Guide**: `CONTRIBUTING.md`
- **Architecture Docs**: `docs/SELF-HOSTING.md`

---

## ✅ Checklist: Before Deploying

- [ ] All tests passing
- [ ] No console errors
- [ ] API rate limiting configured
- [ ] Database migrations run
- [ ] Environment variables set
- [ ] CORS configured correctly
- [ ] Authentication working
- [ ] Billing integration tested
- [ ] Monitoring alerts set up
- [ ] Backup configured

---

## 🤝 Contributing

When adding new features:
1. Update NETWORK_MAP.md with new routes/pages
2. Add documentation comments
3. Follow existing code patterns
4. Test both frontend and backend
5. Update this guide if needed

---

## 📞 Common Contacts/Files

- **Main API file**: `backend/api.py`
- **Core router**: `backend/core/api.py`
- **Frontend layout**: `frontend/src/app/layout.tsx`
- **Mobile layout**: `apps/mobile/app/_layout.tsx`
- **Database config**: `.env` files
- **API documentation**: Generated via FastAPI Swagger UI at `/docs`

---

## 🗓️ Last Updated

**Date**: November 2, 2025  
**Branch**: feature/slash-commands  
**Project**: Kortix/Suna AI Platform

---

*For detailed API documentation, visit `/api/docs` when backend is running*  
*For more information, see NETWORK_MAP.md and ARCHITECTURE_DIAGRAMS.md*
