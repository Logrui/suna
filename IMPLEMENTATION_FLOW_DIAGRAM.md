# Required Output Format - Implementation Flow Diagram

## 🔄 Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   1. Trigger Fires (Gmail)                      │
│                                                                 │
│  Gmail → Composio → Webhook → trigger_service.py               │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│            2. Load Agent Config + Required Output               │
│                                                                 │
│  • Load agent configuration                                     │
│  • Merge trigger's required_output config                       │
│  • Pass to run_agent_background()                               │
│                                                                 │
│  Config Example:                                                │
│  {                                                              │
│    "required_output": {                                         │
│      "enabled": true,                                           │
│      "required_tools": ["composio_gmail_send_message"],         │
│      "max_continuation_attempts": 10                            │
│    }                                                            │
│  }                                                              │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                3. Agent Runs (thread_manager.py)                │
│                                                                 │
│  run_thread() → _execute_run() → LLM API Call                  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│           4. Process LLM Response (response_processor.py)       │
│                                                                 │
│  • Parse tool calls (XML or native)                             │
│  • Execute tools                                                │
│  • Track executed_tool_names: ["web_search", "read_file"]      │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│           5. Validate Required Output ✨ NEW                    │
│                      (response_processor.py)                    │
│                                                                 │
│  _validate_required_output(                                     │
│    executed_tools=["web_search", "read_file"],                 │
│    required_tools=["composio_gmail_send_message"]              │
│  )                                                              │
│                                                                 │
│  Returns:                                                       │
│  {                                                              │
│    "satisfied": false,  ❌                                      │
│    "missing_tools": ["composio_gmail_send_message"],           │
│    "should_continue": true                                      │
│  }                                                              │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│        6. Emit Status Message with Validation Results           │
│                                                                 │
│  {                                                              │
│    "type": "status",                                            │
│    "content": {                                                 │
│      "finish_reason": "stop",                                   │
│      "tools_executed": true,                                    │
│      "executed_tool_names": ["web_search", "read_file"],       │
│      "required_output_satisfied": false,  ❌                    │
│      "missing_required_tools": ["composio_gmail_send_message"] │
│    }                                                            │
│  }                                                              │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│    7. Check Auto-Continue ✨ NEW (thread_manager.py)            │
│                                                                 │
│  _check_auto_continue_trigger()                                 │
│                                                                 │
│  Conditions:                                                    │
│  ✓ finish_reason == 'tool_calls' → continue                    │
│  ✓ finish_reason == 'length' → continue                        │
│  ✓ required_output_satisfied == false → continue ✨            │
│                                                                 │
│  If required output not satisfied:                              │
│  • Check continuation attempts (< 10?)                          │
│  • If YES → Set auto_continue_state['active'] = true           │
│  • Increment required_output_attempts                           │
│  • Inject reminder prompt                                       │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ↓
                     ┌────────┴────────┐
                     │                 │
           ✅ Attempts < 10     ❌ Attempts >= 10
                     │                 │
                     ↓                 ↓
         ┌────────────────────┐  ┌────────────────────┐
         │  8a. Continue Run  │  │ 8b. Stop with Error│
         │                    │  │                    │
         │ • Inject reminder: │  │ "Required output   │
         │   "You must send   │  │  not satisfied     │
         │   an email!"       │  │  after 10 attempts"│
         │                    │  │                    │
         │ • Loop back to     │  │ • Log error        │
         │   step 3 (LLM call)│  │ • Notify user      │
         └────────┬───────────┘  └────────────────────┘
                  │
                  ↓
         ┌─────────────────────────────┐
         │ 9. Agent Responds (Attempt) │
         │                             │
         │ Tools used this time:       │
         │ ["composio_gmail_send_..."] │
         └────────┬────────────────────┘
                  │
                  ↓
         ┌─────────────────────────────┐
         │ 10. Validate Again          │
         │                             │
         │ executed_tools now includes:│
         │ ["composio_gmail_send_..."] │
         │                             │
         │ required_output_satisfied:  │
         │ true ✅                     │
         └────────┬────────────────────┘
                  │
                  ↓
         ┌─────────────────────────────┐
         │ 11. Run Completes ✅        │
         │                             │
         │ • Email sent successfully   │
         │ • All requirements met      │
         │ • Agent run finishes        │
         └─────────────────────────────┘
```

## 📊 State Diagram

```
                    ┌──────────────┐
                    │ Agent Start  │
                    └──────┬───────┘
                           │
                           ↓
                  ┌────────────────┐
                  │  LLM Response  │
                  └────────┬───────┘
                           │
                           ↓
              ┌────────────────────────┐
              │  Execute Tools         │
              │  Track: executed_tools │
              └────────┬───────────────┘
                       │
                       ↓
          ┌────────────────────────────┐
          │   Validate Required Output │
          └────────┬──────────┬────────┘
                   │          │
        ✅ Satisfied        ❌ Not Satisfied
                   │          │
                   │          ↓
                   │    ┌─────────────────┐
                   │    │ Attempts < Max? │
                   │    └────┬────────┬───┘
                   │         │        │
                   │    ✅ YES     ❌ NO
                   │         │        │
                   │         ↓        ↓
                   │    ┌─────┐  ┌────────┐
                   │    │CONT │  │  STOP  │
                   │    │INUE │  │ ERROR  │
                   │    └──┬──┘  └────────┘
                   │       │
                   │       ↓
                   │  ┌──────────┐
                   │  │ Inject   │
                   │  │ Reminder │
                   │  └────┬─────┘
                   │       │
                   │       └──────┐
                   │              │
                   │              ↓
                   │      ┌──────────────┐
                   │      │ Loop to LLM  │
                   │      └──────────────┘
                   │
                   ↓
            ┌──────────────┐
            │ Run Complete │
            └──────────────┘
```

## 🎭 Example Execution Trace

### Scenario: Gmail Auto-Reply

```
Time  | Event                              | State
------|------------------------------------|---------------------------------
0.0s  | Gmail trigger fires               | New email received
0.1s  | Load agent config                 | required_output enabled
0.2s  | Start agent run                   | auto_continue_state = {count:0}
0.5s  | LLM responds                      | Uses web_search, read_file
1.0s  | Execute tools                     | executed_tools = [web_search, read_file]
1.1s  | Validate required output          | ❌ Missing: composio_gmail_send_message
1.2s  | Check auto-continue               | ✅ Continue (attempt 1/10)
1.3s  | Inject reminder                   | "You must send an email!"
1.5s  | LLM call #2                       | With reminder message
2.0s  | LLM responds                      | Uses composio_gmail_send_message
2.5s  | Execute tools                     | executed_tools = [..., composio_gmail_send_message]
2.6s  | Validate required output          | ✅ Satisfied!
2.7s  | Check auto-continue               | ✅ Requirements met, finish
2.8s  | Run completes                     | Success!
```

## 🔍 Data Flow

```
┌──────────────────┐
│ Trigger Config   │
│ (Database)       │
│                  │
│ {                │
│   required_output│
│ }                │
└────────┬─────────┘
         │
         ↓ (Loaded at start)
┌──────────────────┐
│ Agent Config     │
│ (Runtime Memory) │
│                  │
│ Passed to:       │
│ - ThreadManager  │
│ - ResponseProc   │
└────────┬─────────┘
         │
         ↓ (Used during execution)
┌──────────────────┐      ┌─────────────────┐
│ Response Proc    │─────▶│ Validation      │
│                  │      │                 │
│ executed_tools:  │      │ Check if        │
│ [tool1, tool2]   │      │ required_tools  │
│                  │      │ in executed     │
└────────┬─────────┘      └────────┬────────┘
         │                         │
         │                         ↓
         │                ┌─────────────────┐
         │                │ Validation      │
         │                │ Result          │
         │                │                 │
         │                │ {satisfied: F}  │
         │                └────────┬────────┘
         │                         │
         ↓                         ↓
┌──────────────────┐      ┌─────────────────┐
│ Status Message   │◀─────│ Enriched with   │
│                  │      │ validation data │
│ {                │      └─────────────────┘
│   tools_executed │
│   required_...   │
│   missing_...    │
│ }                │
└────────┬─────────┘
         │
         ↓ (Checked by thread manager)
┌──────────────────┐
│ Thread Manager   │
│                  │
│ Auto-Continue?   │
│ - Check required │
│   _output_...    │
│   satisfied      │
│                  │
│ If NO:           │
│ - Continue run   │
│ - Inject reminder│
└──────────────────┘
```

## 🧩 Component Interaction

```
┌─────────────────────────────────────────────────────────────┐
│                       ThreadManager                         │
│                                                             │
│  ┌──────────────────────────────────────────────┐          │
│  │ run_thread()                                 │          │
│  │                                              │          │
│  │  ┌────────────────────────────────────┐     │          │
│  │  │ _execute_run()                     │     │          │
│  │  │                                    │     │          │
│  │  │  • Get messages                    │     │          │
│  │  │  • Apply context compression       │     │          │
│  │  │  • Make LLM call ────────────────┐ │     │          │
│  │  │  • Process response              │ │     │          │
│  │  └──────────────────────────────────┘ │     │          │
│  │                                       │     │          │
│  │  ┌────────────────────────────────────▼───┐ │          │
│  │  │ _check_auto_continue_trigger()         │ │          │
│  │  │                                        │ │          │
│  │  │  • Check finish_reason                 │ │          │
│  │  │  • Check tools_executed                │ │          │
│  │  │  • Check required_output_satisfied ✨  │ │          │
│  │  │  • Decide: continue or stop?           │ │          │
│  │  └────────────────────────────────────────┘ │          │
│  └──────────────────────────────────────────────┘          │
│                                                             │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              │ Delegates to
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     ResponseProcessor                       │
│                                                             │
│  ┌──────────────────────────────────────────────┐          │
│  │ process_streaming_response()                 │          │
│  │                                              │          │
│  │  • Parse tool calls                          │          │
│  │  • Execute tools                             │          │
│  │  • Track executed_tool_names ✨              │          │
│  │                                              │          │
│  │  ┌────────────────────────────────────┐     │          │
│  │  │ _validate_required_output() ✨     │     │          │
│  │  │                                    │     │          │
│  │  │  Input:                            │     │          │
│  │  │  - executed_tool_names             │     │          │
│  │  │  - agent_config.required_output    │     │          │
│  │  │                                    │     │          │
│  │  │  Output:                           │     │          │
│  │  │  - satisfied: bool                 │     │          │
│  │  │  - missing_tools: List[str]        │     │          │
│  │  └────────────────────────────────────┘     │          │
│  │                                              │          │
│  │  • Emit status message with validation       │          │
│  └──────────────────────────────────────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 🎯 Key Decision Points

```
Decision Point 1: Should we continue?
├─ Condition 1: finish_reason == 'tool_calls'
│  └─ ✅ Yes → Continue
│
├─ Condition 2: finish_reason == 'length'
│  └─ ✅ Yes → Continue
│
├─ Condition 3: required_output_satisfied == false ✨ NEW
│  ├─ Check: attempts < max_attempts?
│  │  ├─ ✅ Yes → Continue with reminder
│  │  └─ ❌ No → Stop with error
│  └─ ✅ Continue or Stop
│
└─ Default: Stop normally

Decision Point 2: What to inject?
├─ If auto-continue for tools
│  └─ Inject: Partial assistant response
│
├─ If auto-continue for length
│  └─ Inject: Partial assistant response
│
├─ If auto-continue for required_output ✨ NEW
│  └─ Inject: Partial response + Reminder message
│
└─ No injection

Decision Point 3: How to fail?
├─ failure_action == 'notify_user'
│  └─ Log error, show message
│
├─ failure_action == 'force_stop'
│  └─ Just stop
│
├─ failure_action == 'escalate'
│  └─ Notify admin, trigger fallback
│
└─ Default: notify_user
```

## 📝 Implementation Checklist

- [ ] 1. Add config schema to `agent_triggers.config`
- [ ] 2. Modify `response_processor.py`:
  - [ ] Track `executed_tool_names`
  - [ ] Add `_validate_required_output()` method
  - [ ] Include validation results in status message
- [ ] 3. Modify `thread_manager.py`:
  - [ ] Update `_check_auto_continue_trigger()`
  - [ ] Add `_inject_required_output_reminder()`
  - [ ] Add `_handle_required_output_failure()`
  - [ ] Update `_execute_run()` to inject reminders
- [ ] 4. Test with Gmail trigger
- [ ] 5. Add UI for configuration
- [ ] 6. Write tests

---

*This flow ensures agents complete required actions while preventing infinite loops through max attempt limits.*
