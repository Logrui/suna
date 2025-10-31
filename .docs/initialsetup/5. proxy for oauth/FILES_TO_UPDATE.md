# Files to Update - Backend API URL Fix

**Total Files:** 30 files  
**Total Occurrences:** 47 instances of `process.env.NEXT_PUBLIC_BACKEND_URL`

---

## 📁 File Categories

### **Category 1: Core API Clients (3 files)**
Primary API client files that need the centralized utility:

1. ✅ `frontend/src/lib/api.ts` - Main API client (already has getApiUrl, needs import update)
2. ⬜ `frontend/src/lib/api-client.ts` - API client wrapper
3. ⬜ `frontend/src/lib/versioning/infrastructure/api-client.ts` - Versioning API client

---

### **Category 2: React Query Hooks (13 files)**
React Query hooks for data fetching:

4. ⬜ `frontend/src/hooks/react-query/agents/utils.ts`
5. ⬜ `frontend/src/hooks/react-query/agents/use-agent-tools.ts`
6. ⬜ `frontend/src/hooks/react-query/agents/use-agent-export-import.ts`
7. ⬜ `frontend/src/hooks/react-query/files/use-file-queries.ts`
8. ⬜ `frontend/src/hooks/react-query/files/use-file-mutations.ts`
9. ⬜ `frontend/src/hooks/react-query/knowledge-base/use-knowledge-base-queries.ts`
10. ⬜ `frontend/src/hooks/react-query/mcp/use-mcp-servers.ts`
11. ⬜ `frontend/src/hooks/react-query/mcp/use-credential-profiles.ts`
12. ⬜ `frontend/src/hooks/react-query/secure-mcp/use-secure-mcp.ts`
13. ⬜ `frontend/src/hooks/react-query/threads/utils.ts`
14. ⬜ `frontend/src/hooks/react-query/triggers/use-agent-triggers.ts`
15. ⬜ `frontend/src/hooks/react-query/triggers/use-all-triggers.ts`
16. ⬜ `frontend/src/hooks/react-query/triggers/use-oauth-integrations.ts`
17. ⬜ `frontend/src/hooks/react-query/triggers/use-trigger-providers.ts`

---

### **Category 3: Custom Hooks (2 files)**
Non-React Query hooks:

18. ⬜ `frontend/src/hooks/use-cached-file.ts` - 5 occurrences
19. ⬜ `frontend/src/hooks/use-image-content.ts` - 2 occurrences

---

### **Category 4: Thread Components (8 files)**
Components in the thread/chat interface:

20. ⬜ `frontend/src/components/thread/chat-input/file-upload-handler.tsx`
21. ⬜ `frontend/src/components/thread/file-attachment.tsx` - 2 occurrences
22. ⬜ `frontend/src/components/thread/file-viewer-modal.tsx` - 5 occurrences
23. ⬜ `frontend/src/components/thread/tiptap-document-modal.tsx`
24. ⬜ `frontend/src/components/thread/tool-views/docs-tool/DocsToolView.tsx`
25. ⬜ `frontend/src/components/thread/tool-views/docs-tool/ListDocumentsToolView.tsx`
26. ⬜ `frontend/src/components/thread/tool-views/presentation-tools/ListPresentationTemplatesToolView.tsx` - 2 occurrences
27. ⬜ `frontend/src/components/thread/tool-views/see-image-tool/_utils.ts`
28. ⬜ `frontend/src/components/thread/tool-views/sheets-tools/sheets-tool-view.tsx`

---

### **Category 5: Other Components (2 files)**
Miscellaneous components:

29. ⬜ `frontend/src/components/agents/mcp/custom-mcp-dialog.tsx`
30. ⬜ `frontend/src/components/knowledge-base/knowledge-base-manager.tsx`
31. ⬜ `frontend/src/components/knowledge-base/unified-kb-entry-modal.tsx`

---

### **Category 6: App Routes/Pages (4 files)**
Next.js app router pages:

32. ⬜ `frontend/src/app/api/og/template/route.tsx`
33. ⬜ `frontend/src/app/auth/actions.ts`
34. ⬜ `frontend/src/app/master-login/page.tsx`
35. ⬜ `frontend/src/app/templates/[shareId]/layout.tsx`
36. ⬜ `frontend/src/app/templates/[shareId]/page.tsx` - 2 occurrences

---

## 🔧 Update Patterns

### **Pattern 1: Simple API_URL constant**
**Before:**
```typescript
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';
```

**After:**
```typescript
import { getApiUrl } from '@/lib/get-api-url';

const API_URL = getApiUrl();
```

**Affected Files:** 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 29, 30, 31

---

### **Pattern 2: Inline URL construction**
**Before:**
```typescript
const url = new URL(`${process.env.NEXT_PUBLIC_BACKEND_URL}/sandboxes/${sandboxId}/files/content`);
```

**After:**
```typescript
import { getApiUrl } from '@/lib/get-api-url';

const url = new URL(`${getApiUrl()}/sandboxes/${sandboxId}/files/content`);
```

**Affected Files:** 21, 22, 23, 24, 25, 26, 27, 28

---

### **Pattern 3: getApiUrl function (already exists)**
**File:** `frontend/src/lib/api.ts`

**Current:**
```typescript
const getApiUrl = () => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api`;
  }
  return process.env.NEXT_PUBLIC_BACKEND_URL || '';
};

const API_URL = getApiUrl();
```

**Update:**
```typescript
import { getApiUrl } from '@/lib/get-api-url';

const API_URL = getApiUrl();
```

---

### **Pattern 4: Server-side (SSR/API routes)**
**Files:** 32, 33, 34, 35, 36

**Consideration:** These run on the server, so they need special handling.

**Before:**
```typescript
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
```

**After:**
```typescript
import { getApiUrl } from '@/lib/get-api-url';

const backendUrl = getApiUrl();
```

**Note:** The `getApiUrl()` utility handles server-side by returning `process.env.NEXT_PUBLIC_BACKEND_URL`

---

## 📊 Update Summary by Category

| Category | Files | Occurrences | Priority |
|----------|-------|-------------|----------|
| Core API Clients | 3 | 3 | 🔴 Critical |
| React Query Hooks | 13 | 14 | 🔴 Critical |
| Custom Hooks | 2 | 7 | 🔴 Critical |
| Thread Components | 8 | 13 | 🟡 High |
| Other Components | 3 | 3 | 🟡 High |
| App Routes/Pages | 4 | 7 | 🟢 Medium |

---

## ✅ Update Order (Recommended)

1. **Step 1:** Create utility file (`get-api-url.ts`)
2. **Step 2:** Update Core API Clients (Category 1)
3. **Step 3:** Update React Query Hooks (Category 2)
4. **Step 4:** Update Custom Hooks (Category 3)
5. **Step 5:** Update Components (Categories 4 & 5)
6. **Step 6:** Update App Routes (Category 6)
7. **Step 7:** Test thoroughly

---

## 🧪 Testing After Each Category

After updating each category:
1. Check for TypeScript errors
2. Check browser console for runtime errors
3. Test relevant features
4. Verify Network tab shows `/api/*` requests (not `http://backend:8000/*`)

---

## 📝 Notes

### **Files with Multiple Occurrences:**
- `use-cached-file.ts`: 5 occurrences (lines 97, 436, 569, 655)
- `file-viewer-modal.tsx`: 5 occurrences (lines 56, 261, 296, 1022, 1051)
- `file-attachment.tsx`: 2 occurrences (lines 144, 319)
- `use-image-content.ts`: 2 occurrences (lines 80, 120)
- `ListPresentationTemplatesToolView.tsx`: 2 occurrences (lines 25, 30)
- `[shareId]/page.tsx`: 2 occurrences (lines 101, 247)

### **Special Cases:**
- `api.ts` already has its own `getApiUrl()` - will be replaced with import
- Server-side files (API routes, Server Components) will work with `getApiUrl()` as it checks for `typeof window`

---

## 🎯 Success Criteria

After all updates:
- ✅ No `process.env.NEXT_PUBLIC_BACKEND_URL` references in client-side code
- ✅ All imports use `import { getApiUrl } from '@/lib/get-api-url'`
- ✅ Browser makes requests to `/api/*` (relative URLs)
- ✅ No `ERR_NAME_NOT_RESOLVED` errors in console
- ✅ Data loads successfully on both localhost and Cloudflare Tunnel
