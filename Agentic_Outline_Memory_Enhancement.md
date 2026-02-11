# Agentic Outline: Memory Enhancement (Intelligence & Consolidation)

This phase aims to bring Agent-Zero's sophisticated memory management patterns to Kortix, focusing on intelligent consolidation and improved retrieval.

## Objectives
- Prevent memory bloat through intelligent consolidation (Merge/Replace/Update).
- Improve search accuracy using keyword extraction.
- Provide the agent with explicit search capabilities within the project knowledge base.

## Proposed Implementation

### 1. Prompt Engineering
- [ ] **memory_consolidation_prompt.py**: (Already created) Define system and message prompts for consolidation analysis.
- [ ] **Update Core Prompt**: Refresh the `# PROACTIVE PROJECT MEMORY` section to include instructions on searching before saving and the concept of consolidation.

### 2. Backend Logic (ProjectMemoryService)
- [ ] **Keyword Extraction**: Implement a method to extract search terms from the input using an LLM call.
- [ ] **Search Refinement**: Update `search_memories` to utilize these keywords alongside the raw embedding.
- [ ] **Consolidation Flow**:
    - When `create_memory` is called:
        1. Search for existing similar memories (threshold ~0.7).
        2. If similar memories are found ($n > 0$), call the `MEMORY_CONSOLIDATION_PROMPT`.
        3. Parse the LLM's decision (JSON).
        4. Execute the decision:
            - `merge`: Delete old IDs, insert new consolidated content.
            - `replace`: Delete old IDs, insert new content.
            - `update`: Update existing ID content.
            - `keep_separate`: Normal insert.
            - `skip`: Do nothing.

### 3. Tool Enhancement (ProjectMemoryTool)
- [ ] **`search_project_memories`**: (Already created) verify it works as intended.
- [ ] **Refine `save_project_memory`**: Add logic to trigger the consolidation flow.

### 4. Verification
- [ ] Manual test: Save one fact ("The app uses Tailwind"), then save a conflicting fact ("The app switched to Vanilla CSS"). Verify that the Tailwind memory is replaced or merged.
- [ ] Manual test: Search for a specific fact using a conceptual query. Verify keyword extraction improves the result.

## Sequence of Actions
1. **Architect** confirms prompts and logic flow.
2. **Subagents** implement the changes in `ProjectMemoryService` and `ProjectMemoryTool`.
3. **Architect** verifies the end-to-end flow.
