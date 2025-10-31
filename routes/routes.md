# Suna Routes Documentation

**Date:** October 31, 2025
**Version:** 0.1.0
**Status:** Complete Frontend Route Mapping

---

## Table of Contents

1. [Authentication Routes](#authentication-routes)
2. [Dashboard Routes](#dashboard-routes)
3. [Agent Management Routes](#agent-management-routes)
4. [Project Routes](#project-routes)
5. [Settings Routes](#settings-routes)
6. [Knowledge Base Routes](#knowledge-base-routes)
7. [Triggers Routes](#triggers-routes)
8. [Documentation Routes](#documentation-routes)
9. [Public Routes](#public-routes)
10. [API Routes](#api-routes)
11. [Admin Routes](#admin-routes)
12. [Team/Account Routes](#teamaccount-routes)
13. [Special Routes](#special-routes)

---

## Authentication Routes

### `/auth`
- **Type:** Page
- **Component:** `frontend/src/app/auth/page.tsx`
- **Description:** Main authentication/login page
- **Features:** Email/password login, OAuth providers (GitHub, etc.)
- **Access:** Public (redirects to dashboard if already authenticated)

### `/auth/phone-verification`
- **Type:** Page
- **Component:** `frontend/src/app/auth/phone-verification/page.tsx`
- **Description:** Phone number verification during signup
- **Access:** Public (part of signup flow)

### `/auth/reset-password`
- **Type:** Page
- **Component:** `frontend/src/app/auth/reset-password/page.tsx`
- **Description:** Password reset flow
- **Access:** Public

### `/auth/github-popup`
- **Type:** Page
- **Component:** `frontend/src/app/auth/github-popup/page.tsx`
- **Description:** GitHub OAuth popup handler
- **Features:** OAuth callback handling
- **Access:** Public

### `/master-login`
- **Type:** Page
- **Component:** `frontend/src/app/master-login/page.tsx`
- **Description:** Admin/master login for system administration
- **Access:** Admin only

---

## Dashboard Routes

### `/dashboard`
- **Type:** Page
- **Component:** `frontend/src/app/(dashboard)/dashboard/page.tsx`
- **Description:** Main dashboard - landing page after login
- **Features:** Create new projects, quick start, recent activity
- **Access:** Authenticated users

### `/` (after login)
- **Type:** Layout
- **Component:** `frontend/src/app/(dashboard)/layout.tsx`
- **Description:** Main dashboard layout wrapper
- **Features:** Sidebar, navigation, layout structure
- **Access:** Authenticated users

---

## Agent Management Routes

### `/agents`
- **Type:** Page
- **Component:** `frontend/src/app/(dashboard)/agents/page.tsx`
- **Description:** Agent marketplace and management
- **Layout:** `frontend/src/app/(dashboard)/agents/layout.tsx`
- **Features:** Browse, create, manage agents
- **Query Params:** `?tab=my-agents` (default) or `?tab=marketplace`
- **Access:** Authenticated users

### `/agents/[threadId]`
- **Type:** Dynamic Page
- **Component:** `frontend/src/app/(dashboard)/agents/[threadId]/page.tsx`
- **Layout:** `frontend/src/app/(dashboard)/agents/[threadId]/layout.tsx`
- **Description:** Individual agent thread/conversation view
- **Features:** Agent execution, message history, tool interactions
- **Access:** Authenticated users

### `/agents/[threadId]/redirect-page`
- **Type:** Internal
- **Component:** `frontend/src/app/(dashboard)/agents/[threadId]/redirect-page.tsx`
- **Description:** Redirect handler for agent URLs
- **Access:** Authenticated users

---

## Project Routes

### `/projects/[projectId]/thread/[threadId]`
- **Type:** Dynamic Page
- **Component:** `frontend/src/app/(dashboard)/projects/[projectId]/thread/[threadId]/page.tsx`
- **Layout:** `frontend/src/app/(dashboard)/projects/[projectId]/thread/[threadId]/layout.tsx`
- **Description:** Project-specific thread view
- **Features:** Project context, threaded conversations, file management
- **Access:** Authenticated users (with project access)

---

## Knowledge Base Routes

### `/knowledge`
- **Type:** Page
- **Component:** `frontend/src/app/(dashboard)/knowledge/page.tsx`
- **Description:** Knowledge base management and document storage
- **Features:** Upload documents, manage KB, search functionality
- **Access:** Authenticated users

---

## Triggers Routes

### `/triggers`
- **Type:** Page
- **Component:** `frontend/src/app/(dashboard)/triggers/page.tsx`
- **Description:** Scheduled triggers and webhook configuration
- **Features:** Create triggers, manage schedules, webhook URLs
- **Access:** Authenticated users

---

## Settings Routes

### Personal Account Settings

#### `/settings`
- **Type:** Page
- **Component:** `frontend/src/app/(dashboard)/(personalAccount)/settings/page.tsx`
- **Layout:** `frontend/src/app/(dashboard)/(personalAccount)/settings/layout.tsx`
- **Description:** Personal account settings overview
- **Access:** Authenticated users

#### `/settings/billing`
- **Type:** Page
- **Component:** `frontend/src/app/(dashboard)/(personalAccount)/settings/billing/page.tsx`
- **Description:** Billing and subscription management
- **Features:** Payment methods, subscription plans, invoices
- **Access:** Authenticated users

#### `/settings/transactions`
- **Type:** Page
- **Component:** `frontend/src/app/(dashboard)/(personalAccount)/settings/transactions/page.tsx`
- **Description:** Transaction history
- **Access:** Authenticated users

#### `/settings/teams`
- **Type:** Page
- **Component:** `frontend/src/app/(dashboard)/(personalAccount)/settings/teams/page.tsx`
- **Description:** Team management for personal account
- **Access:** Authenticated users

#### `/settings/env-manager`
- **Type:** Page
- **Component:** `frontend/src/app/(dashboard)/(personalAccount)/settings/env-manager/page.tsx`
- **Description:** Environment variable manager (local development)
- **Features:** Manage .env variables locally
- **Access:** Authenticated users (local mode only)

### Global Settings

#### `/settings/credentials`
- **Type:** Page
- **Component:** `frontend/src/app/(dashboard)/settings/credentials/page.tsx`
- **Layout:** `frontend/src/app/(dashboard)/settings/credentials/layout.tsx`
- **Description:** API credentials and integrations
- **Features:** Connect external services (Composio, MCP, etc.)
- **Access:** Authenticated users

#### `/settings/api-keys`
- **Type:** Page
- **Component:** `frontend/src/app/(dashboard)/settings/api-keys/page.tsx`
- **Layout:** `frontend/src/app/(dashboard)/settings/api-keys/layout.tsx`
- **Description:** API key management
- **Features:** Create, revoke, manage API keys for programmatic access
- **Access:** Authenticated users (Admin only)

---

## Team/Account Routes

### Team Dashboard

#### `/[accountSlug]`
- **Type:** Dynamic Page
- **Component:** `frontend/src/app/(dashboard)/(teamAccount)/[accountSlug]/page.tsx`
- **Description:** Team account dashboard
- **Parameters:** `accountSlug` - URL-friendly team identifier
- **Access:** Team members

### Team Settings

#### `/[accountSlug]/settings`
- **Type:** Page
- **Component:** `frontend/src/app/(dashboard)/(teamAccount)/[accountSlug]/settings/page.tsx`
- **Layout:** `frontend/src/app/(dashboard)/(teamAccount)/[accountSlug]/settings/layout.tsx`
- **Description:** Team settings overview
- **Access:** Team admins/owners

#### `/[accountSlug]/settings/billing`
- **Type:** Page
- **Component:** `frontend/src/app/(dashboard)/(teamAccount)/[accountSlug]/settings/billing/page.tsx`
- **Description:** Team billing settings
- **Features:** Team subscription, payment methods
- **Access:** Team admins/billing managers

#### `/[accountSlug]/settings/members`
- **Type:** Page
- **Component:** `frontend/src/app/(dashboard)/(teamAccount)/[accountSlug]/settings/members/page.tsx`
- **Description:** Team member management
- **Features:** Add/remove members, manage roles
- **Access:** Team admins/owners

---

## Documentation Routes

### `/docs`
- **Type:** Page
- **Component:** `frontend/src/app/docs/page.tsx`
- **Layout:** `frontend/src/app/docs/layout.tsx`
- **Description:** Documentation hub
- **Access:** Public

### `/docs/introduction`
- **Type:** Page
- **Component:** `frontend/src/app/docs/introduction/page.tsx`
- **Description:** Getting started guide
- **Access:** Public

### `/docs/self-hosting`
- **Type:** Page
- **Component:** `frontend/src/app/docs/self-hosting/page.tsx`
- **Description:** Self-hosting installation guide
- **Access:** Public

### `/docs/contributing`
- **Type:** Page
- **Component:** `frontend/src/app/docs/contributing/page.tsx`
- **Description:** Contributing guidelines
- **Access:** Public

### `/docs/architecture`
- **Type:** Page
- **Component:** `frontend/src/app/docs/architecture/page.tsx`
- **Description:** System architecture documentation
- **Access:** Public

### `/docs/license`
- **Type:** Page
- **Component:** `frontend/src/app/docs/license/page.tsx`
- **Description:** License information
- **Access:** Public

---

## Public Routes

### Homepage

#### `/`
- **Type:** Page
- **Component:** `frontend/src/app/(home)/page.tsx`
- **Layout:** `frontend/src/app/(home)/layout.tsx`
- **Description:** Landing page / homepage
- **Features:** Marketing content, call-to-action
- **Access:** Public

#### `/enterprise`
- **Type:** Page
- **Component:** `frontend/src/app/(home)/enterprise/page.tsx`
- **Description:** Enterprise plans and solutions
- **Access:** Public

#### `/changelog`
- **Type:** Page
- **Component:** `frontend/src/app/(home)/changelog/page.tsx`
- **Description:** Product changelog and updates
- **Access:** Public

### Legal & Info

#### `/legal`
- **Type:** Page
- **Component:** `frontend/src/app/legal/page.tsx`
- **Description:** Legal information (Terms, Privacy)
- **Access:** Public

### Shared Content

#### `/share/[threadId]`
- **Type:** Dynamic Page
- **Component:** `frontend/src/app/share/[threadId]/page.tsx`
- **Layout:** `frontend/src/app/share/[threadId]/layout.tsx`
- **Description:** Public shared thread view
- **Features:** View shared conversations without authentication
- **Parameters:** `threadId` - Shared thread identifier
- **Access:** Public

#### `/templates/[shareId]`
- **Type:** Dynamic Page
- **Component:** `frontend/src/app/templates/[shareId]/page.tsx`
- **Layout:** `frontend/src/app/templates/[shareId]/layout.tsx`
- **Description:** Shared template view
- **Features:** Preview and use shared agent templates
- **Parameters:** `shareId` - Shared template identifier
- **Access:** Public

### Billing & Subscription

#### `/checkout`
- **Type:** Page
- **Component:** `frontend/src/app/checkout/page.tsx`
- **Description:** Checkout page for purchases
- **Features:** Payment processing
- **Access:** Authenticated users

#### `/subscription`
- **Type:** Page
- **Component:** `frontend/src/app/subscription/page.tsx`
- **Description:** Subscription management
- **Access:** Authenticated users

#### `/activate-trial`
- **Type:** Page
- **Component:** `frontend/src/app/activate-trial/page.tsx`
- **Description:** Trial activation page
- **Access:** Public (for trial signup)

---

## Admin Routes

### `/admin/billing`
- **Type:** Page
- **Component:** `frontend/src/app/(dashboard)/admin/billing/page.tsx`
- **Description:** Admin billing management dashboard
- **Features:** View all user billings, manage subscriptions
- **Access:** Admin users only

---

## API Routes

### `/api/og/template`
- **Type:** API Route
- **Component:** `frontend/src/app/api/og/template/route.tsx`
- **Description:** Open Graph image generation API
- **Method:** GET/POST
- **Access:** Public

### `/api/share-page/og-image`
- **Type:** API Route
- **Component:** `frontend/src/app/api/share-page/og-image/route.tsx`
- **Description:** Generate OG images for shared pages
- **Method:** GET/POST
- **Access:** Public

---

## Special Routes

### Team Invitations

#### `/invitation`
- **Type:** Page
- **Component:** `frontend/src/app/invitation/page.tsx`
- **Description:** Team invitation acceptance page
- **Features:** Accept invitations to teams
- **Access:** Public (with token validation)

### Testing/Demo Routes

#### `/composio-test`
- **Type:** Page
- **Component:** `frontend/src/app/(dashboard)/composio-test/page.tsx`
- **Description:** Composio integration testing
- **Status:** Development/Testing page
- **Access:** Authenticated users (debug)

#### `/model-pricing`
- **Type:** Page
- **Component:** `frontend/src/app/(dashboard)/model-pricing/page.tsx`
- **Description:** Model pricing display
- **Status:** Development/Testing page
- **Access:** Authenticated users (debug)

#### `/onboarding-demo`
- **Type:** Page
- **Component:** `frontend/src/app/(dashboard)/onboarding-demo/page.tsx`
- **Description:** Onboarding flow demonstration
- **Status:** Development/Testing page
- **Access:** Authenticated users (debug)

### Error Pages

#### `/not-found`
- **Type:** Error Page
- **Component:** `frontend/src/app/not-found.tsx`
- **Description:** 404 Not Found page
- **Access:** All users

#### `/global-error`
- **Type:** Error Page
- **Component:** `frontend/src/app/global-error.tsx`
- **Description:** Global error boundary
- **Access:** All users

---

## Route Structure Summary

### By Protection Level

#### Public Routes (No Auth Required)
- `/` (homepage)
- `/auth`, `/auth/phone-verification`, `/auth/reset-password`
- `/docs/*`
- `/legal`
- `/changelog`
- `/enterprise`
- `/share/[threadId]` (public share)
- `/templates/[shareId]` (public template)
- `/invitation`
- `/activate-trial`

#### Authenticated Routes (Login Required)
- `/dashboard/*`
- `/agents*`
- `/projects/*`
- `/knowledge`
- `/triggers`
- `/settings/*`
- `/checkout`
- `/subscription`

#### Admin Routes (Admin Role Required)
- `/admin/*`
- `/settings/api-keys`
- `/master-login`

### By Functionality

#### Core Features
- **Projects:** `/projects/[projectId]/thread/[threadId]`
- **Agents:** `/agents`, `/agents/[threadId]`
- **Knowledge Base:** `/knowledge`
- **Triggers:** `/triggers`
- **Dashboard:** `/dashboard`

#### Account Management
- **Settings:** `/settings/*`
- **Team:** `/[accountSlug]/*`
- **Billing:** `/settings/billing`, `/[accountSlug]/settings/billing`
- **Credentials:** `/settings/credentials`
- **API Keys:** `/settings/api-keys`

#### Sharing & Collaboration
- **Share Thread:** `/share/[threadId]`
- **Share Template:** `/templates/[shareId]`
- **Invitations:** `/invitation`

---

## Upcoming Routes

Based on sidebar buttons added recently:

### `/conversations` (Planned)
- **Status:** Route added to sidebar, implementation pending
- **Description:** Conversation management and history
- **Expected:** List and manage all conversations

### `/workspaces` (Planned)
- **Status:** Route added to sidebar, implementation pending
- **Description:** Workspace/project organization
- **Expected:** Manage multiple workspaces

---

## Development Notes

### Route Groups
The app uses Next.js route groups (parentheses) for organization:
- `(dashboard)` - Protected dashboard routes
- `(personalAccount)` - Personal account settings
- `(teamAccount)` - Team account settings
- `(home)` - Public home/marketing pages

### Dynamic Routes
- `[threadId]` - Individual conversation/thread
- `[projectId]` - Individual project
- `[accountSlug]` - Team identifier
- `[shareId]` - Shared resource identifier

### Protected Routes
Routes under `(dashboard)` are protected by middleware that:
1. Checks user authentication
2. Validates Supabase session
3. Redirects unauthenticated users to `/auth`

### API Integration
- Backend API: `http://localhost:8000/api` (in Docker) or `http://localhost:8000/api` (local)
- Supabase Auth: Uses NextAuth via Supabase
- Real-time subscriptions: Via Supabase Realtime

---

## Testing Route Access

To verify routes are working:

```bash
# Frontend development server
npm run dev  # http://localhost:3000

# Test authentication flow
curl http://localhost:3000/auth

# Test dashboard (requires valid session)
curl -b "auth_token=..." http://localhost:3000/dashboard

# Test API routes
curl http://localhost:3000/api/og/template?title=Test
```

---

## Sidebar Navigation

Current sidebar buttons:
1. **New Task** → `/dashboard`
2. **Conversations** → `/conversations` (new, pending)
3. **Triggers** → `/triggers`
4. **Knowledge Base** → `/knowledge`
5. **Workspaces** → `/workspaces` (new, pending)
6. **Agents** → Collapsible
   - My Agents → `/agents?tab=my-agents`
   - New Agent → Opens dialog

---

**Last Updated:** October 31, 2025
**Total Routes:** 50+ public/authenticated routes
**Status:** ✅ Comprehensive documentation complete
