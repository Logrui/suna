# Required Output Format Architecture

## Overview

This document outlines the architecture for implementing a "required output format" or "required tool use" validation system for agent runs. This feature ensures agents complete specific actions (e.g., sending an email, creating a task) before the run is allowed to complete.

## Use Case

**Gmail Trigger Example:**
- User receives an email via Gmail Composio Trigger
- Workflow triggers an agent to respond
- **Requirement:** Agent MUST send an email back before the run completes
- **Behavior:** If agent attempts to finish without sending email, force it to continue
- **Safety:** Maximum of 10 "continues" to prevent infinite loops

## Key Integration Points

### 1. **Configuration Storage**

#### Location: Agent Configuration Schema
- **Table:** `agents` (or `agent_triggers` for trigger-specific requirements)
- **Field:** `agentpress_tools` JSONB or new `required_output` JSONB field

**Recommended Schema:**
```json
{
  "required_output": {
    "enabled": true,
    "mode": "tool_required",  // or "response_required"
    "required_tools": ["send_email", "composio_gmail_send_message"],
    "max_continuation_attempts": 10,
    "failure_action": "notify_user",  // or "force_stop", "fallback_response"
    "prompt_on_missing": "You must send an email response before completing this task."
  }
}
```

**Storage Location Options:**

**Option A: Agent-Level Configuration** (Most flexible)
- Store in `agents.agentpress_tools` or `agents.metadata`
- Applies to all runs of this agent
- Best for agents designed with specific workflows

**Option B: Trigger-Level Configuration** (Most targeted)
- Store in `agent_triggers.config`
- Applies only to trigger-initiated runs
- Best for trigger-specific requirements (Gmail, Slack, etc.)

**Option C: Run-Level Configuration** (Most granular)
- Pass via `run_agent_background()` parameters
- Stored in `agent_runs.metadata`
- Best for dynamic, per-run requirements

**Recommendation:** Start with Option B (Trigger-Level), expand to Option A later.

---

### 2. **Validation Logic - Response Processor**

#### Location: `backend/core/agentpress/response_processor.py`

**Current Behavior:**
- Line 900-901: Sets `tools_executed = True` when tools are called
- This flag triggers auto-continue in thread_manager

**Required Changes:**
1. **Track which specific tools were called** during the run
2. **Add validation check** before setting final status

**Implementation Touchpoint:**

```python
# File: backend/core/agentpress/response_processor.py
# Location: process_streaming_response() method around line 900

async def process_streaming_response(...):
    # ... existing code ...

    # NEW: Track executed tools
    executed_tool_names = []
    for ctx in tool_execution_contexts:
        if ctx.result and ctx.result.status == "success":
            executed_tool_names.append(ctx.function_name)

    # Existing code
    if xml_tool_call_count > 0 or len(complete_native_tool_calls) > 0:
        finish_content["tools_executed"] = True

        # NEW: Add executed tool tracking
        finish_content["executed_tool_names"] = executed_tool_names

        # NEW: Check required output validation
        validation_result = await self._validate_required_output(
            thread_id=thread_id,
            executed_tool_names=executed_tool_names,
            config=config
        )

        finish_content["required_output_satisfied"] = validation_result["satisfied"]
        finish_content["missing_required_tools"] = validation_result.get("missing_tools", [])
```

**New Method to Add:**

```python
async def _validate_required_output(
    self,
    thread_id: str,
    executed_tool_names: List[str],
    config: ProcessorConfig
) -> Dict[str, Any]:
    """
    Validate if required output conditions are met.

    Returns:
        {
            "satisfied": bool,
            "missing_tools": List[str],
            "should_continue": bool
        }
    """
    # Load required output config from agent_config or thread metadata
    required_config = self.agent_config.get("required_output", {})

    if not required_config.get("enabled", False):
        return {"satisfied": True, "should_continue": False}

    required_tools = required_config.get("required_tools", [])

    # Check if any required tool was executed
    executed_required_tools = [
        tool for tool in required_tools
        if tool in executed_tool_names
    ]

    if len(executed_required_tools) > 0:
        # At least one required tool was called
        return {
            "satisfied": True,
            "missing_tools": [],
            "should_continue": False
        }
    else:
        # No required tools called yet
        return {
            "satisfied": False,
            "missing_tools": required_tools,
            "should_continue": True
        }
```

---

### 3. **Auto-Continue Logic - Thread Manager**

#### Location: `backend/core/agentpress/thread_manager.py`

**Current Behavior:**
- Line 660-689: `_check_auto_continue_trigger()` decides when to continue
- Checks for `tools_executed`, `finish_reason == 'tool_calls'`, `finish_reason == 'length'`

**Required Changes:**
1. **Add new auto-continue condition** for missing required output
2. **Track continuation attempts** to prevent infinite loops
3. **Inject prompt** to guide agent toward required action

**Implementation Touchpoint:**

```python
# File: backend/core/agentpress/thread_manager.py
# Location: _check_auto_continue_trigger() around line 660-689

def _check_auto_continue_trigger(
    self, chunk: Dict[str, Any], auto_continue_state: Dict[str, Any],
    native_max_auto_continues: int
) -> bool:
    """Check if a response chunk should trigger auto-continue."""
    if chunk.get('type') == 'status':
        try:
            content = json.loads(chunk.get('content', '{}')) if isinstance(chunk.get('content'), str) else chunk.get('content', {})
            finish_reason = content.get('finish_reason')
            tools_executed = content.get('tools_executed', False)

            # NEW: Check required output validation
            required_output_satisfied = content.get('required_output_satisfied', True)
            missing_required_tools = content.get('missing_required_tools', [])

            # Existing auto-continue triggers
            if finish_reason == 'tool_calls' or tools_executed:
                if native_max_auto_continues > 0:
                    logger.debug(f"Auto-continuing for tool execution ({auto_continue_state['count'] + 1}/{native_max_auto_continues})")
                    auto_continue_state['active'] = True
                    auto_continue_state['count'] += 1
                    return True
            elif finish_reason == 'length':
                logger.debug(f"Auto-continuing for length limit ({auto_continue_state['count'] + 1}/{native_max_auto_continues})")
                auto_continue_state['active'] = True
                auto_continue_state['count'] += 1
                return True

            # NEW: Auto-continue for missing required output
            elif not required_output_satisfied and missing_required_tools:
                # Check continuation limit (use separate limit for required output)
                required_output_attempts = auto_continue_state.get('required_output_attempts', 0)
                max_required_attempts = self._get_max_required_output_attempts()

                if required_output_attempts < max_required_attempts:
                    logger.warning(
                        f"Required output not satisfied. Missing tools: {missing_required_tools}. "
                        f"Auto-continuing ({required_output_attempts + 1}/{max_required_attempts})"
                    )
                    auto_continue_state['active'] = True
                    auto_continue_state['count'] += 1
                    auto_continue_state['required_output_attempts'] = required_output_attempts + 1

                    # NEW: Inject reminder message
                    self._inject_required_output_reminder(missing_required_tools, auto_continue_state)

                    return True
                else:
                    logger.error(
                        f"Required output not satisfied after {max_required_attempts} attempts. "
                        f"Stopping agent run. Missing: {missing_required_tools}"
                    )
                    # Handle failure according to config
                    self._handle_required_output_failure(missing_required_tools)
                    return False

        except (json.JSONDecodeError, TypeError):
            pass

    return False

def _get_max_required_output_attempts(self) -> int:
    """Get max continuation attempts for required output from agent config."""
    if not self.agent_config:
        return 10  # Default

    required_config = self.agent_config.get("required_output", {})
    return required_config.get("max_continuation_attempts", 10)

def _inject_required_output_reminder(self, missing_tools: List[str], auto_continue_state: Dict[str, Any]):
    """Inject a reminder message to guide the agent."""
    if not self.agent_config:
        return

    required_config = self.agent_config.get("required_output", {})
    reminder_prompt = required_config.get(
        "prompt_on_missing",
        f"IMPORTANT: You must use one of these tools before completing: {', '.join(missing_tools)}"
    )

    # Store reminder in continuous_state to be prepended to next LLM call
    auto_continue_state['continuous_state']['required_output_reminder'] = reminder_prompt

def _handle_required_output_failure(self, missing_tools: List[str]):
    """Handle failure to satisfy required output after max attempts."""
    if not self.agent_config:
        return

    required_config = self.agent_config.get("required_output", {})
    failure_action = required_config.get("failure_action", "notify_user")

    if failure_action == "notify_user":
        # Log error for user notification
        logger.error(f"Agent failed to complete required actions: {missing_tools}")
        # Could also create a system message in the thread
    elif failure_action == "force_stop":
        # Just stop, already handled
        pass
    # Add other failure actions as needed
```

**Reminder Injection in _execute_run():**

```python
# File: backend/core/agentpress/thread_manager.py
# Location: _execute_run() around line 440-445

# Handle auto-continue context
if auto_continue_state['count'] > 0 and auto_continue_state['continuous_state'].get('accumulated_content'):
    partial_content = auto_continue_state['continuous_state']['accumulated_content']
    messages.append({"role": "assistant", "content": partial_content})

# NEW: Inject required output reminder if present
if auto_continue_state['continuous_state'].get('required_output_reminder'):
    reminder = auto_continue_state['continuous_state']['required_output_reminder']
    messages.append({
        "role": "user",
        "content": f"🔔 SYSTEM REMINDER: {reminder}"
    })
    # Clear reminder after injection
    auto_continue_state['continuous_state']['required_output_reminder'] = None
```

---

### 4. **API Integration - Trigger Service**

#### Location: `backend/core/triggers/trigger_service.py`

**Integration Point:**
When a trigger fires and processes an event, inject the required output config into the agent run.

```python
# File: backend/core/triggers/trigger_service.py
# Location: process_trigger_event() around line 200-224

async def process_trigger_event(self, trigger_id: str, raw_data: Dict[str, Any]) -> TriggerResult:
    trigger = await self.get_trigger(trigger_id)
    # ... existing code ...

    result = await provider_service.process_event(trigger, event)

    # NEW: If this trigger requires specific output, add to agent_prompt or execution_variables
    if result.should_execute_agent:
        # Inject required output config
        required_output_config = trigger.config.get("required_output")
        if required_output_config:
            result.execution_variables["required_output"] = required_output_config

    return result
```

**Modified Agent Run Start:**

```python
# File: backend/core/agent_runs.py
# Location: Where agent runs are started from triggers

# When starting agent run from trigger, merge required output config
agent_config = await _load_agent_config(...)

# NEW: Merge trigger's required output config
if trigger_execution_variables and "required_output" in trigger_execution_variables:
    if not agent_config:
        agent_config = {}
    agent_config["required_output"] = trigger_execution_variables["required_output"]

# Pass to run_agent_background
run_agent_background.send(
    agent_run_id=agent_run_id,
    thread_id=thread_id,
    instance_id=instance_id,
    project_id=project_id,
    model_name=effective_model,
    agent_config=agent_config,  # Now includes required_output
    request_id=request_id
)
```

---

### 5. **Database Schema Changes**

#### Option A: Extend `agent_triggers` table

```sql
-- Add required_output configuration to triggers
-- This is already flexible via the config JSONB field

-- Example trigger config:
UPDATE agent_triggers
SET config = config || jsonb_build_object(
    'required_output', jsonb_build_object(
        'enabled', true,
        'required_tools', jsonb_build_array('composio_gmail_send_message'),
        'max_continuation_attempts', 10,
        'prompt_on_missing', 'You must send an email response.'
    )
)
WHERE trigger_id = 'your-trigger-id';
```

#### Option B: Extend `agents` table (for agent-level defaults)

```sql
-- Add metadata field if not exists
-- (Already exists as JSONB in agents table)

-- Example agent config:
UPDATE agents
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'required_output', jsonb_build_object(
        'enabled', true,
        'required_tools', jsonb_build_array('send_email'),
        'max_continuation_attempts', 10
    )
)
WHERE agent_id = 'your-agent-id';
```

#### Option C: New tracking table for granular logging

```sql
CREATE TABLE IF NOT EXISTS required_output_validations (
    validation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    thread_id UUID NOT NULL REFERENCES threads(thread_id) ON DELETE CASCADE,
    attempt_number INT NOT NULL,
    required_tools JSONB NOT NULL,
    executed_tools JSONB NOT NULL,
    satisfied BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_required_output_agent_run ON required_output_validations(agent_run_id);
```

---

## Implementation Phases

### Phase 1: Core Validation Logic (MVP)
1. Add `required_output` config to `agent_triggers.config`
2. Modify `response_processor.py`:
   - Track executed tool names
   - Add `_validate_required_output()` method
   - Include validation results in status messages
3. Modify `thread_manager.py`:
   - Update `_check_auto_continue_trigger()` to check validation
   - Add basic continuation limit (10 attempts)
4. Test with Gmail trigger example

### Phase 2: Enhanced UX
1. Add prompt injection for reminders
2. Implement `_inject_required_output_reminder()`
3. Add user-facing messages when max attempts reached
4. Create admin UI for configuring required output in trigger settings

### Phase 3: Advanced Features
1. Support multiple validation modes:
   - `tool_required`: At least one of specified tools must be called
   - `all_tools_required`: All specified tools must be called
   - `response_format_required`: Response must match a schema
2. Add failure actions:
   - `notify_user`: Send notification
   - `fallback_response`: Use a predefined fallback
   - `escalate`: Notify admin or trigger alternate workflow
3. Implement validation logging table
4. Add analytics dashboard for validation failures

### Phase 4: Extension to Other Use Cases
1. Extend to non-trigger workflows (manual agent runs)
2. Support conditional requirements (if-then logic)
3. Support time-based requirements (must complete within X minutes)

---

## Code Files to Modify

### Required Changes (Phase 1)
1. **`backend/core/agentpress/response_processor.py`** (~900 lines)
   - Add tool tracking: ~50 lines
   - Add validation method: ~30 lines

2. **`backend/core/agentpress/thread_manager.py`** (~694 lines)
   - Modify `_check_auto_continue_trigger()`: ~30 lines
   - Add helper methods: ~40 lines

3. **`backend/core/triggers/trigger_service.py`** (~318 lines)
   - Modify `process_trigger_event()`: ~10 lines

4. **`backend/core/agent_runs.py`** (~200 lines shown)
   - Modify agent config loading: ~15 lines

### API Models (Phase 2)
5. **`backend/core/api_models/agents.py`** (~136 lines)
   - Add `RequiredOutputConfig` model: ~20 lines

6. **Frontend trigger configuration UI** (TBD)

---

## Example Configuration

### Gmail Auto-Reply Trigger

```json
{
  "trigger_id": "gmail-trigger-123",
  "agent_id": "email-responder-agent",
  "provider_id": "composio",
  "trigger_type": "webhook",
  "name": "Gmail Auto-Reply",
  "config": {
    "composio_trigger_id": "gmail_new_email",
    "trigger_slug": "GMAIL_NEW_GMAIL_MESSAGE",
    "required_output": {
      "enabled": true,
      "mode": "tool_required",
      "required_tools": [
        "composio_gmail_send_message",
        "composio_gmail_create_draft"
      ],
      "max_continuation_attempts": 10,
      "failure_action": "notify_user",
      "prompt_on_missing": "You must send an email reply using composio_gmail_send_message or create a draft using composio_gmail_create_draft before completing this task."
    }
  }
}
```

### Slack Message Responder Trigger

```json
{
  "trigger_id": "slack-trigger-456",
  "agent_id": "slack-responder-agent",
  "provider_id": "composio",
  "trigger_type": "webhook",
  "name": "Slack Message Responder",
  "config": {
    "composio_trigger_id": "slack_new_message",
    "trigger_slug": "SLACK_NEW_MESSAGE",
    "required_output": {
      "enabled": true,
      "mode": "tool_required",
      "required_tools": [
        "composio_slack_send_message"
      ],
      "max_continuation_attempts": 8,
      "failure_action": "escalate",
      "prompt_on_missing": "You must respond to this Slack message using composio_slack_send_message."
    }
  }
}
```

---

## Testing Strategy

### Unit Tests

1. **`test_response_processor.py`**
   - Test `_validate_required_output()` with various tool combinations
   - Test tracking of executed tools

2. **`test_thread_manager.py`**
   - Test auto-continue trigger for missing required output
   - Test max attempts limit
   - Test reminder injection

### Integration Tests

3. **`test_required_output_integration.py`**
   - Simulate full agent run with Gmail trigger
   - Verify agent continues until email is sent
   - Verify max attempts limit works
   - Test with multiple required tools

### Manual Testing

4. **Gmail Trigger Test**
   - Set up real Gmail trigger with Composio
   - Configure required output for `composio_gmail_send_message`
   - Trigger with test email
   - Verify agent sends response
   - Test failure case (agent refuses to send email)

---

## Performance Considerations

1. **Minimal Overhead:**
   - Validation only runs at status messages (once per LLM response)
   - No additional DB queries if config is passed in agent_config
   - ~5-10ms per validation check

2. **Token Usage:**
   - Reminder messages add ~50-100 tokens per continuation
   - Max 10 continuations = ~500-1000 extra tokens worst case
   - Acceptable overhead for ensuring task completion

3. **Latency:**
   - No impact on streaming response
   - Validation happens during status message emission
   - No user-facing latency increase

---

## Security & Safety

1. **Infinite Loop Prevention:**
   - Hard limit of 10 continuation attempts (configurable)
   - Separate counter for required output attempts
   - Logs errors when max attempts reached

2. **Configuration Validation:**
   - Validate required_tools array contains valid tool names
   - Validate max_continuation_attempts is reasonable (1-20)
   - Prevent malicious configs from causing issues

3. **User Control:**
   - Users can disable required output per trigger
   - Users can manually stop agent runs at any time
   - Failure actions are configurable per trigger

---

## Future Enhancements

1. **Smart Validation:**
   - Use LLM to determine if requirement is semantically satisfied
   - Example: "Email must include apology" - check content, not just tool call

2. **Multi-Step Requirements:**
   - Require sequence of tools: "First search, then draft, then send"
   - Support conditional requirements: "If customer angry, escalate; else respond"

3. **Learning from Failures:**
   - Track common failure patterns
   - Suggest better prompts or tool configurations
   - Auto-adjust max attempts based on success rates

4. **Integration with Other Systems:**
   - Zapier-style "Required Actions"
   - Composio trigger templates with pre-configured requirements
   - Workflow builder with visual required output configuration

---

## Summary of Touchpoints

| Component | File | Method/Line | Change Type |
|-----------|------|-------------|-------------|
| **Response Processor** | `response_processor.py` | `process_streaming_response()` ~900 | Add tool tracking & validation |
| **Response Processor** | `response_processor.py` | New method | Add `_validate_required_output()` |
| **Thread Manager** | `thread_manager.py` | `_check_auto_continue_trigger()` ~660 | Add required output condition |
| **Thread Manager** | `thread_manager.py` | `_execute_run()` ~440 | Inject reminder messages |
| **Thread Manager** | `thread_manager.py` | New methods | Add helper methods |
| **Trigger Service** | `trigger_service.py` | `process_trigger_event()` ~200 | Pass required config |
| **Agent Runs** | `agent_runs.py` | Agent loading | Merge trigger config |
| **Database** | `agent_triggers` table | `config` column | Store required_output JSON |

---

## Conclusion

This architecture provides a robust, extensible system for ensuring agents complete required actions before finishing. The implementation is:

- **Minimal:** Leverages existing auto-continue mechanism
- **Flexible:** Configurable per trigger or agent
- **Safe:** Hard limits prevent infinite loops
- **User-Friendly:** Clear error messages and guidance
- **Performant:** Minimal overhead, no blocking operations

The system can be implemented in phases, starting with basic validation and expanding to advanced features as needed.
