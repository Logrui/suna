# Upstream Merge - File Update Checklist

This document provides a detailed checklist of every file that needs to be updated to incorporate the upstream architectural changes.

---

## 📋 File Update Checklist

### 🔴 CRITICAL - Breaking Changes (Must Do First)

#### File Reorganization

- [ ] **CREATE** `backend/core/prompts/`
  - [ ] Create directory
  - [ ] Create `__init__.py`

- [ ] **CREATE** `backend/core/prompts/prompt.py`
  - [ ] Copy content from upstream: `backend/core/prompts/prompt.py`
  - [ ] Verify `SYSTEM_PROMPT` constant is defined
  - [ ] Verify `get_system_prompt()` function exists
  - [ ] Ensure prompt does NOT contain tool schemas (should be ~2400 lines of instructions)

- [ ] **CREATE** `backend/core/prompts/agent_builder_prompt.py`
  - [ ] Copy content from upstream: `backend/core/prompts/agent_builder_prompt.py`
  - [ ] Verify `get_agent_builder_prompt()` function exists

- [ ] **CREATE** `backend/core/run.py`
  - [ ] Copy content from upstream: `backend/core/run.py`
  - [ ] Verify imports are correct for our fork
  - [ ] Verify `AgentConfig` dataclass exists
  - [ ] Verify `ToolManager` class exists with all methods
  - [ ] Verify `MCPManager` class exists with all methods
  - [ ] Verify `PromptManager` class exists with all methods

- [ ] **UPDATE** All imports referencing `backend/agent/prompt.py`
  - [ ] Search codebase: `git grep "from agent.prompt import\|from backend.agent.prompt import"`
  - [ ] Replace with: `from core.prompts.prompt import` or `from backend.core.prompts.prompt import`

- [ ] **UPDATE** All imports referencing `backend/agent/run.py`
  - [ ] Search codebase: `git grep "from agent.run import\|from backend.agent.run import"`
  - [ ] Replace with: `from core.run import` or `from backend.core.run import`

- [ ] **DELETE** `backend/agent/prompt.py` (after verifying all imports updated)
- [ ] **DELETE** `backend/agent/run.py` (after verifying all imports updated)
- [ ] **DELETE** `backend/agent/` directory (if empty)

---

### 🟡 HIGH PRIORITY - Performance & Caching

#### Tool Discovery & Schema Caching

- [ ] **UPDATE** `backend/core/utils/tool_discovery.py`
  - [ ] Add module docstring about performance optimization
  - [ ] Add global cache variables:
    ```python
    _SCHEMA_CACHE: Dict[Type[Tool], Dict[str, List[ToolSchema]]] = {}
    _STATELESS_TOOL_INSTANCES: Dict[Type[Tool], Tool] = {}
    ```
  - [ ] Add `STATELESS_TOOLS` set with tool names
  - [ ] Add `_precompute_schemas_for_class(tool_class)` function
  - [ ] Add `get_cached_schemas(tool_class)` function
  - [ ] Add `get_cached_tool_instance(tool_class)` function
  - [ ] Add `warm_up_tools_cache()` function
  - [ ] Add `_TOOLS_CACHE` and `_WARMUP_COMPLETE` globals
  - [ ] Update `discover_tools()` to use cache
  - [ ] Verify imports: `from core.agentpress.tool import Tool, ToolMetadata, MethodMetadata, ToolSchema`

#### Tool Registry Optimization

- [ ] **UPDATE** `backend/core/agentpress/tool_registry.py`
  - [ ] Update class docstring to mention performance optimization
  - [ ] Update `register_tool()` method:
    - [ ] Add timing instrumentation (`import time`, measure elapsed)
    - [ ] Try to use cached instance first (call `get_cached_tool_instance()`)
    - [ ] Try to use cached schemas first (call `get_cached_schemas()`)
    - [ ] Log timing if >10ms
  - [ ] Update `get_available_functions()` method:
    - [ ] Use stored `method_name` if available (for MCP collision handling)
    - [ ] Fall back to registration name
  - [ ] Verify imports: `from core.utils.tool_discovery import get_cached_schemas, get_cached_tool_instance`

#### MCP Tool Wrapper - Redis Caching & Parallelization

- [ ] **UPDATE** `backend/core/tools/mcp_tool_wrapper.py`
  - [ ] Add `MCPSchemaRedisCache` class at top of file:
    - [ ] `__init__(self, ttl_seconds=3600, key_prefix="mcp_schema:")`
    - [ ] `async def get(self, config)` - get cached schema
    - [ ] `async def set(self, config, data)` - cache schema
    - [ ] `async def clear_pattern(self, pattern=None)` - clear cache
    - [ ] `async def get_stats(self)` - get cache statistics
    - [ ] `def _get_cache_key(self, config)` - generate cache key from config hash
    - [ ] `async def _ensure_redis(self)` - lazy Redis client initialization
  - [ ] Create global cache instance: `_redis_cache = MCPSchemaRedisCache(ttl_seconds=3600)`
  - [ ] Update `MCPToolWrapper.__init__()`:
    - [ ] Add `use_cache: bool = True` parameter
    - [ ] Store as `self.use_cache`
  - [ ] Update `_initialize_servers()` method:
    - [ ] Add timing instrumentation
    - [ ] Separate standard vs custom configs
    - [ ] Check Redis cache for each config
    - [ ] Build list of initialization tasks for non-cached
    - [ ] Use `asyncio.gather()` to run tasks IN PARALLEL
    - [ ] Cache successful results
    - [ ] Log timing breakdown
  - [ ] Add `_initialize_single_standard_server(self, config)` method
  - [ ] Add `_initialize_single_custom_mcp(self, config)` method
  - [ ] Verify imports: `import asyncio`, `import time`, `import hashlib`, `import json`, `from services import redis as redis_service`

---

### 🟠 MEDIUM PRIORITY - Thread & Context Management

#### Thread Manager Updates

- [ ] **UPDATE** `backend/core/agentpress/thread_manager.py`
  - [ ] Add `import litellm` at top
  - [ ] Update billing import:
    - [ ] Change: `from core.billing.billing_integration import billing_integration`
    - [ ] To: `from core.billing.credits.integration import billing_integration`
  - [ ] Update `_log_usage_to_db()` method:
    - [ ] Add cache creation tokens extraction
    - [ ] Add debug logging for cache creation tokens
  - [ ] Update `get_llm_messages()` method:
    - [ ] Add empty user message filter
    - [ ] Handle both string and dict content types
    - [ ] Add warning logs for empty messages
  - [ ] Update `_execute_run()` signature:
    - [ ] Remove `max_xml_tool_calls` parameter
  - [ ] Update `_execute_run()` method body:
    - [ ] Add run counter at start: `run_number = auto_continue_state['count'] + 1`
    - [ ] Add timing instrumentation for:
      - [ ] `get_llm_messages()` - measure and log
      - [ ] Context compression - measure and log
      - [ ] Prompt caching - measure and log
      - [ ] Tool schema retrieval - measure and log
      - [ ] LLM API call - measure and log
    - [ ] Add pre-send validation:
      - [ ] Call `context_manager.validate_tool_call_pairing(prepared_messages)`
      - [ ] If invalid, attempt repair with `context_manager.repair_tool_call_pairing()`
      - [ ] Re-validate after repair
      - [ ] Log validation results
    - [ ] Add XML tool calling stop sequences:
      - [ ] Check `config.xml_tool_calling`
      - [ ] Set `stop_sequences = ["|||STOP_AGENT|||"]` if XML mode
    - [ ] Update LLM call to include `stop` parameter
  - [ ] Update `_handle_auto_continue()` method:
    - [ ] Add credit check before each iteration
    - [ ] Call `billing_integration.check_and_reserve_credits(account_id)`
    - [ ] Yield stop message if insufficient credits
  - [ ] Update `_should_auto_continue()` method:
    - [ ] Add check for `agent_terminated` finish reason
    - [ ] Only auto-continue for `tool_calls` or `length` finish reasons
  - [ ] Update error handling in `_handle_auto_continue()`:
    - [ ] Add non-retryable error detection
    - [ ] Check for `litellm.BadRequestError`
    - [ ] Check for "is blank", "400", "validation", "invalid" in error string
    - [ ] Stop immediately for non-retryable errors
  - [ ] Add `async def cleanup(self)` method:
    - [ ] Clean up tool instances with cleanup support
    - [ ] Clear tool registry
    - [ ] Clear response processor reference

#### Context Manager Updates

- [ ] **UPDATE** `backend/core/agentpress/context_manager.py`
  - [ ] Add module-level singleton clients at top:
    ```python
    _anthropic_client = None
    _bedrock_client = None
    _clients_initialized = False
    ```
  - [ ] Add `_get_anthropic_client_singleton()` function
  - [ ] Add `_get_bedrock_client_singleton()` function
  - [ ] Update `ContextManager` class:
    - [ ] Replace `_anthropic_client` and `_bedrock_client` instance variables
    - [ ] Update `_get_anthropic_client()` to call `_get_anthropic_client_singleton()`
    - [ ] Update `_get_bedrock_client()` to call `_get_bedrock_client_singleton()`
  - [ ] Update Bedrock model ID mappings in `count_tokens()`:
    ```python
    model_id_mapping = {
        "heol2zyy5v48": "anthropic.claude-haiku-4-5-20251001-v1:0",
        "few7z4l830xh": "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
        "tyj1ks3nj9qf": "anthropic.claude-sonnet-4-20250514-v1:0",
    }
    ```
  - [ ] Add `async def estimate_token_usage(self, prompt_messages, completion_content, model)` method
  - [ ] Add `def get_tool_call_ids_from_message(self, msg)` method
  - [ ] Add `def get_tool_call_id_from_result(self, msg)` method
  - [ ] Add `def group_messages_by_tool_calls(self, messages)` method
  - [ ] Add `def flatten_message_groups(self, groups)` method
  - [ ] Add `def validate_tool_call_pairing(self, messages)` method
  - [ ] Add `def remove_orphaned_tool_results(self, messages)` method
  - [ ] Add `def remove_unanswered_tool_calls(self, messages)` method
  - [ ] Add `def repair_tool_call_pairing(self, messages)` method (combine orphan removal + unanswered removal)
  - [ ] Update `is_tool_result_message()` method to detect both native and XML tool calls

---

### 🟢 LOW PRIORITY - Supporting Files

#### Worker & API Startup

- [ ] **UPDATE** `backend/api.py`
  - [ ] Add import: `from core.utils.tool_discovery import warm_up_tools_cache`
  - [ ] Add warmup call at startup (after loading environment):
    ```python
    # Warm up tool cache at startup for faster agent initialization
    warm_up_tools_cache()
    ```
  - [ ] Verify it's called BEFORE any agent runs

- [ ] **UPDATE** `backend/run_agent_background.py` (Dramatiq worker entry)
  - [ ] Add import: `from core.utils.tool_discovery import warm_up_tools_cache`
  - [ ] Add warmup call at worker startup:
    ```python
    # Warm up tool cache at worker startup
    warm_up_tools_cache()
    ```

#### Centralized Tool Registry

- [ ] **VERIFY** `backend/core/tools/tool_registry.py` (centralized registry)
  - [ ] Verify `SANDBOX_TOOLS` list exists and is populated
  - [ ] Verify `AGENT_BUILDER_TOOLS` list exists and is populated
  - [ ] Verify `get_tool_class(module_path, class_name)` function exists
  - [ ] Verify `get_tool_info(tool_name)` function exists
  - [ ] Verify `get_all_tools()` function exists
  - [ ] If file doesn't exist, copy from upstream

#### Execution Service

- [ ] **UPDATE** `backend/core/triggers/execution_service.py` (if exists)
  - [ ] Update imports from `agent.run` to `core.run`
  - [ ] Update imports from `agent.prompt` to `core.prompts.prompt`
  - [ ] Verify all imports are correct

#### Test Files

- [ ] **SEARCH** for all test files importing from `backend/agent/`
  - [ ] Run: `git grep "from agent\." backend/*/tests/`
  - [ ] Run: `git grep "import agent\." backend/*/tests/`
  - [ ] Update all test imports to use `core.*` instead

- [ ] **UPDATE** Test fixtures that create agent configs
  - [ ] Verify they don't rely on old tool schema structure
  - [ ] Verify they work with new prompt structure

---

### 🔍 VERIFICATION STEPS

After making all updates, verify:

#### Import Verification
- [ ] Run: `git grep "from agent\.prompt import\|from backend\.agent\.prompt import"`
  - [ ] Should return ZERO results
- [ ] Run: `git grep "from agent\.run import\|from backend\.agent\.run import"`
  - [ ] Should return ZERO results
- [ ] Run: `python -m backend.api` (or equivalent)
  - [ ] Should start without import errors
  - [ ] Should show warmup logs: "🔥 Warming up: loading tool classes..."
  - [ ] Should show: "✅ Ready: X tools, Y methods, Z instances cached"

#### Runtime Verification
- [ ] Start backend API: `cd backend && uv run uvicorn api:app --reload`
  - [ ] Check logs for warmup completion
  - [ ] Verify no import errors
- [ ] Start Dramatiq worker: `cd backend && uv run dramatiq --processes 4 --threads 4 run_agent_background`
  - [ ] Check logs for warmup completion
  - [ ] Verify no import errors
- [ ] Create a new agent run
  - [ ] Check logs for timing instrumentation:
    - [ ] "⏱️ [TIMING] get_llm_messages(): Xms"
    - [ ] "⏱️ [TIMING] Context compression: Xms"
    - [ ] "⏱️ [TIMING] Prompt caching: Xms"
    - [ ] "⏱️ [TIMING] Get tool schemas: Xms"
    - [ ] "⏱️ [TIMING] LLM API call: Xms"
  - [ ] Verify tools work correctly
  - [ ] Verify MCP tools work (if configured)

#### System Prompt Verification
- [ ] Intercept LLM API call (add debug logging in `thread_manager.py`)
- [ ] Check `prepared_messages[0]` (system message)
  - [ ] Should NOT contain tool schemas
  - [ ] Should be relatively short (~2400 lines or ~500 tokens)
- [ ] Check `openapi_tool_schemas` parameter
  - [ ] Should contain tool schemas as structured JSON
  - [ ] Should be passed to LLM via `tools=` parameter

#### Cache Verification
- [ ] Check Redis for MCP schema cache
  - [ ] Run: `redis-cli KEYS "mcp_schema:*"`
  - [ ] Should show cached schemas after first MCP initialization
- [ ] Restart backend
  - [ ] First MCP initialization should be slow (~500ms+)
  - [ ] Second MCP initialization should be instant (~0ms, cache hit)
- [ ] Check logs for cache hits:
  - [ ] "⚡ Redis cache hit for MCP: <name>"
  - [ ] "⚡ All X MCP schemas loaded from cache - instant startup!"

#### Performance Verification
- [ ] Measure agent startup time (from API call to first LLM response)
  - [ ] Before: ~1-2s
  - [ ] After: ~200-400ms (3-5x faster)
- [ ] Check timing logs:
  - [ ] Tool registration: should be <100ms total
  - [ ] MCP initialization: should be <100ms with cache, instant on 2nd+ run
  - [ ] System prompt building: should be <50ms

---

### 📊 Summary Checklist

- [ ] File reorganization complete (`agent/` → `core/`)
- [ ] All imports updated
- [ ] Tool discovery caching implemented
- [ ] Tool registry optimization implemented
- [ ] MCP Redis caching implemented
- [ ] MCP parallel initialization implemented
- [ ] Thread manager timing instrumentation added
- [ ] Thread manager validation added
- [ ] Context manager singleton clients added
- [ ] Context manager tool call validation added
- [ ] Worker/API warmup calls added
- [ ] All tests passing
- [ ] System prompt verified (no tool schemas)
- [ ] Performance improvements verified (3-5x faster)
- [ ] Redis cache working
- [ ] No import errors

---

## 🚨 Common Issues & Solutions

### Issue: Import Error "No module named 'agent.prompt'"
**Solution**: Search for old imports and update to `core.prompts.prompt`

### Issue: Tool schemas still in system prompt
**Solution**: Verify you're using native function calling API (`tools=` parameter), not XML

### Issue: MCP cache not working
**Solution**: Check Redis connection, verify `use_cache=True` in MCPToolWrapper

### Issue: Agent startup still slow
**Solution**: Verify `warm_up_tools_cache()` is called at startup, check logs for cache hits

### Issue: Tool call validation errors
**Solution**: Check Bedrock model compatibility, ensure tool call pairing is correct

### Issue: Tests failing after migration
**Solution**: Update test imports, verify test fixtures use new structure

---

## 📝 Notes

- This migration is **REQUIRED** for upstream compatibility
- Estimated time: **4-8 hours** for experienced developer
- Test thoroughly after each phase
- Keep backup branch before starting
- Monitor performance improvements with timing logs
- Redis is required for MCP caching (graceful degradation if unavailable)

---

## ✅ Final Validation

After completing all checkboxes above:

1. [ ] Run full test suite: `cd backend && ./test`
2. [ ] Start API and worker, verify no errors
3. [ ] Create test agent run, verify tools work
4. [ ] Check timing logs show performance improvements
5. [ ] Verify system prompt is clean (no tool schemas)
6. [ ] Commit changes with clear message
7. [ ] Deploy to staging environment
8. [ ] Monitor production metrics

**Migration Complete!** 🎉
