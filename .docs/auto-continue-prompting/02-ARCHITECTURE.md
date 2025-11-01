# Architecture Diagram: Auto-Continue System

**Date**: November 1, 2025

---

## System Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER SENDS MESSAGE                             │
│                          "Research AI and create                         │
│                           presentation"                                  │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        AGENT RUN LOOP (run.py)                          │
│  • Creates AgentRunner with config                                      │
│  • Sets native_max_auto_continues = 25                                  │
│  • Initializes generation tracking                                      │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    THREAD MANAGER (thread_manager.py)                   │
│  ┌───────────────────────────────────────────────────────────┐          │
│  │ _auto_continue_generator()                                │          │
│  │ • Creates auto_continue_state = {count: 0, active: True}  │          │
│  │ • Enters loop: while count < max_continues                │          │
│  └───────────────────────────────────────────────────────────┘          │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         _execute_run()                                  │
│  • Fetches conversation history                                         │
│  • Applies context compression (if needed)                              │
│  • Applies prompt caching                                               │
│  • Calls make_llm_api_call()                                           │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       LLM API CALL (llm.py)                             │
│  • Sends messages to LiteLLM Router                                     │
│  • Returns streaming response                                           │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              RESPONSE PROCESSOR (response_processor.py)                 │
│  ┌───────────────────────────────────────────────────────────┐          │
│  │ process_streaming_response()                              │          │
│  │ ┌─────────────────────────────────────────────────────┐   │          │
│  │ │ Stream Loop                                         │   │          │
│  │ │ • Receives chunks from LLM                          │   │          │
│  │ │ • Detects tool calls (XML or native)                │   │          │
│  │ │ • Executes tools (parallel/sequential)              │   │          │
│  │ │ • Yields chunks to frontend                         │   │          │
│  │ │ • Tracks last_message_type                          │   │          │
│  │ └─────────────────────────────────────────────────────┘   │          │
│  │                                                           │          │
│  │ After Stream Complete:                                    │          │
│  │ ┌─────────────────────────────────────────────────────┐   │          │
│  │ │ _should_auto_continue()                             │   │          │
│  │ │ • Check if tools were executed                      │   │          │
│  │ │ • Check if last message is tool/status              │   │          │
│  │ │ • Check if termination tool was called              │   │          │
│  │ │ • Returns: True/False                               │   │          │
│  │ └─────────────────────────────────────────────────────┘   │          │
│  │                                                           │          │
│  │ If should_continue = True:                                │          │
│  │ ┌─────────────────────────────────────────────────────┐   │          │
│  │ │ Yield auto_continue_signal                          │   │          │
│  │ │ {                                                   │   │          │
│  │ │   type: 'auto_continue_signal',                     │   │          │
│  │ │   should_continue: true,                            │   │          │
│  │ │   tool_count: 2,                                    │   │          │
│  │ │   last_message_type: 'tool'                         │   │          │
│  │ │ }                                                   │   │          │
│  │ └─────────────────────────────────────────────────────┘   │          │
│  └───────────────────────────────────────────────────────────┘          │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    AUTO-CONTINUE GENERATOR                              │
│  Receives chunks:                                                        │
│  ┌───────────────────────────────────────────────────────────┐          │
│  │ { type: 'assistant', content: 'I'll search for...' }      │          │
│  │ { type: 'tool', function_name: 'web_search' }             │          │
│  │ { type: 'tool_completed', result: '...' }                 │          │
│  │ { type: 'auto_continue_signal', should_continue: true }   │  ← SIGNAL│
│  └───────────────────────────────────────────────────────────┘          │
│                                                                          │
│  Detects Signal:                                                         │
│  • continuation_needed = True                                            │
│  • Yields all chunks EXCEPT signal to frontend                          │
│                                                                          │
│  After stream completes:                                                 │
│  • auto_continue_state['count'] += 1  (now 1/25)                        │
│  • auto_continue_state['active'] = True                                 │
│  • Calls _add_continuation_prompt()                                     │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   ADD CONTINUATION PROMPT                               │
│  Adds to database:                                                       │
│  {                                                                       │
│    role: 'system',                                                       │
│    content: 'Continue your response. 2 tool(s) have been executed...',  │
│    metadata: { auto_continue_iteration: 1, is_continuation_prompt: true }│
│  }                                                                       │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        LOOP CONTINUES                                   │
│  • Goes back to _execute_run()                                          │
│  • Fetches updated conversation (now includes tool results + prompt)    │
│  • Makes NEW LLM call with updated history                              │
│  • LLM sees: [user msg] [tool call] [tool result] [system: continue]   │
│  • LLM continues naturally: "Based on the search results..."            │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    RESPONSE PROCESSOR (Again)                           │
│  Agent response: "Based on the search results, here are the trends..."  │
│  Agent thinks: "Now I need to create presentation"                      │
│  Agent makes tool call: presentation_tool                                │
│  Tool executes → Yields auto_continue_signal again                      │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  AUTO-CONTINUE ITERATION 2                              │
│  • auto_continue_state['count'] = 2/25                                  │
│  • Adds continuation prompt again                                       │
│  • Loops back to _execute_run()                                         │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       FINAL RESPONSE                                    │
│  Agent: "I've created a presentation with the following slides..."      │
│  No tool calls this time                                                 │
│  _should_auto_continue() returns False                                  │
│  No auto_continue_signal yielded                                        │
│  continuation_needed = False                                            │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    AUTO-CONTINUE LOOP EXITS                             │
│  • while condition: count < max_continues AND active = True             │
│  • active = False (no continuation signal)                              │
│  • Loop breaks                                                           │
│  • Calls _ensure_final_assistant_message()                              │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  FINAL MESSAGE VALIDATION                               │
│  • Queries last message from database                                   │
│  • Checks type: should be 'assistant' or 'llm_response_end'            │
│  • If not, adds placeholder assistant message                           │
│  • ✅ Conversation complete with proper ending                         │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND RECEIVES                                │
│  • All messages in order                                                 │
│  • No auto_continue_signal (filtered)                                   │
│  • Last message is assistant type                                       │
│  • User sees complete, coherent response                                │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Sequence Diagram

```
User    Frontend    Backend     ThreadMgr    ResponseProc    LLM    Tools    DB
  │         │           │            │              │         │       │      │
  │ Message │           │            │              │         │       │      │
  ├────────>│           │            │              │         │       │      │
  │         │  POST     │            │              │         │       │      │
  │         ├──────────>│            │              │         │       │      │
  │         │           │ run_agent()│              │         │       │      │
  │         │           ├───────────>│              │         │       │      │
  │         │           │            │auto_continue_│         │       │      │
  │         │           │            │  generator() │         │       │      │
  │         │           │            ├─────────┐    │         │       │      │
  │         │           │            │ state=  │    │         │       │      │
  │         │           │            │ {0,true}│    │         │       │      │
  │         │           │            │<────────┘    │         │       │      │
  │         │           │            │              │         │       │      │
  │         │           │            │_execute_run()│         │       │      │
  │         │           │            ├─────────────>│         │       │      │
  │         │           │            │              │ Fetch   │       │      │
  │         │           │            │              │ history │       │      │
  │         │           │            │              ├────────────────>│      │
  │         │           │            │              │<────────────────┤      │
  │         │           │            │              │         │       │      │
  │         │           │            │              │ make_   │       │      │
  │         │           │            │              │llm_call()       │      │
  │         │           │            │              ├────────>│       │      │
  │         │           │            │              │         │       │      │
  │         │           │            │              │ stream  │       │      │
  │         │           │            │              │<────────┤       │      │
  │         │           │            │              │         │       │      │
  │         │           │            │              │process_ │       │      │
  │         │           │            │              │stream() │       │      │
  │         │           │            │              ├────┐    │       │      │
  │         │           │            │              │    │    │       │      │
  │         │<──────────┴────────────┴──────────────┤    │    │       │      │
  │ "I'll   │           │            │              │    │    │       │      │
  │ search" │           │            │              │    │    │       │      │
  │         │           │            │              │    │    │       │      │
  │         │           │            │              │    │tool│       │      │
  │         │           │            │              │    │call│       │      │
  │         │<──────────┴────────────┴──────────────┤    │    │       │      │
  │ tool:   │           │            │              │    │    │       │      │
  │ web_srch│           │            │              │    │exec│       │      │
  │         │           │            │              │    ├───────────>│      │
  │         │           │            │              │    │    │       │      │
  │         │           │            │              │    │    │execute│      │
  │         │           │            │              │    │    │<──┐   │      │
  │         │           │            │              │    │    │   │   │      │
  │         │           │            │              │    │    │result│      │
  │         │           │            │              │    │<───┴───────┤      │
  │         │<──────────┴────────────┴──────────────┤    │    │       │      │
  │ tool_   │           │            │              │    │    │       │      │
  │complete │           │            │              │    │    │       │      │
  │         │           │            │              │    │    │       │      │
  │         │           │            │              │    │ end│       │      │
  │         │           │            │              │    │ of │       │      │
  │         │           │            │              │    │ strm       │      │
  │         │           │            │              │<───┘    │       │      │
  │         │           │            │              │         │       │      │
  │         │           │            │              │_should_ │       │      │
  │         │           │            │              │auto_con?│       │      │
  │         │           │            │              ├────┐    │       │      │
  │         │           │            │              │YES │    │       │      │
  │         │           │            │              │<───┘    │       │      │
  │         │           │            │              │         │       │      │
  │         │           │            │<─────────────┤         │       │      │
  │         │           │            │auto_continue_│         │       │      │
  │         │           │            │signal        │         │       │      │
  │         │           │            ├────┐         │         │       │      │
  │         │           │            │set │         │         │       │      │
  │         │           │            │cnt=1         │         │       │      │
  │         │           │            │act=T         │         │       │      │
  │         │           │            │<───┘         │         │       │      │
  │         │           │            │              │         │       │      │
  │         │           │            │_add_cont_    │         │       │      │
  │         │           │            │prompt()      │         │       │      │
  │         │           │            ├──────────────────────────────────────>│
  │         │           │            │              │         │       │      │
  │         │           │            │system: continue...      │       │      │
  │         │           │            │<──────────────────────────────────────┤
  │         │           │            │              │         │       │      │
  │         │           │            │_execute_run()│         │       │      │
  │         │           │            │  (iteration 2)         │       │      │
  │         │           │            ├─────────────>│         │       │      │
  │         │           │            │              │ Fetch   │       │      │
  │         │           │            │              │(updated)│       │      │
  │         │           │            │              ├────────────────>│      │
  │         │           │            │              │<────────────────┤      │
  │         │           │            │              │         │       │      │
  │         │           │            │              │ make_   │       │      │
  │         │           │            │              │llm_call()       │      │
  │         │           │            │              ├────────>│       │      │
  │         │           │            │              │         │       │      │
  │         │<──────────┴────────────┴──────────────┴─────────┤       │      │
  │ "Based  │           │            │              │         │       │      │
  │ on srch"│           │            │              │         │       │      │
  │         │           │            │              │         │       │      │
  │         │           │            │              │ ...more │       │      │
  │         │           │            │              │ tools   │       │      │
  │         │           │            │              │ ...     │       │      │
  │         │           │            │              │         │       │      │
  │         │<──────────┴────────────┴──────────────┴─────────┤       │      │
  │ "Final  │           │            │              │         │       │      │
  │ summary"│           │            │              │         │       │      │
  │         │           │            │              │no tools │       │      │
  │         │           │            │              │no signal│       │      │
  │         │           │            │<─────────────┤         │       │      │
  │         │           │            │              │         │       │      │
  │         │           │            │_ensure_final_│         │       │      │
  │         │           │            │assistant()   │         │       │      │
  │         │           │            ├──────────────────────────────────────>│
  │         │           │            │              │         │       │check │
  │         │           │            │<──────────────────────────────────────┤
  │         │           │            │last=assistant│         │       │  OK  │
  │         │           │            │              │         │       │      │
  │         │           │            │ ✅ Complete  │         │       │      │
  │         │           │<───────────┤              │         │       │      │
  │         │<──────────┤            │              │         │       │      │
  │         │           │            │              │         │       │      │
  │   ✅    │           │            │              │         │       │      │
```

---

## Component Interaction Map

```
┌─────────────────────┐
│   continue.py       │  ← NEW MODULE
│  (Core Logic)       │
└──────────┬──────────┘
           │
           │ Used by:
           │
           ├───────────────────────────────┐
           │                               │
           ▼                               ▼
┌──────────────────────┐        ┌──────────────────────┐
│ response_processor.py│        │  thread_manager.py   │
│                      │        │                      │
│ • _should_auto_      │        │ • _auto_continue_    │
│   continue()         │        │   generator()        │
│   ↓ Uses             │        │   ↓ Uses             │
│   ContinueDecision   │        │   AutoContinue       │
│   Maker              │        │   Manager            │
│                      │        │                      │
│ • Yields signal at   │        │ • Receives signal    │
│   end of stream      │        │ • Manages state      │
│                      │        │ • Adds prompts       │
└──────────┬───────────┘        └──────────┬───────────┘
           │                               │
           │                               │
           ▼                               ▼
┌──────────────────────────────────────────────────────┐
│               Database (Supabase)                    │
│  • messages table                                    │
│  • threads table                                     │
└──────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Message Structure Evolution

**Initial User Message**:
```json
{
  "role": "user",
  "content": "Research AI trends and create presentation",
  "type": "user"
}
```

**First LLM Response (with tool call)**:
```json
{
  "role": "assistant",
  "content": "I'll search for the latest AI trends.",
  "type": "assistant"
}
```

**Tool Call Message**:
```json
{
  "type": "tool",
  "function_name": "web_search",
  "arguments": {"query": "latest AI trends 2025"}
}
```

**Tool Result Message**:
```json
{
  "type": "tool_completed",
  "function_name": "web_search",
  "result": "... search results ..."
}
```

**Auto-Continue Signal** (NOT saved to DB):
```json
{
  "type": "auto_continue_signal",
  "should_continue": true,
  "tool_count": 1,
  "last_message_type": "tool_completed"
}
```

**Continuation Prompt** (saved to DB):
```json
{
  "role": "system",
  "content": "Continue your response. 1 tool(s) have been executed...",
  "type": "system",
  "metadata": {
    "auto_continue_iteration": 1,
    "is_continuation_prompt": true
  }
}
```

**Continued LLM Response**:
```json
{
  "role": "assistant",
  "content": "Based on the search results, here are the key trends...",
  "type": "assistant"
}
```

### 2. State Progression

```
Iteration 0:
  count: 0
  active: true
  continuous_state: {accumulated_content: '', thread_run_id: null}

After First Continue:
  count: 1
  active: true  ← Set by receiving auto_continue_signal
  continuous_state: {accumulated_content: '', thread_run_id: 'xxx'}

After Second Continue:
  count: 2
  active: true
  continuous_state: {accumulated_content: '', thread_run_id: 'xxx'}

Final State (no more tools):
  count: 2
  active: false  ← No signal received
  continuous_state: {accumulated_content: '', thread_run_id: 'xxx'}

Loop exits: count < max_continues (2 < 25) BUT active = false
```

---

## Error Handling Flow

```
Tool Execution
     │
     ├─ Success ──> Continue normally
     │
     └─ Failure
          │
          ├─ Retryable? (timeout, network)
          │    │
          │    ├─ Yes ──> Retry up to 3 times
          │    │            │
          │    │            ├─ Success ──> Continue
          │    │            └─ Still failing ──> Error Recovery Prompt
          │    │
          │    └─ No (validation, auth)
          │         │
          │         └──> Error Recovery Prompt
          │                   │
          │                   ├─ Add system message with error
          │                   ├─ Still trigger auto-continue
          │                   └─ Agent acknowledges and proceeds
          │
          └─ Critical (system crash)
                │
                └──> Stop auto-continue
                      │
                      └──> Return error to user
```

---

## Configuration Flow

```
Environment Variables
     │
     ├─ NATIVE_MAX_AUTO_CONTINUES (default: 25)
     ├─ ENABLE_AUTO_CONTINUE (default: true)
     └─ AUTO_CONTINUE_TERMINATION_TOOLS (default: 'ask,complete,present_presentation')
     │
     ▼
AgentConfig (run.py)
     │
     ├─ native_max_auto_continues: int = 25
     └─ ...
     │
     ▼
ThreadManager
     │
     ├─ ContinueConfig created
     │    │
     │    ├─ max_continues = 25
     │    ├─ enable_continuation = true
     │    └─ termination_tools = ['ask', 'complete', 'present_presentation']
     │
     └─ AutoContinueManager created
          │
          └─ Used throughout auto-continue process
```

---

**Last Updated**: November 1, 2025  
**Status**: ✅ Architecture Complete
