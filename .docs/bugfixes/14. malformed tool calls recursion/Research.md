# Current Frontend & Backend Parsing System Overview

**Document Generated**: November 10, 2025  
**Current Branch**: `feature/malformed-tool-call-handler`

---

## Table of Contents

1. [Frontend Parsing System](#frontend-parsing-system)
2. [Backend Parsing System](#backend-parsing-system)
3. [Complete End-to-End Flow](#complete-end-to-end-flow)
4. [Current Limitations & Problems](#current-limitations--problems)
5. [Integration Points for Malformed Detection](#integration-points-for-malformed-detection)

---

## Frontend Parsing System

### File: `frontend/src/components/thread/tool-views/xml-parser.ts`

#### Purpose
Frontend XML parser that extracts tool calls from LLM responses for UI rendering.

#### Key Functions

**1. `parseXmlToolCalls(content: string): ParsedToolCall[]`**

Parses new format XML tool calls:
```xml
<function_calls>
<invoke name="tool_name">
<parameter name="param">value</parameter>
</invoke>
</function_calls>
```

**Logic Flow**:
1. Extract `<function_calls>` blocks using regex: `/<function_calls>([\s\S]*?)<\/function_calls>/gi`
2. For each block, find `<invoke>` tags: `/<invoke\s+name=["']([^"']+)["']>([\s\S]*?)<\/invoke>/gi`
3. For each invoke block, extract parameters: `/<parameter\s+name=["']([^"']+)["']>([\s\S]*?)<\/parameter>/gi`
4. Parse parameter values with `parseParameterValue()`

**Issues**:
- Non-greedy regex `([\s\S]*?)` stops at **first** `</parameter>` tag
- Nested parameters break parsing
- Result: Malformed parameters containing XML strings

**2. `parseParameterValue(value: string): any`**

Attempts type conversion:
1. Try JSON parsing if starts with `{` or `[`
2. Convert boolean strings: `'true'` → `true`
3. Parse numbers: `'42'` → `42`
4. Return as string

**Returns**:
- Parsed object/array if valid JSON
- Boolean if true/false
- Number if numeric
- String otherwise

**3. `isNewXmlFormat(content: string): boolean`**

Quick check: `/<function_calls>[\s\S]*<invoke\s+name=/.test(content)`

#### Data Structure

```typescript
interface ParsedToolCall {
  functionName: string;           // Tool name (underscores converted to dashes)
  parameters: Record<string, any>; // Parsed parameters (may contain malformed XML strings)
  rawXml: string;                 // Original invoke XML
}
```

---

### File: `frontend/src/components/thread/content/ThreadContent.tsx`

#### Purpose
Main component that renders messages and tool calls in the thread UI.

#### Key Function: `renderMarkdownContent()`

**Flow**:

```
Input: Message content string
  │
  ├─ Check if debug mode → render raw in <pre>
  │
  ├─ Check if new XML format → YES
  │   │
  │   ├─ Extract function_calls blocks with regex
  │   │
  │   ├─ For each block:
  │   │   └─ Parse with parseXmlToolCalls()
  │   │
  │   ├─ For each tool call:
  │   │   │
  │   │   ├─ If toolName = 'ask' or 'complete'
  │   │   │   └─ Render text + attachments
  │   │   │
  │   │   └─ Else
  │   │       └─ Render tool button
  │   │
  │   └─ Build contentParts array
  │
  └─ Else (old format or markdown only)
      └─ Render as markdown
```

**Critical Code Section** (Lines 125-250):

```typescript
if (isNewXmlFormat(content)) {
    const contentParts: React.ReactNode[] = [];
    let lastIndex = 0;

    const functionCallsRegex = /<function_calls>([\s\S]*?)<\/function_calls>/gi;
    let match: RegExpExecArray | null = null;

    while ((match = functionCallsRegex.exec(content)) !== null) {
        // 1. Add text before function_calls
        if (match.index > lastIndex) {
            const textBeforeBlock = content.substring(lastIndex, match.index);
            if (textBeforeBlock.trim()) {
                contentParts.push(
                    <ComposioUrlDetector 
                        key={`md-${lastIndex}`} 
                        content={textBeforeBlock} 
                        className="..." 
                    />
                );
            }
        }

        // 2. Parse tool calls in this block
        const toolCalls = parseXmlToolCalls(match[0]);

        toolCalls.forEach((toolCall, index) => {
            const toolName = toolCall.functionName.replace(/_/g, '-');

            if (toolName === 'ask') {
                // Extract and render text + attachments
                const askText = toolCall.parameters.text || '';
                const attachments = toolCall.parameters.attachments || [];
                contentParts.push(
                    <div key={`ask-${match.index}-${index}`} className="space-y-3">
                        <ComposioUrlDetector content={askText} className="..." />
                        {renderAttachments(attachmentArray, ...)}
                    </div>
                );
            } else {
                // Render tool button
                contentParts.push(
                    <button
                        onClick={() => handleToolClick(messageId, toolName)}
                        className="..."
                    >
                        <IconComponent className="h-3.5 w-3.5" />
                        <span>{getUserFriendlyToolName(toolName)}</span>
                        {paramDisplay && <span>{paramDisplay}</span>}
                    </button>
                );
            }
        });

        lastIndex = match.index + match[0].length;
    }

    // 3. Add remaining text
    if (lastIndex < content.length) {
        const remainingText = content.substring(lastIndex);
        if (remainingText.trim()) {
            contentParts.push(
                <ComposioUrlDetector key={`md-${lastIndex}`} content={remainingText} className="..." />
            );
        }
    }

    return contentParts.length > 0 ? contentParts : <ComposioUrlDetector content={content} className="..." />;
}
```

**Key Behaviors**:
- Splits message content by function_calls blocks
- Renders text + tools interspersed
- For malformed parameters, button still renders but shows corrupted data

---

## Backend Parsing System

### File: `backend/core/agentpress/xml_tool_parser.py`

#### Purpose
Server-side XML parser for tool calls before execution. More sophisticated than frontend.

#### Key Class: `XMLToolParser`

**Regex Patterns**:
```python
FUNCTION_CALLS_PATTERN = r'<function_calls>(.*?)</function_calls>'
INVOKE_PATTERN = r'<invoke\s+name=["\']([^"\']+)["\']>(.*?)</invoke>'
PARAMETER_PATTERN = r'<parameter\s+name=["\']([^"\']+)["\']>(.*?)</parameter>'
```

**Main Method: `parse_content(content: str) -> List[XMLToolCall]`**

Flow:
```
Input: LLM response text
  │
  ├─ Extract all <function_calls> blocks
  │
  ├─ For each block:
  │   │
  │   ├─ Extract <invoke> tags
  │   │
  │   └─ For each invoke:
  │       │
  │       ├─ Extract function_name
  │       │
  │       ├─ Call _parse_invoke_block()
  │       │
  │       └─ Return XMLToolCall object
  │
  └─ Return List[XMLToolCall]
```

**XMLToolCall Data Structure**:
```python
@dataclass
class XMLToolCall:
    function_name: str
    parameters: Dict[str, Any]
    raw_xml: str
    parsing_details: Dict[str, Any]  # {function_name, raw_parameters}
```

#### Method: `_parse_invoke_block(function_name, invoke_content, full_block)`

**Key Logic** (Lines 96-130):

```python
def _parse_invoke_block(self, function_name: str, invoke_content: str, full_block: str):
    parameters = {}
    parsing_details = {
        "function_name": function_name,
        "raw_parameters": {}
    }
    
    # Extract TOP-LEVEL parameters only (not nested ones)
    # BUT the regex still uses non-greedy matching!
    param_pattern = re.compile(
        r'<parameter\s+name=["\']([^"\']+)["\']>([^<]*(?:<(?!parameter)[^>]*>[^<]*)*)</parameter>',
        re.DOTALL | re.IGNORECASE
    )
    param_matches = param_pattern.findall(invoke_content)
    
    for param_name, param_value in param_matches:
        param_value = param_value.strip()
        
        # Check if parameter value contains nested <parameter> tags
        if '<parameter' in param_value:
            # Call _parse_nested_parameters() to extract as structured data
            parsed_value = self._parse_nested_parameters(param_value)
        else:
            # Normal parameter parsing
            parsed_value = self._parse_parameter_value(param_value)
        
        parameters[param_name] = parsed_value
        parsing_details["raw_parameters"][param_name] = param_value
    
    # Extract raw XML
    invoke_pattern = re.compile(
        rf'<invoke\s+name=["\']{re.escape(function_name)}["\']>.*?</invoke>',
        re.DOTALL | re.IGNORECASE
    )
    raw_xml_match = invoke_pattern.search(full_block)
    raw_xml = raw_xml_match.group(0) if raw_xml_match else "..."
    
    return XMLToolCall(
        function_name=function_name,
        parameters=parameters,
        raw_xml=raw_xml,
        parsing_details=parsing_details
    )
```

#### Method: `_parse_nested_parameters(nested_xml: str) -> Any`

**Purpose**: Attempt to extract nested `<parameter>` tags from XML strings

**Logic** (Lines 149-175):

```python
def _parse_nested_parameters(self, nested_xml: str) -> Any:
    """
    Parse improperly nested parameters from XML content.
    
    When LLM generates nested <parameter> tags:
    <parameter name="tasks">
    <parameter name="task">Task 1</parameter>
    <parameter name="task">Task 2</parameter>
    </parameter>
    
    Extract them as structured list/dict.
    """
    try:
        nested_pattern = re.compile(
            r'<parameter\s+name=["\']([^"\']+)["\']>([^<]*)</parameter>',
            re.DOTALL | re.IGNORECASE
        )
        matches = nested_pattern.findall(nested_xml)
        
        if matches:
            names = [name for name, _ in matches]
            values = [self._parse_parameter_value(value.strip()) for _, value in matches]
            
            if len(set(names)) == 1:
                # All same name - return as list
                return values if len(values) > 1 else values[0] if values else None
            else:
                # Different names - return as dict
                return {name: value for name, value in zip(names, values)}
        
        # If no nested parameters found, return raw value
        return nested_xml.strip()
    except Exception as e:
        logger.error(f"Error parsing nested parameters: {e}")
        return nested_xml.strip()
```

**Problem**: Still uses non-greedy regex - **same issue as frontend!**

#### Method: `_parse_parameter_value(value: str) -> Any`

Similar to frontend - JSON, boolean, number, or string conversion.

---

### File: `backend/core/agentpress/response_processor.py`

#### Purpose
Orchestrates LLM response processing: streaming, parsing, tool execution, result handling.

#### Key Configuration: `ProcessorConfig`

```python
@dataclass
class ProcessorConfig:
    xml_tool_calling: bool = True           # Enable XML format
    native_tool_calling: bool = False       # OpenAI function format
    execute_tools: bool = True              # Execute detected tools
    execute_on_stream: bool = False         # Execute during stream vs. after
    tool_execution_strategy: str = "sequential"  # or "parallel"
    xml_adding_strategy: str = "assistant_message"
    max_xml_tool_calls: int = 0             # 0 = no limit
```

#### Main Method: `process_streaming_response()`

**High-Level Flow** (2000+ lines):

```
Input: AsyncGenerator[LLM chunks], thread_id, config, ...
  │
  ├─ Initialize accumulators
  │   ├─ accumulated_content = ""
  │   ├─ xml_chunks_buffer = []
  │   └─ tool_index = 0
  │
  ├─ Yield llm_response_start status
  │
  ├─ Stream loop: async for chunk in llm_response
  │   │
  │   ├─ Extract delta content
  │   │
  │   ├─ Accumulate content
  │   │
  │   ├─ Check for XML tool calls in accumulated_content
  │   │   │
  │   │   ├─ Extract complete <function_calls> blocks
  │   │   │
  │   │   ├─ Call _parse_xml_tool_calls() for each
  │   │   │
  │   │   └─ If execute_on_stream:
  │   │       │
  │   │       ├─ Yield tool_started status
  │   │       │
  │   │       └─ Queue for async execution
  │   │
  │   └─ Check finish_reason (stop, tool_calls, length, etc.)
  │
  ├─ Stream complete
  │
  ├─ Wait for pending streamed tool executions
  │
  ├─ Save assistant message to DB
  │
  ├─ Execute remaining XML tool calls (if not streamed)
  │   │
  │   ├─ Call _parse_xml_tool_calls() again
  │   │
  │   └─ Execute with sequential/parallel strategy
  │
  ├─ For each tool result:
  │   │
  │   ├─ Yield tool_started status
  │   │
  │   ├─ Save result to DB
  │   │
  │   ├─ Yield tool_completed status
  │   │
  │   └─ Yield result message
  │
  ├─ Save llm_response_end (with usage data)
  │
  ├─ Yield finish status
  │
  └─ Check auto_continue trigger
      └─ If should_continue: continue loop with auto_continue_count += 1
```

#### Method: `_parse_xml_tool_calls(content: str) -> List[Dict]`

**Current Implementation** (Lines 1448-1473):

```python
def _parse_xml_tool_calls(self, content: str) -> List[Dict[str, Any]]:
    """Parse XML tool calls from content string.
    
    Returns:
        List of dictionaries, each containing {'tool_call': ..., 'parsing_details': ...}
    """
    parsed_data = []
    
    try:
        xml_chunks = self._extract_xml_chunks(content)
        
        for xml_chunk in xml_chunks:
            result = self._parse_xml_tool_call(xml_chunk)
            if result:
                tool_call, parsing_details = result
                parsed_data.append({
                    "tool_call": tool_call,
                    "parsing_details": parsing_details
                })
                
    except Exception as e:
        logger.error(f"Error parsing XML tool calls: {e}", exc_info=True)
        self.trace.event(...)
    
    return parsed_data
```

**Returns**: List of dicts with tool_call and parsing_details

#### Method: `_extract_xml_chunks(content: str) -> List[str]`

Extracts complete `<function_calls>...</function_calls>` blocks.

#### Method: `_parse_xml_tool_call(xml_chunk: str) -> Tuple`

Calls XMLToolParser to parse a single XML chunk.

---

### File: `backend/core/agentpress/thread_manager.py`

#### Purpose
Manages conversation threads, controls auto-continue, and orchestrates message flow.

#### Key Method: `_check_auto_continue_trigger()`

**Logic** (Lines 644-675):

```python
def _check_auto_continue_trigger(
    self, chunk: Dict[str, Any], auto_continue_state: Dict[str, Any], 
    native_max_auto_continues: int
) -> bool:
    """Check if a response chunk should trigger auto-continue."""
    if chunk.get('type') == 'status':
        try:
            content = json.loads(chunk.get('content', '{}')) \
                if isinstance(chunk.get('content'), str) else chunk.get('content', {})
            finish_reason = content.get('finish_reason')
            tools_executed = content.get('tools_executed', False)
            
            # Trigger auto-continue for: native tool calls, length limit, or XML tools executed
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
                
            elif finish_reason == 'xml_tool_limit_reached':
                logger.debug("Stopping auto-continue due to XML tool limit")
                auto_continue_state['active'] = False
                
        except (json.JSONDecodeError, TypeError):
            pass
            
    return False
```

**Current Triggers**:
- `finish_reason == 'tool_calls'` → LLM wants to call tools
- `tools_executed == True` → Tools were executed
- `finish_reason == 'length'` → Context length limit
- `finish_reason == 'xml_tool_limit_reached'` → Tool limit exceeded (stops)

---

## Complete End-to-End Flow

### Diagram: LLM Response → Display

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LLM Generates Response                                │
│                                                                              │
│  "Let me search for that...\n                                              │
│   <function_calls>                                                           │
│   <invoke name=\"web_search\">                                             │
│   <parameter name=\"query\">python nested parameters</parameter>            │
│   </invoke>                                                                  │
│   </function_calls>"                                                        │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────┐
        │  Backend: ResponseProcessor    │
        │   process_streaming_response() │
        └────────────┬───────────────────┘
                     │
                     ▼
        ┌────────────────────────────────┐
        │  Extract XML chunks from       │
        │  accumulated content           │
        │  _extract_xml_chunks()         │
        └────────────┬───────────────────┘
                     │
                     ▼
        ┌────────────────────────────────┐
        │  Parse with XMLToolParser      │
        │  _parse_xml_tool_calls()       │
        │                                 │
        │  Returns:                       │
        │  [{                             │
        │    tool_call: {                 │
        │      function_name: "...",     │
        │      arguments: {...}          │
        │    },                           │
        │    parsing_details: {...}      │
        │  }]                             │
        └────────────┬───────────────────┘
                     │
                     ├─ If execute_tools: Execute via ToolRegistry
                     │
                     ├─ Save message to DB
                     │
                     └─ Yield response messages to frontend
                        (content chunks + tool calls)
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │      Frontend: ThreadContent.tsx       │
        │      renderMarkdownContent()           │
        │                                         │
        │  1. Receives accumulated_content       │
        │  2. Checks isNewXmlFormat()            │
        │  3. Calls parseXmlToolCalls()          │
        │  4. Renders tool buttons or text       │
        └────────────┬────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────────────────┐
        │      UI Display                        │
        │                                         │
        │  "Let me search for that..."           │
        │  [🔍 Web Search | python nested...]    │
        │                                         │
        │  (User clicks button → tool side panel)│
        └────────────────────────────────────────┘
```

---

## Current Limitations & Problems

### 1. **Nested Parameter Parsing Failure**

**Problem**: Both frontend and backend use non-greedy regex that stops at **first** `</parameter>` tag

**Example Input**:
```xml
<invoke name="create_tasks">
<parameter name="sections">
  <parameter name="title">Research</parameter>
  <parameter name="tasks">
    <item>Task 1</item>
  </parameter>
</parameter>
</invoke>
```

**What Happens**:
1. Regex: `/<parameter\s+name=["\']([^"\']+)["\']>([\s\S]*?)<\/parameter>/gi`
2. Matches `<parameter name="sections">...` up to **first** `</parameter>` (the one closing `<parameter name="title">`)
3. Returns: `parameters.sections = "<parameter name=\"title\">Research</parameter>\n<parameter name=\"tasks\">..."`
4. Result: XML string instead of structured data

**Frontend Impact**:
- Parser returns malformed parameters
- Tool button still renders but with garbage data
- Side panel shows corrupted parameter values

**Backend Impact**:
- XMLToolParser attempts `_parse_nested_parameters()` but still fails for deeply nested cases
- Tool execution receives malformed parameters
- Tool may fail or behave unexpectedly

### 2. **No Malformation Detection**

**Current State**:
- No validation that parameters are properly structured
- No detection that a parameter value contains XML strings
- Silent failure - tools execute with wrong data

**What We Need**:
- Detect XML strings in parameter values
- Check for unbalanced `<parameter>` tags
- Validate against tool schema

### 3. **No Feedback to LLM**

**Current State**:
- Tool fails silently
- LLM never learns it made a mistake
- Same error happens again in next call

**What We Need**:
- Generate clear error message
- Add to thread as message
- Trigger auto-continue with corrective prompt

### 4. **No Reprompting System**

**Current Auto-Continue Triggers** (thread_manager.py line 644-675):
- ✅ `finish_reason == 'tool_calls'` → Native tool format
- ✅ `tools_executed == True` → Tools were executed
- ✅ `finish_reason == 'length'` → Context length
- ❌ NO TRIGGER for malformed tool calls

**What We Need**:
- Add `finish_reason == 'tool_validation_failed'`
- Automatically trigger reprompt
- Pass error details to LLM in corrective message

---

## Integration Points for Malformed Detection

### Entry Point 1: ResponseProcessor._parse_xml_tool_calls()

**Location**: `backend/core/agentpress/response_processor.py` line 1448

**Current Code**:
```python
def _parse_xml_tool_calls(self, content: str) -> List[Dict[str, Any]]:
    parsed_data = []
    try:
        xml_chunks = self._extract_xml_chunks(content)
        for xml_chunk in xml_chunks:
            result = self._parse_xml_tool_call(xml_chunk)
            if result:
                tool_call, parsing_details = result
                parsed_data.append({
                    "tool_call": tool_call,
                    "parsing_details": parsing_details
                })
    except Exception as e:
        logger.error(f"Error parsing XML tool calls: {e}", exc_info=True)
    return parsed_data
```

**Enhancement Point**:
- Add `_validate_parsed_tool_call()` after parsing
- Separate valid/malformed calls
- Return tuple: `(valid_calls, malformed_calls)`

### Entry Point 2: ResponseProcessor.process_streaming_response()

**Location**: `backend/core/agentpress/response_processor.py` line 227-1000 (streaming loop)

**Where Validation Fits**:
```python
# After _parse_xml_tool_calls() returns
valid_calls, malformed_calls = self._parse_xml_tool_calls(content)

if malformed_calls:
    # NEW: Handle malformed calls
    async for error_chunk in self._handle_malformed_tool_calls(malformed_calls):
        yield error_chunk
    
    # Trigger reprompt
    finish_content["finish_reason"] = "tool_validation_failed"
```

### Entry Point 3: ThreadManager._check_auto_continue_trigger()

**Location**: `backend/core/agentpress/thread_manager.py` line 644

**Enhancement**:
```python
def _check_auto_continue_trigger(self, chunk, auto_continue_state, native_max_auto_continues):
    if chunk.get('type') == 'status':
        content = ...
        finish_reason = content.get('finish_reason')
        
        # NEW: Add malformed tool call handling
        if finish_reason == 'tool_validation_failed':
            if native_max_auto_continues > 0:
                logger.info("Auto-reprompting for malformed tool call")
                auto_continue_state['active'] = True
                auto_continue_state['count'] += 1
                return True
        
        # Existing logic...
        elif finish_reason == 'tool_calls' or ...
```

---

## Current Message Flow to Frontend

### WebSocket Message Types

1. **llm_response_start**: Signals start of LLM response
2. **content_chunk**: Streamed content delta
3. **tool_started**: Tool execution started
4. **tool_completed**: Tool execution finished
5. **tool_result**: Tool execution result/output
6. **llm_response_end**: LLM response complete with usage stats
7. **status**: Status updates (finish_reason, tools_executed, etc.)
8. **assistant**: Complete assistant message
9. **user**: User message
10. **tool_result**: Tool result message

### Error Message Flow (Proposed)

```
1. Malformed detected in ResponseProcessor
   ↓
2. Generate error message with corrective guidance
   ↓
3. Add as user message to thread (metadata: reprompt=true)
   ↓
4. Yield error message to frontend
   ↓
5. Set finish_reason = "tool_validation_failed"
   ↓
6. ThreadManager detects this and triggers auto-continue
   ↓
7. LLM receives error context and regenerates tool call
```

---

## Summary: Key Numbers

| Component | Size | Files |
|-----------|------|-------|
| Frontend parsing | 145 lines | `xml-parser.ts` |
| Frontend rendering | 1242 lines | `ThreadContent.tsx` (renderMarkdownContent ~150 lines) |
| Backend XML parser | 290 lines | `xml_tool_parser.py` |
| Backend response processor | 2091 lines | `response_processor.py` |
| Backend thread manager | 678 lines | `thread_manager.py` |
| **Total System** | **~4,500 lines** | **5 core files** |

---

## Ready for Implementation

With this research complete, we have:

✅ **Full Frontend Understanding**: How messages flow from LLM to UI rendering  
✅ **Full Backend Understanding**: How streaming, parsing, execution orchestrated  
✅ **Identified Integration Points**: 3 key locations for malformed detection  
✅ **Auto-Continue Mechanism**: Existing infrastructure ready for reprompt trigger  
✅ **Data Flow**: Clear path from detection → feedback → reprompt → correction  

**Next Steps**:
1. Implement validation methods in ResponseProcessor
2. Add malformed tool call handler
3. Integrate into streaming response flow
4. Add auto-continue trigger in ThreadManager
5. Test with real malformed examples