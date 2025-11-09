# Suna Network Map - Project Overview

## 📋 Summary

A comprehensive network map has been created for the Suna/Kortix AI Platform application. This documentation provides complete visibility into:

- ✅ **32+ Frontend pages** across web and mobile
- ✅ **93+ Backend API endpoints** organized by functionality  
- ✅ **System architecture** and data flow diagrams
- ✅ **Integration patterns** and authentication flows
- ✅ **Quick reference guide** for developers

---

## 📁 Generated Documentation Files

### 1. **NETWORK_MAP.md** (Primary Reference)
The complete network map covering:
- Frontend pages organized by category (Home, Auth, Dashboard, Agents, Settings, etc.)
- Backend APIs organized by module (Core, Billing, Admin, Triggers, Composio, etc.)
- Integration points between frontend and backend
- Mobile app structure
- Authentication flows
- Rate limiting strategy
- Key integration patterns (Agent Lifecycle, Billing, Triggers, External Tools)
- Complete API endpoint listing with HTTP methods

**Use this for**: Finding specific routes, understanding API organization, learning system integration

---

### 2. **ARCHITECTURE_DIAGRAMS.md** (Visual Reference)
ASCII diagrams showing:
- System architecture overview with all components
- Frontend route hierarchy (tree structure)
- Backend API route structure (organized tree)
- Data flow diagrams for:
  - Agent execution flow
  - Billing & subscription flow
  - Trigger execution flow
  - Composio integration flow
- Authentication & session management flow
- Rate limiting & performance optimization
- Deployment architecture

**Use this for**: Understanding system flows, visualizing architecture, presentations

---

### 3. **QUICK_REFERENCE.md** (Developer Guide)
Quick reference with:
- Navigation guide to all docs
- Finding frontend pages quickly
- Finding backend APIs quickly
- Common tasks (adding pages, APIs, debugging)
- Database schema reference
- Authentication flows explanation
- Common issues & solutions
- Integration patterns summary
- Performance tips
- Debugging tips
- Deployment checklist

**Use this for**: Day-to-day development, quick lookups, troubleshooting

---

## 🎯 Key Insights

### Frontend Structure (32+ Pages)
```
Landing & Public:    / , /changelog, /enterprise, /support, /docs
Authentication:      /auth, /auth/github-popup, /auth/phone-verification, /reset-password
Dashboard:           /dashboard
Agent Management:    /dashboard/agents, /config/[agentId], /[threadId], /onboarding-demo
Settings:            /settings/api-keys, /credentials, /billing, /env-manager, /teams, /transactions
Team Management:     /[accountSlug], /[accountSlug]/settings/
Admin:              /admin/billing
Billing:            /checkout, /subscription, /activate-trial
Sharing:            /share/[threadId], /templates/[shareId], /invitation
```

### Backend Structure (93+ Endpoints)
```
Core Modules:
├── Agents           (7 endpoints)  - CRUD + versioning + tools
├── Threads          (9 endpoints)  - Conversation management
├── Agent Runs       (4 endpoints)  - Execution & streaming
├── Billing          (24 endpoints) - Payments + subscriptions
├── Triggers         (7 endpoints)  - Scheduling + webhooks
├── Composio         (15 endpoints) - Tool integrations
├── Admin            (10 endpoints) - User + billing management
├── Templates        (7 endpoints)  - Agent templates + marketplace
├── Sandbox          (7 endpoints)  - File operations + environment
├── MCP/Credentials  (3 endpoints)  - Secure integration storage
├── Vapi             (3 endpoints)  - Voice API integration
├── Google APIs      (2 endpoints)  - Docs + Slides
├── Knowledge Base   (1 endpoint)   - Document management
├── Transcription    (1 endpoint)   - Audio transcription
└── Email            (1 endpoint)   - Email services
```

### Integration Points
```
Frontend ↔ Backend    → HTTP/REST + WebSocket via JWT auth
Backend ↔ Database    → Supabase PostgreSQL with connection pooling
Backend ↔ Cache       → Redis for sessions, caching, job queues
Backend ↔ External    → Stripe, Google APIs, Composio, Vapi, LLM providers
Mobile ↔ Backend      → Same API client & authentication as web
```

---

## 🚀 How to Use This Documentation

### For Frontend Developers
1. Start with **QUICK_REFERENCE.md** for common tasks
2. Find your page in **NETWORK_MAP.md** 
3. Review similar pages for patterns
4. Check **ARCHITECTURE_DIAGRAMS.md** for data flows

### For Backend Developers  
1. Find your API in **NETWORK_MAP.md**
2. Check module implementation in `backend/core/`
3. Review **ARCHITECTURE_DIAGRAMS.md** for integration patterns
4. Use **QUICK_REFERENCE.md** for debugging tips

### For DevOps/System Architects
1. Review system diagram in **ARCHITECTURE_DIAGRAMS.md**
2. Understand deployment architecture
3. Check rate limiting & performance strategies
4. Review integration points

### For Product/Project Managers
1. Review **NETWORK_MAP.md** overview section
2. Check feature completeness against roadmap
3. Use **ARCHITECTURE_DIAGRAMS.md** for high-level presentations
4. Reference statistics in **QUICK_REFERENCE.md**

---

## 📊 Statistics

| Metric | Count |
|--------|-------|
| Frontend Pages | 32+ |
| Backend API Endpoints | 93+ |
| API Categories | 15+ |
| Mobile Screens | 6+ |
| External Integrations | 6+ |
| Database Tables | 10+ |
| Documentation Pages | 3 |

---

## 🔍 Key Features Documented

### Agent Management
- ✅ Create, update, delete agents
- ✅ Agent versioning & rollback
- ✅ Agent tool configuration
- ✅ Custom MCP tool integration

### Conversation System  
- ✅ Thread creation & management
- ✅ Message history
- ✅ Multi-agent support
- ✅ Real-time streaming

### Agent Execution
- ✅ Start/stop runs
- ✅ Real-time streaming
- ✅ Background execution
- ✅ Run history & analytics

### Billing & Subscriptions
- ✅ Stripe integration
- ✅ Credit system
- ✅ Subscription management
- ✅ Payment history
- ✅ Trial period support

### Triggers & Scheduling
- ✅ Cron-based scheduling
- ✅ Webhook triggers
- ✅ Event-based triggers
- ✅ Upcoming run tracking

### Integrations
- ✅ Composio tool marketplace
- ✅ Google Docs/Slides
- ✅ Vapi voice integration
- ✅ Custom MCP servers
- ✅ External credentials storage

### Admin Capabilities
- ✅ User management
- ✅ Billing administration
- ✅ Environment variable management
- ✅ Master authentication

---

## 📝 Documentation Format

All documentation is in **Markdown** format:
- **NETWORK_MAP.md** - 500+ lines, organized by category
- **ARCHITECTURE_DIAGRAMS.md** - ASCII diagrams with explanations
- **QUICK_REFERENCE.md** - Task-oriented with code examples

Files are located in repository root:
```
/NETWORK_MAP.md
/ARCHITECTURE_DIAGRAMS.md
/QUICK_REFERENCE.md
```

---

## 🔗 Cross References

### Navigation
- **NETWORK_MAP.md** contains detailed information
- **ARCHITECTURE_DIAGRAMS.md** contains visual flows
- **QUICK_REFERENCE.md** contains quick lookups
- Files reference each other for additional context

### Related Documentation
- `backend/README.md` - Backend setup instructions
- `frontend/README.md` - Frontend setup instructions
- `apps/mobile/README.md` - Mobile app setup
- `CONTRIBUTING.md` - Contribution guidelines
- `docs/SELF-HOSTING.md` - Deployment guide

---

## ✨ Benefits of This Documentation

1. **Complete Visibility** - See all pages and APIs at a glance
2. **Quick Navigation** - Find what you need fast
3. **Onboarding** - New developers can understand the system quickly
4. **Architecture Clarity** - Visual diagrams explain flows
5. **Common Patterns** - Understand how features integrate
6. **Troubleshooting** - Quick reference for debugging
7. **Planning** - Help with feature planning and scope
8. **Code Navigation** - Understand where to find code

---

## 🎓 Learning Path

### For New Team Members
1. Read **QUICK_REFERENCE.md** intro
2. Review **ARCHITECTURE_DIAGRAMS.md** system overview
3. Study relevant sections in **NETWORK_MAP.md**
4. Find examples in codebase
5. Ask questions about specific flows

### For Feature Implementation
1. Check **NETWORK_MAP.md** for existing similar features
2. Review **ARCHITECTURE_DIAGRAMS.md** for integration points
3. Find implementation in codebase
4. Follow existing patterns
5. Update documentation when adding features

### For System Architecture Review
1. Study **ARCHITECTURE_DIAGRAMS.md** completely
2. Review all integration patterns
3. Check rate limiting & performance strategies
4. Understand data flows
5. Plan improvements

---

## 🚀 Next Steps

### To Use This Documentation
1. ✅ Check that files were created in repository root
2. ✅ Open with any Markdown viewer or editor
3. ✅ Use browser search (Ctrl+F) to find specific routes
4. ✅ Reference when developing features
5. ✅ Update when adding new pages/APIs

### To Keep Documentation Current
- [ ] Update NETWORK_MAP.md when adding new routes
- [ ] Update ARCHITECTURE_DIAGRAMS.md when changing flows
- [ ] Update QUICK_REFERENCE.md with new common patterns
- [ ] Keep in sync with actual codebase
- [ ] Review quarterly for accuracy

---

## 📞 Questions?

**For specific API questions:** Check NETWORK_MAP.md or look at `backend/core/*/api.py`  
**For flow questions:** Check ARCHITECTURE_DIAGRAMS.md  
**For quick answers:** Check QUICK_REFERENCE.md  
**For code:** Explore `frontend/src/app` and `backend/core/`

---

## 📄 Document Information

| Document | Lines | Categories | Created |
|----------|-------|-----------|---------|
| NETWORK_MAP.md | 500+ | 15+ | Nov 2, 2025 |
| ARCHITECTURE_DIAGRAMS.md | 400+ | 8+ | Nov 2, 2025 |
| QUICK_REFERENCE.md | 300+ | 12+ | Nov 2, 2025 |

**Current Branch**: `feature/slash-commands`  
**Repository**: Kortix/Suna  
**Last Updated**: November 2, 2025

---

## ✅ Deliverables Checklist

- ✅ Complete network map of frontend pages (32+)
- ✅ Complete network map of backend APIs (93+)
- ✅ System architecture diagram
- ✅ Data flow diagrams for key processes
- ✅ Integration point documentation
- ✅ Authentication flow documentation
- ✅ Quick reference guide for developers
- ✅ Common patterns explained
- ✅ Debugging tips and tricks
- ✅ Performance optimization guidance

---

*Thank you for reviewing the Suna Application Network Map!*

For more information, please see the individual documentation files.
