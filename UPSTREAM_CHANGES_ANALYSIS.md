# Upstream PRODUCTION Branch Changes Analysis

## Executive Summary

The upstream `kortix-ai/suna` PRODUCTION branch contains significant improvements focused on:
1. **Cost-saving prompt caching optimizations (70-90% savings claimed)**
2. **Enhanced context management with Bedrock/Anthropic token counting**
3. **Native tool calling support**
4. **Billing system refactoring**
5. **Module-level singleton clients for memory efficiency**

---

## Key Files Changed (Cost-Savings Focus)

### 1. `backend/core/agentpress/prompt_caching.py` (509 lines changed)

#### Major Improvements:
- **Store/Retrieve cache thresholds**: New `store_threshold()` function with `system_prompt_tokens` parameter for persistent optimization
- **Enhanced model detection**: Improved `is_anthropic_model()` with ModelProvider registry check and Bedrock ARN detection
- **Message grouping for tool calls**: New `group_messages_by_tool_calls_for_caching()` function that preserves assistant+tool_result pairing (CRITICAL for Bedrock)
- **Dynamic chunk redistribution**: Uses 1.8x multiplier instead of 1.5x, and `max_chunk_size = int(context_window_tokens * 0.15)` instead of fixed 30k cap
- **Cache breakpoint strategy**: Enhanced `create_conversation_chunks()` that operates on MESSAGE GROUPS rather than individual messages

#### Key Code Changes:
```python
# New: Store system prompt tokens for reuse
async def store_threshold(thread_id, threshold, model, reason, turn, system_prompt_tokens=None):

# New: Enhanced add_cache_control that preserves tool_calls and other fields
def add_cache_control(message: Dict[str, Any]) -> Dict[str, Any]:
    cached_msg = deepcopy(message)  # Preserves all message fields
    
# New: Group messages for atomic caching units
def group_messages_by_tool_calls_for_caching(messages) -> List[List[Dict]]:
```

### 2. `backend/core/agentpress/context_manager.py` (872 lines changed)

#### Major Improvements:
- **Module-level singleton clients**: `_get_anthropic_client_singleton()` and `_get_bedrock_client_singleton()` for memory efficiency
- **Bedrock token counting with cache_control -> cachePoint conversion**: Converts Anthropic format to Bedrock Converse API format
- **Bidirectional tool call validation**: Validates both orphaned tool results AND unanswered tool calls
- **Enhanced compression**: `repair_tool_call_pairing()` function to fix message structure before sending to LLM

#### Key Code Changes:
```python
# Module-level singletons (not per-instance)
_anthropic_client = None
_bedrock_client = None
_clients_initialized = False

def _get_anthropic_client_singleton():
    global _anthropic_client, _clients_initialized
    ...

# New validation methods
def validate_tool_call_pairing(self, messages) -> tuple[bool, List[str], List[str]]:
def remove_orphaned_tool_results(self, messages) -> List[Dict]:
def remove_unanswered_tool_calls(self, messages) -> List[Dict]:
def repair_tool_call_pairing(self, messages) -> List[Dict]:

# Enhanced token estimation for billing
async def estimate_token_usage(self, prompt_messages, completion_content, model) -> Dict:
```

### 3. `backend/core/agentpress/thread_manager.py` (249 lines changed)

#### Major Improvements:
- **Timing instrumentation**: Added `[TIMING]` logs for profiling (get_llm_messages, compression, caching, validation)
- **Pre-send validation**: Validates tool call pairing before sending to LLM with automatic repair
- **Fast path optimization**: Improved cache creation token handling in fast check
- **Billing import update**: Changed from `billing_integration` to `core.billing.credits.integration`
- **Stop sequences for XML tool calling**: Added `|||STOP_AGENT|||` stop sequence

#### Key Code Changes:
```python
# Import change (upstream billing refactor)
from core.billing.credits.integration import billing_integration

# Pre-send validation
is_valid, orphaned_ids, unanswered_ids = context_manager.validate_tool_call_pairing(prepared_messages)
if not is_valid:
    prepared_messages = context_manager.repair_tool_call_pairing(prepared_messages)

# Timing instrumentation
fetch_start = time.time()
messages = await self.get_llm_messages(thread_id)
logger.info(f"⏱️ [TIMING] get_llm_messages(): {(time.time() - fetch_start) * 1000:.1f}ms")
```

---

## Billing System Refactoring

The upstream has undergone significant billing refactoring:

### Old Structure (Local):
```
backend/core/billing/
├── billing_integration.py
├── subscription_service.py
├── trial_service.py
├── payment_service.py
├── reconciliation_service.py
├── stripe_circuit_breaker.py
└── config.py
```

### New Structure (Upstream):
```
backend/core/billing/
├── credits/
│   ├── integration.py      # billing_integration lives here
│   ├── calculator.py
│   └── manager.py
├── subscriptions/
├── payments/
├── external/
│   ├── stripe/
│   └── revenuecat/         # NEW: Mobile billing support
└── shared/
    └── config.py
```

---

## Safe Commits to Cherry-Pick

Based on the analysis, here are the recommended changes to incorporate:

### HIGH PRIORITY (Cost Savings):
1. **prompt_caching.py updates** - All changes relate to cost optimization
2. **context_manager.py singleton clients** - Memory efficiency
3. **thread_manager.py pre-send validation** - Prevents Bedrock errors

### MEDIUM PRIORITY (Stability):
1. **Tool call pairing validation** - Prevents API errors
2. **Timing instrumentation** - Performance debugging
3. **Error handling improvements** in error_processor.py

### LOW PRIORITY (Requires Major Refactoring):
1. **Billing system restructure** - Requires significant migration
2. **RevenueCat integration** - Mobile-specific

---

## Recommended Approach

### Option A: Surgical Updates (Recommended)
Update only the prompt caching and context management files:
1. `backend/core/agentpress/prompt_caching.py` - Full replacement
2. `backend/core/agentpress/context_manager.py` - Selective changes (singleton clients, validation methods)
3. `backend/core/agentpress/thread_manager.py` - Selective changes (timing, validation)

**Risk**: Low - Core functionality unchanged, just optimization
**Effort**: Medium - Need to reconcile import differences

### Option B: Full Backend Sync (Not Recommended)
Sync entire backend with upstream PRODUCTION.

**Risk**: High - Billing refactor could break integrations
**Effort**: Very High - Need to migrate billing, test everything

---

## Key Technical Details for Implementation

### Import Changes Required:
```python
# If keeping old billing structure, this import needs to stay:
from core.billing.billing_integration import billing_integration

# If adopting new structure:
from core.billing.credits.integration import billing_integration
```

### New Dependencies:
None identified - all changes use existing dependencies.

### Database Changes:
None required for prompt caching changes.

### Configuration Changes:
None required - changes use existing model_manager and registry.

---

## Files to Copy from Upstream

For the minimal cost-saving update, these files should be reviewed and updated:

1. `backend/core/agentpress/prompt_caching.py` (primary)
2. `backend/core/agentpress/context_manager.py` (selective methods)
3. `backend/core/agentpress/thread_manager.py` (selective sections)
4. `backend/core/agentpress/PROMPT_CACHING.md` (documentation)

