# Commit Review: abadd6a6 - Cancellation Event & Graceful Stoppage

**Commit**: `abadd6a6b9226e3f9abea33f9f4245ac7b9104fe`  
**Author**: marko-kraemer  
**Date**: Mon Nov 3 15:12:46 2025 +0800  
**Subject**: fix string parsing task list bug, add graceful premature llm stoppage, WIP test sanitized GET messages

---

## Summary of Changes

This commit adds a cancellation event system to gracefully stop LLM streaming and prevent resource leaks.

**Key Features:**
1. ✅ Cancellation event propagation (Problem #2, #3)
2. ✅ Immediate stop on XML tool limit (Problem #6)
3. ✅ Resource cleanup for pending tasks
4. ⚠️ WIP features: sanitized API endpoints (not needed for streaming fixes)

---

## File 1: `backend/core/agentpress/response_processor.py` (KEY FILE)

### Change 1: Add cancellation_event parameter

```python
# BEFORE (line 236)
async def process_streaming_response(
    self,
    llm_response: AsyncGenerator,
    thread_id: str,
    continuous_state: Optional[Dict[str, Any]] = None,
    generation = None,
    estimated_total_tokens: Optional[int] = None,
) -> AsyncGenerator[Dict[str, Any], None]:

# AFTER (line 236)
async def process_streaming_response(
    self,
    llm_response: AsyncGenerator,
    thread_id: str,
    continuous_state: Optional[Dict[str, Any]] = None,
    generation = None,
    estimated_total_tokens: Optional[int] = None,
    cancellation_event: Optional[asyncio.Event] = None,  # ← NEW PARAMETER
) -> AsyncGenerator[Dict[str, Any], None]:
```

**Impact**: Allows external cancellation signal to stop streaming

---

### Change 2: Initialize cancellation event

```python
# NEW CODE (after line 254)
# Initialize cancellation event if not provided
if cancellation_event is None:
    cancellation_event = asyncio.Event()
```

**Impact**: Ensures cancellation_event always exists (backward compatible)

---

### Change 3: Check for cancellation in streaming loop

```python
# NEW CODE (inside async for chunk in llm_response loop, after line 322)
async for chunk in llm_response:
    # Check for cancellation before processing each chunk
    if cancellation_event.is_set():
        logger.info(f"Cancellation signal received for thread {thread_id} - stopping LLM stream processing")  
        finish_reason = "cancelled"
        break  # ← STOPS PROCESSING IMMEDIATELY
    
    chunk_count += 1
    # ... rest of chunk processing
```

**Impact**: Stops LLM stream immediately when cancellation signal received

---

### Change 4: Remove drain timeout logic (MAJOR CHANGE)

```python
# BEFORE (lines 490-530) - REMOVED 40+ LINES
if finish_reason == "xml_tool_limit_reached":
    logger.info("XML tool limit reached - draining remaining stream to capture usage data")
    
    drain_timeout = 5.0
    drain_start_time = datetime.now(timezone.utc).timestamp()
    chunks_drained = 0
    max_drain_chunks = 100
    
    try:
        async for remaining_chunk in llm_response:  
            chunk_count += 1
            chunks_drained += 1
            
            # ... 30+ lines of draining logic
            
            if (current_drain_time - drain_start_time) > drain_timeout:
                break
            
            if chunks_drained >= max_drain_chunks:
                break
    
    except Exception as drain_error:
        logger.warning(f"Error draining stream after tool limit: {drain_error}")
    
    break

# AFTER (lines 490-495) - SIMPLIFIED TO 5 LINES
if finish_reason == "xml_tool_limit_reached":
    logger.info("XML tool limit reached - stopping immediately without draining stream")
    self.trace.event(
        name="xml_tool_limit_reached_immediate_stop", 
        level="DEFAULT", 
        status_message="XML tool limit reached - stopping immediately to prevent further LLM token generation"
    )
    # Immediately break from the loop to stop consuming chunks
    # This prevents the LLM from continuing to generate tokens in the background
    break
```

**Impact**: 
- ✅ Prevents hanging on tool limit (addresses Problem #6)
- ✅ Stops LLM token generation immediately
- ⚠️ May lose usage data that was captured during drain

---

### Change 5: Resource cleanup in finally block

```python
# NEW CODE (in finally block, after line 946)
# Phase 3: Resource Cleanup - Cancel pending tasks and close generator
try:
    # Cancel all pending tool execution tasks when stopping
    if pending_tool_executions:
        logger.info(f"Cancelling {len(pending_tool_executions)} pending tool executions due to stop/cancellation")
        for execution in pending_tool_executions:
            task = execution.get("task")
            if task and not task.done():
                try:
                    task.cancel()
                except Exception as cancel_err:
                    logger.warning(f"Error cancelling tool execution task: {cancel_err}")
    
    # Try to close the LLM response generator if it supports aclose()
    # This helps stop the underlying HTTP connection from continuing
    if hasattr(llm_response, 'aclose'):
        try:
            await llm_response.aclose()
            logger.debug(f"Closed LLM response generator for thread {thread_id}")
        except Exception as close_err:
            logger.debug(f"Error closing LLM response generator (may not support aclose): {close_err}")
    elif hasattr(llm_response, 'close'):
        try:
            llm_response.close()
            logger.debug(f"Closed LLM response generator (sync close) for thread {thread_id}")
        except Exception as close_err:
            logger.debug(f"Error closing LLM response generator (sync): {close_err}")
except Exception as cleanup_err:
    logger.warning(f"Error during resource cleanup: {cleanup_err}")
```

**Impact**: 
- ✅ Prevents resource leaks from pending tool tasks
- ✅ Closes LLM generator connection properly
- ✅ Addresses Problem #2 (error propagation)

---

## File 2: `backend/run_agent_background.py` (KEY FILE)

### Change 1: Create cancellation event

```python
# NEW CODE (after line 117)
async def run_agent_background(
    agent_run_id: str,
    thread_id: str,
    # ... other params
):
    pubsub = None
    stop_checker = None
    stop_signal_received = False
    
    # Create cancellation event to signal LLM to stop
    cancellation_event = asyncio.Event()  # ← NEW
```

**Impact**: Creates event for signaling cancellation

---

### Change 2: Set cancellation event on STOP signal

```python
# BEFORE (line 137)
if data == "STOP":
    logger.debug(f"Received STOP signal for agent run {agent_run_id} (Instance: {instance_id})")
    stop_signal_received = True
    break

# AFTER (line 137)
if data == "STOP":
    logger.debug(f"Received STOP signal for agent run {agent_run_id} (Instance: {instance_id})")
    stop_signal_received = True
    # Set cancellation event to stop LLM execution immediately
    cancellation_event.set()  # ← NEW
    break
```

**Impact**: Signals LLM to stop when STOP received from Redis

---

### Change 3: Pass cancellation event to run_agent

```python
# BEFORE (line 166)
agent_gen = run_agent(
    thread_id=thread_id, 
    project_id=project_id,
    model_name=effective_model,
    agent_config=agent_config,
    trace=trace,
)

# AFTER (line 166)
agent_gen = run_agent(
    thread_id=thread_id, 
    project_id=project_id,
    model_name=effective_model,
    agent_config=agent_config,
    trace=trace,
    cancellation_event=cancellation_event,  # ← NEW
)
```

**Impact**: Propagates cancellation event through call chain

---

## File 3: `backend/core/run.py` (Propagation)

**Expected Change**: `run_agent()` function will accept and pass `cancellation_event` to `response_processor.process_streaming_response()`

---

## File 4: `backend/core/agentpress/thread_manager.py` (Propagation)

**Expected Change**: Thread manager will accept and pass `cancellation_event` parameter

---

## New Files (WIP Features - Not Critical for Streaming)

### File 5: `backend/core/api_sanitized.py` (NEW - 239 lines)
- Test endpoint for sanitized GET messages
- **Not needed for streaming fixes**
- Can be included or skipped

### File 6: `backend/core/utils/message_sanitizer.py` (NEW - 366 lines)
- Message sanitization utilities
- **Not needed for streaming fixes**
- Can be included or skipped

### File 7: `frontend/src/app/(dashboard)/test-sanitized/page.tsx` (Modified)
- Frontend test page for sanitized messages
- **Not needed for streaming fixes**
- May cause conflicts, can be skipped

---

## File 8: `backend/core/tools/task_list_tool.py` (Modified - 105 lines added)

**Purpose**: Fixes string parsing bug in task list tool (mentioned in commit subject)

**Relevance**: Related to tool execution, may be useful but not critical for streaming

---

## Files 9-10: Minor Changes

- `backend/api.py` - Minor modifications (5 lines)
- `backend/core/ai_models/manager.py` - Minor modifications (2 lines)

---

## Approval Decision Matrix

| Component | Critical? | Action |
|-----------|-----------|--------|
| Cancellation event system | ✅ YES | Include |
| Immediate stop on tool limit | ✅ YES | Include |
| Resource cleanup | ✅ YES | Include |
| api_sanitized.py | ❌ NO | Skip or include (low risk) |
| message_sanitizer.py | ❌ NO | Skip or include (low risk) |
| test-sanitized/page.tsx | ❌ NO | Skip (may conflict) |
| task_list_tool.py changes | ⚠️ MAYBE | Include if no conflicts |

---

## Recommendation

**APPROVE** cherry-pick with strategy:
1. ✅ Cherry-pick entire commit first
2. ⚠️ If conflicts occur, resolve manually
3. ⚠️ If WIP files cause issues, revert them individually
4. ✅ Test backend after cherry-pick

**Expected Conflicts**: 
- `response_processor.py` - May have baseline differences
- `test-sanitized/page.tsx` - Frontend may not have this file

**Conflict Resolution Strategy**:
- Keep THEIRS for core cancellation logic
- Skip frontend test page if conflicts
- Keep WIP files if they don't conflict

---

## Testing Plan After Cherry-Pick

1. ✅ Backend starts without errors
2. ✅ Streaming works normally
3. ✅ Cancellation event prevents hanging
4. ✅ Resource cleanup prevents leaks
5. ✅ No new console errors

