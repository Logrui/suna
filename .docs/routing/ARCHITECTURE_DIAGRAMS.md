# Suna Application - Visual Architecture Diagrams

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           SUNA PLATFORM                                │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐         ┌──────────────────────┐         ┌──────────────────────┐
│   WEB FRONTEND       │         │   MOBILE FRONTEND    │         │   API CLIENTS        │
│   (Next.js)          │         │   (Expo React Native)│         │                      │
│                      │         │                      │         │                      │
│  32+ Pages           │         │  6+ Screens          │         │  Authentication      │
│  TypeScript/TSX      │         │  TypeScript/TSX      │         │  HTTP Client         │
│  TailwindCSS         │         │  NativeWind CSS      │         │  WebSocket           │
└──────────────┬───────┘         └──────────┬───────────┘         └──────────┬───────────┘
               │                            │                                  │
               └────────────────┬───────────┴──────────────────────────────────┘
                                │
                   HTTP/REST + WebSocket
                                │
┌───────────────────────────────▼──────────────────────────────────────────┐
│                        FASTAPI BACKEND                                   │
│                     (Python 3.10+)                                       │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ Auth Module  │  │ Agent Module │  │ Billing      │  │ Admin      │  │
│  │              │  │              │  │ Module       │  │ Module     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ Threads      │  │ Triggers     │  │ Composio     │  │ Sandbox    │  │
│  │ Module       │  │ Module       │  │ Integration  │  │ Module     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ Templates    │  │ Knowledge    │  │ Tools API    │  │ Vapi       │  │
│  │ Module       │  │ Base         │  │              │  │ Integration│  │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │
│                                                                          │
│  ~93+ Endpoints across all modules                                      │
└────────┬─────────────────────────────┬──────────────────────────────────┘
         │                             │
         │ Database                    │ Cache & Queue
         │                             │
    ┌────▼──────┐                 ┌────▼────┐
    │ Supabase  │                 │  Redis  │
    │ PostgreSQL│                 │         │
    │           │                 │ Session │
    │ Tables:   │                 │ Queue   │
    │ • Users   │                 │ Cache   │
    │ • Agents  │                 └─────────┘
    │ • Threads │
    │ • Runs    │
    │ • Subs    │
    └────┬──────┘
         │
    External APIs
         │
    ┌────┴────────────────────────────────────┐
    │                                         │
┌───▼──────┐ ┌──────────┐ ┌──────────┐ ┌────▼──────┐
│  Stripe  │ │  Google  │ │Composio  │ │ Vapi      │
│ Billing  │ │ OAuth2   │ │Platform  │ │ Voice API │
│          │ │ Docs API │ │          │ │           │
│ Payment  │ │ Slides   │ │ Tools    │ │ Call      │
└──────────┘ └──────────┘ └──────────┘ │ Management
                                       │ 
                                   ┌───▼──────┐
                                   │ OpenAI   │
                                   │ Claude   │
                                   │ Local LLM│
                                   └──────────┘
```

---

## Frontend Route Hierarchy

```
App Root (layout.tsx)
│
├─── (home)
│    ├─── page.tsx                    [Public Landing]
│    ├─── /changelog
│    ├─── /enterprise
│    ├─── /support
│    └─── /docs
│         ├─── /introduction
│         ├─── /architecture
│         ├─── /contributing
│         ├─── /license
│         └─── /self-hosting
│
├─── /auth
│    ├─── page.tsx                    [Login]
│    ├─── /github-popup
│    ├─── /phone-verification
│    └─── /reset-password
│
├─── /master-login                    [Admin Login]
│
├─── /legal                           [Legal Pages]
│
├─── (dashboard)                      [Protected Routes]
│    │
│    ├─── (personalAccount)
│    │    ├─── /dashboard              [Main Dashboard]
│    │    └─── /settings
│    │         ├─── page.tsx           [Account Settings]
│    │         ├─── /billing           [Billing Settings]
│    │         ├─── /env-manager       [Environment Variables]
│    │         ├─── /teams             [Team Management]
│    │         └─── /transactions      [Transaction History]
│    │
│    ├─── (teamAccount)
│    │    └─── /[accountSlug]
│    │         ├─── page.tsx           [Team Dashboard]
│    │         └─── /settings
│    │              ├─── /billing      [Team Billing]
│    │              └─── /members      [Team Members]
│    │
│    ├─── /agents                      [Agent Management]
│    │    ├─── page.tsx                [List Agents]
│    │    ├─── /config/[agentId]       [Configure Agent]
│    │    ├─── /[threadId]             [Agent Conversation]
│    │    ├─── /onboarding-demo        [Onboarding Demo]
│    │    └─── /composio-test          [Composio Testing]
│    │
│    ├─── /projects
│    │    └─── /[projectId]
│    │         └─── /thread/[threadId] [Project Thread]
│    │
│    ├─── /knowledge                   [Knowledge Base]
│    │
│    ├─── /triggers                    [Trigger Management]
│    │
│    ├─── /settings
│    │    ├─── /api-keys               [API Key Management]
│    │    └─── /credentials            [Credential Management]
│    │
│    ├─── /model-pricing               [Model Pricing]
│    │
│    └─── /admin
│         └─── /billing                [Admin Billing Panel]
│
├─── /checkout                        [Stripe Checkout]
│
├─── /subscription                    [Subscription Management]
│
├─── /activate-trial                  [Trial Activation]
│
├─── /share/[threadId]                [Shared Thread View]
│
├─── /templates/[shareId]             [Shared Template View]
│
├─── /invitation                      [Team Invitation]
│
└─── /docs                            [Documentation]
```

---

## Backend API Route Structure

```
API Router (FastAPI)
│
├─── /agents (Core Agent Management)
│    ├─── POST   /agents                           [Create]
│    ├─── GET    /agents                           [List]
│    ├─── GET    /agents/{agent_id}                [Get]
│    ├─── PUT    /agents/{agent_id}                [Update]
│    ├─── DELETE /agents/{agent_id}                [Delete]
│    ├─── POST   /agents/generate-icon             [Generate Icon]
│    ├─── GET    /agents/{agent_id}/export         [Export JSON]
│    ├─── POST   /agents/json/import               [Import JSON]
│    └─── POST   /agents/json/analyze              [Analyze JSON]
│
├─── /agents/{agent_id}/tools (Agent Tools)
│    ├─── GET    /tools                            [Get All Tools]
│    ├─── GET    /tools/{tool_name}                [Get Tool Details]
│    ├─── GET    /agents/{agent_id}/tools          [Get Agent Tools]
│    ├─── GET    /agents/{agent_id}/custom-mcp-tools
│    ├─── POST   /agents/{agent_id}/custom-mcp-tools
│    └─── PUT    /agents/{agent_id}/custom-mcp-tools
│
├─── /agents/{agent_id}/versions (Agent Versioning)
│    ├─── POST   /agents/{agent_id}/versions       [Create Version]
│    ├─── GET    /agents/{agent_id}/versions       [List Versions]
│    ├─── GET    /agents/{agent_id}/versions/{version_id}
│    ├─── PUT    /agents/{agent_id}/versions/{version_id}/activate
│    ├─── POST   /agents/{agent_id}/versions/{version_id}/rollback
│    ├─── GET    /agents/{agent_id}/versions/{v1}/compare/{v2}
│    └─── PUT    /agents/{agent_id}/versions/{version_id}/details
│
├─── /agent/start (Agent Execution)
│    └─── POST   /agent/start                      [Start Agent]
│
├─── /agent-run (Agent Run Management)
│    ├─── POST   /agent-run/{agent_run_id}/stop    [Stop Run]
│    ├─── GET    /agent-runs/active                [List Active]
│    ├─── GET    /agent-run/{agent_run_id}         [Get Run]
│    └─── GET    /agent-run/{agent_run_id}/stream  [Stream Results]
│
├─── /threads (Thread Management)
│    ├─── GET    /threads                          [List]
│    ├─── POST   /threads                          [Create]
│    ├─── GET    /threads/{thread_id}              [Get]
│    ├─── PATCH  /threads/{thread_id}              [Update]
│    ├─── DELETE /threads/{thread_id}              [Delete]
│    ├─── GET    /threads/{thread_id}/messages     [Get Messages]
│    ├─── POST   /threads/{thread_id}/messages     [Create Message]
│    ├─── POST   /threads/{thread_id}/messages/add [Add Message]
│    └─── DELETE /threads/{thread_id}/messages/{msg_id}
│
├─── /account (Account Management)
│    ├─── POST   /account/request-deletion         [Request Delete]
│    ├─── POST   /account/cancel-deletion          [Cancel Delete]
│    ├─── GET    /account/deletion-status          [Check Status]
│    └─── DELETE /account/delete-immediately       [Delete Now]
│
├─── /billing (Billing & Subscriptions)
│    ├─── POST   /check                            [Check Status]
│    ├─── GET    /balance                          [Get Balance]
│    ├─── POST   /purchase-credits                 [Purchase]
│    ├─── GET    /subscription                     [Get Subscription]
│    ├─── POST   /create-checkout-session          [Checkout]
│    ├─── POST   /create-portal-session            [Portal]
│    ├─── POST   /cancel-subscription              [Cancel]
│    ├─── POST   /reactivate-subscription          [Reactivate]
│    ├─── GET    /transactions                     [History]
│    ├─── GET    /usage-history                    [Usage]
│    ├─── POST   /trial/start                      [Start Trial]
│    ├─── POST   /trial/cancel                     [Cancel Trial]
│    ├─── GET    /trial/status                     [Trial Status]
│    └─── POST   /webhook                          [Stripe Webhook]
│
├─── /triggers (Triggers & Scheduling)
│    ├─── GET    /providers                        [Get Providers]
│    ├─── GET    /all                              [Get All]
│    ├─── GET    /agents/{agent_id}/triggers       [Get Agent Triggers]
│    ├─── POST   /agents/{agent_id}/triggers       [Create]
│    ├─── GET    /{trigger_id}                     [Get]
│    ├─── PUT    /{trigger_id}                     [Update]
│    ├─── DELETE /{trigger_id}                     [Delete]
│    ├─── POST   /{trigger_id}/webhook             [Webhook]
│    └─── GET    /agents/{agent_id}/upcoming-runs  [Upcoming]
│
├─── /composio (Composio Integration)
│    ├─── GET    /categories                       [Categories]
│    ├─── GET    /toolkits                         [Toolkits]
│    ├─── GET    /toolkits/{toolkit_slug}/details  [Details]
│    ├─── POST   /integrate                        [Integrate]
│    ├─── POST   /profiles                         [Create Profile]
│    ├─── GET    /profiles                         [List Profiles]
│    ├─── GET    /profiles/{profile_id}            [Get Profile]
│    ├─── POST   /discover-tools/{profile_id}      [Discover Tools]
│    ├─── POST   /tools/list                       [List Tools]
│    ├─── GET    /triggers/apps                    [Trigger Apps]
│    ├─── GET    /triggers/schema/{trigger_slug}   [Trigger Schema]
│    ├─── POST   /triggers/create                  [Create Trigger]
│    ├─── POST   /webhook                          [Webhook]
│    └─── GET    /health                           [Health Check]
│
├─── /templates (Templates & Agents)
│    ├─── POST   /templates                        [Create]
│    ├─── POST   /templates/{template_id}/publish  [Publish]
│    ├─── POST   /templates/{template_id}/unpublish
│    ├─── DELETE /templates/{template_id}          [Delete]
│    ├─── POST   /templates/install                [Install]
│    ├─── GET    /templates/marketplace            [Marketplace]
│    ├─── GET    /templates/my                     [My Templates]
│    ├─── GET    /templates/{template_id}          [Get]
│    └─── GET    /templates/public/{template_id}   [Public]
│
├─── /sandboxes (Sandbox Environment)
│    ├─── POST   /sandboxes/{sandbox_id}/files     [Create File]
│    ├─── PUT    /sandboxes/{sandbox_id}/files     [Update File]
│    ├─── GET    /sandboxes/{sandbox_id}/files     [List Files]
│    ├─── GET    /sandboxes/{sandbox_id}/files/content
│    ├─── DELETE /sandboxes/{sandbox_id}/files     [Delete File]
│    ├─── DELETE /sandboxes/{sandbox_id}           [Delete Sandbox]
│    └─── POST   /project/{project_id}/sandbox/ensure-active
│
├─── /admin (Admin Operations)
│    ├─── GET    /users/list                       [List Users]
│    ├─── GET    /users/{user_id}                  [Get User]
│    ├─── GET    /users/stats/overview             [Stats]
│    ├─── GET    /users/{user_id}/activity         [Activity]
│    ├─── POST   /credits/adjust                   [Adjust Credits]
│    ├─── POST   /refund                           [Issue Refund]
│    ├─── GET    /user/{account_id}/summary        [Summary]
│    ├─── GET    /user/{account_id}/transactions   [Transactions]
│    ├─── POST   /authenticate                     [Admin Auth]
│    └─── GET    /env-vars                         [Env Variables]
│
├─── /secure-mcp (MCP & Credentials)
│    ├─── POST   /credentials                      [Create]
│    └─── GET    /credentials                      [List]
│
├─── /vapi (Vapi Voice Integration)
│    ├─── POST   /webhooks/vapi                    [Webhook]
│    ├─── GET    /vapi/calls                       [List Calls]
│    └─── GET    /vapi/calls/{call_id}             [Get Call]
│
├─── /transcription (Audio Transcription)
│    └─── POST   /transcription                    [Transcribe]
│
├─── /email (Email Services)
│    └─── POST   /send-welcome-email               [Send Email]
│
└─── /knowledge-base (Knowledge Management)
     └─── [Document & Knowledge Routes]
```

---

## Data Flow Diagrams

### Agent Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ AGENT EXECUTION FLOW                                                    │
└─────────────────────────────────────────────────────────────────────────┘

Frontend
│
├── User navigates to /dashboard/agents/[threadId]
│
├── Display agent conversation interface
│
└─► User enters prompt or message

    │
    ├── Frontend validates input
    │
    ├── POST /agent/start
    │   ├── agent_id
    │   ├── thread_id
    │   └── message

        Backend (Agent Run Handler)
        │
        ├── Validate user permissions
        │
        ├── Create AgentRun record in DB
        │
        ├── Load Agent configuration
        │
        ├── Initialize conversation context
        │
        ├── Load tools for agent
        │
        ├── Call LLM (OpenAI/Claude/Local)
        │
        ├── Execute agent tools as needed
        │   ├── Browser automation
        │   ├── File operations
        │   ├── External API calls
        │   └── Data processing

        │
        ├── Store intermediate results
        │
        ├── Return AgentRun ID with status
        │
        └─► Response to Frontend

    │
    ├── Frontend receives run ID
    │
    ├── GET /agent-run/{agent_run_id}/stream
    │
    ├── Open WebSocket/SSE connection
    │
    └─► Display real-time agent updates

        Backend (Stream Handler)
        │
        ├── Poll or stream agent run status
        │
        ├── Send intermediate results
        │
        └── Send final completion status

    │
    └── Frontend displays final agent response
```

---

### Billing & Subscription Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ BILLING & SUBSCRIPTION FLOW                                             │
└─────────────────────────────────────────────────────────────────────────┘

Frontend: User clicks "Upgrade"
│
├── GET /subscription [Check current status]
│
├── POST /create-checkout-session
│   ├── stripe_price_id
│   └── billing_cycle

    Backend
    │
    ├── Validate user account
    │
    ├── Create Stripe session
    │
    └─► Return checkout URL

│
├── Redirect to Stripe checkout
│
└─► User enters payment info

    Stripe
    │
    ├── Process payment
    │
    ├── Create subscription
    │
    └─► Webhook to Backend

        Backend (Webhook Handler)
        │
        ├── POST /webhook [Stripe event]
        │
        ├── Validate webhook signature
        │
        ├── Update subscription in DB
        │   ├── Activate subscription
        │   ├── Set plan tier
        │   ├── Calculate credits
        │   └── Store payment method
        │
        ├── Trigger welcome email
        │
        └── Update user account

    │
    └── Email notification to user

Frontend
│
├── User returns from checkout
│
├── GET /subscription [Verify upgrade]
│
├── Display subscription details
│
└── Show available credits
```

---

### Trigger Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ TRIGGER EXECUTION FLOW                                                  │
└─────────────────────────────────────────────────────────────────────────┘

Frontend: User creates trigger via /dashboard/triggers
│
├── POST /agents/{agent_id}/triggers
│   ├── trigger_type (schedule/webhook/event)
│   ├── schedule (cron pattern)
│   ├── trigger_config
│   └── enabled

    Backend (Trigger Service)
    │
    ├── Create trigger in DB
    │
    ├── Register with scheduler
    │   ├── Redis pub/sub
    │   └── Cron job
    │
    └─► Return trigger details

│
└── Frontend displays trigger confirmation

    Time passes...

    Backend Scheduler (Background Job)
    │
    ├── Monitor triggers at scheduled times
    │
    ├── Check if trigger conditions met
    │
    ├── POST /agent/start [Automatically]
    │   ├── agent_id
    │   ├── trigger_id
    │   └── auto_execute: true
    │
    ├── Agent runs (see Agent Execution Flow)
    │
    ├── Store run results
    │
    └── Optional: Send notification to user

Frontend: User checks /dashboard/triggers
│
├── GET /agents/{agent_id}/upcoming-runs
│
├── Display:
│   ├── Next scheduled run
│   ├── Recent run history
│   └── Last run results
│
└── Can view detailed run: GET /agent-run/{agent_run_id}
```

---

### Composio Integration Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ COMPOSIO INTEGRATION FLOW                                               │
└─────────────────────────────────────────────────────────────────────────┘

Frontend: User goes to integrations settings
│
├── GET /composio/categories [Load available integrations]
│
├── GET /composio/toolkits [List toolkits]
│
└── Display integration options

User: Clicks "Connect GitHub"
│
├── POST /composio/integrate
│   ├── toolkit_slug: "github"
│   └── user_credentials

    Backend (Composio Handler)
    │
    ├── Verify toolkit available
    │
    ├── Create Composio connection
    │   ├── OAuth redirect if needed
    │   └── Store connection token
    │
    ├── Create Composio profile
    │
    └─► Return profile_id

│
├── Optional: OAuth redirect to GitHub
│
└── User authorizes access

Backend: After authorization
│
├── Store authorized connection
│
├── POST /discover-tools/{profile_id} [Async]
│
└── Index available tools

Frontend: Integration setup complete
│
├── GET /composio/profiles [Verify integration]
│
├── Display:
│   ├── Connected integrations
│   ├── Available tools
│   └── Configuration options
│
└── User can now use tools in agents

Agent Execution with Composio Tools
│
├── When agent runs with enabled Composio tools
│
├── LLM requests tool execution
│
├── Backend calls Composio API
│   ├── Execute action via toolkit
│   ├── Handle OAuth tokens
│   └── Return results
│
└── Agent incorporates results in response
```

---

## Authentication & Session Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ AUTHENTICATION & SESSION MANAGEMENT                                     │
└─────────────────────────────────────────────────────────────────────────┘

Unauthenticated User
│
├── Visit / (landing page)
│   └── Accessible
│
├── Try to visit /dashboard
│   └── Redirect to /auth

Frontend: /auth page
│
├── Display login options:
│   ├── Email/password
│   ├── GitHub OAuth
│   ├── Google OAuth
│   └── Phone verification
│
└── User selects login method

User: Enters credentials
│
├── Frontend validates input
│
├── POST to Supabase Auth API
│   ├── email & password
│   └── or OAuth provider

    Supabase
    │
    ├── Authenticate user
    │
    ├── Generate JWT tokens
    │   ├── Access token (short-lived)
    │   └── Refresh token (long-lived)
    │
    └─► Return tokens

Frontend: Receives tokens
│
├── Store in secure cookie
│
├── Set Authorization header
│
├── Redirect to /dashboard

Backend: Every subsequent request
│
├── Extract Authorization header
│   └── "Bearer {token}"
│
├── Validate token with Supabase
│
├── Get user context
│   ├── user_id
│   ├── account_id
│   ├── subscription_tier
│   └── permissions
│
└── Process request with user context

Token Refresh
│
├── If access token expires
│
├── Frontend detects 401 response
│
├── POST /token/refresh
│   ├── refresh_token
│   └── user_id
│
├── Supabase issues new access token
│
└── Retry original request

User Logout
│
├── Frontend clears cookies
│
├── POST /logout [Optional backend cleanup]
│
├── Clear local storage
│
└── Redirect to /
```

---

## Rate Limiting & Performance

```
┌─────────────────────────────────────────────────────────────────────────┐
│ RATE LIMITING & PERFORMANCE OPTIMIZATION                                │
└─────────────────────────────────────────────────────────────────────────┘

Request arrives at Backend
│
├── IP Rate Limiting
│   ├── Track by client IP
│   ├── Max 25 concurrent IPs
│   └── Reject if exceeded
│
├── User Validation
│   └── Check authentication
│
├── Credit-Based Rate Limiting
│   ├── Check user credit balance
│   ├── Calculate operation cost
│   ├── Check against limits
│   └── Reject if insufficient credits
│
├── Tier-Based Rate Limiting
│   ├── Subscription tier determines:
│   │   ├── Requests per minute
│   │   ├── Max concurrent runs
│   │   └── API call limits
│   └── Enforce limits
│
└── Process request

Response
│
├── Deduct credits
│
├── Log usage
│
├── Cache where applicable (Redis)
│
└── Return to client

Caching Strategy
│
├── Frontend
│   ├── React Query caching
│   ├── Browser cache
│   └── Local storage
│
├── Backend
│   ├── Redis cache for:
│   │   ├── Agent configs
│   │   ├── Tool definitions
│   │   ├── User sessions
│   │   └── Frequently accessed data
│   │
│   └── Database query optimization
│       ├── Indexes on:
│       │   ├── user_id
│       │   ├── agent_id
│       │   ├── thread_id
│       │   └── subscription_id
│       │
│       └── Connection pooling
│
└── CDN (Vercel)
    └── Static asset caching
```

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ DEPLOYMENT ARCHITECTURE                                                 │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                         EDGE/CDN LAYER (Vercel)                         │
│  - Static asset caching                                                 │
│  - Next.js server functions                                             │
│  - Request routing                                                      │
└──────────────────────────────────────────────────────────────────────────┘
                                 │
                        HTTP Requests
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
    ┌────▼────────┐      ┌───────▼──────┐      ┌─────────▼─┐
    │   Frontend  │      │   Backend    │      │  Mobile  │
    │  (Vercel)   │      │  (Docker/K8s)│      │ (Stores) │
    └─────────────┘      └───────┬──────┘      └──────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
              Database      Cache       Workers
              Supabase      Redis       Background
              PostgreSQL               Jobs
```

---

*Last Updated: November 2, 2025*
*For more details, see NETWORK_MAP.md*
