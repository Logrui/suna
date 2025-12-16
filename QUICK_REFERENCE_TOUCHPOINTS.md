# Quick Reference: Required Output Format Integration Points

This is a quick reference guide for implementing the required output format feature. See `REQUIRED_OUTPUT_FORMAT_ARCHITECTURE.md` for complete details.

## 🎯 Core Concept

Ensure agents complete specific actions (e.g., send email, create task) before finishing a run. If the required action hasn't been completed, force the agent to continue (max 10 attempts).

## 📍 Integration Touchpoints

### 1. **Configuration Storage**
**Location:** Trigger or Agent config
**Recommended:** `agent_triggers.config` JSONB field

```json
{
  "required_output": {
    "enabled": true,
    "required_tools": ["composio_gmail_send_message"],
    "max_continuation_attempts": 10,
    "prompt_on_missing": "You must send an email response."
  }
}
```

### 2. **Tool Execution Tracking**
**File:** `backend/core/agentpress/response_processor.py`
**Method:** `process_streaming_response()`
**Line:** ~900

**Add:**
- Track which tools were executed
- Validate against required tools
- Include validation status in finish_content

```python
executed_tool_names = [ctx.function_name for ctx in tool_execution_contexts if ctx.result]
validation_result = await self._validate_required_output(thread_id, executed_tool_names, config)
finish_content["required_output_satisfied"] = validation_result["satisfied"]
finish_content["missing_required_tools"] = validation_result.get("missing_tools", [])
```

### 3. **Auto-Continue Decision**
**File:** `backend/core/agentpress/thread_manager.py`
**Method:** `_check_auto_continue_trigger()`
**Line:** ~660-689

**Add:**
- Check if required output is satisfied
- Force continue if missing required tools
- Track continuation attempts (max 10)
- Inject reminder prompt

```python
required_output_satisfied = content.get('required_output_satisfied', True)
missing_required_tools = content.get('missing_required_tools', [])

if not required_output_satisfied and missing_required_tools:
    required_output_attempts = auto_continue_state.get('required_output_attempts', 0)
    if required_output_attempts < max_required_attempts:
        auto_continue_state['active'] = True
        auto_continue_state['required_output_attempts'] = required_output_attempts + 1
        self._inject_required_output_reminder(missing_required_tools, auto_continue_state)
        return True
```

### 4. **Reminder Injection**
**File:** `backend/core/agentpress/thread_manager.py`
**Method:** `_execute_run()`
**Line:** ~440-445

**Add:**
- Inject reminder message after auto-continue
- Clear reminder after injection

```python
if auto_continue_state['continuous_state'].get('required_output_reminder'):
    reminder = auto_continue_state['continuous_state']['required_output_reminder']
    messages.append({
        "role": "user",
        "content": f"🔔 SYSTEM REMINDER: {reminder}"
    })
    auto_continue_state['continuous_state']['required_output_reminder'] = None
```

### 5. **Trigger Integration**
**File:** `backend/core/triggers/trigger_service.py`
**Method:** `process_trigger_event()`
**Line:** ~200-224

**Add:**
- Pass required_output config to agent run
- Include in execution_variables

```python
if result.should_execute_agent:
    required_output_config = trigger.config.get("required_output")
    if required_output_config:
        result.execution_variables["required_output"] = required_output_config
```

## 📊 Files to Modify

| Priority | File | Lines to Add | Complexity |
|----------|------|--------------|------------|
| 🔴 High | `response_processor.py` | ~80 | Medium |
| 🔴 High | `thread_manager.py` | ~70 | Medium |
| 🟡 Medium | `trigger_service.py` | ~10 | Low |
| 🟡 Medium | `agent_runs.py` | ~15 | Low |
| 🟢 Low | `api_models/agents.py` | ~20 | Low |

**Total estimated LOC:** ~200 lines across 5 files

## 🧪 Testing Checklist

- [ ] Tool tracking works correctly
- [ ] Validation identifies missing required tools
- [ ] Auto-continue triggers when requirements not met
- [ ] Max attempts limit prevents infinite loops
- [ ] Reminder messages inject correctly
- [ ] Gmail trigger example works end-to-end
- [ ] Agent stops after max attempts with clear error

## 🚀 Implementation Phases

**Phase 1 (MVP):** ~4-6 hours
- Core validation logic
- Basic auto-continue
- Gmail trigger test

**Phase 2 (UX):** ~3-4 hours
- Reminder injection
- User-facing messages
- Admin UI configuration

**Phase 3 (Advanced):** ~6-8 hours
- Multiple validation modes
- Failure actions
- Logging and analytics

## 💡 Key Design Decisions

1. **Leverage existing auto-continue:** Minimal changes to core flow
2. **Trigger-level config:** Most flexible for different use cases
3. **Separate continuation counter:** Don't interfere with normal auto-continue
4. **Soft validation:** Check tool names, not execution results
5. **User control:** Always allow manual override

## 🔗 Related Files

- Full architecture: `REQUIRED_OUTPUT_FORMAT_ARCHITECTURE.md`
- Thread manager: `backend/core/agentpress/thread_manager.py:660`
- Response processor: `backend/core/agentpress/response_processor.py:900`
- Trigger service: `backend/core/triggers/trigger_service.py:200`
- Auto-continue state: `thread_manager.py:273-277`
