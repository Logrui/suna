# Dynamic Prompt System

**Version:** 2.0 (Token Optimization)

## Overview
The Dynamic Prompt System replaces the legacy monolithic system prompt (~2.3k lines) with a modular builder that constructs the system message on-the-fly. This results in massive token savings and improved model attention.

## Key Features

### 1. Dynamic Injection
The `DynamicPromptBuilder` (`backend/core/prompts/dynamic_prompt.py`) strictly limits the prompt to:
- **Core Identity:** Who the agent is.
- **Environment:** Critical execution context (Linux, workspace paths).
- **Active Tools Only:** Instructions are **only** injected for tools that are actually enabled in the agent's configuration.

### 2. Safety Mechanisms
Critical safety workflows are preserved and injected dynamically:
- **Paid Tools**: Warnings and confirmation flows for `people_search` and `company_search` ($0.54/run) are automatically injected when those tools are active.
- **Browser**: Screenshot review protocols are injected when `browser_tool` is active.

## Metrics
| Metric | Legacy Prompt | Dynamic Prompt (Typical) | Reduction |
| :--- | :--- | :--- | :--- |
| **Tokens** | ~35,679 | ~800 | **>97%** |
| **Context** | Full Static Text | Relevant Sections Only | Optimized |

## Usage
The system is active by default. In `suna_config.py`, the `system_prompt` is set to an empty string to let the dynamic builder take over.

```python
# backend/core/suna_config.py
SUNA_CONFIG = {
    "system_prompt": "", # Triggers dynamic generation
    # ...
}
```
