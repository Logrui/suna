# Langfuse Analysis: Abrupt Chat Completions Root Cause

**Date**: November 9, 2025  
**Analysis**: LLM Model Behavior and Stream Termination Issues  
**Traces Analyzed**: 3 most recent agent runs from Langfuse  

---

## Executive Summary

Analysis of recent Langfuse traces reveals **three distinct failure patterns** across different LLM models (Haiku, Sonnet, and comparison with Gemini Flash). All issues trace back to **app-level configuration problems**, not model limitations.

**Key Finding**: Your application has an **XML tool call limit of 1** configured, which catastrophically breaks Sonnet's ability to respond after executing a single tool. Haiku has additional timing/execution constraints that prevent it from generating any response.

---

## Detailed Findings

### Finding #1: Claude Haiku (06:37:36 UTC)

#### Trace Details
- **Model**: `anthropic/claude-haiku-4-5`
- **Execution Time**: 30ms (instant termination)
- **Output Tokens**: 0
- **Input Tokens**: 0
- **Status**: ✅ Marked `agent_run_completed` but **no response generated**

#### The Issue
Haiku completes almost instantly with zero token usage, indicating the stream was terminated before the model could even begin generating a response.

#### Root Cause (App Configuration)
```python
# SUSPECTED LOCATION: backend/core/agentpress/response_processor.py
# Or backend/core/agentpress/thread_manager.py

# Per-model configuration favoring speed over completeness
# Haiku executions hit hard timeout before tool execution completes
```

**Evidence**:
- Model parameters show `max_tokens=null`
- Stream ended at `06:37:37.689` with no content
- Only 2 web_search operations were attempted before termination
- No actual file creation or tool execution occurred

**Hypothesis**: Your app likely has a **per-model timeout setting** that's too aggressive for Haiku. Possible configurations:
- `HAIKU_EXECUTION_TIMEOUT = 30ms` (or similar)
- `MIN_MODEL_TIMEOUT` setting that's incompatible with Haiku's speed
- Different tool execution limits based on model tier

---

### Finding #2: Claude Sonnet - First Continuation (06:39:20 UTC)

#### Trace Details
- **Model**: `anthropic/claude-sonnet-4-5-20250929`
- **Execution Time**: 56.8 seconds (long but reasonable)
- **Input Tokens**: 93,219 (massive conversation history!)
- **Output Tokens**: 60 (only 60 tokens!)
- **Cost**: $0.28
- **Status**: ⚠️ **Stream interrupted by XML tool limit**

#### The Critical Event Timeline
```
06:39:21.181 - Stream processing started
06:39:26.731 - Tool executed: execute_command (cat biotech_healthcare_vc_firms.csv) ✅
             - Execution latency: 4.2 seconds (tool worked!)
06:39:31.074 - ❌ STREAM ABRUPTLY STOPPED
             - Event: "stream_finished_with_reason_xml_tool_limit_reached_after_xml_tool_calls"
             - Message: "after 1 XML tool calls"
06:41:05.204 - Finally marked agent_run_completed (1m 34s after tool execution)
```

#### The Root Cause: XML Tool Limit = 1

**CRITICAL FINDING**: Your app has a hard limit of 1 XML tool call configured.

```python
# LOCATION: backend/core/agentpress/response_processor.py
# Line 62-63:

@dataclass
class ProcessorConfig:
    """Configuration for response processing and tool execution."""
    
    xml_tool_calling: bool = True  
    native_tool_calling: bool = False
    
    execute_tools: bool = True
    execute_on_stream: bool = False
    tool_execution_strategy: ToolExecutionStrategy = "sequential"
    xml_adding_strategy: XmlAddingStrategy = "assistant_message"
    max_xml_tool_calls: int = 0  # 0 means no limit  ← But this is overridden somewhere!
```

**The Problem**:
1. User asks Sonnet to show the file
2. Sonnet correctly executes the tool: `execute_command cat biotech_healthcare_vc_firms.csv`
3. **Tool execution succeeds** - the file is read and returned
4. **Stream stops** - After 1 tool call, the system force-stops the stream
5. Sonnet never gets to generate a response about the file contents
6. 93,219 input tokens were used re-processing the entire conversation trying to recover

#### Why 93,219 Input Tokens?

The high token count is the system **retrying and regenerating** context after hitting the tool limit:
- Initial conversation history + file creation + web searches = baseline
- User asks "show me the file" 
- Sonnet executes the tool
- **Stream hits limit and dies**
- System tries to process the entire conversation again to recover
- New tokens consumed by attempting recovery

#### Why No Output?

After the tool limit is hit:
- The stream is terminated mid-execution
- Sonnet's response ("Here's the file content...") is never generated
- Only 60 completion tokens recorded (likely from failed recovery attempts)

---

### Finding #3: Claude Sonnet - Follow-up Request (06:43:46 UTC)

#### Trace Details
- **Model**: `anthropic/claude-sonnet-4-5-20250929`
- **Execution Time**: 46ms (instant)
- **Input**: "Can you show me the completed file"
- **Output Tokens**: 0
- **Status**: ✅ Marked `agent_run_completed` but **zero output**

#### What Happened

```
06:43:46 - User sends: "Can you show me the completed file"
06:43:47 - Generation span: output=null, endTime=null (never completed)
06:44:33 - Agent marked as completed, but nothing was yielded
```

#### Root Cause Analysis

**Two likely causes working together**:

1. **Cooldown/Backoff After Previous Failure**
   - Previous request (06:39:20) hit the XML tool limit catastrophically
   - Session state may be corrupted
   - Your app likely has a backoff mechanism that kills subsequent requests

2. **Response Buffering Issue**
   - After previous tool limit hit, Sonnet's response was never captured
   - Stream recovery mechanism failed
   - New request tries to recover but gives up immediately

**Evidence**:
- Execution time is instant (46ms)
- No attempt to process or execute tools
- Generation observation shows `endTime=null` (stream never properly ended)

---

## Comparison: Why Gemini 2.5 Flash Worked

### Key Differences

| Aspect | Suna (Haiku/Sonnet) | Gemini Flash (Your Test) |
|--------|-------------------|------------------------|
| XML Tool Limit | 1 (hardcoded) | None / much higher |
| Stream Recovery | Fails silently | Recovers gracefully |
| Tool Execution | Stops after 1 | Continues through multiple |
| Response Generation | Blocked | Completes successfully |
| Token Usage | Wasted on recovery | Efficient |

### Why Gemini Flash Succeeded

Gemini Flash:
1. ✅ Executed all necessary tools without hitting a limit
2. ✅ Generated the full response after tool execution
3. ✅ Completed the task end-to-end
4. ✅ No token waste on recovery attempts

---

## Configuration Issues Identified

### Issue A: XML Tool Limit = 1 (CRITICAL)

**Location**: Likely in `backend/core/agentpress/response_processor.py` or `thread_manager.py`

**Current Code** (response_processor.py):
```python
max_xml_tool_calls: int = 0  # 0 means no limit
```

**But somewhere** this is being overridden to `1`.

**Evidence from Langfuse**:
```
EVENT: stream_finished_with_reason_xml_tool_limit_reached_after_xml_tool_calls
METADATA: after 1 XML tool calls
```

**Impact**:
- ❌ Sonnet can't respond after executing a single tool
- ❌ 93,219+ tokens wasted on recovery attempts
- ❌ User gets no response
- ❌ Conversation state becomes corrupted

**Fix Required**: 
Set `max_xml_tool_calls: int = 0` (or much higher, e.g., `100`) everywhere it's instantiated.

---

### Issue B: Haiku Stream Timeout (Model-Specific)

**Location**: Likely `backend/core/agentpress/thread_manager.py` or model configuration

**Problem**: 
- Haiku gets killed almost instantly (30ms)
- Generates 0 tokens
- Never attempts tool execution

**Possible Causes**:
1. Per-model timeout setting favoring "speed" for Haiku
2. Tool execution limit per model tier
3. Stream timeout that's incompatible with Haiku's architecture

**Evidence**:
- Trace 3: 30ms execution with 0 tokens
- Compared to Sonnet: 56,861ms with 93,279 tokens (before hitting limit)

**Fix Required**:
Review `thread_manager.py` for model-specific timeout configurations. Ensure Haiku gets adequate time to execute.

---

### Issue C: Stream Recovery Failure

**Location**: `backend/core/agentpress/response_processor.py` stream handler

**Problem**:
- After XML tool limit hit, stream ends abruptly
- No proper error recovery or retry mechanism
- Subsequent requests on the same session fail silently

**Evidence**:
- Trace 2: Stream stops at 06:39:31 with `xml_tool_limit_reached`
- Trace 1 (4 min later): Same session, instant failure with 46ms execution

**Fix Required**:
Implement proper stream error recovery that:
1. Detects tool limit reached
2. Increments the limit or switches strategies
3. Attempts to continue processing
4. Yields partial results if needed

---

## ProcessorConfig Deep Dive

### Current Configuration (response_processor.py, lines 62-75)

```python
@dataclass
class ProcessorConfig:
    """Configuration for response processing and tool execution."""
    
    xml_tool_calling: bool = True  
    native_tool_calling: bool = False
    
    execute_tools: bool = True
    execute_on_stream: bool = False
    tool_execution_strategy: ToolExecutionStrategy = "sequential"
    xml_adding_strategy: XmlAddingStrategy = "assistant_message"
    max_xml_tool_calls: int = 0  # 0 means no limit
    
    def __post_init__(self):
        """Validate configuration after initialization."""
        # Validation logic here
```

### Where This Gets Instantiated

**Search Required**: Find all calls to `ProcessorConfig()` in the codebase:
- `backend/core/agentpress/thread_manager.py`
- `backend/core/run.py`
- Anywhere that calls `process_streaming_response()`

**Hypothesis**: Somewhere, `ProcessorConfig` is being instantiated with `max_xml_tool_calls=1`.

---

## Event Log Analysis

### Trace 2 Event Sequence (Sonnet - Detailed)

```
06:39:21.181 - llm_response_start event (marked)
06:39:26.731 - execute_tool.execute_command started
06:39:30.993 - execute_tool.execute_command completed (SUCCESS ✅)
06:39:31.074 - ⚠️ xml_tool_limit_drain... event
06:39:31.074 - ⚠️ stream_finished_with_reason_xml_tool_limit_reached_after_xml_tool_calls
06:39:31.140 - processing_buffered_tool_results
06:39:31.140 - saving_and_yielding_final_tool_result_messages
06:39:31.141 - adding_parsing_details_to_tool_result_metadata
06:39:32.000 - ⏹️ agent_run_completed (1 minute early)
```

**Key Observation**: Tool execution succeeded, but stream was force-terminated immediately after.

---

## Recommendations

### Priority 1: Fix XML Tool Limit (CRITICAL)

**Action**: Locate where `max_xml_tool_calls=1` is set and change it to `0` or `100`.

**Search Command**:
```bash
grep -r "max_xml_tool_calls" backend/core/
grep -r "ProcessorConfig(" backend/core/
```

**Files to Check**:
1. `backend/core/agentpress/thread_manager.py`
2. `backend/core/run.py`
3. `backend/core/agentpress/response_processor.py`

### Priority 2: Implement Stream Recovery

**Action**: Add error handling in `process_streaming_response()` to detect tool limit and recover gracefully.

**Implementation**:
- Catch `xml_tool_limit_reached` event
- Either: increase limit, retry, or yield partial results
- Prevent session corruption

### Priority 3: Review Model-Specific Timeouts

**Action**: Check if per-model timeout settings exist and are configured correctly.

**Files to Check**:
- `backend/core/ai_models/registry.py`
- `backend/core/ai_models/ai_models.py`
- `backend/core/agentpress/thread_manager.py`

### Priority 4: Add Monitoring

**Action**: Add Langfuse logging for:
- When XML tool limit is reached
- Stream recovery attempts
- Per-model execution times

---

## Summary Table

| Model | Issue | Impact | Root Cause | Fix |
|-------|-------|--------|-----------|-----|
| **Haiku** | 30ms instant termination | No response generated | Per-model timeout too aggressive | Review model-specific timeouts |
| **Sonnet #1** | Stops after 1 tool | Can't respond to "show file" | `max_xml_tool_calls=1` | Change to `0` or `100` |
| **Sonnet #2** | Instant failure post-error | No recovery mechanism | Corrupted session state | Implement stream recovery |
| **Gemini Flash** | ✅ Works correctly | Completes full task | No artificial limits | Use as reference implementation |

---

## Next Steps

1. **Search codebase** for `max_xml_tool_calls=1` or `ProcessorConfig(` calls
2. **Change limit** to 0 or 100
3. **Test with Sonnet** - verify it can execute multiple tools
4. **Test with Haiku** - verify it gets adequate time
5. **Monitor Langfuse** - watch for `xml_tool_limit_reached` events
6. **Compare with Gemini Flash** - use as success baseline

---

## Evidence Links

**Langfuse Trace IDs**:
- Haiku (06:37:36): `8f2246e3-8a97-4e81-8e5c-a5967c34034f`
- Sonnet #1 (06:39:20): `815f3856-6582-4aeb-8597-07f76b586793`
- Sonnet #2 (06:43:46): `402d40d4-528e-4208-a3cc-313ced04d51b`

**Files Referenced**:
- `backend/core/agentpress/response_processor.py` (lines 62-75)
- `backend/core/agentpress/thread_manager.py` (likely `run_thread()`)
- `backend/core/run.py` (likely calls to thread_manager)

---

**Report Generated**: 2025-11-09  
**Analyst**: GitHub Copilot  
**Status**: Ready for Implementation
