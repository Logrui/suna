# Path A Implementation Checklist

## Phase 1: Backend Endpoint (30 minutes)

### Setup
- [ ] Open file: `backend/core/knowledge_base/api.py`
- [ ] Navigate to end of file (around line 475, after existing endpoints)
- [ ] Ensure you have these imports at top of file:
  - [ ] `from uuid import UUID`
  - [ ] `from core.services.supabase import DBConnection`
  - [ ] `logger` from `core.utils.logger`

### Implementation
- [ ] Add new endpoint function:
  ```python
  @router.get("/knowledge-base/entries/{entry_id}/content")
  async def get_entry_content(entry_id: UUID):
      """Retrieve file content from S3 storage."""
      try:
          session = await get_session()
          if not session:
              raise HTTPException(status_code=401, detail="Unauthorized")
          
          client = await DBConnection().client
          
          # Query for file_path
          result = await client.table('knowledge_base_entries').select(
              'entry_id, filename, file_path, account_id'
          ).eq('entry_id', entry_id).single().execute()
          
          if not result.data:
              raise HTTPException(status_code=404, detail="Entry not found")
          
          entry = result.data
          
          # Verify access
          if entry['account_id'] != session.user.id:
              raise HTTPException(status_code=403, detail="Access denied")
          
          # Download from S3
          try:
              file_bytes = await client.storage.from_('file-uploads').download(
                  entry['file_path']
              )
          except Exception as e:
              logger.error(f"S3 download failed: {e}")
              raise HTTPException(status_code=500, detail="Failed to download file")
          
          # Decode to text
          try:
              content_text = file_bytes.decode('utf-8', errors='ignore')
          except Exception as e:
              logger.error(f"Decode failed: {e}")
              raise HTTPException(status_code=400, detail="Invalid file encoding")
          
          # Return response
          return {
              'content': content_text,
              'filename': entry['filename'],
              'length': len(content_text),
              'entry_id': str(entry['entry_id'])
          }
          
      except HTTPException:
          raise
      except Exception as e:
          logger.error(f"Unexpected error: {e}")
          raise HTTPException(status_code=500, detail="Internal server error")
  ```

### Verification
- [ ] No syntax errors (IDE should highlight if any)
- [ ] Endpoint is properly indented (same level as other @router decorators)
- [ ] All variables are defined
- [ ] Error handling covers main failure modes

### Testing Backend Endpoint
- [ ] Start backend server: `python start.py`
- [ ] Open terminal or Postman
- [ ] Get an entry_id from:
  ```bash
  curl http://localhost:8000/api/knowledge-base/folders \
    -H "Authorization: Bearer YOUR_TOKEN"
  ```
- [ ] Test endpoint:
  ```bash
  curl http://localhost:8000/api/knowledge-base/entries/{entry_id}/content \
    -H "Authorization: Bearer YOUR_TOKEN"
  ```
- [ ] Expected response: `{"content": "# Summarize\n...", "filename": "..."}`
- [ ] [ ] Response received successfully
- [ ] [ ] Content is not empty
- [ ] [ ] Filename is correct

---

## Phase 2: Frontend Hook Update (20 minutes)

### Setup
- [ ] Open file: `frontend/src/hooks/useSlashCommands.ts`
- [ ] Find the mapping section (around line 230)
- [ ] Look for: `entries.map(entry => ({ name, description, prompt }))`

### Find Current Code

Look for this section:
```typescript
// Around line 230
const commands: SlashCommand[] = entries.map(entry => ({
    name: entry.filename.split('.')[0],
    description: entry.summary,
    prompt: entry.content || ''  // ← THIS IS WHERE WE FETCH
}));

return commands;
```

### Replace With New Code

```typescript
// NEW: Fetch content for each entry
const entriesWithContent = await Promise.all(
    entries.map(async (entry) => {
        try {
            // Call new backend endpoint
            const response = await fetch(
                `/api/knowledge-base/entries/${entry.entry_id}/content`,
                {
                    headers: {
                        'Authorization': `Bearer ${session?.access_token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            
            if (!response.ok) {
                logger.warn(`Failed to fetch content for ${entry.entry_id}: ${response.status}`);
                return { ...entry, content: entry.summary };
            }
            
            const { content } = await response.json();
            return { ...entry, content };
            
        } catch (error) {
            logger.warn(`Error fetching content for ${entry.entry_id}:`, error);
            return { ...entry, content: entry.summary };
        }
    })
);

// Map to SlashCommand format
const commands: SlashCommand[] = entriesWithContent.map(entry => ({
    name: entry.filename.split('.')[0],
    description: entry.summary,
    prompt: entry.content  // ← NOW HAS CONTENT! ✅
}));

return commands;
```

### Verification
- [ ] Old code completely replaced
- [ ] New code has Promise.all for parallel fetching
- [ ] Error handling with fallback to summary
- [ ] Auth token included in headers
- [ ] Logger imported at top of file
- [ ] No syntax errors

### TypeScript Checks
- [ ] Hover over `entriesWithContent` - should show proper type
- [ ] Hover over `response.json()` - should show proper type
- [ ] No red squiggles in IDE
- [ ] Type checking passes: `npm run typecheck` (or similar)

---

## Phase 3: End-to-End Testing (30 minutes)

### Test 1: Initial Load

- [ ] Start frontend: `npm run dev` (or similar)
- [ ] Open browser to http://localhost:3000
- [ ] Open DevTools (F12 or Cmd+Option+I)
- [ ] Go to Network tab
- [ ] Open chat window
- [ ] Type "/" in chat input
- [ ] Watch Network tab:
  - [ ] See `GET /knowledge-base/folders/{id}/entries` (lists commands)
  - [ ] See `GET /api/knowledge-base/entries/...content` (×4 for each command)
  - [ ] Each content request should return 200 OK
  - [ ] Response contains `content`, `filename` fields

### Test 2: Autocomplete Display

- [ ] Autocomplete appears when you type "/"
- [ ] All 4 commands visible:
  - [ ] summarize
  - [ ] draft-email
  - [ ] brainstorm
  - [ ] explain-simple
- [ ] Each shows description text
- [ ] Keyboard navigation works (arrow keys)
- [ ] Escape closes autocomplete

### Test 3: Command Selection & Injection

For each command:

**Summarize**:
- [ ] Type "/" → select "summarize"
- [ ] Verify "/summarize" appears in input
- [ ] Type " for my blog post"
- [ ] Open DevTools Console
- [ ] Check what gets logged/sent (depends on your logging)
- [ ] Expected: Prompt + user text combined

**Draft Email**:
- [ ] Type "/" → select "draft-email"
- [ ] Verify "/draft-email" appears
- [ ] Type " about quarterly results"
- [ ] Verify injection works

**Brainstorm**:
- [ ] Type "/" → select "brainstorm"
- [ ] Verify command selected
- [ ] Type " for new product features"
- [ ] Verify injection works

**Explain Simple**:
- [ ] Type "/" → select "explain-simple"
- [ ] Verify command selected
- [ ] Type " the blockchain"
- [ ] Verify injection works

### Test 4: Content Verification

- [ ] Each command has different content (they're not all the same)
- [ ] Content is not empty (not blank strings)
- [ ] Content appears to be a reasonable prompt (not garbage)
- [ ] Content includes markdown headers (# Summarize, etc.)

### Test 5: Error Handling

**Simulate failure** (optional):
- [ ] In DevTools Network tab, throttle to offline
- [ ] Try to select a command
- [ ] Expected: Falls back to summary (command still works)
- [ ] Turn throttling off
- [ ] Command works normally again

### Test 6: Caching (5-minute stale time)

- [ ] Select command → fetches from S3 (~500ms)
- [ ] Same session, select same command again (within 5 min)
- [ ] Should be faster (React Query cache)
- [ ] Network tab shouldn't show new request (or shows from cache)

---

## Common Issues & Fixes

### Issue: 401 Unauthorized

**Symptom**: GET /content returns 401

**Fix**:
- [ ] Check Supabase session is valid
- [ ] Verify `session?.access_token` exists
- [ ] Check auth header is in request

### Issue: 404 Not Found

**Symptom**: GET /content returns 404

**Fix**:
- [ ] Verify entry_id is correct UUID format
- [ ] Confirm entry exists in database
- [ ] Check file_path is stored correctly

### Issue: 500 Internal Server Error

**Symptom**: GET /content returns 500

**Fix**:
- [ ] Check backend logs for error message
- [ ] Verify S3 file exists at stored path
- [ ] Check file is readable (permissions)

### Issue: Empty Content

**Symptom**: `"content": ""`

**Possible causes**:
- [ ] Binary file (PDF, image)
- [ ] File encoding issue
- [ ] Empty file

**Fix**:
- [ ] Ensure uploaded files are text (.md, .txt, .json)
- [ ] Check file is not empty
- [ ] If binary, re-upload as text version

### Issue: Slow Loading

**Symptom**: Commands take > 2 seconds to appear

**Possible causes**:
- [ ] S3 latency
- [ ] Network throttling
- [ ] Large files

**Fix**:
- [ ] Check network in DevTools
- [ ] Reduce file sizes if needed
- [ ] Upgrade to Path C later (adds caching)

---

## Validation Checklist

Before considering "done":

### Backend Endpoint
- [ ] Code added to `api.py`
- [ ] Endpoint accessible at `/api/knowledge-base/entries/{id}/content`
- [ ] Returns JSON with `content` and `filename`
- [ ] Authorization check works
- [ ] Error handling for missing entry

### Frontend Hook
- [ ] Code added to `useSlashCommands.ts`
- [ ] Fetches content in parallel (Promise.all)
- [ ] Falls back to summary on error
- [ ] Passes auth token in header
- [ ] Maps entries to SlashCommand with content

### Testing
- [ ] All 4 commands load
- [ ] Each has different content
- [ ] Content is not empty
- [ ] Content appears in chat input
- [ ] Can send message with injected prompt
- [ ] Agent receives full prompt + user text

### No Schema Changes
- [ ] No database migrations created
- [ ] No new columns added
- [ ] No table structures modified
- [ ] Only querying existing fields
- [ ] Zero sync debt ✅

---

## Success Criteria

Feature is complete when:

✅ Typing "/" shows autocomplete
✅ Autocomplete lists 4 commands
✅ Selecting command injects prompt into input
✅ Prompt text is not empty
✅ Sending message works
✅ Agent receives full prompt + user text
✅ All tests pass
✅ Zero database schema changes
✅ No git migrations file created

---

## Time Tracking

| Step | Task | Planned | Actual | Status |
|------|------|---------|--------|--------|
| 1 | Add backend endpoint | 30 min | _____ | ⏳ |
| 2 | Update frontend hook | 20 min | _____ | ⏳ |
| 3 | E2E testing | 30 min | _____ | ⏳ |
| **Total** | **Working feature** | **1.5h** | _____ | ⏳ |

---

## Next: Once Complete

After Path A works:

- [ ] **Optional**: Upgrade to Path C (add caching) for better UX
- [ ] **Document**: Add user guide for creating custom commands
- [ ] **Deploy**: Merge feature branch to main
- [ ] **Celebrate**: Slash commands shipped! 🎉

---

## Questions During Implementation?

Refer back to: `PATH-A-DETAILED-IMPLEMENTATION.md` for:
- Architecture diagrams
- Memory flow details
- Request/response examples
- Error handling patterns
- Caching strategy
