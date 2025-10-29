# OAuth & Authentication in Suna Kortix

Suna uses a **hybrid authentication approach**: it combines **Supabase's standard authentication methods** with **custom extensions** for more advanced scenarios. Here's how it works:

## 1. 🔐 Primary Authentication Layer: Supabase Auth

### Standard Supabase Methods
Suna leverages Supabase's built-in authentication for **user login/signup**:

- **Email/Password**: Standard credential-based authentication
- **OAuth 2.0 Providers** (via Supabase):
  - **Google OAuth** - `signInWithOAuth({ provider: 'google' })`
  - **GitHub OAuth** - `signInWithOAuth({ provider: 'github' })`

### Frontend OAuth Flow
```typescript
// Frontend/src/components/GoogleSignIn.tsx
const handleGoogleSignIn = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback?returnUrl=...`,
    },
  });
};

// Frontend/src/components/GithubSignIn.tsx
// Similar implementation for GitHub
```

### OAuth Callback Handling
```typescript
// Frontend/src/app/auth/callback/route.ts
export async function GET(request: NextRequest) {
  const code = searchParams.get('code')
  
  // Exchange authorization code for session
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  
  // Redirect to dashboard on success
  return NextResponse.redirect(`${baseUrl}${next}`)
}
```

**Key Points:**
- Supabase handles the OAuth 2.0 flow server-side
- Frontend redirects user to Supabase auth endpoint → OAuth provider → back to callback
- Session is established via JWT tokens stored in cookies
- No custom OAuth implementation needed for user auth

---

## 2. 🎯 Custom Authentication Layer

Beyond Supabase's standard auth, Suna adds **custom authentication mechanisms**:

### JWT Token Verification
```python
# Backend/core/utils/auth_utils.py
async def verify_and_get_user_id_from_jwt(request: Request) -> str:
    auth_header = request.headers.get('Authorization')
    
    if not auth_header or not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="No valid auth credentials")
    
    token = auth_header.split(' ')[1]
    
    # Decode JWT without signature verification
    # (Supabase handles signature, we trust the token)
    payload = _decode_jwt_safely(token)
    user_id = payload.get('sub')  # Subject claim = user ID
    
    return user_id
```

### API Key Authentication
Suna implements **API key authentication** for programmatic access (SDK usage):

```python
# Backend/core/services/api_keys.py
class APIKeyService:
    """
    API Key authentication with HMAC-SHA256 hashing
    Performance optimizations:
    - HMAC-SHA256 hashing (100x faster than bcrypt)
    - Redis caching for validation (2min TTL)
    - Throttled last_used_at updates (15min intervals)
    """
    
    async def validate_api_key(self, public_key: str, secret_key: str):
        # Returns: APIKeyValidationResult(is_valid, account_id, key_id)
```

**API Key Format**: `pk_xxx:sk_xxx` (public:secret)

```python
# Usage in auth verification
if x_api_key:
    public_key, secret_key = x_api_key.split(':', 1)
    validation_result = await api_key_service.validate_api_key(
        public_key, 
        secret_key
    )
```

---

## 3. 🔗 Tool OAuth: Composio Integration

For **agent tools** (integrations with external services), Suna uses **Composio** as an OAuth broker:

### Connected Accounts & OAuth
```python
# Backend/core/composio_integration/
# - auth_config_service.py
# - connected_account_service.py

# Agents can authenticate with third-party services via Composio
# This handles OAuth for tools like:
# - Gmail, Google Sheets, Google Calendar
# - Slack, Salesforce, HubSpot
# - GitHub, GitLab, Jira
# - And 100+ other integrations
```

**Flow for Tool OAuth:**
1. User connects a tool (e.g., Slack) to their agent
2. Suna redirects to Composio's OAuth flow
3. User authorizes the integration
4. Composio stores the `connected_account_id`
5. Agents use this ID to authenticate tool requests

```python
# Backend/core/tools/agent_creation_tool.py
# Agents can query available authentication methods:
"OAuth Support": 'Yes' if 'OAUTH2' in toolkit_data.auth_schemes else 'No'
```

---

## 4. 🔑 Multi-Layer Authentication Summary

| Layer | Method | Use Case | Provider |
|-------|--------|----------|----------|
| **User Auth** | Email/Password | Manual signup/login | Supabase |
| **User Auth** | OAuth (Google, GitHub) | Social login | Supabase + Provider |
| **API Auth** | JWT Tokens | Server-to-server requests | Supabase/Custom |
| **SDK Auth** | API Keys (pk:sk) | Programmatic access | Custom (HMAC-SHA256) |
| **Tool Auth** | OAuth via Composio | Third-party integrations | Composio + Provider |

---

## 5. 🛡️ Authorization (Beyond Authentication)

Suna implements **role-based authorization**:

```python
# Backend/core/auth.py
def verify_role(required_role: str):
    async def role_checker(user: dict = Depends(get_current_user)) -> dict:
        # Query user_roles table
        result = await client.table('user_roles').select('role').eq(
            'user_id', user['user_id']
        ).execute()
        
        # Check role hierarchy: user < admin < super_admin
        role_hierarchy = {'user': 0, 'admin': 1, 'super_admin': 2}
        
        if role_hierarchy[user_role] < role_hierarchy[required_role]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    return role_checker

# Applied via dependencies
require_admin = verify_role('admin')
require_super_admin = verify_role('super_admin')
```

---

## 6. 🚀 How It All Works Together

```
┌─────────────────────────────────────────────────────────────────┐
│ AUTHENTICATION FLOW IN SUNA                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ USER LOGIN (Web/Mobile)                                          │
│   ↓                                                               │
│ Choose: Email/Password OR Google OAuth OR GitHub OAuth           │
│   ↓                                                               │
│ Supabase Auth Endpoint                                           │
│   ├─ Email/Pass: Direct validation                              │
│   └─ OAuth: Redirect to Provider → Back with code               │
│   ↓                                                               │
│ Exchange code for JWT (Supabase)                                │
│   ↓                                                               │
│ Store JWT in secure cookie (frontend)                           │
│   ↓                                                               │
│ Include JWT in Authorization header (subsequent requests)       │
│   ↓                                                               │
│ Backend: verify_and_get_user_id_from_jwt()                      │
│   ├─ Check JWT validity                                          │
│   ├─ Extract user ID from 'sub' claim                            │
│   ├─ Return user_id for authorization checks                    │
│   └─ Optional: Check role hierarchy                              │
│   ↓                                                               │
│ AGENT EXECUTION                                                  │
│   ├─ If using external tools (Slack, Gmail, etc.)               │
│   └─ Use Composio connected_account_id for OAuth                │
│                                                                   │
│ SDK/API ACCESS                                                   │
│   Alternative: Use API Key (pk_xxx:sk_xxx)                      │
│   ├─ Validate via APIKeyService (HMAC-SHA256)                   │
│   └─ Map to account_id → user_id                                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. ✅ Summary: Standard vs. Custom

| Aspect | Standard Supabase | Custom |
|--------|-------------------|--------|
| **User OAuth** | ✅ Yes (Google, GitHub) | ❌ No |
| **Email/Password** | ✅ Yes | ❌ No |
| **JWT Verification** | ✅ Supabase generates | ✅ Suna verifies |
| **API Keys** | ❌ No built-in | ✅ Custom implementation |
| **Role-Based Auth** | ⚠️ Minimal | ✅ Full hierarchy |
| **Tool OAuth** | ❌ No | ✅ Via Composio |
| **SSO** | ⚠️ Via FastAPI-SSO library | (Not deeply integrated) |

**Conclusion**: Suna uses **Supabase's standard OAuth for user authentication** (minimal custom work), but extends it with:
- Custom API key system (for SDKs)
- Custom role-based authorization
- Composio integration for tool-level OAuth

This is a pragmatic approach: **leverage Supabase for user auth, customize only where needed**.

---

## Key Files Reference

### Frontend Authentication
- `frontend/src/middleware.ts` - Route protection & auth middleware
- `frontend/src/app/auth/page.tsx` - Login/signup page
- `frontend/src/app/auth/actions.ts` - Server-side auth actions (signIn, signUp, forgotPassword)
- `frontend/src/app/auth/callback/route.ts` - OAuth callback handler
- `frontend/src/components/GoogleSignIn.tsx` - Google OAuth button
- `frontend/src/components/GithubSignIn.tsx` - GitHub OAuth button
- `frontend/src/app/auth/reset-password/page.tsx` - Password reset flow

### Backend Authentication
- `backend/core/auth.py` - FastAPI auth dependencies & role checking
- `backend/core/utils/auth_utils.py` - JWT verification, user ID extraction, authorization logic
- `backend/core/services/api_keys.py` - API key service (HMAC-SHA256 validation, Redis caching)
- `backend/core/services/api_keys_api.py` - API key management endpoints

### Tool OAuth & Integrations
- `backend/core/composio_integration/api.py` - Composio webhook handling & integration
- `backend/core/composio_integration/auth_config_service.py` - Tool authentication config
- `backend/core/composio_integration/connected_account_service.py` - Connected accounts management

### Configuration
- `backend/core/utils/config.py` - Environment variables for auth (Supabase keys, Composio API key, etc.)

---

## Environment Variables Required

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Backend (Supabase credentials)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OAuth Providers (configured in Supabase)
# - Google OAuth: Set up in Supabase Auth > Providers > Google
# - GitHub OAuth: Set up in Supabase Auth > Providers > GitHub

# Composio Integration
COMPOSIO_API_KEY=your-composio-api-key
COMPOSIO_WEBHOOK_SECRET=your-webhook-secret

# Admin Access
KORTIX_ADMIN_API_KEY=your-admin-api-key
```

---

## Security Considerations

1. **JWT Security**: Tokens are validated but signature verification delegates to Supabase
2. **API Keys**: HMAC-SHA256 hashing with Redis caching (no bcrypt for performance)
3. **Cookie Security**: Secure, httpOnly flags set by Supabase client
4. **Role-Based Access Control**: Hierarchy enforced at request level (user → admin → super_admin)
5. **Rate Limiting**: IP-based limiting (max 25 concurrent IPs per backend instance)
6. **OAuth Provider Security**: Delegated to Supabase and respective OAuth providers
7. **Tool OAuth**: Composio handles OAuth provider integration securely

---

## Testing & Development

### Local Development Setup
```bash
# Install dependencies
npm install  # frontend
cd backend && uv sync  # backend

# Set up Supabase
# Option 1: Use cloud Supabase (recommended for OAuth testing)
# Option 2: Use local Supabase (docker-compose supabase start)

# Set environment variables in .env.local

# Start frontend
npm run dev

# Start backend
cd backend && uv run uvicorn api:app --reload
```

### Testing OAuth Locally
- OAuth redirects require `localhost:3000` to be configured in provider settings
- Use ngrok for HTTPS tunneling if needed for webhooks
- Test with `/auth` page and click OAuth provider buttons

### Testing API Keys
```bash
# Create an API key via UI or directly in database
# Format: pk_xxx:sk_xxx

# Use in requests
curl -H "x-api-key: pk_xxx:sk_xxx" http://localhost:8000/api/agents
```

---

## Additional Resources

- [Supabase Authentication Docs](https://supabase.com/docs/guides/auth)
- [Composio Integration Docs](https://docs.composio.dev/)
- [FastAPI Security](https://fastapi.tiangolo.com/tutorial/security/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc7519)
