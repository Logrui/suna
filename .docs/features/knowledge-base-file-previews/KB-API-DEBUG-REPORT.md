# Knowledge Base API Debug Report
**Date**: November 5, 2025  
**Investigation**: Why Knowledge Base file content is not accessible for slash commands  
**Status**: ROOT CAUSE IDENTIFIED

---

## Executive Summary

**The Problem**: Console logs show Knowledge Base entries have `content: null` or `contentLength: 0`

**Root Cause**: The Knowledge Base API `/knowledge-base/folders/{folder_id}/entries` endpoint does NOT return the file `content` field. It only returns metadata (filename, summary, file_size).

**Solution Required**: Need to add a new API endpoint to fetch file content from Supabase storage

---

## Investigation Findings

### 1. Knowledge Base API Endpoints Available

#### ✅ **GET /knowledge-base/folders**
Returns list of all folders with metadata
```
Response: List[FolderResponse]
Fields: folder_id, name, description, entry_count, created_at
```

#### ✅ **GET /knowledge-base/folders/{folder_id}/entries**
**Currently Used by Slash Commands**
```
Response: List[EntryResponse]
Fields: entry_id, filename, summary, file_size, created_at

⚠️ IMPORTANT: Does NOT return 'content'
```

**Proof from API code** (`backend/core/knowledge_base/api.py` line 378-381):
```python
result = await client.table('knowledge_base_entries').select(
    'entry_id, filename, summary, file_size, created_at'
).eq('folder_id', folder_id).eq('is_active', True).order('created_at', desc=True).execute()

# Returns EntryResponse which only has: 
# - entry_id, filename, summary, file_size, created_at
# NO content field!
```

#### ✅ **PATCH /knowledge-base/entries/{entry_id}**
Updates entry summary only
```
Request: { summary: string }
Response: EntryResponse (still no content)
```

#### ✅ **DELETE /knowledge-base/entries/{entry_id}**
Deletes an entry

#### ✅ **PUT /knowledge-base/entries/{entry_id}/move**
Moves file between folders

#### ❌ **GET /knowledge-base/entries/{entry_id}**
**NOT FOUND** - There is NO endpoint to retrieve a single entry's content!

---

## Database Schema Analysis

### Knowledge Base Entries Table

What gets stored in the database:
```python
knowledge_base_entries {
  entry_id: UUID          # Primary key
  filename: str           # e.g., "summarize.md"
  summary: str            # e.g., "Summarize content into 5 bullet points"
  file_size: int          # Size in bytes
  created_at: timestamp
  folder_id: UUID         # Reference to folder
  account_id: UUID        # Owner
  file_path: str          # S3 path (not returned by API!)
  is_active: bool
}
```

**Key Finding**: The `file_path` column is stored but:
1. NOT returned by the `/entries` endpoint
2. NOT included in `EntryResponse` model
3. Stored in database but content NOT fetched from Supabase storage

---

## File Storage Architecture

### Where Content Actually Lives

**Files are stored in Supabase Storage** (`file-uploads` bucket):
```
s3_path = f"knowledge-base/{folder_id}/{entry_id}/{sanitized_filename}"
Example: "knowledge-base/c71e29c7-3c32-4402-8042-49c409f2abec/uuid-here/summarize.md"
```

### Upload Process (Verified - Working ✅)
```python
# From file_processor.py - this DOES store content properly
await client.storage.from_('file-uploads').upload(
    s3_path, 
    file_content,        # ← Content IS stored!
    {"content-type": mime_type}
)
```

### The Missing Piece ❌

**No endpoint exists to download/retrieve file content from storage**

Current API only provides:
- Metadata (filename, summary, size)
- File path (stored in DB but not returned)

Missing:
- **GET /knowledge-base/entries/{entry_id}/content** ← NEEDED FOR SLASH COMMANDS

---

## Console Ninja Log Analysis

### What We're Seeing

```javascript
{
  filename: 'summarize.md',
  summary: 'Summarize content into 5 bullet points.',  ✅ Returns
  hasContent: false,                                    ❌ No content
  contentLength: 0,                                     ❌ Empty
  entryId: '87fc9069-6362-4337-b672-c98aa8d79534'
}
```

### Why It's Empty

In `useSlashCommands.ts` line 234:
```typescript
const commands: SlashCommand[] = entries.map((entry: any) => ({
  name: entry.filename.replace(/\.(txt|md)$/i, ''),
  description: entry.summary || '',
  prompt: entry.content || '',  // ← This is NULL!
}));
```

The `entry.content` is empty because:
1. The API endpoint doesn't fetch from storage
2. The EntryResponse model doesn't include content
3. No mechanism to retrieve content from S3

---

## Solution Options

### Option 1: Add New API Endpoint (RECOMMENDED) ✅

Create: **GET /knowledge-base/entries/{entry_id}/content**

```python
@router.get("/entries/{entry_id}/content")
async def get_entry_content(
    entry_id: str,
    user_id: str = Depends(verify_and_get_user_id_from_jwt)
):
    """Download file content from knowledge base entry."""
    try:
        client = await db.client
        account_id = user_id
        
        # Get entry with file_path
        entry_result = await client.table('knowledge_base_entries').select(
            'entry_id, file_path, filename'
        ).eq('entry_id', entry_id).eq('account_id', account_id).execute()
        
        if not entry_result.data:
            raise HTTPException(status_code=404, detail="Entry not found")
        
        entry = entry_result.data[0]
        file_path = entry['file_path']
        
        # Download from Supabase storage
        file_bytes = await client.storage.from_('file-uploads').download(file_path)
        
        # Decode for text files, return as-is for binary
        try:
            content = file_bytes.decode('utf-8')
        except:
            content = file_bytes.decode('latin-1')
        
        return {"content": content, "filename": entry['filename']}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting entry content: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to retrieve content")
```

**Frontend Usage**:
```typescript
const response = await fetch(
  `${API_URL}/knowledge-base/entries/${entryId}/content`,
  { headers }
);
const { content } = await response.json();
```

**Pros**:
- Clean separation of concerns
- Consistent with REST API design
- Easy to add caching/permissions later
- Can add query parameters for filters

**Cons**:
- Requires backend changes (small)
- Additional API call needed

---

### Option 2: Include Content in Entries Response

Modify: **GET /knowledge-base/folders/{folder_id}/entries**

Change EntryResponse to include content:
```python
class EntryResponse(BaseModel):
    entry_id: str
    filename: str
    summary: str
    file_size: int
    created_at: str
    content: Optional[str] = None  # ← Add this
    file_path: str                 # ← Add this
```

**Pros**:
- Single API call instead of N+1
- Simpler frontend code

**Cons**:
- Large payloads (files can be 100GB limit)
- Bad performance if many files
- Not RESTful (GET returns too much)
- Impossible to cache properly

---

### Option 3: Add Content Fetch in Frontend Hook

Keep API as-is, fetch from Supabase storage directly

```typescript
// In useSlashCommands.ts
const supabase = createClient();
const { data: content } = await supabase
  .storage
  .from('file-uploads')
  .download(entry.file_path);
```

**Pros**:
- No backend changes needed
- Direct storage access

**Cons**:
- Requires public read access to storage (security issue)
- Frontend directly couples to storage layer
- Doesn't scale with permissions

---

## Recommendation

**Implement Option 1: Add /knowledge-base/entries/{entry_id}/content endpoint**

### Why:
1. **Secure** - Access controlled by backend authentication
2. **Scalable** - Can add caching, logging, permissions
3. **Performance** - Fetches only needed content
4. **Clean** - Follows REST principles
5. **Future-proof** - Can add features like streaming, compression

### Implementation Steps:
1. Add new endpoint to `backend/core/knowledge_base/api.py`
2. Update `useSlashCommands.ts` to fetch content via new endpoint
3. Test with Console Ninja to verify content is populated
4. Verify slash command injection works end-to-end

### Estimated Time:
- Backend: 30 minutes
- Frontend: 15 minutes
- Testing: 15 minutes
- **Total: 1 hour**

---

## Current State vs. Expected State

### Current Flow (Broken) ❌
```
1. User types "/" in chat
2. useSlashCommands calls GET /knowledge-base/folders/{id}/entries
3. API returns: { filename, summary, file_size } ← NO CONTENT
4. Console logs show: contentLength: 0
5. Prompt injection gets nothing to inject
6. Agent receives empty prompt
```

### Expected Flow (After Fix) ✅
```
1. User types "/" in chat
2. useSlashCommands calls GET /knowledge-base/folders/{id}/entries
3. API returns: { entry_id, filename, summary, file_size }
4. Frontend calls GET /knowledge-base/entries/{entry_id}/content
5. Backend fetches from Supabase storage
6. Returns: { content: "Summarize the following content..." }
7. Prompt injection uses content
8. Agent receives full prompt + user text
```

---

## Files to Modify

### Backend
- `backend/core/knowledge_base/api.py` - Add new endpoint

### Frontend
- `frontend/src/hooks/useSlashCommands.ts` - Fetch content for each entry

### No changes needed:
- `frontend/src/components/slash-commands/SlashCommandAutocomplete.tsx` - Works as-is
- `frontend/src/components/thread/chat-input/chat-input.tsx` - Works as-is
- `frontend/src/lib/slashCommands.ts` - Works as-is

---

## Testing Plan

### After Implementation:

1. **Console Ninja Verification**
   ```
   Should see in logs:
   ✅ prompt: "Summarize the following content..."
   ✅ promptLength: 165 (not 0)
   ```

2. **Manual E2E Test**
   - Type "/" in chat
   - Select "/summarize"
   - Type " this article"
   - Send message
   - Check: Agent receives full prompt (not just "/summarize this article")

3. **All 4 Commands**
   - Test each example command works
   - Verify different prompts are injected correctly

---

## Related Files Reference

**Backend Knowledge Base API**:
- `backend/core/knowledge_base/api.py` (602 lines)
  - Current endpoints documented above
  - File upload endpoint (line 295)
  - Entry listing endpoint (line 360)

**Frontend Hooks**:
- `frontend/src/hooks/useSlashCommands.ts` (258 lines)
  - Calls `/knowledge-base/folders/{id}/entries`
  - Maps response to SlashCommand[]
  - Where content is accessed (line 234)

**Frontend Integration**:
- `frontend/src/components/thread/chat-input/chat-input.tsx` (1173 lines)
  - Uses useSlashCommands hook
  - Injects prompt on command selection
  - Already has logic for prompt injection

---

## Conclusion

**The slash commands feature is architecturally sound.** The only issue is that the Knowledge Base API doesn't currently provide a way to retrieve file content. Adding a single endpoint will enable full functionality.

**Blocker**: Cannot proceed with full E2E testing until content endpoint is available.

**Next Action**: Implement the new `/knowledge-base/entries/{entry_id}/content` endpoint
