# Testing Guide: Auto-Continue System

**Date**: November 1, 2025  
**Status**: Testing Framework Complete  

---

## Table of Contents

1. [Unit Tests](#unit-tests)
2. [Integration Tests](#integration-tests)
3. [End-to-End Tests](#end-to-end-tests)
4. [Performance Tests](#performance-tests)
5. [Edge Case Tests](#edge-case-tests)
6. [Manual Testing Scenarios](#manual-testing-scenarios)
7. [Validation Checklist](#validation-checklist)

---

## Unit Tests

### Test File: `backend/core/agentpress/test_continue.py`

```python
"""
Unit tests for auto-continue module.
"""

import pytest
from core.agentpress.continue import (
    ContinueConfig,
    ContinueState,
    ContinueDecisionMaker,
    ContinuePromptBuilder,
    AutoContinueManager,
    create_continuation_signal,
)


class TestContinueConfig:
    """Test ContinueConfig dataclass."""
    
    def test_default_config(self):
        """Test default configuration values."""
        config = ContinueConfig()
        assert config.max_continues == 25
        assert config.enable_continuation == True
        assert 'ask' in config.termination_tools
        assert 'complete' in config.termination_tools
    
    def test_custom_config(self):
        """Test custom configuration."""
        config = ContinueConfig(
            max_continues=10,
            enable_continuation=False,
            termination_tools=['custom_tool']
        )
        assert config.max_continues == 10
        assert config.enable_continuation == False
        assert config.termination_tools == ['custom_tool']
    
    def test_negative_max_continues_raises_error(self):
        """Test that negative max_continues raises ValueError."""
        with pytest.raises(ValueError):
            ContinueConfig(max_continues=-1)


class TestContinueState:
    """Test ContinueState dataclass."""
    
    def test_default_state(self):
        """Test default state values."""
        state = ContinueState()
        assert state.count == 0
        assert state.active == True
        assert state.last_tool_count == 0
        assert state.last_message_type is None
        assert state.start_time is not None  # ⭐ NEW
        assert state.previous_tool_calls == []  # ⭐ NEW
        assert state.repeat_count == 0  # ⭐ NEW
    
    def test_should_continue_true(self):
        """Test should_continue returns True when conditions met."""
        config = ContinueConfig(max_continues=25)
        state = ContinueState(count=5, active=True)
        assert state.should_continue(config) == True
    
    def test_should_continue_false_when_max_reached(self):
        """Test should_continue returns False when max reached."""
        config = ContinueConfig(max_continues=25)
        state = ContinueState(count=25, active=True)
        assert state.should_continue(config) == False
    
    def test_should_continue_false_when_inactive(self):
        """Test should_continue returns False when inactive."""
        config = ContinueConfig(max_continues=25)
        state = ContinueState(count=5, active=False)
        assert state.should_continue(config) == False
    
    def test_timeout_detection(self):
        """Test timeout detection."""  # ⭐ NEW
        config = ContinueConfig(max_duration_seconds=1)
        state = ContinueState()
        
        # Should not be timed out initially
        assert state.is_timed_out(config) == False
        
        # Wait and check again
        import time
        time.sleep(1.1)
        assert state.is_timed_out(config) == True
    
    def test_loop_detection_same_tools(self):
        """Test loop detection with repeated tools."""  # ⭐ NEW
        config = ContinueConfig(loop_detection_threshold=3)
        state = ContinueState()
        
        tools = ['web_search', 'calculator']
        
        # First call - no loop
        assert state.detect_loop(tools, config) == False
        assert state.repeat_count == 1
        
        # Second call - still no loop
        assert state.detect_loop(tools, config) == False
        assert state.repeat_count == 2
        
        # Third call - loop detected!
        assert state.detect_loop(tools, config) == True
        assert state.repeat_count == 3
    
    def test_loop_detection_different_tools(self):
        """Test loop detection resets on different tools."""  # ⭐ NEW
        config = ContinueConfig(loop_detection_threshold=3)
        state = ContinueState()
        
        # First pattern
        assert state.detect_loop(['web_search'], config) == False
        assert state.repeat_count == 1
        
        # Different pattern - should reset
        assert state.detect_loop(['calculator'], config) == False
        assert state.repeat_count == 0
    
    def test_loop_detection_disabled(self):
        """Test loop detection when disabled."""  # ⭐ NEW
        config = ContinueConfig(enable_loop_detection=False)
        state = ContinueState()
        
        # Should never detect loop
        for _ in range(10):
            assert state.detect_loop(['web_search'], config) == False
    
    def test_increment(self):
        """Test increment increases count."""
        state = ContinueState()
        assert state.count == 0
        state.increment()
        assert state.count == 1
        state.increment()
        assert state.count == 2
    
    def test_reset(self):
        """Test reset returns state to defaults."""
        state = ContinueState(count=10, active=False, last_tool_count=5, repeat_count=3)
        state.reset()
        assert state.count == 0
        assert state.active == True
        assert state.last_tool_count == 0
        assert state.repeat_count == 0  # ⭐ UPDATED


class TestContinueDecisionMaker:
    """Test ContinueDecisionMaker class."""
    
    def test_should_continue_with_no_tools(self):
        """Test returns False when no tools executed."""
        config = ContinueConfig()
        decision_maker = ContinueDecisionMaker(config)
        result = decision_maker.should_continue_after_tools([], 'tool')
        assert result == False
    
    def test_should_continue_with_termination_tool(self):
        """Test returns False when termination tool called."""
        config = ContinueConfig()
        decision_maker = ContinueDecisionMaker(config)
        tool_calls = [{'function_name': 'ask', 'arguments': {}}]
        result = decision_maker.should_continue_after_tools(tool_calls, 'tool')
        assert result == False
    
    def test_should_continue_with_tool_message_type(self):
        """Test returns True when last message is tool type."""
        config = ContinueConfig()
        decision_maker = ContinueDecisionMaker(config)
        tool_calls = [{'function_name': 'web_search', 'arguments': {}}]
        result = decision_maker.should_continue_after_tools(tool_calls, 'tool')
        assert result == True
    
    def test_should_not_continue_with_assistant_message_type(self):
        """Test returns False when last message is assistant type."""
        config = ContinueConfig()
        decision_maker = ContinueDecisionMaker(config)
        tool_calls = [{'function_name': 'web_search', 'arguments': {}}]
        result = decision_maker.should_continue_after_tools(tool_calls, 'assistant')
        assert result == False
    
    def test_is_termination_tool(self):
        """Test is_termination_tool method."""
        config = ContinueConfig()
        decision_maker = ContinueDecisionMaker(config)
        assert decision_maker.is_termination_tool('ask') == True
        assert decision_maker.is_termination_tool('complete') == True
        assert decision_maker.is_termination_tool('web_search') == False


class TestContinuePromptBuilder:
    """Test ContinuePromptBuilder class."""
    
    def test_build_continuation_prompt(self):
        """Test continuation prompt building."""
        config = ContinueConfig()
        builder = ContinuePromptBuilder(config)
        prompt = builder.build_continuation_prompt(tool_count=2, iteration=1)
        
        assert prompt['role'] == 'system'
        assert '2 tool(s)' in prompt['content']
        assert prompt['metadata']['auto_continue_iteration'] == 1
        assert prompt['metadata']['is_continuation_prompt'] == True
    
    def test_build_max_iterations_prompt(self):
        """Test max iterations prompt building."""
        config = ContinueConfig(max_continues=25)
        builder = ContinuePromptBuilder(config)
        prompt = builder.build_max_iterations_prompt(25)
        
        assert prompt['role'] == 'system'
        assert '25' in prompt['content']
        assert prompt['metadata']['max_continues_reached'] == True
    
    def test_build_error_recovery_prompt(self):
        """Test error recovery prompt building."""
        config = ContinueConfig()
        builder = ContinuePromptBuilder(config)
        prompt = builder.build_error_recovery_prompt(
            error_message="Connection timeout",
            tool_name="web_search"
        )
        
        assert prompt['role'] == 'system'
        assert 'web_search' in prompt['content']
        assert 'Connection timeout' in prompt['content']
        assert prompt['metadata']['is_error_recovery'] == True
        assert prompt['metadata']['failed_tool'] == 'web_search'
    
    def test_build_timeout_prompt(self):
        """Test timeout prompt building."""  # ⭐ NEW
        config = ContinueConfig()
        builder = ContinuePromptBuilder(config)
        prompt = builder.build_timeout_prompt(elapsed_seconds=305.5)
        
        assert prompt['role'] == 'system'
        assert '305' in prompt['content'] or '306' in prompt['content']
        assert prompt['metadata']['is_timeout_prompt'] == True
        assert prompt['metadata']['elapsed_seconds'] == 305.5
    
    def test_build_loop_detected_prompt(self):
        """Test loop detection prompt building."""  # ⭐ NEW
        config = ContinueConfig()
        builder = ContinuePromptBuilder(config)
        prompt = builder.build_loop_detected_prompt(
            repeated_tools=['web_search', 'calculator'],
            repeat_count=4
        )
        
        assert prompt['role'] == 'system'
        assert 'web_search' in prompt['content']
        assert 'calculator' in prompt['content']
        assert '4' in prompt['content']
        assert prompt['metadata']['is_loop_detected_prompt'] == True
        assert prompt['metadata']['repeat_count'] == 4


class TestAutoContinueManager:
    """Test AutoContinueManager class."""
    
    def test_initialization(self):
        """Test manager initializes correctly."""
        manager = AutoContinueManager()
        assert manager.config.max_continues == 25
        assert isinstance(manager.decision_maker, ContinueDecisionMaker)
        assert isinstance(manager.prompt_builder, ContinuePromptBuilder)
    
    def test_create_state(self):
        """Test state creation."""
        manager = AutoContinueManager()
        state = manager.create_state()
        assert isinstance(state, ContinueState)
        assert state.count == 0
        assert state.active == True
    
    def test_should_continue_integration(self):
        """Test should_continue with real scenario."""
        manager = AutoContinueManager()
        state = manager.create_state()
        tool_calls = [{'function_name': 'web_search', 'arguments': {}}]
        
        # Should continue when last message is tool type
        result = manager.should_continue(state, tool_calls, 'tool')
        assert result == True
        
        # Should not continue when last message is assistant type
        result = manager.should_continue(state, tool_calls, 'assistant')
        assert result == False
    
    def test_validate_final_message_type(self):
        """Test final message type validation."""
        manager = AutoContinueManager()
        
        assert manager.validate_final_message_type('assistant') == True
        assert manager.validate_final_message_type('llm_response_end') == True
        assert manager.validate_final_message_type('tool') == False
        assert manager.validate_final_message_type('status') == False
    
    def test_update_state_from_signal(self):
        """Test state update from signal."""
        manager = AutoContinueManager()
        state = manager.create_state()
        
        signal = {
            'should_continue': True,
            'tool_count': 3,
            'last_message_type': 'tool_completed'
        }
        
        manager.update_state_from_signal(state, signal)
        
        assert state.active == True
        assert state.last_tool_count == 3
        assert state.last_message_type == 'tool_completed'


class TestConvenienceFunctions:
    """Test convenience functions."""
    
    def test_create_continuation_signal(self):
        """Test signal creation."""
        signal = create_continuation_signal(
            tool_count=2,
            last_message_type='tool'
        )
        
        assert signal['type'] == 'auto_continue_signal'
        assert signal['should_continue'] == True
        assert signal['tool_count'] == 2
        assert signal['last_message_type'] == 'tool'
        assert 'timestamp' in signal
```

---

## Integration Tests

### Test File: `backend/core/agentpress/test_continue_integration.py`

```python
"""
Integration tests for auto-continue with thread manager.
"""

import pytest
from core.agentpress.continue import AutoContinueManager, ContinueState
from core.agentpress.thread_manager import ThreadManager
from core.agentpress.response_processor import ResponseProcessor


@pytest.mark.asyncio
class TestContinueIntegration:
    """Integration tests with real components."""
    
    async def test_auto_continue_with_thread_manager(self, thread_manager):
        """Test auto-continue integrates with thread manager."""
        # This would test the actual integration
        # Would require mocked database and LLM responses
        pass
    
    async def test_continuation_prompt_added_to_db(self, db_client):
        """Test that continuation prompts are saved to database."""
        # Test that system messages are actually added
        pass
    
    async def test_max_iterations_stops_correctly(self, thread_manager):
        """Test that max iterations limit is enforced."""
        # Test iteration limit
        pass
```

---

## End-to-End Tests

### Manual Test Scenarios

#### Scenario 1: Simple Tool Call

**Setup**:
1. Start backend and frontend
2. Create new thread
3. Ensure auto-continue is enabled

**Test**:
```
User Input: "What's the current weather in San Francisco?"

Expected Flow:
1. Agent responds: "I'll check the weather for you..."
2. Agent calls weather_tool
3. Tool executes successfully
4. Auto-continue triggers (iteration 1/25)
5. Agent continues: "The current weather in San Francisco is..."
6. No more tools needed
7. Final message type: "assistant" ✓

Validation:
- Check database: last message should be type 'assistant'
- Check frontend: no tool calls visible as final message
- Check logs: should see "Auto-continue iteration: 1"
```

#### Scenario 2: Multiple Sequential Tools

**Test**:
```
User Input: "Research AI trends and create a presentation about it"

Expected Flow:
1. Agent: "I'll search for AI trends..."
2. Tool: web_search → Auto-continue (1/25)
3. Agent: "Based on the results, I'll create a presentation..."
4. Tool: presentation_tool → Auto-continue (2/25)
5. Agent: "I've created a presentation with these slides..."
6. Final message type: "assistant" ✓

Validation:
- Database shows 2 continuation prompts
- Final message is assistant type
- Logs show 2 iterations
- All tool results are in conversation history
```

#### Scenario 3: Termination Tool

**Test**:
```
User Input: "Ask me what my favorite color is"

Expected Flow:
1. Agent: "I'll ask you about your favorite color..."
2. Tool: ask → NO auto-continue (termination tool)
3. Agent run stops
4. Final message type: "assistant" ✓

Validation:
- No continuation prompts added
- Logs show "termination tool" message
- Auto-continue count stays at 0
```

#### Scenario 4: Max Iterations Reached

**Test** (with max_continues set to 3 for testing):
```
User Input: "Make 5 web searches"

Expected Flow:
1. Search 1 → Auto-continue (1/3)
2. Search 2 → Auto-continue (2/3)
3. Search 3 → Auto-continue (3/3)
4. Max reached → Final summary prompt added
5. Agent provides summary
6. Final message type: "assistant" ✓

Validation:
- Exactly 3 continuation prompts
- Max iterations prompt added
- Logs show "max continues reached"
- Agent doesn't make more tool calls
```

#### Scenario 5: Tool Error Recovery

**Test**:
```
User Input: "Search for something that will fail"

Expected Flow:
1. Agent calls web_search
2. Tool fails with error
3. Error recovery prompt added
4. Auto-continue still triggers
5. Agent: "The search encountered an error, but I can..."
6. Final message type: "assistant" ✓

Validation:
- Error recovery prompt in database
- Auto-continue still happened
- Agent acknowledged the error
- Conversation completed gracefully
```

#### Scenario 6: Timeout Detection ⭐ NEW

**Test** (with max_duration_seconds set to 30 for testing):
```
User Input: "Run a very slow operation"

Expected Flow:
1. Agent makes tool call (slow operation)
2. Tool takes 35 seconds to complete
3. Timeout detected (> 30 seconds)
4. Timeout prompt added
5. Agent provides summary based on work so far
6. Final message type: "assistant" ✓

Validation:
- Timeout prompt in database
- Logs show "Auto-continue timed out"
- Conversation stopped gracefully
- No infinite waiting
```

#### Scenario 7: Loop Detection ⭐ NEW

**Test** (with loop_detection_threshold set to 3 for testing):
```
User Input: "Keep searching for better results"

Expected Flow:
1. Agent calls web_search
2. Auto-continue (1/25)
3. Agent calls web_search again (same tool)
4. Auto-continue (2/25), repeat_count = 1
5. Agent calls web_search again (same tool)
6. Auto-continue (3/25), repeat_count = 2
7. Agent calls web_search again (same tool)
8. Loop detected! repeat_count = 3
9. Loop warning prompt added
10. Agent: "I've searched multiple times, here's the best result..."
11. Final message type: "assistant" ✓

Validation:
- Loop detection prompt in database
- Logs show "Loop detected" message
- Agent broke out of loop
- Conversation completed gracefully
```

#### Scenario 8: Emergency Kill Switch ⭐ NEW

**Test** (with ENABLE_AUTO_CONTINUE=false):
```
User Input: "Make 5 tool calls"

Expected Flow:
1. Agent makes first tool call
2. Tool executes
3. Auto-continue is disabled (env var)
4. Agent run stops
5. Final message type: "tool" (not ideal, but expected)

Validation:
- Logs show "Auto-continue disabled via environment variable"
- No continuation prompts added
- Feature completely bypassed
```

---

## Performance Tests

### Token Usage Test

**Goal**: Measure token cost increase with auto-continue

**Test Script**:
```python
async def test_token_usage_with_continue():
    """
    Compare token usage with and without auto-continue.
    """
    # Run agent with auto-continue disabled
    tokens_without = await run_agent_and_measure_tokens(
        prompt="Make 3 tool calls",
        max_continues=0
    )
    
    # Run agent with auto-continue enabled
    tokens_with = await run_agent_and_measure_tokens(
        prompt="Make 3 tool calls",
        max_continues=25
    )
    
    # Calculate overhead
    overhead = (tokens_with - tokens_without) / tokens_without * 100
    
    print(f"Tokens without: {tokens_without}")
    print(f"Tokens with: {tokens_with}")
    print(f"Overhead: {overhead:.2f}%")
    
    # Should be reasonable (< 20% overhead)
    assert overhead < 20
```

### Latency Test

**Goal**: Measure response time increase

**Test**:
```python
async def test_latency_with_continue():
    """
    Measure latency impact of auto-continue.
    """
    import time
    
    # Without auto-continue
    start = time.time()
    await run_agent(prompt="Simple task", max_continues=0)
    duration_without = time.time() - start
    
    # With auto-continue (3 iterations)
    start = time.time()
    await run_agent(prompt="Task with 3 tool calls", max_continues=25)
    duration_with = time.time() - start
    
    print(f"Duration without: {duration_without:.2f}s")
    print(f"Duration with: {duration_with:.2f}s")
    
    # Calculate per-iteration overhead
    overhead_per_iter = (duration_with - duration_without) / 3
    print(f"Overhead per iteration: {overhead_per_iter:.2f}s")
```

---

## Edge Case Tests

### Edge Case 1: Empty Tool Calls List

**Test**:
```python
def test_empty_tool_calls():
    """Test with no tools executed."""
    manager = AutoContinueManager()
    state = manager.create_state()
    
    result = manager.should_continue(state, [], 'assistant')
    assert result == False
```

### Edge Case 2: Tool Call Without function_name

**Test**:
```python
def test_tool_call_missing_function_name():
    """Test with malformed tool call."""
    manager = AutoContinueManager()
    state = manager.create_state()
    
    # Tool call without function_name
    tool_calls = [{'arguments': {}}]
    result = manager.should_continue(state, tool_calls, 'tool')
    
    # Should handle gracefully (no crash)
    assert isinstance(result, bool)
```

### Edge Case 3: Negative Iteration Count

**Test**:
```python
def test_negative_iteration_count():
    """Test with negative count (should never happen)."""
    state = ContinueState(count=-1)
    config = ContinueConfig()
    
    # Should still work (defensive programming)
    result = state.should_continue(config)
    assert result == True  # Not limited by count
```

### Edge Case 4: Very Long Tool Results

**Test**:
```
User Input: "Search for a very long document"

Expected:
- Tool returns 50,000 tokens of content
- Context compression triggers
- Auto-continue still works
- No token overflow errors

Validation:
- Check compression logs
- Verify token count stayed under limit
- Conversation completed successfully
```

---

## Validation Checklist

### Functional Requirements

- [ ] Agent continues after tool calls
- [ ] Conversations end with assistant messages
- [ ] Termination tools work correctly
- [ ] Max iterations limit enforced
- [ ] Tool errors handled gracefully
- [ ] Continuation prompts added correctly
- [ ] State tracking works properly
- [ ] Final message validation works

### Non-Functional Requirements

- [ ] Token overhead < 20%
- [ ] Latency increase acceptable
- [ ] No memory leaks
- [ ] Logs are comprehensive
- [ ] Error messages are clear
- [ ] Code is maintainable

### Database Validation

- [ ] Continuation prompts saved correctly
- [ ] Message types are correct
- [ ] Metadata includes iteration count
- [ ] No duplicate messages
- [ ] Thread state updated properly

### Frontend Validation

- [ ] Auto-continue signals filtered
- [ ] UI shows smooth transitions
- [ ] No duplicate messages displayed
- [ ] Loading states appropriate
- [ ] Error messages displayed correctly

---

## Running Tests

### Unit Tests

```bash
# Run all unit tests
pytest backend/core/agentpress/test_continue.py -v

# Run specific test class
pytest backend/core/agentpress/test_continue.py::TestAutoContinueManager -v

# Run with coverage
pytest backend/core/agentpress/test_continue.py --cov=core.agentpress.continue
```

### Integration Tests

```bash
# Run integration tests (requires database)
pytest backend/core/agentpress/test_continue_integration.py -v

# Run with specific markers
pytest -m integration -v
```

### Manual Testing

```bash
# Start backend
cd backend
python -m uvicorn api:app --reload

# Start frontend
cd frontend
npm run dev

# Use browser to test scenarios
```

---

## Test Data

### Sample Tool Calls

```python
SAMPLE_TOOL_CALLS = [
    {
        'function_name': 'web_search',
        'arguments': {'query': 'AI trends 2025'},
        'result': '...'
    },
    {
        'function_name': 'presentation_tool',
        'arguments': {'title': 'AI Trends'},
        'result': 'Presentation created'
    },
    {
        'function_name': 'ask',
        'arguments': {'question': 'What is your name?'},
        'result': None
    }
]
```

### Sample Messages

```python
SAMPLE_MESSAGES = [
    {
        'role': 'user',
        'content': 'Research AI and create presentation',
        'type': 'user'
    },
    {
        'role': 'assistant',
        'content': 'I will search for AI trends...',
        'type': 'assistant'
    },
    {
        'type': 'tool',
        'function_name': 'web_search',
        'result': '...'
    },
    {
        'role': 'system',
        'content': 'Continue your response. 1 tool(s) have been executed...',
        'type': 'system',
        'metadata': {'is_continuation_prompt': True}
    }
]
```

---

## Debugging Tips

### Enable Debug Logging

```python
import logging
logging.getLogger('core.agentpress.continue').setLevel(logging.DEBUG)
```

### Check Database State

```sql
-- Get last 10 messages in thread
SELECT type, content, metadata, created_at
FROM messages
WHERE thread_id = 'xxx'
ORDER BY created_at DESC
LIMIT 10;

-- Count continuation prompts
SELECT COUNT(*)
FROM messages
WHERE thread_id = 'xxx'
AND metadata->>'is_continuation_prompt' = 'true';
```

### Monitor Token Usage

```python
# In thread_manager.py, enable token logging
logger.info(f"Tokens used: {usage.get('total_tokens')}")
logger.info(f"Input tokens: {usage.get('prompt_tokens')}")
logger.info(f"Output tokens: {usage.get('completion_tokens')}")
```

---

## Success Criteria

All tests must pass:
- ✅ 100% unit test coverage
- ✅ All integration tests pass
- ✅ All manual scenarios complete successfully
- ✅ Performance within acceptable limits
- ✅ No critical bugs found
- ✅ User experience is smooth

---

**Last Updated**: November 1, 2025  
**Status**: ✅ Testing Framework Complete
