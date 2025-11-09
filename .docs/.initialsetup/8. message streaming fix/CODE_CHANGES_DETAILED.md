# 🔧 Code Changes Reference - Auto-Continue After Tool Errors

**File**: `backend/core/run.py`  
**Changes**: 7 targeted modifications  
**Total Lines**: ~30 added/modified  

---

## Change 1: Initialize Message Type Tracking

**Location**: Line 786 (right after `last_tool_call = None`)

```python
# BEFORE:
last_tool_call = None
agent_should_terminate = False
error_detected = False

# AFTER:
last_tool_call = None
last_message_type = None  # Track the type of the last message
agent_should_terminate = False
error_detected = False
```

**Why**: Establishes variable to track message types from status chunks.

---

## Change 2: Extract Status Type from Chunks

**Location**: Lines 805-810 (in initial response handler)

```python
# BEFORE:
if isinstance(chunk, dict) and chunk.get('type') == 'status':
    try:
        content = chunk.get('content', {})
        if isinstance(content, str):
            content = json.loads(content)
        
        # Check for error status

# AFTER:
if isinstance(chunk, dict) and chunk.get('type') == 'status':
    try:
        content = chunk.get('content', {})
        if isinstance(content, str):
            content = json.loads(content)
        
        # Track message type for continuation decisions
        if 'status_type' in content:
            last_message_type = content['status_type']  # e.g., 'tool_error', 'tool_failed', 'tool_completed'
        
        # Check for error status
```

**Why**: Captures the status_type from tool execution status messages.

---

## Change 3: Mark Assistant Messages as Final

**Location**: Line 832 (in initial response handler)

```python
# BEFORE:
# Check for terminating XML tools in assistant content
if chunk.get('type') == 'assistant' and 'content' in chunk:
    try:

# AFTER:
# Check for terminating XML tools in assistant content
if chunk.get('type') == 'assistant' and 'content' in chunk:
    last_message_type = 'assistant'  # Mark as final type
    try:
```

**Why**: Marks assistant responses as final message type.

---

## Change 4: Updated Auto-Continue Entry Condition

**Location**: Lines 876-898 (replaced old termination tool check)

```python
# BEFORE:
if agent_should_terminate or last_tool_call in ['ask', 'complete', 'present_presentation']:
    if generation:
        generation.end(status_message="agent_stopped")
    logger.info(f"🛑 Termination tool detected: {last_tool_call} - continuing main loop without auto-continue")
    continue_execution = False

# Enhanced AUTO-CONTINUE LOGIC (Pattern 2 with Task Awareness)
# If last message is not from assistant, continue the conversation
logger.info(f"🔄 Entering auto-continue loop (continue_execution={continue_execution}, termination_tool={last_tool_call})")
...

# AFTER:
if agent_should_terminate or last_tool_call in ['ask', 'complete', 'present_presentation']:
    if generation:
        generation.end(status_message="agent_stopped")
    logger.info(f"🛑 Termination tool detected: {last_tool_call} - continuing main loop without auto-continue")
    continue_execution = False

# Enhanced AUTO-CONTINUE LOGIC (Pattern 2 with Task Awareness)
# Determine if we should enter auto-continue
# Non-final message types that require continuation:
non_final_message_types = [
    'tool',
    'tool_completed',
    'tool_failed',
    'tool_error',
    'status'
]

should_auto_continue = last_message_type in non_final_message_types

if not should_auto_continue:
    logger.info(f"✅ Response complete: last_message_type='{last_message_type}' (final type, no auto-continue needed)")
    continue_execution = False
else:
    logger.info(f"🔄 Auto-continue needed: last_message_type='{last_message_type}' is non-final, entering auto-continue loop")

if not should_auto_continue:
    continue_execution = False
    break

logger.info(f"🔄 Entering auto-continue loop (continue_execution={continue_execution}, termination_tool={last_tool_call})")
...
```

**Why**: Implements the decision logic to enter auto-continue based on message type.

---

## Change 5: Reset Message Type in Auto-Continue Loop

**Location**: Line 977 (start of auto-continue loop iteration)

```python
# BEFORE:
last_auto_continue_tool_call = None
continuation_error = False
response_length = 0

# AFTER:
last_auto_continue_tool_call = None
last_message_type = None  # Reset for this iteration
continuation_error = False
response_length = 0
```

**Why**: Ensures message type tracking is fresh for each continuation iteration.

---

## Change 6a: Mark Assistant Messages in Loop

**Location**: Line 982 (in auto-continue loop message processing)

```python
# BEFORE:
async for chunk in continuation_response:
    # Track response quality indicators
    if chunk.get('type') == 'assistant' and 'content' in chunk:
        try:
            content = chunk.get('content', '{}')
            if isinstance(content, str):
                response_length += len(content)

# AFTER:
async for chunk in continuation_response:
    # Track response quality indicators
    if chunk.get('type') == 'assistant' and 'content' in chunk:
        last_message_type = 'assistant'  # Mark as final
        try:
            content = chunk.get('content', '{}')
            if isinstance(content, str):
                response_length += len(content)
```

**Why**: Tracks final assistant messages during continuation loop.

---

## Change 6b: Extract Status Type in Loop

**Location**: Lines 1015-1016 (in auto-continue loop status processing)

```python
# BEFORE:
if isinstance(chunk, dict) and chunk.get('type') == 'status':
    try:
        content = chunk.get('content', {})
        if isinstance(content, str):
            content = json.loads(content)
        metadata = chunk.get('metadata', {})
        if isinstance(metadata, str):
            metadata = json.loads(metadata)
        
        if metadata.get('agent_should_terminate'):

# AFTER:
if isinstance(chunk, dict) and chunk.get('type') == 'status':
    try:
        content = chunk.get('content', {})
        if isinstance(content, str):
            content = json.loads(content)
        metadata = chunk.get('metadata', {})
        if isinstance(metadata, str):
            metadata = json.loads(metadata)
        
        # Track message type for continuation decisions
        if 'status_type' in content:
            last_message_type = content['status_type']
        
        if metadata.get('agent_should_terminate'):
```

**Why**: Captures status types during continuation responses.

---

## Change 7: Check for Final Message in Loop

**Location**: Lines 1073-1075 (after termination tool check)

```python
# BEFORE:
# Check for termination tools
if last_auto_continue_tool_call in ['ask', 'complete', 'present_presentation']:
    logger.info(f"🛑 Auto-continue: Termination tool detected: {last_auto_continue_tool_call}")
    break

# Escalation check: prompt for user guidance at critical points

# AFTER:
# Check for termination tools
if last_auto_continue_tool_call in ['ask', 'complete', 'present_presentation']:
    logger.info(f"🛑 Auto-continue: Termination tool detected: {last_auto_continue_tool_call}")
    break

# Check if we got a final message (last_message_type == 'assistant')
if last_message_type == 'assistant':
    logger.info(f"✅ Auto-continue: Received final assistant message (last_message_type='assistant')")
    break
elif last_message_type and last_message_type != 'assistant':
    logger.info(f"🔄 Auto-continue: Continuing after non-final message_type='{last_message_type}'")

# Escalation check: prompt for user guidance at critical points
```

**Why**: Properly exits the auto-continue loop when final assistant message is received.

---

## Summary of Changes

| Change # | Type | Lines | Purpose |
|----------|------|-------|---------|
| 1 | Add | 786 | Initialize tracking variable |
| 2 | Add | 805-810 | Extract status type from chunks |
| 3 | Add | 832 | Mark assistant as final |
| 4 | Replace | 876-898 | Auto-continue entry logic |
| 5 | Add | 977 | Reset per iteration |
| 6a | Add | 982 | Track assistant in loop |
| 6b | Add | 1015-1016 | Extract status type in loop |
| 7 | Add | 1073-1075 | Check for final message |

**Total**: ~30 lines added/modified  
**Deletions**: 0  
**Breaking changes**: 0  

---

## Testing the Changes

### Manual Testing

**Test 1: Verify Tool Error Handling**
```bash
# 1. Send a message that will cause a tool error
# 2. Check logs for: 🔄 Auto-continue needed: last_message_type='tool_error'
# 3. Verify agent provides recovery message
# 4. Verify conversation completes normally

docker logs suna-backend-1 -f | grep "Auto-continue needed"
```

**Test 2: Verify Normal Completion**
```bash
# 1. Send a message with successful tool calls
# 2. Check logs for: ✅ Auto-continue: Received final assistant message
# 3. Verify loop breaks after assistant response

docker logs suna-backend-1 -f | grep "Received final"
```

### Code Review Checklist

- [ ] All 7 changes are logically sound
- [ ] Message type tracking is consistent
- [ ] No race conditions in async code
- [ ] Logging is appropriate
- [ ] Error handling is preserved
- [ ] No new dependencies added
- [ ] Performance impact is negligible
- [ ] Code follows existing style

---

## Rollback Instructions

If issues occur, rollback is simple - just revert the 7 changes:

```bash
# 1. Checkout original version
git checkout backend/core/run.py

# 2. Rebuild Docker
docker compose down
docker compose up -d --build

# 3. Verify
docker logs suna-backend-1
```

---

## Verification Commands

```bash
# Verify changes are in place
grep -n "last_message_type" backend/core/run.py | head -10

# Should show ~8 lines with last_message_type

# Check for logging
grep -n "Auto-continue needed" backend/core/run.py

# Verify syntax
python -m py_compile backend/core/run.py
```

---

