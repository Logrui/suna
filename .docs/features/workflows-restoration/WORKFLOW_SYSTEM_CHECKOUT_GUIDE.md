# Workflow System Branch Checkout Guide

## Branch Information

**Branch Name:** `workflow-system-before-removal`  
**Commit:** `c62ea282` (refactor: remove deprecated code and endpoints)  
**Date:** Before October 5, 2025 refactor  
**Status:** ✅ All workflow and playbook system files present

---

## How to Switch Branches

You're now on the `workflow-system-before-removal` branch! To verify:

```powershell
cd "D:\Homelab\suna-main\suna"
git branch
git log --oneline -1
```

Expected output should show:
```
* workflow-system-before-removal
c62ea282 refactor: remove deprecated code and endpoints
```

---

## What's Included on This Branch

### ✅ Workflow System Files (PRESENT)

**Backend:**
- `backend/core/tools/agent_builder_tools/workflow_tool.py` - 571 lines of workflow tool definitions
- `backend/core/triggers/` - Full workflow trigger support
- `backend/supabase/migrations/` - 8 workflow migration files:
  - `20250417000000_workflow_system.sql`
  - `20250418000000_workflow_flows.sql`
  - `20250705155923_rollback_workflows.sql`
  - `20250705161610_agent_workflows.sql`
  - `20250705164211_fix_agent_workflows.sql`
  - `20250706130554_simplify_workflow_steps.sql`
  - `20250708034613_add_steps_to_workflows.sql`
  - `20250723093053_fix_workflow_policy_conflicts.sql`
  - `20250726180605_remove_old_workflow_sys.sql`
  - `20250814184554_add_workflows_to_config.sql`

**Frontend Workflow Components:**
- `frontend/src/app/(dashboard)/agents/config/[agentId]/workflow/[workflowId]/page.tsx`
- `frontend/src/app/(dashboard)/agents/config/[agentId]/workflow/layout.tsx`
- `frontend/src/app/api/webhooks/trigger/[workflowId]/route.ts`
- `frontend/src/components/agents/workflows/` (2 files)
  - `agent-workflows-configuration.tsx`
  - `conditional-workflow-builder.tsx`
- `frontend/src/components/thread/tool-views/` (6 files)
  - `activate-agent-workflow/`
  - `create-agent-workflow/`
  - `list-agent-workflows/`
- `frontend/src/components/workflows/` (13 files)
  - `CredentialProfileSelector.tsx`
  - `MCPConfigurationDialog.tsx`
  - `animated-flow-line.tsx`
  - `workflow-builder.tsx`
  - `workflow-definitions.ts`
  - `workflow-execution-dialog.tsx`
  - `workflow-header.tsx`
  - `workflow-layout.tsx`
  - `workflow-side-panel.tsx`
  - `steps/` components
  - `hooks/` utilities
  - Tests and utilities

**Frontend Workflow Hooks:**
- `frontend/src/hooks/react-query/agents/conditional-workflow-types.ts` - 318 lines
- `frontend/src/hooks/react-query/agents/use-agent-workflows.ts` - 97 lines
- `frontend/src/hooks/react-query/agents/workflow-builder.ts` - 446 lines
- `frontend/src/hooks/react-query/agents/workflow-keys.ts` - 6 lines
- `frontend/src/hooks/react-query/agents/workflow-prompt-builder.ts` - 338 lines
- `frontend/src/hooks/react-query/agents/workflow-utils.ts` - 340 lines

### ✅ Playbooks System Files (PRESENT)

- `frontend/src/components/agents/playbooks/agent-playbooks-configuration.tsx`
- `frontend/src/components/playbooks/playbook-create-modal.tsx`
- `frontend/src/components/playbooks/playbook-execute-dialog.tsx`
- `frontend/src/components/playbooks/token-editor.tsx`
- `frontend/src/components/playbooks/token-textarea.tsx`

---

## Key Workflow Features on This Branch

### Workflow Management
- Complete workflow builder interface
- Workflow configuration dialogs
- Workflow step definitions and management
- Workflow execution tracking
- Workflow execution dialogs

### Playbooks Integration
- Playbook creation and management
- Playbook execution
- Token editors for playbook configuration
- Agent playbooks configuration

### Database Support
- `agent_workflows` table fully functional
- Workflow step management in database
- Workflow execution tracking
- Migration history for workflow system

### API Endpoints
- Workflow CRUD operations
- Workflow execution endpoints
- Workflow webhook triggers (`/api/webhooks/trigger/[workflowId]`)
- Composio integration with workflow routing

### Frontend Features
- Playbooks tab in agent configuration
- Playbooks button in chat input
- Workflow builder UI components
- Conditional workflow support
- Workflow execution visualization

---

## Next Steps to Explore

### 1. View the Workflow Tool Implementation
```powershell
code backend/core/tools/agent_builder_tools/workflow_tool.py
```

### 2. Check Workflow Database Migrations
```powershell
ls backend/supabase/migrations/ | Select-String workflow
```

### 3. Explore Workflow Frontend Components
```powershell
cd frontend/src/components/workflows/
ls
```

### 4. Review Workflow Types
```powershell
code frontend/src/hooks/react-query/agents/conditional-workflow-types.ts
```

### 5. Check Playbooks Components
```powershell
ls frontend/src/components/playbooks/
```

---

## Compare with Current State

To see exactly what was removed, you can compare this branch with `main`:

```powershell
# Show all deleted files
git diff --name-only main..workflow-system-before-removal --diff-filter=D | Select-String workflow

# Show the refactor commit that removed workflows
git show 0ec17b0d
```

---

## Important Notes

⚠️ **This branch is a point-in-time snapshot** - Do not push changes to this branch to remote unless you intend to preserve the workflow system state.

### To Go Back to Current Main:
```powershell
git checkout main
git stash pop  # If you had stashed changes
```

### To Create a Feature Branch from This:
```powershell
git checkout -b feature/restore-workflow-system
# Make your changes
git commit -am "feat: restore workflow system"
```

### To Compare File-by-File:
```powershell
# Compare workflow_tool.py between branches
git diff main..workflow-system-before-removal -- backend/core/tools/agent_builder_tools/workflow_tool.py

# Compare all workflow files
git diff main..workflow-system-before-removal -- '*.workflow*'
```

---

## Branch History

```
c62ea2823 (HEAD -> workflow-system-before-removal) refactor: remove deprecated code and endpoints
8b7bc36d5 refactor: consolidate duplicate account lookup logic
538389797 refactor: remove redundant code - eliminate 7 workspace_path duplications
98e9196d4 refactor: simplify backend - fix naming conflicts and centralize DB dependencies
8d7e85de4 refactor: massive backend simplification - eliminate 450+ lines of duplicate code
```

The **next commit** `0ec17b0d` on the main branch is: `refactor: completely remove workflow and playbook system`

---

## File Count Summary

- **50+ Workflow-related files** present and intact
- **5 Playbooks-related files** present and intact
- **10 Database migration files** with full workflow history
- **6 Custom React Query hooks** for workflow management
- **13+ Workflow UI components** ready to explore

---

## Quick Reference Commands

```powershell
# Check current branch
git branch

# View workflow files
git ls-files | Select-String workflow

# View playbook files
git ls-files | Select-String playbook

# See what was removed in next commit
git diff HEAD~1 --stat

# Go to specific workflow file
code frontend/src/components/workflows/workflow-builder.tsx

# Check workflow database schema (view migration files)
type backend/supabase/migrations/20250814184554_add_workflows_to_config.sql
```

---

## Summary

You now have access to the complete workflow and playbook system as it existed before the October 5, 2025 refactor. Explore the code, study the architecture, and understand how the system worked before it was simplified to agent-only execution.

All 50+ workflow files and 5 playbook files are available for review and modification on this branch.
