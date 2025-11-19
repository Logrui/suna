# Notifications System Implementation Plan

## Objective
Implement the notifications system from upstream branch `2025-10-31-vr4n-bc257` into `feature/notifications-system`

## Branch Information
- **Source Branch**: `upstream/2025-10-31-vr4n-bc257` (kortix-ai/suna)
- **Target Branch**: `feature/notifications-system` (created from feature/workflows-playbooks)
- **Base Branch**: `feature/workflows-playbooks` (Logrui/suna)

## Exclusions
- `apps/mobile/` - Ignored as per requirements
- `apps/mobile_old/` - Ignored as per requirements

## Analysis Summary

### New Files Identified (28 files)
Files that exist in upstream but not in current branch - these need to be copied:

#### Backend Files (5 files)
1. `backend/core/admin/notification_admin_api.py` - Admin API for notifications
2. `backend/core/services/notification_api.py` - User-facing notification API
3. `backend/core/services/notification_service.py` - Core notification service logic
4. `backend/supabase/migrations/20251030140049_account_deletion.sql` - Account deletion migration
5. `backend/supabase/migrations/20251031141213_notifications_system.sql` - Notifications system migration

#### Documentation Files (4 files)
6. `docs/EXPO_PUSH_NOTIFICATIONS_EXPLAINED.md` - Expo push notifications explanation
7. `docs/EXPO_PUSH_NOTIFICATIONS_SETUP.md` - Setup guide for push notifications
8. `docs/NOTIFICATION_EMAIL_TEMPLATE.md` - Email template documentation
9. `docs/PUSH_NOTIFICATION_AUTHENTICATION_FLOW.md` - Auth flow documentation

#### Frontend Files (19 files)

**Admin Pages:**
10. `frontend/src/app/(dashboard)/admin/notifications/page.tsx` - Admin notifications page
11. `frontend/src/app/(dashboard)/admin/page.tsx` - Main admin page

**User Pages:**
12. `frontend/src/app/(dashboard)/notifications/page.tsx` - User notifications page

**Thread Components:**
13. `frontend/src/app/(dashboard)/projects/[projectId]/thread/_components/UpgradeDialog.tsx`
14. `frontend/src/app/(dashboard)/projects/[projectId]/thread/_components/index.ts`

**Thread Hooks:**
15. `frontend/src/app/(dashboard)/projects/[projectId]/thread/_hooks/index.ts`
16. `frontend/src/app/(dashboard)/projects/[projectId]/thread/_hooks/useBilling.ts`
17. `frontend/src/app/(dashboard)/projects/[projectId]/thread/_hooks/useKeyboardShortcuts.ts`
18. `frontend/src/app/(dashboard)/projects/[projectId]/thread/_hooks/useThreadData.ts`
19. `frontend/src/app/(dashboard)/projects/[projectId]/thread/_hooks/useToolCalls.ts`

**Admin Components:**
20. `frontend/src/components/admin/admin-notification-batch-dialog.tsx`
21. `frontend/src/components/admin/admin-notification-batch-list.tsx`
22. `frontend/src/components/admin/admin-notification-form.tsx`

**Notification Components:**
23. `frontend/src/components/notifications/notification-bell.tsx`
24. `frontend/src/components/notifications/notification-item.tsx`
25. `frontend/src/components/notifications/notification-list.tsx`

**React Query Hooks:**
26. `frontend/src/hooks/react-query/admin/use-admin-notifications.ts`
27. `frontend/src/hooks/react-query/notifications/keys.ts`
28. `frontend/src/hooks/react-query/notifications/use-notifications.ts`

### Modified Files To Review
Files that exist in both branches and may have notifications-related changes - these need manual review and integration.

## Implementation Steps

### Phase 1: Setup ✓
- [x] Clone repository
- [x] Add upstream remote
- [x] Fetch branches
- [x] Create feature/notifications-system branch
- [x] Create this plan document

### Phase 2: New Files Integration
- [ ] Copy all 28 new files from upstream branch
- [ ] Verify file integrity

### Phase 3: Modified Files Analysis
- [ ] Identify common files that have been modified in upstream
- [ ] Filter for notifications-related changes
- [ ] Document specific changes needed

### Phase 4: Manual Integration
- [ ] Review each modified file
- [ ] Implement notifications-related code changes
- [ ] Ensure no breaking changes to existing functionality

### Phase 5: Verification & Commit
- [ ] Review all changes
- [ ] Test integration points
- [ ] Commit changes with descriptive message
- [ ] Push to feature/notifications-system branch

## Next Steps
1. Copy all 28 new files from upstream
2. Analyze modified files for notifications-related changes
3. Create detailed checklist of files to modify
4. Implement changes systematically

## Notes
- DO NOT use merge, rebase, or checkout commands that would overwrite existing modified files
- Focus on manual integration to preserve existing work in feature/notifications-system
- Prioritize frontend and backend changes, ignore mobile apps
