# Modified Files in Production Commit 71718d2d9cb49ea799990fabd42b6a545dbf169d

**Commit**: `71718d2d9cb49ea799990fabd42b6a545dbf169d`  
**Author**: Saumya  
**Date**: Sat Nov 15 20:08:02 2025 +0530  
**Message**: revamp app

**Total Modified Files**: 408
- Backend: 61
- Frontend: 210
- Other: 137

## Backend Files (10) - PRIORITY FOR STREAMING FIXES - NEEDS MANUAL REVIEW
- `backend/.env.example`  
- `backend/api.py`  
- `backend/core/api.py`  
- `backend/core/billing/api.py`  

- `backend/core/composio_integration/api.py`  
- `backend/core/limits_api.py`  
- `backend/core/knowledge_base/api.py`  

- `backend/core/triggers/api.py`  
- `backend/supabase/config.toml`  
- `backend/core/sandbox/docker/docker-compose.yml`  
---

## Backend Files (51) - PRIORITY FOR STREAMING FIXES - OK TO MERGE/CHERRY PICK WITH KEEP THEIRS

These are the critical files for chat completions and streaming:
- `backend/.gitignore`  

- `backend/core/agent_loader.py`  
- `backend/core/agent_runs.py`  
- `backend/core/agent_service.py`  
- `backend/core/agent_setup.py`  
- `backend/core/agent_tools.py`  
- `backend/core/agentpress/context_manager.py`  
- `backend/core/agentpress/error_processor.py`  
- `backend/core/agentpress/response_processor.py`  
- `backend/core/agentpress/thread_manager.py`  
- `backend/core/agentpress/xml_tool_parser.py`  
- `backend/core/ai_models/ai_models.py`  
- `backend/core/ai_models/manager.py`  
- `backend/core/ai_models/registry.py`  

- `backend/core/billing/billing_integration.py`  
- `backend/core/billing/config.py`  
- `backend/core/billing/free_tier_service.py`  
- `backend/core/billing/payment_service.py`  
- `backend/core/billing/setup_api.py`  
- `backend/core/billing/subscription_service.py`  
- `backend/core/billing/trial_service.py`  
- `backend/core/billing/webhook_service.py`  

- `backend/core/composio_integration/composio_profile_service.py`  
- `backend/core/credits.py`  

- `backend/core/knowledge_base/file_processor.py`  

- `backend/core/prompts/prompt.py`  
- `backend/core/run.py`  

- `backend/core/sandbox/sandbox.py`  
- `backend/core/services/email.py`  
- `backend/core/services/llm.py`  
- `backend/core/templates/utils.py`  
- `backend/core/threads.py`  

- `backend/core/tools/sb_files_tool.py`  
- `backend/core/tools/sb_kb_tool.py`  
- `backend/core/tools/sb_presentation_tool.py`  
- `backend/core/tools/sb_upload_file_tool.py`  
- `backend/core/tools/task_list_tool.py`  
- `backend/core/tools/tool_registry.py`  

- `backend/core/utils/auth_utils.py`  
- `backend/core/utils/config.py`  
- `backend/core/utils/icon_generator.py`  
- `backend/core/utils/limits_checker.py`  

- `backend/core/utils/message_sanitizer.py`  

- `backend/core/utils/project_helpers.py`  
- `backend/core/utils/scripts/fix_missing_subscription.py`  
- `backend/core/utils/tool_discovery.py`  
- `backend/run_agent_background.py`  

- `backend/supabase/migrations/20251102072712_enable_free_tier.sql`  
- `backend/supabase/migrations/20251102090935_revert_free_tier_grant.sql`  
- `backend/supabase/migrations/20251106090733_allow_negative_credits.sql`  
- `backend/supabase/migrations/20251106184128_tier_downgrade_fields.sql`  

---

## Frontend Files (16) - NEEDS MANUAL REVIEW
- `frontend/.env.example`  
- `frontend/Dockerfile`  
- `frontend/next.config.ts`  
- `frontend/package.json`  
- `frontend/package-lock.json`  
- `frontend/src/components/sidebar/sidebar-left.tsx`  

- `frontend/src/lib/api/projects.ts`  
- `frontend/src/lib/api/threads.ts`  
- `frontend/src/lib/api-client.ts`  

- `frontend/src/components/knowledge-base/knowledge-base-manager.tsx`  
- `frontend/src/components/knowledge-base/knowledge-base-page.tsx`  
- `frontend/src/components/knowledge-base/shared-kb-tree.tsx`  
- `frontend/src/components/knowledge-base/unified-kb-entry-modal.tsx`  

- `frontend/src/components/sidebar/thread-search-modal.tsx`  

- `frontend/src/components/ui/fancy-tabs.tsx`  

## Other Files (2) - NEEDS MANUAL REVIEW
- `docker-compose.yaml`  
- `frontend/src/middleware.ts`  

---

## Frontend Files (194) - UI/BILLING/COMPONENTS - OK TO MERGE/CHERRY PICK WITH KEEP THEIRS
- `frontend/public/manifest.json`  
- `frontend/public/plan-icons/basic.svg`  
- `frontend/public/plan-icons/plus.svg`  
- `frontend/public/plan-icons/pro.svg`  
- `frontend/public/plan-icons/ultra.svg`  
- `frontend/public/robots.txt`  

- `frontend/src/app/(dashboard)/admin/billing/page.tsx`  
- `frontend/src/app/(dashboard)/agents/[threadId]/redirect-page.tsx`  
- `frontend/src/app/(dashboard)/agents/config/[agentId]/page.tsx`  
- `frontend/src/app/(dashboard)/agents/config/[agentId]/screens/instructions-screen.tsx`  
- `frontend/src/app/(dashboard)/agents/config/[agentId]/screens/integrations-screen.tsx`  
- `frontend/src/app/(dashboard)/agents/config/[agentId]/screens/knowledge-screen.tsx`  
- `frontend/src/app/(dashboard)/agents/config/[agentId]/screens/tools-screen.tsx`  
- `frontend/src/app/(dashboard)/agents/config/[agentId]/screens/triggers-screen.tsx`  
- `frontend/src/app/(dashboard)/agents/config/[agentId]/screens/workflows-screen.tsx`  
- `frontend/src/app/(dashboard)/agents/page.tsx`  
- `frontend/src/app/(dashboard)/credits-explained/page.tsx`  
- `frontend/src/app/(dashboard)/model-pricing/page.tsx`  
- `frontend/src/app/(dashboard)/onboarding-demo/page.tsx`  

- `frontend/src/app/(dashboard)/settings/api-keys/page.tsx`  
- `frontend/src/app/(home)/enterprise/page.tsx`  
- `frontend/src/app/(home)/layout.tsx`  
- `frontend/src/app/(home)/page.tsx`  
- `frontend/src/app/activate-trial/page.tsx`  
- `frontend/src/app/auth/actions.ts`  
- `frontend/src/app/auth/callback/route.ts`  
- `frontend/src/app/auth/page.tsx`  
- `frontend/src/app/checkout/page.tsx`  
- `frontend/src/app/help/credits/page.tsx`  
- `frontend/src/app/help/layout.tsx`  
- `frontend/src/app/help/page.tsx`  
- `frontend/src/app/layout.tsx`  
- `frontend/src/app/legal/page.tsx`  
- `frontend/src/app/metadata.ts`  
- `frontend/src/app/not-found.tsx`  
- `frontend/src/app/setting-up/page.tsx`  
- `frontend/src/app/share/[threadId]/_components/SharePageWrapper.tsx`  
- `frontend/src/app/share/[threadId]/_components/ShareThreadLayout.tsx`  
- `frontend/src/app/share/[threadId]/layout.tsx`  
- `frontend/src/app/share/[threadId]/page.tsx`  
- `frontend/src/app/sitemap.ts`  
- `frontend/src/app/subscription/page.tsx`  
- `frontend/src/app/suna/page.tsx`  

- `frontend/src/components/admin/admin-user-details-dialog.tsx`  
- `frontend/src/components/admin/admin-user-table.tsx`  

- `frontend/src/components/agents/agent-configuration-dialog.tsx`  
- `frontend/src/components/agents/agent-count-limit-dialog.tsx`  
- `frontend/src/components/agents/agent-creation-modal.tsx`  
- `frontend/src/components/agents/agent-selector.tsx`  
- `frontend/src/components/agents/agents-grid.tsx`  
- `frontend/src/components/agents/AgentVersionManager.tsx`  
- `frontend/src/components/agents/agent-version-switcher.tsx`  

- `frontend/src/components/agents/composio/composio-app-card.tsx`  
- `frontend/src/components/agents/composio/composio-connections-section.tsx`  
- `frontend/src/components/agents/composio/composio-connector.tsx`  
- `frontend/src/components/agents/composio/composio-credential-profile-selector.tsx`  
- `frontend/src/components/agents/composio/composio-profile-selector.tsx`  
- `frontend/src/components/agents/composio/composio-registry.tsx`  
- `frontend/src/components/agents/composio/composio-tools-manager.tsx`  
- `frontend/src/components/agents/composio/composio-tools-selector.tsx`  

- `frontend/src/components/agents/config/agent-editor-dialog.tsx`  
- `frontend/src/components/agents/config/agent-icon-editor-dialog.tsx`  
- `frontend/src/components/agents/config/model-selector.tsx`  

- `frontend/src/components/agents/create-version-button.tsx`  
- `frontend/src/components/agents/custom-agents-page/publish-dialog.tsx`  
- `frontend/src/components/agents/custom-agents-page/tabs-navigation.tsx`  

- `frontend/src/components/agents/docs-agent/editor.tsx`  
- `frontend/src/components/agents/docs-agent/editor/controls/color-picker.tsx`  
- `frontend/src/components/agents/docs-agent/editor/controls/font-selector.tsx`  
- `frontend/src/components/agents/docs-agent/editor/controls/highlight-picker.tsx`  
- `frontend/src/components/agents/docs-agent/editor/controls/image-dialog.tsx`  
- `frontend/src/components/agents/docs-agent/editor/controls/link-dialog.tsx`  
- `frontend/src/components/agents/docs-agent/editor/controls/table-dropdown.tsx` 

- `frontend/src/components/agents/installation/streamlined-profile-connector.tsx`  
- `frontend/src/components/agents/json-import-dialog.tsx`  
- `frontend/src/components/agents/marketplace-agent-preview-dialog.tsx`  

- `frontend/src/components/agents/mcp/configured-mcp-list.tsx`  
- `frontend/src/components/agents/mcp/custom-mcp-dialog.tsx`  
- `frontend/src/components/agents/mcp/tools-manager.tsx`  

- `frontend/src/components/agents/new-agent-dialog.tsx`  
- `frontend/src/components/agents/tools/granular-tool-configuration.tsx`  
- `frontend/src/components/agents/tools/tool-groups.ts`  

- `frontend/src/components/agents/triggers/agent-triggers-configuration.tsx`  
- `frontend/src/components/agents/triggers/event-based-trigger-dialog.tsx`  
- `frontend/src/components/agents/triggers/one-click-integrations.tsx`  
- `frontend/src/components/agents/triggers/trigger-browse-dialog.tsx`  

- `frontend/src/components/agents/upcoming-runs-dropdown.tsx`  
- `frontend/src/components/agents/version-inline-editor.tsx`  
- `frontend/src/components/auth/background-aal-checker.tsx`  
- `frontend/src/components/auth/phone-verification/phone-verification-page.tsx`  

- `frontend/src/components/billing/credit-purchase.tsx`  
- `frontend/src/components/billing/credits-display.tsx`  
- `frontend/src/components/billing/credit-transactions.tsx`  
- `frontend/src/components/billing/credit-usage.tsx`  
- `frontend/src/components/billing/index.ts`  
- `frontend/src/components/billing/plan-utils.ts`  
- `frontend/src/components/billing/pricing/index.ts`  
- `frontend/src/components/billing/pricing/plan-selection-modal.tsx`  
- `frontend/src/components/billing/scheduled-downgrade-card.tsx`  
- `frontend/src/components/billing/subscription-cancellation-card.tsx`  
- `frontend/src/components/billing/thread-usage.tsx`  
- `frontend/src/components/billing/tier-badge.tsx`  

- `frontend/src/components/dashboard/custom-agents-section.tsx`  
- `frontend/src/components/dashboard/dashboard-content.tsx`  
- `frontend/src/components/dashboard/layout-content.tsx`  
- `frontend/src/components/dashboard/trial-management.tsx`  

- `frontend/src/components/file-renderers/authenticated-markdown-renderer.tsx`  
- `frontend/src/components/file-renderers/xlsx-renderer.tsx`  
- `frontend/src/components/GithubSignIn.tsx`  
- `frontend/src/components/help/help-search-modal.tsx`  
- `frontend/src/components/help/help-sidebar.tsx`  
- `frontend/src/components/home/theme-toggle.tsx`  

- `frontend/src/components/maintenance/maintenance-page.tsx`  
- `frontend/src/components/onboarding/index.ts`  
- `frontend/src/components/onboarding/onboarding-config.tsx`  
- `frontend/src/components/onboarding/onboarding-provider.tsx`  
- `frontend/src/components/settings/user-settings-modal.tsx`  

- `frontend/src/components/sidebar/kortix-enterprise-modal.tsx`  
- `frontend/src/components/sidebar/nav-agents.tsx`  
- `frontend/src/components/sidebar/nav-agents-view.tsx`  
- `frontend/src/components/sidebar/nav-global-config.tsx`  
- `frontend/src/components/sidebar/nav-trigger-runs.tsx`  
- `frontend/src/components/sidebar/nav-user-with-teams.tsx`  
- `frontend/src/components/sidebar/search-search.tsx`  
- `frontend/src/components/sidebar/share-modal.tsx`  

- `frontend/src/components/thread/agent-run-limit-dialog.tsx`  
- `frontend/src/components/thread/attachment-group.tsx`  

- `frontend/src/components/thread/chat-input/chat-input.tsx`  
- `frontend/src/components/thread/chat-input/file-upload-handler.tsx`  
- `frontend/src/components/thread/chat-input/unified-config-menu.tsx`  
- `frontend/src/components/thread/chat-input/usage-preview.tsx`  
- `frontend/src/components/thread/chat-input/voice-recorder.tsx`  

- `frontend/src/components/thread/content/agent-avatar.tsx`  
- `frontend/src/components/thread/content/PlaybackControls.tsx`  
- `frontend/src/components/thread/content/PlaybackFloatingControls.tsx`  
- `frontend/src/components/thread/content/ShowToolStream.tsx`  
- `frontend/src/components/thread/content/SimplePlaybackControls.tsx`  
- `frontend/src/components/thread/content/ThreadContent.tsx`  
- `frontend/src/components/thread/content/usePlaybackControls.tsx`  

- `frontend/src/components/thread/ContextUsageIndicator.tsx`  
- `frontend/src/components/thread/file-attachment.tsx`  
- `frontend/src/components/thread/file-browser.tsx`  
- `frontend/src/components/thread/file-viewer-modal.tsx`  
- `frontend/src/components/thread/HealthCheckedVncIframe.tsx`  
- `frontend/src/components/thread/layout/index.ts`  
- `frontend/src/components/thread/preview-renderers/file-preview-markdown-renderer.tsx`  
- `frontend/src/components/thread/preview-renderers/html-renderer.tsx`  
- `frontend/src/components/thread/ThreadComponent.tsx`  
- `frontend/src/components/thread/thread-site-header.tsx`  
- `frontend/src/components/thread/tiptap-document-modal.tsx`  

- `frontend/src/components/thread/tool-views/configure-agent-integration/configure-agent-integration.tsx`  
- `frontend/src/components/thread/tool-views/create-credential-profile-for-agent/create-credential-profile-for-agent.tsx`  
- `frontend/src/components/thread/tool-views/designer-tool/DesignerToolView.tsx`  
- `frontend/src/components/thread/tool-views/discover-mcp-tools-for-agent/discover-mcp-tools-for-agent.tsx`  
- `frontend/src/components/thread/tool-views/docs-tool/_utils.tsx`  
- `frontend/src/components/thread/tool-views/docs-tool/DocsToolView.tsx`  
- `frontend/src/components/thread/tool-views/docs-tool/ListDocumentsToolView.tsx`  
- `frontend/src/components/thread/tool-views/file-operation/FileEditToolView.tsx`  
- `frontend/src/components/thread/tool-views/file-operation/FileOperationToolView.tsx`  
- `frontend/src/components/thread/tool-views/presentation-tools/ExportToolView.tsx`  
- `frontend/src/components/thread/tool-views/presentation-tools/ListPresentationTemplatesToolView.tsx`  
- `frontend/src/components/thread/tool-views/presentation-tools/PresentationViewerProvider.tsx`  
- `frontend/src/components/thread/tool-views/search-mcp-servers-for-agent/search-mcp-servers-for-agent.tsx`  
- `frontend/src/components/thread/tool-views/see-image-tool/_utils.ts`  
- `frontend/src/components/thread/tool-views/sheets-tools/luckysheet-viewer.tsx`  
- `frontend/src/components/thread/tool-views/sheets-tools/sheets-tool-view.tsx`  
- `frontend/src/components/thread/tool-views/types.ts`  
- `frontend/src/components/thread/tool-views/utils/presentation-utils.ts`  
- `frontend/src/components/thread/tool-views/vapi-call/MakeCallToolView.tsx`  
- `frontend/src/components/thread/tool-views/vapi-call/MonitorCallToolView.tsx`  
- `frontend/src/components/thread/tool-views/wrapper/ToolViewRegistry.tsx`  

- `frontend/src/components/thread/types.ts`  

- `frontend/src/components/triggers/simplified-trigger-detail-panel.tsx`  
- `frontend/src/components/triggers/trigger-creation-dialog.tsx`  
- `frontend/src/components/triggers/triggers-page.tsx`  

- `frontend/src/components/ui/border-beam.tsx`  
- `frontend/src/components/ui/calendar.tsx`  
- `frontend/src/components/ui/date-range-picker.tsx`  
- `frontend/src/components/ui/editable.tsx`  
- `frontend/src/components/ui/kbd.tsx`  
- `frontend/src/components/ui/kortix-loader.tsx`  
- `frontend/src/components/ui/page-header.tsx`  
- `frontend/src/components/ui/sidebar.tsx`  
- `frontend/src/components/ui/status-overlay.tsx`  
- `frontend/src/components/ui/unified-agent-card.tsx`  

- `frontend/src/lib/config.ts`  
- `frontend/src/lib/email.ts`  
- `frontend/src/lib/error-handler.ts`  
- `frontend/src/lib/home.tsx`  
- `frontend/src/lib/model-provider-icons.tsx`  
- `frontend/src/lib/site.ts`  
- `frontend/src/lib/supabase/client.ts`  
- `frontend/src/lib/supabase/server.ts`  
- `frontend/src/lib/utils/credit-formatter.ts`  


---



