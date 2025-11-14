# 🧪 E2E Testing Guide - Slash Commands with Content

## Pre-Testing Checklist

- [ ] Both backend and frontend are running
- [ ] You have the 4 example commands in Knowledge Base
- [ ] Browser DevTools are open (F12)
- [ ] You're logged into the application

---

## Test 1: Autocomplete Display (2 min)

### Expected Behavior
When you type "/" in chat, you should see all 4 commands with descriptions.

### Steps
1. Click in the chat input field
2. Type `/` (single forward slash)
3. Autocomplete dropdown appears

### What to Look For ✅
- [ ] Dropdown shows **4 commands** (not more, not less)
- [ ] Each command has a **description** visible
- [ ] Commands visible: `summarize`, `draft-email`, `brainstorm`, `explain-simple`
- [ ] Dropdown is **styled correctly** (dark theme matches chat style)
- [ ] **Keyboard navigation works**: Arrow keys move selection, Enter selects

### If It Fails ❌
- Check console for errors
- Check that Knowledge Base has the 4 example commands
- Check that `/knowledge-base/folders` endpoint returns Suna folder

---

## Test 2: Command Selection & Content Display (2 min)

### Expected Behavior
When you select a command, the entire prompt should appear in the input field.

### Steps
1. Type `/` and let autocomplete appear
2. Click on **"summarize"** command
3. Look at the input field

### What to Look For ✅
- [ ] Input field now shows `/summarize`
- [ ] **CRITICAL**: Full prompt text appears below/in the input
- [ ] Prompt starts with something like "# Summarize" or "Summarize the following..."
- [ ] Prompt is **not empty** (this was the bug!)
- [ ] Prompt is **relevant** to the command name
- [ ] User can continue typing after the prompt

### If It Fails ❌
- Open DevTools Network tab
- Look for request to `/knowledge-base/entries/{id}/content`
- Check response body - should have `"content": "..."`
- If content is empty, check S3 file exists
- Check console for `[SlashCommands]` logs

---

## Test 3: All 4 Commands Have Content (5 min)

### Expected Behavior
Each command should have different, relevant content.

### Steps
1. For each command (`summarize`, `draft-email`, `brainstorm`, `explain-simple`):
   - Type `/` to trigger autocomplete
   - Click on the command
   - Note the prompt content
   - Press Escape to clear

### What to Look For ✅
- [ ] **summarize**: Prompt talks about "bullet points" and "key takeaways"
- [ ] **draft-email**: Prompt talks about "professional email" and "formal tone"
- [ ] **brainstorm**: Prompt talks about "creative ideas" and "diverse"
- [ ] **explain-simple**: Prompt talks about "simple terms" and "10-year-old"
- [ ] Each prompt is **different** (not duplicates)
- [ ] Each prompt is **substantial** (not just 1-2 words)

### If It Fails ❌
- Check that all 4 files were uploaded to Knowledge Base
- Check DevTools Network tab for each command's content request
- Verify S3 bucket has the files at: `knowledge-base/{folder_id}/{entry_id}/*.md`

---

## Test 4: Message Injection (3 min)

### Expected Behavior
When you type a message and send it, the prompt is included in the message.

### Steps
1. Type `/summarize` and select the command
2. Type: ` for my meeting notes`
3. Press Enter to send

### What to Look For ✅
- [ ] Message sends successfully
- [ ] **In DevTools Network tab**, look at the request to send message
- [ ] Request body should contain **both**:
  - The full prompt content
  - Your text: "for my meeting notes"
- [ ] Agent receives the full context and responds
- [ ] Response is relevant (agent understood the prompt)

### If It Fails ❌
- Check chat-input component injection logic
- Verify `${prompt}\n\n${userText}` is being used
- Look for errors in console during send

---

## Test 5: DevTools Verification (3 min)

### Network Tab Inspection

1. **Clear Network tab** (Ctrl+Shift+Delete or button)
2. Type `/` and select a command
3. Look for network requests:

```
Request 1: GET /knowledge-base/folders
└─ Response: Array of folders

Request 2: GET /knowledge-base/folders/{folderId}/entries
└─ Response: Array of entries with metadata

Request 3: GET /knowledge-base/entries/{entryId}/content (x4 - one per command)
└─ Response: {"content": "...", "filename": "...", "length": ...}
```

### What to Look For ✅
- [ ] **Status codes**: All 200 ✅
- [ ] **Response time**: Each content request < 500ms
- [ ] **Response body**: Contains full prompt text
- [ ] **No errors**: Check for 404, 500, or network errors
- [ ] **Size**: Response is > 1KB (substantial content, not empty)

### Console Tab Inspection

Look for logs like:
```
[SlashCommands] useSlashCommands: Fetching commands...
[SlashCommands] useSlashCommands: Fetched entries: 4
[SlashCommands] useSlashCommands: Converted to commands: [
  { name: 'summarize', descriptionLength: 65, promptLength: 287 },
  { name: 'draft-email', descriptionLength: ..., promptLength: ... },
  ...
]
```

### What to Look For ✅
- [ ] `Fetched entries: 4` ✅
- [ ] `promptLength > 0` for each command ✅
- [ ] No error logs ✅
- [ ] Timing: Total load < 500ms ✅

---

## Test 6: Error Handling (3 min)

### Simulate S3 Failure (Optional)

1. Disconnect internet or throttle network (DevTools → Network → Offline)
2. Try to select a command
3. Reconnect

### What to Look For ✅
- [ ] UI doesn't crash ❌ (should show error gracefully)
- [ ] Fallback behavior works (shows description or empty prompt)
- [ ] Console shows error logs with context
- [ ] No unhandled exceptions

---

## Test 7: Caching Behavior (2 min)

### Expected Behavior
Second load should be instant (uses React Query 5-minute cache).

### Steps
1. Select `summarize` command
2. Press Escape to clear
3. Wait 2 seconds
4. Select `summarize` command again
5. Look at Network tab

### What to Look For ✅
- [ ] Second load is **instant** (no content requests in network tab)
- [ ] Prompt appears immediately ✅
- [ ] DevTools shows it was cached (Query status: "success" with cache)
- [ ] If you wait > 5 minutes, new requests appear ✅

---

## Success Criteria

You've passed E2E testing if:

✅ **All 4 commands display** in autocomplete  
✅ **All 4 prompts load** when selected  
✅ **Prompts are not empty** (this was the bug!)  
✅ **Each prompt is different and relevant**  
✅ **Content loads in < 500ms** (network tab)  
✅ **Agent receives full prompt + user text**  
✅ **Agent responds appropriately**  
✅ **No errors in console** (except warnings, those are fine)  
✅ **Second load is instant** (caching works)  
✅ **Error handling works** (graceful fallbacks)  

---

## Troubleshooting

### Problem: Autocomplete not showing
- [ ] Check `/` is being typed in chat input
- [ ] Check Knowledge Base has Suna folder
- [ ] Check browser console for errors
- [ ] Refresh page and try again

### Problem: Prompt is empty
- [ ] This was the original bug! You should see content now.
- [ ] If still empty after this implementation:
  - Check backend endpoint is added to api.py
  - Check DevTools Network for `/content` request
  - Check S3 bucket has files
  - Check response body has content (not null/empty string)

### Problem: Content requests fail (404, 500)
- [ ] Check backend is running
- [ ] Check endpoint URL matches: `/knowledge-base/entries/{id}/content`
- [ ] Check entry_id in request is valid UUID
- [ ] Check user is authenticated (token in header)
- [ ] Check S3 credentials are valid

### Problem: Slow loading (> 1 second)
- [ ] Check network throttling (DevTools)
- [ ] Check S3 bucket response times
- [ ] Can optimize with Path C (caching) later

### Problem: Agent not receiving prompt
- [ ] Check message body in DevTools
- [ ] Verify prompt is included in request
- [ ] Check chat-input component injection logic
- [ ] Try a simple message without slash command (test baseline)

---

## Quick Test Script (Copy-Paste)

In browser console:
```javascript
// Check if knowledge base endpoint works
fetch('/api/knowledge-base/folders', {
  headers: {
    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`
  }
}).then(r => r.json()).then(d => console.log('Folders:', d));

// Check if content endpoint works (replace ID)
fetch('/api/knowledge-base/entries/{ENTRY_ID}/content', {
  headers: {
    'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session.access_token}`
  }
}).then(r => r.json()).then(d => console.log('Content:', d.content.substring(0, 100)));
```

---

## When to Stop Testing

Stop and commit when:
- ✅ All 4 commands show in autocomplete
- ✅ All 4 prompts load with content
- ✅ Prompts inject correctly into messages
- ✅ Agent receives and processes prompts
- ✅ No console errors (warnings OK)

**Testing Time**: ~20 minutes  
**Result**: Production-ready slash commands! 🚀

Ready to test? Just open your app and start at Test 1! 🎬
