# Suna Application - Network Map
## Frontend Pages & Backend APIs Architecture

**Generated:** November 2, 2025
**Project:** Kortix/Suna - Open Source AI Platform
**Current Branch:** feature/slash-commands

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Frontend Architecture](#frontend-architecture)
3. [Backend API Architecture](#backend-api-architecture)
4. [Integration Points](#integration-points)
5. [Mobile App Structure](#mobile-app-structure)

---

## 🏗️ System Overview

The Suna application is a multi-platform AI agent platform with three main components:

- **Frontend (Next.js)**: Web application dashboard
- **Backend (FastAPI)**: REST API and agent orchestration
- **Mobile (Expo React Native)**: Native mobile application

---

## 🖥️ Frontend Architecture

### Frontend Structure
- **Framework**: Next.js (App Router)
- **Location**: `frontend/src/app`
- **Styling**: Tailwind CSS with NativeWind

### Frontend Pages by Category

#### **Home & Authentication Pages**
```
/ → (home)/page.tsx
├── /changelog → changelog/page.tsx
├── /enterprise → enterprise/page.tsx
├── /support → support/page.tsx
├── /legal → legal/page.tsx
├── /docs → docs/page.tsx
│   ├── /docs/introduction → introduction/page.tsx
│   ├── /docs/architecture → architecture/page.tsx
│   ├── /docs/contributing → contributing/page.tsx
│   ├── /docs/license → license/page.tsx
│   └── /docs/self-hosting → self-hosting/page.tsx
├── /auth → auth/page.tsx
│   ├── /auth/github-popup → github-popup/page.tsx
│   ├── /auth/phone-verification → phone-verification/page.tsx
│   └── /auth/reset-password → reset-password/page.tsx
└── /master-login → master-login/page.tsx
```

#### **Dashboard Pages** (Protected Routes)
```
/dashboard → (dashboard)/(personalAccount)/dashboard/page.tsx
```

#### **Agent Management**
```
/dashboard/agents → (dashboard)/agents/page.tsx
├── /dashboard/agents/config/[agentId] → config/[agentId]/page.tsx
├── /dashboard/agents/[threadId] → [threadId]/page.tsx
├── /dashboard/composio-test → composio-test/page.tsx
└── /dashboard/onboarding-demo → onboarding-demo/page.tsx
```

#### **Project & Thread Management**
```
/dashboard/projects/[projectId]/thread/[threadId] 
  → projects/[projectId]/thread/[threadId]/page.tsx
```

#### **Knowledge Base & Templates**
```
/dashboard/knowledge → (dashboard)/knowledge/page.tsx
/dashboard/model-pricing → (dashboard)/model-pricing/page.tsx
```

#### **Settings & Configuration**
```
/dashboard/settings/
├── /api-keys → api-keys/page.tsx
├── /credentials → credentials/page.tsx
└── /(personalAccount)/settings/
    ├── → settings/page.tsx
    ├── /billing → billing/page.tsx
    ├── /env-manager → env-manager/page.tsx
    ├── /teams → teams/page.tsx
    └── /transactions → transactions/page.tsx
```

#### **Team & Account Management**
```
/(dashboard)/(teamAccount)/[accountSlug]
├── → [accountSlug]/page.tsx
├── /settings → settings/page.tsx
│   ├── /billing → billing/page.tsx
│   └── /members → members/page.tsx
```

#### **Admin Panel**
```
/dashboard/admin/
└── /billing → admin/billing/page.tsx
```

#### **Triggers**
```
/dashboard/triggers → triggers/page.tsx
```

#### **Billing & Checkout**
```
/checkout → checkout/page.tsx
/subscription → subscription/page.tsx
/activate-trial → activate-trial/page.tsx
```

#### **Sharing & Templates**
```
/share/[threadId] → share/[threadId]/page.tsx
/templates/[shareId] → templates/[shareId]/page.tsx
/invitation → invitation/page.tsx
```

---

## 🔌 Backend API Architecture

### Backend Structure
- **Framework**: FastAPI (Python)
- **Location**: `backend/core`
- **Database**: Supabase PostgreSQL
- **Cache**: Redis

### API Router Organization

#### **Core API Module** (`core/api.py`)
Routes handling core agent functionality

#### **Account Management**
```
POST   /account/request-deletion           → Request account deletion
POST   /account/cancel-deletion            → Cancel deletion request
GET    /account/deletion-status            → Get deletion status
DELETE /account/delete-immediately         → Immediately delete account
```

#### **Agent Management & CRUD**
```
POST   /agents                             → Create Agent
GET    /agents                             → List Agents (with pagination/filtering)
GET    /agents/{agent_id}                  → Get Agent Details
PUT    /agents/{agent_id}                  → Update Agent
DELETE /agents/{agent_id}                  → Delete Agent
POST   /agents/generate-icon               → Generate Agent Icon (AI-generated)
GET    /agents/{agent_id}/export           → Export Agent as JSON
POST   /agents/json/import                 → Import Agent from JSON
POST   /agents/json/analyze                → Analyze Agent JSON
```

#### **Agent Tools & MCP Integration**
```
GET    /agents/{agent_id}/tools            → Get Agent Tools
GET    /agents/{agent_id}/custom-mcp-tools → Get Custom MCP Tools
POST   /agents/{agent_id}/custom-mcp-tools → Update Custom MCP Tools
PUT    /agents/{agent_id}/custom-mcp-tools → Update Custom MCPs
```

#### **Agent Versioning**
```
GET    /agents/{agent_id}/versions         → List Agent Versions
POST   /agents/{agent_id}/versions         → Create Agent Version
GET    /agents/{agent_id}/versions/{version_id}
       → Get Specific Agent Version
PUT    /agents/{agent_id}/versions/{version_id}/activate
       → Activate Agent Version
GET    /agents/{agent_id}/versions/{version1_id}/compare/{version2_id}
       → Compare Two Agent Versions
POST   /agents/{agent_id}/versions/{version_id}/rollback
       → Rollback to Agent Version
PUT    /agents/{agent_id}/versions/{version_id}/details
       → Update Agent Version Details
```

#### **Threads & Conversation Management**
```
GET    /threads                            → List User Threads
POST   /threads                            → Create Thread
GET    /threads/{thread_id}                → Get Thread Details
PATCH  /threads/{thread_id}                → Update Thread
DELETE /threads/{thread_id}                → Delete Thread
GET    /threads/{thread_id}/messages       → Get Thread Messages
POST   /threads/{thread_id}/messages       → Create Thread Message
POST   /threads/{thread_id}/messages/add   → Add Message to Thread
DELETE /threads/{thread_id}/messages/{message_id}
       → Delete Thread Message
GET    /thread/{thread_id}/agent           → Get Thread Agent
GET    /thread/{thread_id}/agent-runs      → List Thread Agent Runs
```

#### **Agent Runs & Execution**
```
POST   /agent/start                        → Start Agent (Unified)
POST   /agent-run/{agent_run_id}/stop      → Stop Agent Run
GET    /agent-runs/active                  → List All Active Agent Runs
GET    /agent-run/{agent_run_id}           → Get Agent Run Details
GET    /agent-run/{agent_run_id}/stream    → Stream Agent Run Results
```

#### **Tools & Capabilities**
```
GET    /tools                              → Get All Available Tools
GET    /tools/{tool_name}                  → Get Tool Details
```

#### **Sandbox Environment** (`core/sandbox/api.py`)
```
POST   /sandboxes/{sandbox_id}/files       → Create File in Sandbox
PUT    /sandboxes/{sandbox_id}/files       → Update File in Sandbox
GET    /sandboxes/{sandbox_id}/files       → List Files in Sandbox
GET    /sandboxes/{sandbox_id}/files/content
       → Get File Content from Sandbox
DELETE /sandboxes/{sandbox_id}/files       → Delete File from Sandbox
DELETE /sandboxes/{sandbox_id}             → Delete Sandbox
POST   /project/{project_id}/sandbox/ensure-active
       → Ensure Sandbox is Active
```

#### **Billing & Payments** (`core/billing/api.py`)
```
POST   /check                              → Check Billing Status
GET    /check-status                       → Get Check Status
GET    /project-limits                     → Get Project Rate Limits
POST   /deduct                             → Deduct Credits
GET    /balance                            → Get Account Balance
POST   /purchase-credits                   → Purchase Credits
POST   /webhook                            → Handle Payment Webhooks
GET    /subscription                       → Get Subscription Status
POST   /sync-subscription                  → Sync Subscription with Stripe
GET    /subscription-cancellation-status   → Get Cancellation Status
POST   /cancel-subscription                → Cancel Active Subscription
POST   /reactivate-subscription            → Reactivate Cancelled Subscription
GET    /transactions                       → Get Transaction History
GET    /transactions/summary               → Get Transaction Summary
GET    /credit-breakdown                   → Get Credit Usage Breakdown
GET    /usage-history                      → Get Usage History
GET    /available-models                   → Get Available AI Models
POST   /create-checkout-session            → Create Stripe Checkout Session
POST   /create-portal-session              → Create Stripe Portal Session
GET    /subscription-commitment/{subscription_id}
       → Get Subscription Commitment Details
GET    /trial/status                       → Get Trial Status
POST   /trial/start                        → Start Trial Period
POST   /trial/cancel                       → Cancel Trial
POST   /trial/create-checkout              → Create Trial Checkout
GET    /proration-preview                  → Preview Proration Calculation
POST   /reconcile                          → Reconcile Billing Records
GET    /circuit-breaker-status             → Get Circuit Breaker Status
```

#### **Admin APIs** (`core/admin/`)
```
Admin User Management:
GET    /users/list                         → List All Users
GET    /users/{user_id}                    → Get User Details
GET    /users/stats/overview               → Get User Statistics
GET    /users/{user_id}/activity           → Get User Activity
GET    /users/threads/by-email             → Get User Threads by Email
POST   /suna-agents/install-user/{account_id}
       → Install Suna Agent for User
GET    /env-vars                           → Get Environment Variables
POST   /env-vars                           → Set Environment Variables

Admin Billing:
POST   /credits/adjust                     → Adjust User Credits
POST   /refund                             → Issue Refund
GET    /user/{account_id}/summary          → Get User Billing Summary
GET    /user/{account_id}/transactions     → Get User Transactions

Admin Authentication:
POST   /authenticate                       → Master Password Authentication
```

#### **Triggers & Scheduling** (`core/triggers/api.py`)
```
GET    /providers                          → Get Trigger Providers
GET    /all                                → Get All Triggers
GET    /agents/{agent_id}/triggers         → Get Agent Triggers
POST   /agents/{agent_id}/triggers         → Create Agent Trigger
GET    /agents/{agent_id}/upcoming-runs    → Get Upcoming Trigger Runs
GET    /{trigger_id}                       → Get Trigger Details
PUT    /{trigger_id}                       → Update Trigger
DELETE /{trigger_id}                       → Delete Trigger
POST   /{trigger_id}/webhook               → Handle Trigger Webhook
```

#### **Composio Integration** (`core/composio_integration/api.py`)
```
GET    /categories                         → Get Composio Categories
GET    /toolkits                           → Get Available Toolkits
GET    /toolkits/{toolkit_slug}/details    → Get Toolkit Details
GET    /toolkits/{toolkit_slug}/icon       → Get Toolkit Icon
POST   /integrate                          → Integrate with External Service
POST   /profiles                           → Create Composio Profile
GET    /profiles                           → List User Profiles
GET    /profiles/check-name-availability   → Check Profile Name Availability
GET    /profiles/{profile_id}              → Get Profile Details
GET    /profiles/{profile_id}/mcp-config   → Get Profile MCP Configuration
POST   /profiles/{profile_id}/discover-tools
       → Discover Available Tools
GET    /integration/{connected_account_id}/status
       → Get Integration Status
POST   /discover-tools/{profile_id}        → Discover Tools for Profile
POST   /tools/list                         → List Composio Tools
GET    /triggers/apps                      → Get Trigger Apps
GET    /triggers/apps/{toolkit_slug}       → Get Trigger Details for App
GET    /triggers/schema/{trigger_slug}     → Get Trigger Schema
POST   /triggers/create                    → Create Trigger
POST   /webhook                            → Handle Composio Webhook
GET    /health                             → Composio Health Check
```

#### **MCP Module** (`core/mcp_module/api.py`)
```
Model Context Protocol Integration
(Detailed routes TBD - handles MCP server interactions)
```

#### **Credentials & Secrets** (`core/credentials/api.py`)
```
POST   /secure-mcp/credentials             → Create Credential
GET    /secure-mcp/credentials             → List User Credentials
(Full route details available in credentials module)
```

#### **Templates & Agents** (`core/templates/api.py`)
```
POST   /templates                          → Create Template
POST   /templates/{template_id}/publish    → Publish Template
POST   /templates/{template_id}/unpublish  → Unpublish Template
DELETE /templates/{template_id}            → Delete Template
POST   /templates/install                  → Install Template
GET    /templates/kortix-all               → Get All Kortix Templates
GET    /templates/marketplace              → Get Marketplace Templates
GET    /templates/my                       → Get User's Templates
GET    /templates/public/{template_id}     → Get Public Template
GET    /templates/{template_id}            → Get Template Details
GET    /presentation-templates/{template_name}/image.png
       → Get Template Preview Image
```

#### **Knowledge Base** (`core/knowledge_base/api.py`)
```
Document and Knowledge Management
(Routes handle document storage, retrieval, and indexing)
```

#### **Vapi Integration** (`core/vapi_api.py`)
```
POST   /webhooks/vapi                      → Vapi Call Webhook
GET    /vapi/calls                         → List Vapi Calls
GET    /vapi/calls/{call_id}               → Get Call Details
```

#### **API Keys Management** (`core/services/api_keys_api.py`)
```
API Key CRUD Operations
(Routes handle user API key generation and management)
```

#### **Transcription** (`core/services/transcription.py`)
```
POST   /transcription                      → Transcribe Audio
```

#### **Email Services** (`core/services/email_api.py`)
```
POST   /send-welcome-email                 → Send Welcome Email
```

#### **Google Integration** 
```
Google Slides API (core/google/google_slides_api.py):
(Routes for creating, updating, and managing Google Slides presentations)

Google Docs API (core/google/google_docs_api.py):
(Routes for creating, updating, and managing Google Docs documents)
```

---

## 🔗 Integration Points

### Frontend ↔ Backend Integration

#### **Primary Data Flow**
```
Frontend (Next.js)
    ↓
API Client (Fetch/Axios)
    ↓
Backend (FastAPI) /v1/
    ↓
Services Layer (Business Logic)
    ↓
Database (Supabase PostgreSQL)
    ↓
External Services
    ├─ Stripe (Billing)
    ├─ OpenAI/Claude (AI Models)
    ├─ Google APIs (Docs, Slides)
    ├─ Composio (Tool Integrations)
    ├─ Vapi (Voice API)
    ├─ Supabase Auth
    └─ Redis (Caching)
```

### Authentication Flow
```
1. User logs in via /auth
2. Supabase Auth generates JWT token
3. Token stored in frontend (localStorage/cookies)
4. Frontend sends token in Authorization header
5. Backend validates token via middleware
6. User context available to all API endpoints
```

### Real-time Features
```
- WebSocket connections for agent run streaming
- Redis pub/sub for background job updates
- Server-sent events for long-polling alternatives
```

### Rate Limiting
```
- IP-based tracking (max 25 concurrent IPs)
- Credit-based rate limiting for API operations
- Tier-based limits for different subscription levels
```

---

## 📱 Mobile App Structure

### Mobile Framework
- **Framework**: Expo with React Native
- **Navigation**: Expo Router (file-based routing)
- **Location**: `apps/mobile/app`

### Mobile Pages

```
/
├── index.tsx                              → Home/Dashboard
├── splash.tsx                             → App Splash Screen
├── onboarding.tsx                         → First-time User Onboarding
├── auth/
│   └── auth management screens
├── home.tsx                               → Home Screen
├── billing/
│   └── billing management screens
├── trigger-detail.tsx                     → Trigger Detail View
└── _layout.tsx                            → Root Layout/Navigation
```

### Mobile Features
- **State Management**: React Context (based on frontend/contexts)
- **HTTP Client**: Supabase SDK + custom API client
- **Local Storage**: AsyncStorage
- **Native Modules**: Audio, Camera, File System

### Mobile ↔ Backend Integration
```
Mobile App (React Native)
    ↓
API Client (Same as web frontend)
    ↓
Backend FastAPI
    ↓
(Same backend services as web)
```

---

## 📊 Key Integration Patterns

### 1. Agent Lifecycle
```
Frontend: User creates agent via /dashboard/agents
  ↓
POST /agents (Backend)
  ↓
Agent stored in Supabase
  ↓
Frontend: User configures agent via /dashboard/agents/config/[agentId]
  ↓
PUT /agents/{agent_id} (Backend)
  ↓
Frontend: User starts agent via /dashboard/agents/[threadId]
  ↓
POST /agent/start (Backend)
  ↓
Agent execution with background workers
  ↓
GET /agent-run/{agent_run_id}/stream (Frontend websocket)
  ↓
Real-time updates streamed to client
```

### 2. Billing Flow
```
Frontend: User navigates to /checkout
  ↓
POST /create-checkout-session (Backend)
  ↓
Stripe checkout URL returned
  ↓
User redirected to Stripe
  ↓
POST /webhook (Backend receives Stripe webhook)
  ↓
Subscription created in Supabase
  ↓
Frontend: User can view /subscription or /dashboard/settings/billing
```

### 3. Trigger Execution Flow
```
Frontend: User creates trigger via /dashboard/triggers
  ↓
POST /agents/{agent_id}/triggers (Backend)
  ↓
Trigger stored with schedule
  ↓
Backend scheduler monitors triggers
  ↓
On trigger event: Automatically start agent
  ↓
Results available via GET /agents/{agent_id}/upcoming-runs
```

### 4. External Tool Integration
```
Frontend: User connects Composio integration via settings
  ↓
POST /integrate (Backend)
  ↓
Connection stored with OAuth tokens
  ↓
Agent can use tools from integration
  ↓
When agent runs: Tools executed via Composio API
  ↓
Results returned to frontend
```

---

## 🔐 Authentication & Authorization

### Token-Based Auth
```
- JWT tokens from Supabase
- Stored in secure cookies
- Validated on every request
- Refresh tokens for session management
```

### Permission Levels
```
1. Unauthenticated: Can access /docs, /legal, /home, /auth
2. Authenticated User: Can access /dashboard/* routes
3. Admin: Can access /admin routes (via special role)
4. Team Member: Can access team-specific routes
```

---

## 📈 Performance & Scalability

### Caching Strategy
- **Redis**: Agent cache, session storage
- **Frontend**: React Query for data caching
- **CDN**: Static assets via Vercel

### Async Processing
- **Background Workers**: Agent execution
- **Job Queue**: Scheduled triggers, transcription
- **WebSockets**: Real-time agent updates

### Rate Limiting
- **Credit-based**: API operations deduct credits
- **Subscription tiers**: Different rate limits
- **IP-based**: Global connection limits

---

## 📚 API Endpoints Summary

| Category | Count | Key Endpoints |
|----------|-------|---------------|
| Agents | 7 | Create, Read, Update, Delete, List |
| Agent Tools | 3 | Get, Update, Manage MCP |
| Agent Versions | 7 | Create, Get, Compare, Rollback, Activate |
| Threads | 9 | CRUD, Messages, Agent Association |
| Agent Runs | 4 | Start, Stop, List, Stream |
| Billing | 24 | Subscription, Credits, Payments, Usage |
| Admin | 10 | User Management, Billing, Auth |
| Triggers | 7 | CRUD, Schedule, Webhooks |
| Composio | 15 | Profiles, Tools, Integrations, Webhooks |
| Sandbox | 7 | File Management, Environment |
| **TOTAL** | **~93+** | **Various categories** |

---

## 🎯 Frontend Pages Summary

| Category | Count | Examples |
|----------|-------|----------|
| Home & Public | 7 | Home, Docs, Legal, Changelog |
| Authentication | 4 | Login, Phone Verify, Reset Password |
| Dashboard | 1 | Main Dashboard |
| Agents | 4 | List, Config, Thread, Demo |
| Settings | 9 | Account, Billing, API Keys, Teams |
| Admin | 1 | Billing Admin |
| Billing | 3 | Checkout, Subscription, Trial |
| Sharing | 3 | Share Thread, Templates, Invitations |
| **TOTAL** | **~32+** | **Various pages** |

---

## 📱 Mobile Pages Summary

| Category | Count |
|----------|-------|
| Core Navigation | 2 |
| Onboarding | 1 |
| Authentication | 1 |
| Billing | 1 |
| Details | 1 |
| **TOTAL** | **~6+** |

---

## 🔄 Data Model Overview

### Core Entities
```
User/Account
├── Agent (many)
│   ├── Version (many)
│   ├── Tool (many)
│   ├── Trigger (many)
│   └── Run (many)
├── Thread (many)
│   ├── Message (many)
│   └── Run (many)
├── Credential (many)
├── API Key (many)
└── Subscription (1)

Subscription
├── Plan
├── Transaction (many)
└── Credit Usage (many)

Trigger
├── Schedule/Event Config
└── Associated Agent

Template
├── Agent Config
└── Published Versions
```

---

## 🚀 Deployment Architecture

### Services
```
Frontend
├── Vercel (Next.js hosting)
├── CDN for static assets
└── Client-side libraries

Backend
├── Python/FastAPI application
├── Redis instance
├── Supabase PostgreSQL
└── Background workers

External Services
├── Stripe (Billing)
├── Google Cloud (OAuth, APIs)
├── Supabase (Auth, Database)
├── Composio (Tool marketplace)
└── Various AI providers
```

---

## 📝 Notes

- This map is current as of the `feature/slash-commands` branch
- API endpoints are organized by functional area
- Frontend uses Next.js App Router with dynamic segments
- Backend implements RESTful principles with JSON request/response
- Mobile app shares API client with web frontend
- All endpoints require authentication except public docs/auth routes

---

*For detailed implementation, refer to individual module documentation in the respective `api.py` and `page.tsx` files.*
