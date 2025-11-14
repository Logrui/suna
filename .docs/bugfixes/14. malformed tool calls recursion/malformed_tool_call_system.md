# Malformed Tool Call Detection & Auto-Reprompt System

## Executive Summary

This document outlines the design and implementation strategy for an automatic detection and recovery system for malformed XML tool calls. When an LLM generates improperly structured tool calls (particularly nested parameters), the system should detect the malformation, provide clear feedback to the LLM, and automatically request a corrected version.

---

## Problem Statement

### Current Issue: Nested Parameters Break Parser

The XML tool parser uses **non-greedy regex matching** that fails on nested `<parameter>` tags:

```xml
<function_calls>
<invoke name="create_tasks">
<parameter name="sections">
  <parameter name="sections">           ← Nested parameter
    <parameter name="title">Research</parameter>
    <parameter name="tasks">
      <parameter name="tasks">           ← Double-nested
        <item>Task 1</item>
      </parameter>
    </parameter>
  </parameter>
</parameter>
</invoke>
</function_calls>
```

**Parser Behavior**:
- Regex: `/<parameter\s+name=["']([^"']+)["']>([\s\S]*?)<\/parameter>/gi`
- Uses `*?` (non-greedy), stops at **first** `</parameter>` tag
- Results in **malformed parameters** containing XML strings instead of structured data
- Example: `parameters.sections = "<parameter name=\"sections\">\n<parameter name=\"title\">Research..."`

### Impact

1. **Tool button renders** but with corrupted data
2. **Side panel shows garbage** when clicked
3. **Tool execution fails** with invalid parameters
4. **No user feedback** about what went wrong
5. **LLM never learns** from the mistake

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    LLM Response Stream                       │
│                                                              │
│  "Let me create tasks...\n                                  │
│   <function_calls>                                           │
│   <invoke name=\"create_tasks\">                            │
│   <parameter name=\"sections\">                             │
│   <parameter name=\"sections\">...</parameter>              │
│   </parameter>                                               │
│   </invoke>                                                  │
│   </function_calls>"                                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              ResponseProcessor                               │
│         (response_processor.py)                              │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  _parse_xml_tool_calls()                           │    │
│  │  ├─ _extract_xml_chunks()                          │    │
│  │  └─ _parse_xml_tool_call()                         │    │
│  │     └─ xml_parser.parse_content()                  │    │
│  │        (XMLToolParser from xml_tool_parser.py)     │    │
│  └────────────────────────────────────────────────────┘    │
│                     │                                        │
│                     ▼                                        │
│  ┌────────────────────────────────────────────────────┐    │
│  │  🔍 NEW: validate_parsed_tool_calls()              │    │
│  │  ├─ Check for XML string parameters                │    │
│  │  ├─ Detect nested <parameter> tags in values       │    │
│  │  ├─ Validate parameter types vs schema             │    │
│  │  └─ Return ValidationResult                         │    │
│  └────────────────────────────────────────────────────┘    │
│                     │                                        │
│         ┌───────────┴───────────┐                           │
│         ▼                       ▼                           │
│  ┌─────────────┐         ┌─────────────┐                   │
│  │  VALID ✅   │         │ INVALID ❌  │                   │
│  │             │         │             │                   │
│  │ Proceed to  │         │ Trigger     │                   │
│  │ _execute_   │         │ auto-       │                   │
│  │ tools()     │         │ reprompt    │                   │
│  └─────────────┘         └──────┬──────┘                   │
│                                  │                           │
└──────────────────────────────────┼───────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│        🔄 NEW: Auto-Reprompt System                         │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  handle_malformed_tool_call()                      │    │
│  │  ├─ Generate error message with examples           │    │
│  │  ├─ Add error as system/user message               │    │
│  │  ├─ Set reprompt metadata                          │    │
│  │  └─ Yield error to frontend                        │    │
│  └────────────────────────────────────────────────────┘    │
│                     │                                        │
│                     ▼                                        │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Continue to next LLM call                         │    │
│  │  (ThreadManager auto-continue logic)               │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. XMLToolParser (xml_tool_parser.py)

**Current Behavior**:
```python
class XMLToolParser:
    PARAMETER_PATTERN = re.compile(
        r'<parameter\s+name=["\']([^"\']+)["\']>(.*?)</parameter>',
        re.DOTALL | re.IGNORECASE
    )
```

**Issues**:
- Non-greedy `(.*?)` stops at first closing tag
- No nested parameter support
- `_parse_nested_parameters()` attempts fix but insufficient

**Proposed Enhancement**:
```python
def validate_tool_call(
    self, 
    tool_call: XMLToolCall, 
    expected_params: Optional[Dict[str, type]] = None
) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
    """
    Enhanced validation with malformation detection.
    
    Returns:
        Tuple of (is_valid, error_message, malformation_details)
    """
    malformation_details = {}
    
    # Check 1: Detect XML strings in parameter values
    for param_name, param_value in tool_call.parameters.items():
        if isinstance(param_value, str) and '<parameter' in param_value:
            malformation_details[param_name] = {
                'type': 'nested_xml_detected',
                'value_preview': param_value[:100],
                'suggestion': 'Use flat parameters or JSON objects'
            }
    
    # Check 2: Validate against expected schema
    if expected_params:
        for param_name, expected_type in expected_params.items():
            if param_name not in tool_call.parameters:
                return False, f"Missing required parameter: {param_name}", None
            
            param_value = tool_call.parameters[param_name]
            if not isinstance(param_value, expected_type):
                if param_name not in malformation_details:
                    malformation_details[param_name] = {}
                malformation_details[param_name]['type_mismatch'] = {
                    'expected': expected_type.__name__,
                    'received': type(param_value).__name__
                }
    
    # Check 3: Detect unclosed tags or malformed XML
    raw_xml = tool_call.raw_xml
    if raw_xml.count('<parameter') != raw_xml.count('</parameter>'):
        malformation_details['xml_structure'] = {
            'type': 'unbalanced_tags',
            'open_count': raw_xml.count('<parameter'),
            'close_count': raw_xml.count('</parameter>')
        }
    
    if malformation_details:
        error_msg = f"Malformed tool call detected: {', '.join(malformation_details.keys())}"
        return False, error_msg, malformation_details
    
    return True, None, None
```

---

### 2. ResponseProcessor (response_processor.py)

**Current Flow**:
```python
def _parse_xml_tool_calls(self, content: str) -> List[Dict[str, Any]]:
    """Parse XML tool calls from content string."""
    parsed_data = []
    
    xml_chunks = self._extract_xml_chunks(content)
    
    for xml_chunk in xml_chunks:
        result = self._parse_xml_tool_call(xml_chunk)
        if result:
            tool_call, parsing_details = result
            parsed_data.append({
                "tool_call": tool_call,
                "parsing_details": parsing_details
            })
    
    return parsed_data
```

**Proposed Enhancement**:
```python
def _parse_xml_tool_calls(
    self, 
    content: str,
    validate: bool = True
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Parse XML tool calls with validation.
    
    Returns:
        Tuple of (valid_tool_calls, malformed_tool_calls)
    """
    valid_calls = []
    malformed_calls = []
    
    xml_chunks = self._extract_xml_chunks(content)
    
    for xml_chunk in xml_chunks:
        result = self._parse_xml_tool_call(xml_chunk)
        if not result:
            continue
            
        tool_call, parsing_details = result
        
        # NEW: Validate parsed tool call
        if validate:
            is_valid, error_msg, malformation_details = self._validate_parsed_tool_call(
                tool_call, 
                parsing_details
            )
            
            if not is_valid:
                malformed_calls.append({
                    "tool_call": tool_call,
                    "parsing_details": parsing_details,
                    "error": error_msg,
                    "malformation": malformation_details,
                    "raw_xml": xml_chunk
                })
                logger.warning(f"⚠️ Malformed tool call detected: {error_msg}")
                continue
        
        valid_calls.append({
            "tool_call": tool_call,
            "parsing_details": parsing_details
        })
    
    return valid_calls, malformed_calls


def _validate_parsed_tool_call(
    self,
    tool_call: Dict[str, Any],
    parsing_details: Dict[str, Any]
) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
    """
    Validate a parsed tool call for malformations.
    
    Checks:
    1. Parameter values contain XML strings (nested parameters)
    2. Parameter types match expected schema
    3. Required parameters present
    
    Returns:
        (is_valid, error_message, malformation_details)
    """
    function_name = tool_call.get("function_name")
    arguments = tool_call.get("arguments", {})
    
    malformation_details = {}
    
    # Check 1: Detect XML strings in parameter values
    for param_name, param_value in arguments.items():
        if isinstance(param_value, str):
            # Check for nested XML tags
            if '<parameter' in param_value:
                malformation_details[param_name] = {
                    'type': 'nested_xml_detected',
                    'value_preview': param_value[:200].replace('\n', '\\n'),
                    'full_length': len(param_value)
                }
            # Check for unclosed tags
            elif param_value.count('<') != param_value.count('>'):
                malformation_details[param_name] = {
                    'type': 'unbalanced_brackets',
                    'value_preview': param_value[:200]
                }
    
    # Check 2: Get tool schema and validate types
    tool_schema = self.tool_registry.get_tool_schema(function_name)
    if tool_schema and 'parameters' in tool_schema:
        required_params = tool_schema.get('required', [])
        param_schemas = tool_schema['parameters'].get('properties', {})
        
        # Check required parameters
        for required_param in required_params:
            if required_param not in arguments:
                if 'missing_params' not in malformation_details:
                    malformation_details['missing_params'] = []
                malformation_details['missing_params'].append(required_param)
        
        # Check parameter types
        for param_name, param_schema in param_schemas.items():
            if param_name in arguments:
                expected_type = param_schema.get('type')
                actual_value = arguments[param_name]
                
                # Type validation
                type_valid = self._validate_parameter_type(
                    actual_value, 
                    expected_type
                )
                
                if not type_valid:
                    if 'type_mismatches' not in malformation_details:
                        malformation_details['type_mismatches'] = {}
                    malformation_details['type_mismatches'][param_name] = {
                        'expected': expected_type,
                        'received': type(actual_value).__name__,
                        'value_preview': str(actual_value)[:100]
                    }
    
    if malformation_details:
        error_summary = []
        if 'nested_xml_detected' in str(malformation_details):
            error_summary.append("nested XML parameters")
        if 'missing_params' in malformation_details:
            error_summary.append(f"missing params: {malformation_details['missing_params']}")
        if 'type_mismatches' in malformation_details:
            error_summary.append("type mismatches")
        
        error_msg = f"Malformed tool call '{function_name}': {', '.join(error_summary)}"
        return False, error_msg, malformation_details
    
    return True, None, None


def _validate_parameter_type(self, value: Any, expected_type: str) -> bool:
    """Validate parameter value against expected JSON Schema type."""
    type_mapping = {
        'string': str,
        'number': (int, float),
        'integer': int,
        'boolean': bool,
        'array': list,
        'object': dict
    }
    
    expected_python_type = type_mapping.get(expected_type)
    if not expected_python_type:
        return True  # Unknown type, pass validation
    
    return isinstance(value, expected_python_type)
```

---

### 3. Auto-Reprompt Handler

**New Module**: Add to `response_processor.py`

```python
async def _handle_malformed_tool_calls(
    self,
    malformed_calls: List[Dict[str, Any]],
    thread_id: str,
    thread_run_id: str,
    assistant_message_id: str
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Handle malformed tool calls by generating error feedback and triggering reprompt.
    
    Args:
        malformed_calls: List of malformed tool call dictionaries
        thread_id: Thread ID
        thread_run_id: Current thread run ID
        assistant_message_id: ID of assistant message containing malformed calls
        
    Yields:
        Status messages and error feedback
    """
    for malformed in malformed_calls:
        tool_call = malformed['tool_call']
        function_name = tool_call.get('function_name', 'unknown')
        error_msg = malformed['error']
        malformation = malformed['malformation']
        raw_xml = malformed['raw_xml']
        
        # Generate detailed error message for the LLM
        error_feedback = self._generate_malformation_feedback(
            function_name=function_name,
            malformation=malformation,
            raw_xml=raw_xml
        )
        
        # Log the error
        logger.error(f"🚫 MALFORMED TOOL CALL: {function_name}")
        logger.error(f"   Error: {error_msg}")
        logger.error(f"   Raw XML: {raw_xml[:200]}...")
        
        # Add error message to thread (as user message to maintain context)
        error_content = {
            "role": "user",
            "content": error_feedback
        }
        
        error_msg_obj = await self.add_message(
            thread_id=thread_id,
            type="user",
            content=error_content,
            is_llm_message=True,
            metadata={
                "thread_run_id": thread_run_id,
                "error_type": "malformed_tool_call",
                "function_name": function_name,
                "original_message_id": assistant_message_id,
                "reprompt_trigger": True
            }
        )
        
        # Yield error status to frontend
        if error_msg_obj:
            yield await self._yield_message(error_msg_obj)
        
        # Yield status message
        yield {
            "type": "status",
            "content": json.dumps({
                "status": "tool_validation_failed",
                "function_name": function_name,
                "error": error_msg,
                "reprompt": True
            })
        }


def _generate_malformation_feedback(
    self,
    function_name: str,
    malformation: Dict[str, Any],
    raw_xml: str
) -> str:
    """
    Generate detailed feedback for the LLM about malformed tool calls.
    
    Args:
        function_name: Name of the tool
        malformation: Malformation details dictionary
        raw_xml: Raw XML that was malformed
        
    Returns:
        Formatted error message for LLM
    """
    feedback_parts = [
        f"❌ **Tool Call Validation Error: `{function_name}`**",
        "",
        "Your tool call was malformed and could not be executed. Please fix the following issues:",
        ""
    ]
    
    # Nested XML detection
    nested_params = [
        param for param, details in malformation.items()
        if isinstance(details, dict) and details.get('type') == 'nested_xml_detected'
    ]
    
    if nested_params:
        feedback_parts.extend([
            "**Issue: Nested `<parameter>` tags detected**",
            "",
            f"The following parameters contain nested XML tags: {', '.join(f'`{p}`' for p in nested_params)}",
            "",
            "❌ **Incorrect format (nested parameters):**",
            "```xml",
            "<parameter name=\"sections\">",
            "  <parameter name=\"title\">Research</parameter>",
            "  <parameter name=\"tasks\">",
            "    <item>Task 1</item>",
            "  </parameter>",
            "</parameter>",
            "```",
            "",
            "✅ **Correct format (flat parameters with JSON):**",
            "```xml",
            "<parameter name=\"sections\">[",
            "  {\"title\": \"Research\", \"tasks\": [\"Task 1\", \"Task 2\"]},",
            "  {\"title\": \"Analysis\", \"tasks\": [\"Task 3\", \"Task 4\"]}",
            "]</parameter>",
            "```",
            "",
            "**OR use separate flat parameters:**",
            "```xml",
            "<parameter name=\"title\">Research</parameter>",
            "<parameter name=\"tasks\">[\"Task 1\", \"Task 2\"]</parameter>",
            "```",
            ""
        ])
    
    # Missing parameters
    if 'missing_params' in malformation:
        missing = malformation['missing_params']
        feedback_parts.extend([
            f"**Issue: Missing required parameters**",
            "",
            f"The following required parameters are missing: {', '.join(f'`{p}`' for p in missing)}",
            ""
        ])
    
    # Type mismatches
    if 'type_mismatches' in malformation:
        feedback_parts.extend([
            "**Issue: Parameter type mismatches**",
            ""
        ])
        for param, details in malformation['type_mismatches'].items():
            feedback_parts.append(
                f"- `{param}`: Expected `{details['expected']}`, got `{details['received']}`"
            )
        feedback_parts.append("")
    
    # Show malformed XML
    feedback_parts.extend([
        "**Your malformed XML:**",
        "```xml",
        raw_xml[:500] + ("..." if len(raw_xml) > 500 else ""),
        "```",
        "",
        "**Please:**",
        "1. Review the correct format above",
        "2. Regenerate the tool call with proper flat parameters or JSON objects",
        "3. Do NOT nest `<parameter>` tags inside other `<parameter>` tags",
        ""
    ])
    
    return "\n".join(feedback_parts)
```

---

### 4. Integration with Streaming Response

**Modify `process_response_stream()` in ResponseProcessor**:

```python
async def process_response_stream(
    self,
    # ... existing parameters ...
) -> AsyncGenerator[Dict[str, Any], None]:
    """Process streaming LLM response with validation and auto-reprompt."""
    
    # ... existing code ...
    
    # After parsing XML tool calls
    if config.xml_tool_calling and accumulated_content:
        # NEW: Parse with validation
        valid_calls, malformed_calls = self._parse_xml_tool_calls(
            accumulated_content,
            validate=True
        )
        
        # Handle malformed calls
        if malformed_calls:
            logger.warning(f"⚠️ Found {len(malformed_calls)} malformed tool calls")
            
            # Yield error feedback
            async for error_chunk in self._handle_malformed_tool_calls(
                malformed_calls=malformed_calls,
                thread_id=thread_id,
                thread_run_id=thread_run_id,
                assistant_message_id=assistant_message_id
            ):
                yield error_chunk
            
            # Set flag to trigger auto-continue (reprompt)
            finish_content["tools_executed"] = False
            finish_content["reprompt_needed"] = True
            finish_content["finish_reason"] = "tool_validation_failed"
        
        # Process valid calls
        if valid_calls and config.execute_tools:
            # ... existing tool execution logic ...
            pass
```

---

### 5. ThreadManager Integration

**Modify auto-continue logic in `thread_manager.py`**:

```python
def _check_auto_continue_trigger(
    self, 
    chunk: Dict[str, Any], 
    auto_continue_state: Dict[str, Any], 
    native_max_auto_continues: int
) -> bool:
    """Check if a response chunk should trigger auto-continue."""
    if chunk.get('type') == 'status':
        try:
            content = json.loads(chunk.get('content', '{}')) if isinstance(chunk.get('content'), str) else chunk.get('content', {})
            finish_reason = content.get('finish_reason')
            tools_executed = content.get('tools_executed', False)
            reprompt_needed = content.get('reprompt_needed', False)  # NEW
            
            # NEW: Trigger auto-continue for tool validation failure
            if finish_reason == 'tool_validation_failed' or reprompt_needed:
                if native_max_auto_continues > 0:
                    logger.info(f"🔄 Auto-reprompting for malformed tool call ({auto_continue_state['count'] + 1}/{native_max_auto_continues})")
                    auto_continue_state['active'] = True
                    auto_continue_state['count'] += 1
                    return True
            
            # Existing logic for tool calls and length
            if finish_reason == 'tool_calls' or tools_executed:
                # ... existing code ...
                pass
            
        except (json.JSONDecodeError, TypeError):
            pass
    
    return False
```

---

## Implementation Phases

### Phase 1: Detection (Low Risk)
**Goal**: Add validation without changing behavior

1. ✅ Add `_validate_parsed_tool_call()` to `ResponseProcessor`
2. ✅ Add `_validate_parameter_type()` helper
3. ✅ Modify `_parse_xml_tool_calls()` to return valid/malformed lists
4. ✅ Log malformed calls but don't block execution
5. ✅ Add metrics/monitoring for malformation rates

**Testing**:
- Unit tests with nested XML examples
- Integration tests with real agent runs
- Monitor logs for detection accuracy

### Phase 2: Feedback Generation (Medium Risk)
**Goal**: Generate helpful error messages

1. ✅ Add `_generate_malformation_feedback()`
2. ✅ Add `_handle_malformed_tool_calls()`
3. ✅ Test feedback message quality
4. ✅ Ensure messages don't break conversation flow

**Testing**:
- Review generated feedback messages
- Test with various malformation types
- Ensure markdown rendering works

### Phase 3: Auto-Reprompt (High Risk)
**Goal**: Automatically trigger LLM correction

1. ✅ Integrate with `process_response_stream()`
2. ✅ Add reprompt trigger to finish status
3. ✅ Modify `_check_auto_continue_trigger()` in ThreadManager
4. ✅ Add reprompt counter to prevent infinite loops
5. ✅ Add max reprompt attempts configuration

**Configuration**:
```python
@dataclass
class ProcessorConfig:
    # ... existing fields ...
    
    # NEW: Auto-reprompt configuration
    enable_tool_validation: bool = True
    enable_auto_reprompt: bool = True
    max_reprompt_attempts: int = 2  # Limit reprompts per tool call
```

**Testing**:
- Test with known malformed calls
- Verify LLM can correct itself
- Test reprompt limit enforcement
- Monitor for infinite loops

### Phase 4: Frontend Integration (Optional)
**Goal**: Show validation errors in UI

1. ✅ Add UI indicator for validation failures
2. ✅ Show error details in tool side panel
3. ✅ Display reprompt status
4. ✅ Allow manual retry

---

## Error Message Examples

### Example 1: Nested Parameters

**LLM Output**:
```xml
<function_calls>
<invoke name="create_tasks">
<parameter name="sections">
<parameter name="title">Research</parameter>
<parameter name="tasks">
<item>Task 1</item>
</parameter>
</parameter>
</invoke>
</function_calls>
```

**System Response**:
```markdown
❌ **Tool Call Validation Error: `create_tasks`**

Your tool call was malformed and could not be executed. Please fix the following issues:

**Issue: Nested `<parameter>` tags detected**

The following parameters contain nested XML tags: `sections`

❌ **Incorrect format (nested parameters):**
```xml
<parameter name="sections">
  <parameter name="title">Research</parameter>
  <parameter name="tasks">
    <item>Task 1</item>
  </parameter>
</parameter>
```

✅ **Correct format (flat parameters with JSON):**
```xml
<parameter name="sections">[
  {"title": "Research", "tasks": ["Task 1", "Task 2"]},
  {"title": "Analysis", "tasks": ["Task 3", "Task 4"]}
]</parameter>
```

**OR use separate flat parameters:**
```xml
<parameter name="title">Research</parameter>
<parameter name="tasks">["Task 1", "Task 2"]</parameter>
```

**Your malformed XML:**
```xml
<invoke name="create_tasks">
<parameter name="sections">
<parameter name="title">Research</parameter>
...
```

**Please:**
1. Review the correct format above
2. Regenerate the tool call with proper flat parameters or JSON objects
3. Do NOT nest `<parameter>` tags inside other `<parameter>` tags
```

---

## Configuration & Toggles

```python
# In agent configuration or environment
TOOL_VALIDATION_CONFIG = {
    # Enable/disable validation
    "enable_validation": True,
    
    # Enable/disable auto-reprompt
    "enable_auto_reprompt": True,
    
    # Max reprompt attempts per tool call
    "max_reprompt_attempts": 2,
    
    # Whether to block execution on malformed calls
    "block_malformed_execution": True,
    
    # Whether to log malformed calls for analysis
    "log_malformed_calls": True,
    
    # Validation strictness
    "validate_types": True,
    "validate_required_params": True,
    "validate_xml_structure": True,
}
```

---

## Monitoring & Metrics

### Key Metrics to Track

1. **Malformation Detection Rate**
   - Total tool calls parsed
   - Malformed tool calls detected
   - Malformation types distribution

2. **Auto-Reprompt Success Rate**
   - Reprompts triggered
   - Successful corrections (valid on retry)
   - Failed corrections (still malformed)

3. **LLM Learning Curve**
   - Malformation rate over time
   - Per-agent malformation rates
   - Per-tool malformation rates

4. **Performance Impact**
   - Validation overhead (ms)
   - Reprompt latency
   - Additional token usage

### Logging Example

```python
logger.info("🔍 Tool Validation", extra={
    "tool_name": function_name,
    "validation_result": "malformed",
    "malformation_type": "nested_xml",
    "reprompt_triggered": True,
    "attempt": reprompt_attempt,
    "thread_id": thread_id
})
```

---

## Benefits

### Immediate Benefits
1. ✅ **Better Error Detection**: Catch malformed calls before execution
2. ✅ **Clear Feedback**: LLM receives specific, actionable guidance
3. ✅ **Reduced Failures**: Automatic correction attempts
4. ✅ **Improved UX**: Users see validation status, not silent failures

### Long-term Benefits
1. 📈 **LLM Training Signal**: Error feedback improves model over time
2. 🎯 **Data Quality**: Collect malformed examples for model fine-tuning
3. 🔧 **Easier Debugging**: Clear logs of what went wrong
4. 📊 **Metrics**: Track validation success rates

---

## Risks & Mitigations

### Risk 1: Infinite Reprompt Loops
**Mitigation**:
- Hard limit on reprompt attempts (default: 2)
- Track reprompt count per tool call
- Circuit breaker after N consecutive failures

### Risk 2: False Positives
**Mitigation**:
- Start with conservative validation rules
- Log all validation failures for review
- Allow configuration to disable validation
- Whitelist certain tools from strict validation

### Risk 3: Performance Impact
**Mitigation**:
- Validation is fast (regex + type checks)
- Only validates tool calls (not all content)
- Can be disabled per-agent or globally

### Risk 4: Breaking Existing Behavior
**Mitigation**:
- Phase 1 is detection-only (no blocking)
- Feature flags for gradual rollout
- Extensive testing with existing agents

---

## Testing Strategy

### Unit Tests

```python
def test_detect_nested_parameters():
    """Test detection of nested <parameter> tags."""
    malformed_xml = """
    <function_calls>
    <invoke name="create_tasks">
    <parameter name="sections">
    <parameter name="title">Research</parameter>
    </parameter>
    </invoke>
    </function_calls>
    """
    
    parser = XMLToolParser()
    tool_calls = parser.parse_content(malformed_xml)
    
    assert len(tool_calls) == 1
    tool_call = tool_calls[0]
    
    # Validate
    is_valid, error, details = validate_parsed_tool_call(tool_call)
    
    assert not is_valid
    assert "nested" in error.lower()
    assert details is not None
    assert "sections" in details


def test_valid_flat_parameters():
    """Test that valid flat parameters pass validation."""
    valid_xml = """
    <function_calls>
    <invoke name="create_tasks">
    <parameter name="title">Research</parameter>
    <parameter name="tasks">["Task 1", "Task 2"]</parameter>
    </invoke>
    </function_calls>
    """
    
    parser = XMLToolParser()
    tool_calls = parser.parse_content(valid_xml)
    
    assert len(tool_calls) == 1
    tool_call = tool_calls[0]
    
    is_valid, error, details = validate_parsed_tool_call(tool_call)
    
    assert is_valid
    assert error is None


def test_reprompt_limit():
    """Test that reprompt attempts are limited."""
    processor = ResponseProcessor(...)
    
    # Simulate 3 consecutive malformed calls
    for i in range(3):
        result = await processor._handle_malformed_tool_calls(...)
        if i >= 2:
            # Should not trigger another reprompt
            assert result.get("reprompt") is False
```

### Integration Tests

```python
async def test_auto_reprompt_success():
    """Test that LLM successfully corrects malformed call."""
    thread_id = await thread_manager.create_thread()
    
    # Add initial message that triggers malformed response
    await thread_manager.add_message(
        thread_id=thread_id,
        type="user",
        content={"role": "user", "content": "Create tasks with nested structure"}
    )
    
    # Run agent with validation enabled
    responses = []
    async for chunk in thread_manager.run_agent_stream(
        thread_id=thread_id,
        config=ProcessorConfig(
            enable_tool_validation=True,
            enable_auto_reprompt=True
        )
    ):
        responses.append(chunk)
    
    # Verify:
    # 1. Malformed call was detected
    # 2. Reprompt was triggered
    # 3. Second attempt was valid
    # 4. Tool executed successfully
    
    validation_errors = [r for r in responses if r.get("type") == "status" 
                        and "validation_failed" in r.get("content", "")]
    
    assert len(validation_errors) > 0, "Should detect malformed call"
    
    tool_results = [r for r in responses if r.get("type") == "tool" 
                   and r.get("status") == "success"]
    
    assert len(tool_results) > 0, "Should eventually execute tool successfully"
```

---

## Future Enhancements

### 1. Recursive XML Parser
Replace regex-based parsing with proper recursive descent parser:
- Handles arbitrary nesting depth
- Better error messages
- More robust

### 2. Schema-Guided Validation
Use tool schemas to validate structure:
- Check required vs optional params
- Validate enum values
- Check array lengths, string patterns

### 3. LLM Fine-tuning Data
Collect malformed examples for training:
- Build dataset of malformed → corrected pairs
- Use for model fine-tuning
- Improve base model's XML generation

### 4. Smart Reprompt Strategies
Different strategies based on error type:
- Simple typo: Suggest specific fix
- Structure error: Show correct template
- Missing param: Ask specific question

---

## Summary

This system provides a comprehensive solution for detecting and automatically correcting malformed XML tool calls. By validating tool calls before execution and providing clear feedback to the LLM, we can:

1. **Reduce failures** from malformed tool calls
2. **Improve LLM behavior** through targeted feedback
3. **Enhance user experience** with transparent error handling
4. **Collect valuable data** for model improvement

The phased rollout approach minimizes risk while allowing iterative improvements based on real-world usage patterns.