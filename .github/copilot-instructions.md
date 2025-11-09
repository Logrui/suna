# GitHub Copilot Instructions for Suna

## Documentation Constraints (HARD LIMIT)

**⚠️ CRITICAL: Maximum 3 markdown files per request - This is a hard limit, not a guideline.**
**⚠️ CRITICAL: NEVER CREATE FILES OR ADDITIONAL BEFORE ASKING THE USER - IF THE USER ASKS FOR ONE NEW DOC - CREATE ONLY ONE NEW DOC**
**⚠️ CRITICAL: ALWAYS SUMMARIZE IN CHAT FINDINGS OR INVESTIGATIONS BY DEFAULT UNLESS EXPLICIT USER REQUESTS OTHERWISE**


- **Never create more than 3 markdown files per request** - Consolidate instead
- **Check total count first** - Count existing docs before creating new ones
- **If at 3 files, merge** - Don't add a 4th file; consolidate existing content
- **Avoid redundancy** - Each file must serve a distinct, non-overlapping purpose
- **Descriptive names** - Use clear filenames: `QUICK_REFERENCE.md`, `COMPLETE_GUIDE.md`, `TROUBLESHOOTING.md`
- **Quality over quantity** - 3 well-organized files > 8 scattered files with overlap

**Additional constraint files:**
- See `.github/instructions/documentation.instructions.md` for detailed documentation rules
- See `CLAUDE.md` in repository root for AI agent-specific guidelines

## Project Overview

Suna is a full-stack AI agent productivity platform with:
- **Backend:** Python FastAPI with Supabase integration
- **Frontend:** Next.js React with real-time WebSocket connections
- **Mobile:** React Native apps
- **Architecture:** Microservices with Docker Compose orchestration
- **Database:** PostgreSQL via Supabase with RLS policies

## Specific to this Fork
- This fork includes custom fixes for agent chat timeouts and WebSocket security issues
- Adds additional features and cutting edge ai framework technologies
- Hosted locally at kortix.syhc.dev via cloudflare tunnel
- Supabase and Suna are self hosted in docker containers via Windows 11 Docker Desktop

## Key Technical Constraints

### WebSocket/Realtime
- HTTPS pages MUST use `wss://` protocol (not `ws://`)
- `NEXT_PUBLIC_REALTIME_URL` is a build-time environment variable, must be set in Docker build args
- Kong API Gateway handles reverse proxy for HTTP APIs but NOT WebSocket upgrades
- Cloudflare Tunnel auto-upgrades HTTP→HTTPS but NOT WebSocket protocols

### Build and Deployment
- Docker builds use build-time environment variables via `ARG` in Dockerfile
- Frontend: Always rebuild with `--no-cache` when environment variables change
- Tests: Run `pytest` from `backend/` directory
- Linting: Use ESLint for frontend, Python linters for backend

### Git Workflow
- Main branch: `dev` (default)
- Feature branches: `feature/*`
- Fixes: `localfix/*` or `fix/*`
- Synced branches should be merged/rebased regularly to avoid drift

## Common Issues

1. **WebSocket fails on HTTPS:** Verify `NEXT_PUBLIC_REALTIME_URL` is HTTPS-based
2. **Build args not applied:** Check Dockerfile has `ARG` declaration before `ENV`
3. **Docker changes not reflected:** Use `--no-cache` flag when rebuilding
