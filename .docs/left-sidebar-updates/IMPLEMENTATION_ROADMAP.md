# Knowledge Base Sidebar - Implementation Roadmap

**Date:** November 2, 2025  
**Branch:** `feature/knowledge-sidebar`  
**Status:** Ready to implement  

---

## ✅ DECISIONS CONFIRMED

### 1. URL Sync Logic - SEPARATE ROUTES ✅
- `/triggers` → `activeView = 'starred'`
- `/knowledge` → `activeView = 'knowledge'`
- **Action:** Fix URL sync in sidebar-left.tsx

### 2. Component Structure - FOLLOW PATTERN ✅
- "All Folders & Files" link at top (like "All Triggers")
- Recent Files section (last 5 files)
- All folders list below
- **Pattern Reference:** NavGlobalConfig.tsx

### 3. Display Limits - SHOW ALL ✅
- Remove `.slice()` on folders
- Show ALL folders (scrollable)
- Show last 5 recent files
- **Reason:** Better UX, container is scrollable

### 4. Recent Files Section - INCLUDE ✅
- Show 5 most recent files
- Display above folder list
- **Layout:** Browse All → Recent Files → All Folders

### 5. Badge Display - CONDITIONAL ✅
- Only show badge when `count > 0`
- **Styling:** `variant="secondary" className="text-xs h-5 px-1.5"`

### 6. URL Parameters - SIMPLE ROUTE ✅
- Navigate to `/knowledge` (no tab param)
- Can add folder/file params later
- **Focus:** Main knowledge base content only

### 7. Empty State - KEEP SIMPLE ✅
- Message: "No folders yet"
- Subtitle: "Create folders in Knowledge Base"

---

## 🚨 Issues to Address

### Issue 1: Badge Component Import ✅
**Status:** Will verify during implementation  
**Priority:** Low  
**Action:** Check if Badge exists, import if available

### Issue 2: URL Sync Conflict ✅
**Status:** MUST FIX  
**Priority:** HIGH  
**Action:** Update useEffect in sidebar-left.tsx:
```typescript
// OLD (WRONG):
if (pathname?.includes('/triggers') || pathname?.includes('/knowledge')) {
  setActiveView('starred');
}

// NEW (CORRECT):
if (pathname?.includes('/triggers')) {
  setActiveView('starred');
} else if (pathname?.includes('/knowledge')) {
  setActiveView('knowledge');
}
```

### Issue 3: Data Fetching Pattern ✅
**Status:** MAINTAIN CONSISTENCY  
**Priority:** Medium  
**Decision:** Check existing sidebar patterns first
- NavAgents: React Query ✅
- NavAgentsView: React Query ✅
- NavGlobalConfig: React Query ✅
- NavKnowledgeBase: Match pattern (likely React Query)

**Action:** Check if useKnowledgeFolders uses React Query or needs conversion

---

## 🎯 Final Component Structure

```
NavKnowledgeBase
├─ Section Header: "Knowledge Base"
├─ Browse All Link: "All Folders & Files" → /knowledge
├─ Recent Files Section (if files exist)
│  ├─ Header: "Recent Files (5)"
│  └─ File Items (last 5 files)
├─ Folders Section
│  ├─ Header: "All Folders"
│  └─ Folder Items (all folders, scrollable)
└─ Empty State (if no folders)
```

---

## 📋 CONCRETE IMPLEMENTATION STEPS

### STEP 1: Verify Data Hook Pattern (5 min)
**File to check:** `frontend/src/hooks/react-query/knowledge-base/use-folders.ts`

**Actions:**
1. Read the file to understand current implementation
2. Check if it uses React Query or raw useEffect
3. Compare with NavAgents/NavAgentsView patterns
4. Decide if conversion needed

**Expected Result:**
- Know exact hook API: `const { folders, recentFiles, loading } = useKnowledgeFolders()`
- Know if it matches React Query pattern or needs update

---

### STEP 2: Create NavKnowledgeBase Component (30-45 min)
**File to create:** `frontend/src/components/sidebar/nav-knowledge-base.tsx`

**Sub-steps:**
1. Copy template from KNOWLEDGE_IMPLEMENTATION_PLAN.md
2. Add all imports (verify Badge component exists)
3. Create sub-components:
   - `DateGroupHeader`
   - `FolderItem`
   - `FileItem` 
   - `LoadingSkeleton`
   - `EmptyState`
4. Implement main component with:
   - Data fetching via useKnowledgeFolders()
   - Navigation handlers
   - Render logic for all sections

**Key Code Sections:**

```typescript
// Data fetching
const { folders, recentFiles, loading } = useKnowledgeFolders();

// Active state tracking
const activeFolderId = searchParams.get('folder');
const activeFileId = searchParams.get('file');

// Navigation handlers
const handleBrowseAll = () => {
  router.push('/knowledge');
  if (isMobile) setOpenMobile(false);
};

const handleFolderClick = (folderId: string) => {
  router.push(`/knowledge?folder=${folderId}`);
  if (isMobile) setOpenMobile(false);
};

const handleFileClick = (entryId: string, folderId: string) => {
  router.push(`/knowledge?folder=${folderId}&file=${entryId}`);
  if (isMobile) setOpenMobile(false);
};
```

**Render Order:**
1. "All Folders & Files" link
2. Recent Files section (if recentFiles.length > 0)
3. All Folders section (if folders.length > 0)
4. Empty state (if folders.length === 0 && !loading)
5. Loading state (if loading)

---

### STEP 3: Integrate into Sidebar (15 min)
**File to edit:** `frontend/src/components/sidebar/sidebar-left.tsx`

**Changes needed:**

**3a. Add Import (line ~12)**
```typescript
import { NavKnowledgeBase } from '@/components/sidebar/nav-knowledge-base';
```

**3b. Update URL Sync Logic (line ~207-210)**
```typescript
// OLD:
useEffect(() => {
  if (pathname?.includes('/triggers') || pathname?.includes('/knowledge')) {
    setActiveView('starred');
  }
}, [pathname]);

// NEW:
useEffect(() => {
  if (pathname?.includes('/triggers')) {
    setActiveView('starred');
  } else if (pathname?.includes('/knowledge')) {
    setActiveView('knowledge');
  }
}, [pathname]);
```

**3c. Replace Placeholder (line ~532-537)**
```typescript
// OLD:
{activeView === 'knowledge' && (
  <div className="p-4 text-center text-muted-foreground">
    <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
    <p className="text-sm">Knowledge Base placeholder</p>
  </div>
)}

// NEW:
{activeView === 'knowledge' && <NavKnowledgeBase />}
```

---

### STEP 4: Test Basic Functionality (15 min)

**4a. Manual Testing:**
- [ ] Sidebar shows when clicking "Knowledge" button
- [ ] Loading skeleton appears while fetching
- [ ] Folders render with correct names and counts
- [ ] Recent files render (if any exist)
- [ ] "All Folders & Files" link works
- [ ] Clicking folder navigates to /knowledge?folder=ID
- [ ] Clicking file navigates to /knowledge?folder=ID&file=ID
- [ ] Mobile sidebar closes on navigation
- [ ] Active states highlight correctly

**4b. Check Console:**
- [ ] No TypeScript errors
- [ ] No runtime errors
- [ ] Data fetches successfully
- [ ] Navigation works

**4c. Edge Cases:**
- [ ] Empty state shows when no folders
- [ ] Works with 0 folders
- [ ] Works with 1 folder
- [ ] Works with 10+ folders
- [ ] Long folder names truncate
- [ ] Long file names truncate

---

### STEP 5: Polish & Accessibility (15 min)

**5a. Add ARIA Labels:**
```typescript
<div 
  className="flex items-center gap-3 p-2.5 text-sm" 
  onClick={onClick}
  role="button"
  tabIndex={0}
  aria-label={`Open ${folder.name} folder`}
>
```

**5b. Add Keyboard Navigation:**
```typescript
onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    onClick();
  }
}}
```

**5c. Error Handling:**
```typescript
const { folders, recentFiles, loading, error } = useKnowledgeFolders();

if (error) {
  return <ErrorState message="Failed to load knowledge base" />;
}
```

---

## 🗂️ Files Involved

### Files to CREATE:
```
✨ frontend/src/components/sidebar/nav-knowledge-base.tsx (NEW)
```

### Files to MODIFY:
```
📝 frontend/src/components/sidebar/sidebar-left.tsx
   - Add import
   - Fix URL sync logic  
   - Replace placeholder
```

### Files to REFERENCE:
```
📖 frontend/src/components/sidebar/nav-global-config.tsx (pattern)
📖 frontend/src/components/sidebar/nav-agents.tsx (pattern)
📖 frontend/src/hooks/react-query/knowledge-base/use-folders.ts (data)
```

---

## ⏱️ Time Estimate

| Step | Task | Time |
|------|------|------|
| 1 | Verify data hook pattern | 5 min |
| 2 | Create NavKnowledgeBase component | 45 min |
| 3 | Integrate into sidebar | 15 min |
| 4 | Test functionality | 15 min |
| 5 | Polish & accessibility | 15 min |
| **TOTAL** | **End-to-end implementation** | **~90 min** |

---

## ✅ Implementation Checklist

### Pre-Implementation
- [ ] Review this roadmap
- [ ] Have NavGlobalConfig open for reference
- [ ] Have use-folders.ts open for reference
- [ ] Verify Badge component exists

### Phase 1: Data Hook
- [ ] Read use-folders.ts implementation
- [ ] Verify hook returns: folders, recentFiles, loading
- [ ] Check if React Query or useEffect
- [ ] Note any differences from other hooks

### Phase 2: Component Creation
- [ ] Create nav-knowledge-base.tsx file
- [ ] Add all imports (verify each one)
- [ ] Create DateGroupHeader sub-component
- [ ] Create FolderItem sub-component
- [ ] Create FileItem sub-component
- [ ] Create LoadingSkeleton sub-component
- [ ] Create EmptyState sub-component
- [ ] Implement main NavKnowledgeBase component
- [ ] Add data fetching
- [ ] Add navigation handlers
- [ ] Add render logic

### Phase 3: Integration
- [ ] Import NavKnowledgeBase in sidebar-left.tsx
- [ ] Fix URL sync logic (split triggers/knowledge)
- [ ] Replace knowledge placeholder
- [ ] Save all files

### Phase 4: Testing
- [ ] Start dev server (if not running)
- [ ] Navigate to dashboard
- [ ] Click "Knowledge" button in sidebar
- [ ] Verify component renders
- [ ] Test "All Folders & Files" link
- [ ] Test folder click navigation
- [ ] Test file click navigation (if files exist)
- [ ] Test mobile behavior
- [ ] Test empty state (if no folders)
- [ ] Check browser console for errors

### Phase 5: Polish
- [ ] Add ARIA labels to interactive elements
- [ ] Add keyboard navigation support
- [ ] Add error handling
- [ ] Test accessibility (tab navigation)
- [ ] Verify TypeScript types
- [ ] Format code

---

## 🚀 Ready to Start?

**Next Command:** Begin with Step 1 - Verify data hook pattern

```bash
# Open the data hook file to understand its implementation
code frontend/src/hooks/react-query/knowledge-base/use-folders.ts
```

**Then proceed to Step 2:** Create the NavKnowledgeBase component

---

## 📝 Code Template Reference

**Full component template is available in:**
`KNOWLEDGE_IMPLEMENTATION_PLAN.md` (lines 800-1000)

**Key sections to copy:**
1. Imports block
2. Sub-component definitions (DateGroupHeader, FolderItem, etc.)
3. Main component structure
4. Data fetching logic
5. Navigation handlers
6. Render JSX

---

**Status:** ✅ READY TO IMPLEMENT  
**Branch:** feature/knowledge-sidebar  
**Next Step:** STEP 1 - Verify data hook pattern
