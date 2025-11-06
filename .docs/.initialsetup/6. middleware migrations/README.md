# Middleware Migrations - Documentation Index

**Complete documentation of the multi-domain Supabase URL detection solution**

---

## 📚 Documents in This Collection

### 1. **Complete Solution Overview**
📄 **File:** `0. Middleware Dynamic URL Fix - Complete Solution.md`

**Read this first!** Comprehensive explanation of:
- The problem (400 errors on Cloudflare)
- Root cause analysis
- Three-layer solution architecture
- Code implementation for each layer
- Verification and testing procedures

**Best for:** Understanding the full picture, troubleshooting issues

---

### 2. **Quick Reference Guide**
📄 **File:** `1. Quick Reference Guide.md`

**TL;DR version** with:
- What was broken and what we fixed
- Three-layer URL detection diagram
- Configuration checklist
- Quick deployment reference
- FAQ and troubleshooting matrix

**Best for:** Quick lookups, copying configurations, troubleshooting

---

### 3. **Implementation Details**
📄 **File:** `2. Implementation Details - Three-Layer Detection.md`

**Deep technical dive** covering:
- Browser client implementation
- Server client implementation
- Middleware implementation
- Header detection logic
- Request flow diagrams
- Integration examples
- Performance analysis

**Best for:** Understanding the "why" and "how", code review

---

### 4. **Deployment Guide**
📄 **File:** `3. Deployment Guide - New Environments.md`

**Practical guide** for deploying to new environments:
- 5 deployment scenarios with examples
- Step-by-step deployment process
- Environment variable reference
- Troubleshooting new deployments
- Migration checklist

**Best for:** Setting up new deployments, environment setup

---

## 🎯 Quick Navigation

### By Use Case

**I want to understand the solution:**
→ Start with `0. Complete Solution Overview`

**I need to deploy to a new environment:**
→ Use `3. Deployment Guide`

**I'm debugging an issue:**
→ Check `1. Quick Reference Guide` FAQ section

**I'm reviewing the code:**
→ Read `2. Implementation Details`

**I need a quick reminder:**
→ Use `1. Quick Reference Guide`

---

### By Topic

**Localhost Configuration:**
- `1. Quick Reference Guide` - Configuration checklist
- `3. Deployment Guide` - Scenario 1: Local Development

**Docker Configuration:**
- `0. Complete Solution Overview` - Section 5: Docker Environment
- `3. Deployment Guide` - Scenario 2: Docker Locally

**Cloud Deployment:**
- `3. Deployment Guide` - Scenario 3: Cloud Supabase

**Self-Hosted Supabase:**
- `3. Deployment Guide` - Scenario 4: Self-Hosted Supabase

**Kubernetes:**
- `3. Deployment Guide` - Scenario 5: Kubernetes Deployment

**Request Headers & Proxies:**
- `2. Implementation Details` - Section 2: Layer 2 Server Client
- `2. Implementation Details` - How Layers Work Together

---

## ✅ Problem Summary

**Issue:** Frontend worked on `localhost:3000` but failed on `https://kortix.syhc.dev` with Supabase 400 errors

**Root Cause:** Build-time environment variables hardcoded into rewrites, causing Supabase URL mismatch between local and Cloudflare deployments

**Solution:** Three-layer dynamic URL detection:
1. **Browser Client** - Uses `window.location.origin`
2. **Server Client** - Uses request headers
3. **Middleware** - Uses request headers for auth

---

## 🎓 Key Concepts

### Build-Time vs Runtime

| Aspect | When | Example |
|--------|------|---------|
| **Build-time** | During `docker build` | `NEXT_PUBLIC_SUPABASE_URL` in Dockerfile |
| **Runtime** | When request arrives | `x-forwarded-host` header detection |

**Solution uses both:**
- Build-time: Set correct internal URL per deployment
- Runtime: Detect actual request origin dynamically

### Environment Isolation

| Environment | Supabase URL | Frontend URL | Access Method |
|-------------|--------------|--------------|----------------|
| **Local Dev** | `localhost:8888` | `localhost:3000` | Direct |
| **Docker** | `supabase-kong:8000` | `localhost:3000` | Direct + Tunnel |
| **Production** | `project.supabase.co` | `yourdomain.com` | Domain + Proxy |

### Same-Origin Requests

Browser makes requests to `/auth/v1/*` (relative URLs), which:
- Always hit the same origin
- Preserve cookies correctly
- Avoid CORS issues
- Work from any domain

---

## 🔧 Implementation Summary

### Files Modified

| File | Change | Purpose |
|------|--------|---------|
| `frontend/next.config.ts` | Restored build-time rewrites | Define proxy routes with env vars |
| `frontend/.env.local` | Set localhost URLs | Local development config |
| `docker-compose.yaml` | Set Docker internal URLs | Container environment |
| `frontend/src/lib/supabase/client.ts` | Uses `window.location.origin` | Browser URL detection |
| `frontend/src/lib/supabase/server.ts` | Uses request headers | Server URL detection |
| `frontend/src/middleware.ts` | Uses request headers | Auth middleware URL detection |

### No Breaking Changes

All changes are backward compatible:
- Old code paths still work
- Fallback mechanisms in place
- Gradual migration possible

---

## 📊 Testing Guide

### Basic Test (Localhost)
```bash
npm run dev
# Visit http://localhost:3000
# Try to login
# Check console for errors
```

### Docker Test
```bash
docker compose up -d --build
# Visit http://localhost:3000
# Try to login
```

### Tunnel Test
```bash
# Visit https://kortix.syhc.dev
# Try to login
```

### Verification
- ✅ Login works
- ✅ Dashboard loads
- ✅ Data fetches
- ✅ No 400 errors
- ✅ Cookies set correctly
- ✅ Auth persists on page reload

---

## 🚀 Deployment Quick Start

### 1. Identify Your URLs
```
Supabase: http://supabase-kong:8000
Backend:  http://backend:8000/api
```

### 2. Update Build Config
```yaml
# docker-compose.yaml or Dockerfile
NEXT_PUBLIC_SUPABASE_URL=http://supabase-kong:8000
NEXT_PUBLIC_BACKEND_URL=http://backend:8000/api
```

### 3. Deploy
```bash
docker compose up -d --build
```

### 4. Test
- Visit your domain
- Try to login
- Verify data loads

---

## ❓ FAQ

**Q: Why is the same Docker image used for multiple domains?**
A: Runtime detection of request origin using headers handles both `localhost:3000` and `https://kortix.syhc.dev` identically.

**Q: Do I need to rebuild for each domain?**
A: No! The same image works for multiple domains. Just route traffic through different proxies.

**Q: What if my Supabase is cloud-hosted?**
A: Just set `NEXT_PUBLIC_SUPABASE_URL=https://project.supabase.co` and configure CORS in Supabase dashboard.

**Q: How does this work with reverse proxies?**
A: Proxies like Cloudflare Tunnel preserve `x-forwarded-*` headers, which the middleware uses.

**Q: Can I use this with self-hosted Supabase?**
A: Yes! Just use your internal hostname as `NEXT_PUBLIC_SUPABASE_URL`.

---

## 🔗 Related Documentation

**Original OAuth Setup:**
- `../5. proxy for oauth/5. proxy for oauth.md` - OAuth configuration
- `../5. proxy for oauth/6. Dynamic Middleware Routing - OAuth Success.md` - Middleware routing
- `../5. proxy for oauth/7. Backend API Proxy Fix.md` - Backend API proxy

**Other Setup Docs:**
- `../1. env and migrations/` - Environment setup
- `../2. oauth/` - OAuth provider configuration

---

## 📋 Checklist for New Developers

When onboarding new team members:

- [ ] Read `0. Complete Solution Overview` for context
- [ ] Check `1. Quick Reference Guide` for configuration
- [ ] Review `2. Implementation Details` for understanding code
- [ ] Test locally with `npm run dev`
- [ ] Test Docker with `docker compose up`
- [ ] Verify on Cloudflare Tunnel
- [ ] Ask questions in team channel

---

## 🆘 Troubleshooting Matrix

| Symptom | Document | Section |
|---------|----------|---------|
| 400 errors from Supabase | Quick Reference | Troubleshooting |
| Auth cookies not set | Complete Solution | Layer 1 Browser |
| Works locally, fails on Tunnel | Deployment Guide | Troubleshooting |
| Server-side auth fails | Implementation Details | Layer 3 Middleware |
| Unsure about deployment | Deployment Guide | Step-by-step guide |

---

## 📞 Support

For issues not covered in these docs:
1. Check Quick Reference FAQ
2. Review Troubleshooting sections
3. Check console logs in browser and Docker
4. Review middleware logs: `docker logs frontend`
5. Verify environment variables: `docker inspect frontend`

---

## 🏆 Key Achievements

✅ Single Docker image works on multiple domains  
✅ No code changes needed for new environments  
✅ Backward compatible  
✅ Production-ready  
✅ Fully documented  
✅ Troubleshooting guide included  

---

**Last Updated:** October 31, 2025  
**Status:** ✅ Complete and Production Ready  
**Complexity:** Advanced (but well documented!)  
**Time to Deploy:** 5-10 minutes per new environment  

---

## 🎉 Success Metrics

After implementing this solution:

- ✅ Same Docker image works on `localhost:3000` AND `https://kortix.syhc.dev`
- ✅ No DNS errors accessing Supabase
- ✅ Auth works correctly on both domains
- ✅ Cookies set with correct domain
- ✅ Zero deployment friction

---

**Happy Deploying!** 🚀
