# Dev Branch Sync Review Plan - Oct 31, 2025

## Overview
After merging `main` into `dev` with `theirs` strategy, we preserved 58 critical self-hosted files. Now we need to selectively review each file to determine which upstream changes to accept.

## Strategy
For each file:
1. Review the diff between `main` and `dev`
2. Decide: Keep dev version, take main version, or manually merge
3. Cherry-pick specific changes as needed

## Modified Files to Review (58 total)

### Backend Files (13) - ✅ ALL REVIEWED - KEEP ALL (WITH NOTE ON agent_runs.py)
**All files contain critical self-hosted configurations. agent_runs.py needs error handling from main merged in.**

- [✅] backend/.gitignore (Minor: Added .docs/ exclusion - KEEP)
- [✅] backend/core/agent_runs.py (LOCAL mode billing bypass + error handling from main - MERGED ✅)
- [✅] backend/core/agentpress/response_processor.py (Trace null checks for local deployments - KEEP)
- [✅] backend/core/billing/billing_integration.py (Debug logging for LOCAL mode detection - KEEP)
- [✅] backend/core/knowledge_base/api.py (100GB file limit for self-hosted - KEEP)
- [✅] backend/core/knowledge_base/file_processor.py (100GB file limit for self-hosted - KEEP)
- [✅] backend/core/sandbox/docker/docker-compose.yml (Custom forked Docker image - KEEP)
- [✅] backend/core/tools/sb_kb_tool.py (100GB file limit for self-hosted - KEEP)
- [✅] backend/core/tools/sb_upload_file_tool.py (100GB file limit for self-hosted - KEEP)
- [✅] backend/core/utils/config.py (Custom Docker image references - KEEP)
- [✅] backend/run_agent_background.py (Trace null checks for local deployments - KEEP)
- [✅] backend/supabase/config.toml (100GB storage limits for self-hosted - KEEP)
- [✅] docker-compose.yaml (Complete self-hosted deployment config - KEEP)

### Frontend Config Files (3)
- [ ] frontend/Dockerfile
- [ ] frontend/next.config.ts
- [ ] setup.py

### Frontend Pages/Layouts (8) - ✅ REVIEWED - KEEP ALL (CRITICAL AUTH LOGIC)
**Most files have critical self-hosted auth flow and Supabase integration - DO NOT UPDATE FROM MAIN**

- [✅] frontend/src/app/(dashboard)/agents/page.tsx (UI: Added subagents placeholder - KEEP)
- [✅] frontend/src/app/api/og/template/route.tsx (Uses getApiUrl() for OG image generation - KEEP)
- [✅] frontend/src/app/auth/actions.ts (Uses getApiUrl() for welcome email - KEEP)
- [✅] frontend/src/app/auth/page.tsx (CRITICAL: Direct Supabase client auth + session sync - KEEP)
- [✅] frontend/src/app/layout.tsx (Removed Vercel Analytics (good for self-hosting) - KEEP)
- [✅] frontend/src/app/master-login/page.tsx (Uses getApiUrl() for admin auth - KEEP)
- [✅] frontend/src/app/templates/[shareId]/layout.tsx (Uses getApiUrl() for metadata - KEEP)
- [✅] frontend/src/app/templates/[shareId]/page.tsx (Uses getApiUrl() for template fetch - KEEP)

### Frontend Components (15)
- [✅] frontend/src/components/agents/custom-agents-page/tabs-navigation.tsx
- [✅] frontend/src/components/agents/mcp/custom-mcp-dialog.tsx
- [✅] frontend/src/components/knowledge-base/knowledge-base-manager.tsx
- [✅] frontend/src/components/knowledge-base/knowledge-base-page.tsx (Tab system + databases placeholder - KEEP; removed showRecentFiles)
- [✅] frontend/src/components/knowledge-base/unified-kb-entry-modal.tsx
- [ ] frontend/src/components/sidebar/sidebar-left.tsx
- [ ] frontend/src/components/thread/chat-input/file-upload-handler.tsx
- [ ] frontend/src/components/thread/file-attachment.tsx
- [ ] frontend/src/components/thread/file-viewer-modal.tsx
- [ ] frontend/src/components/thread/tiptap-document-modal.tsx
- [ ] frontend/src/components/thread/tool-views/docs-tool/DocsToolView.tsx
- [ ] frontend/src/components/thread/tool-views/docs-tool/ListDocumentsToolView.tsx
- [ ] frontend/src/components/thread/tool-views/presentation-tools/ListPresentationTemplatesToolView.tsx
- [ ] frontend/src/components/thread/tool-views/see-image-tool/_utils.ts
- [ ] frontend/src/components/thread/tool-views/sheets-tools/sheets-tool-view.tsx

### Frontend Hooks & Utils (22) - ✅ ALL REVIEWED AND APPROVED
**17 files with API URL routing only + 5 flagged files with critical self-hosted logic - ALL KEEPING**

- [✅] frontend/src/hooks/react-query/agents/use-agent-export-import.ts (API URL only)
- [✅] frontend/src/hooks/react-query/agents/use-agent-tools.ts (API URL only)
- [✅] frontend/src/hooks/react-query/agents/utils.ts (API URL only)
- [✅] frontend/src/hooks/react-query/files/use-file-mutations.ts (API URL only)
- [✅] frontend/src/hooks/react-query/files/use-file-queries.ts (API URL only)
- [✅] frontend/src/hooks/react-query/knowledge-base/use-knowledge-base-queries.ts (API URL only)
- [✅] frontend/src/hooks/react-query/mcp/use-credential-profiles.ts (API URL only)
- [✅] frontend/src/hooks/react-query/mcp/use-mcp-servers.ts (API URL only)
- [✅] frontend/src/hooks/react-query/secure-mcp/use-secure-mcp.ts (API URL only)
- [✅] frontend/src/hooks/react-query/threads/utils.ts (API URL only)
- [✅] frontend/src/hooks/react-query/triggers/use-agent-triggers.ts (API URL only)
- [✅] frontend/src/hooks/react-query/triggers/use-all-triggers.ts (API URL only)
- [✅] frontend/src/hooks/react-query/triggers/use-oauth-integrations.ts (API URL only)
- [✅] frontend/src/hooks/react-query/triggers/use-trigger-providers.ts (API URL only)
- [✅] frontend/src/hooks/use-image-content.ts (API URL only)
- [✅] frontend/src/lib/api-client.ts (API URL only)
- [✅] frontend/src/lib/versioning/infrastructure/api-client.ts (API URL only)
- [✅] frontend/src/hooks/use-cached-file.ts (API URL + file caching + 4 URL replacements - KEEP)
- [✅] frontend/src/lib/api.ts (API URL + error handling improvements - KEEP for debugging)
- [✅] frontend/src/lib/supabase/client.ts (Dynamic Supabase URL from window.location.origin - KEEP CRITICAL)
- [✅] frontend/src/lib/supabase/server.ts (Dynamic Supabase URL from headers - KEEP CRITICAL)
- [✅] frontend/src/middleware.ts (Dynamic Supabase URL routing + auth debug logging - KEEP CRITICAL)

## Review Process

### For Each File:
```bash
# View the diff
git diff main dev -- <filename>

# See what changed in main
git diff main HEAD~X -- <filename>

# Decide action:
# 1. KEEP dev (skip) - if dev version is better for self-hosting
# 2. TAKE main - if we need the upstream changes
# 3. MANUAL MERGE - if we need parts of both
```

## Completed Reviews

### ✅ Completed (30/58 files)
- **22 Frontend Hooks & Utils** - All approved
- **8 Frontend Pages/Layouts** - All approved  
- **13 Backend Files** - All approved (agent_runs.py needs error handling merge)

**Total Reviewed: 43 files (74%)**

### ⏳ Pending Review (28 files)
- **3 Frontend Config files** - Next
- **15 Frontend Components** - Later
- **10 remaining** - Final batch

## Special Task: agent_runs.py Error Handling ✅ COMPLETED

File: `backend/core/agent_runs.py`
- ✅ Merged error handling try/except from main into `get_active_agent_runs()` function
- ✅ Preserved LOCAL mode billing bypass from dev
- ✅ Function now has both self-hosted optimization AND error handling

## Next Steps

1. **MANUAL MERGE**: Edit `backend/core/agent_runs.py` to include:
   - LOCAL mode billing bypass from dev
   - Error handling from main
2. Review remaining 28 files (Frontend Config, Components)
3. For files where we want to accept main's changes:
   ```bash
   git checkout main -- <filename>
   git add <filename>
   git commit -m "Accept upstream changes for <filename>"
   ```
4. For files to keep as-is, leave unchanged

## Notes

- Self-hosted critical files: docker-compose.yaml, backend/supabase/config.toml, etc.
- Be cautious with API client files - may have important security updates
- Frontend component changes are likely safe to merge if they don't break self-hosting logic
