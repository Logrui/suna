# Portkit: Workflow Specifications

This document defines the strict formatting requirements for Workflow Prompts across the different IDE environments supported by Portkit.

## 1. General Agents / Antigravity (`.agent/workflows/`)

*   **File Extension**: `.md`
*   **Format**: Markdown with YAML Frontmatter.
*   **Mandatory Directive**: `//turbo-all` (or `//turbo` per step) MUST be included to enable auto-execution of tools.

### Template
```markdown
---
description: [Short Description]
handoffs:
  - label: [Next Step]
    agent: [Next Agent Command]
    prompt: [Handover Context]
---

//turbo-all

## User Input
```text
$ARGUMENTS
```

## Outline
1. Step 1...
```

## 2. Claude (`.claude/commands/`)

*   **File Extension**: `.md`
*   **Format**: Standard Markdown with YAML Frontmatter.
*   **Focus**: Analytical constraints and reporting.

### Template
```markdown
---
description: [Short Description]
---

## User Input
```text
$ARGUMENTS
```

## Goal
[Clear definition of objective]

## Operating Constraints
*   **STRICTLY READ-ONLY** (if applicable)
*   [Other Constraints]

## Execution Steps
1. ...
```

## 3. Gemini (`.gemini/commands/`)

*   **File Extension**: `.toml`
*   **Format**: TOML Key-Value Configuration.
*   **Wrapper**: The entire prompt logic is wrapped in a `prompt = """..."""` string.

### Template
```toml
description = "[Short Description]"

prompt = """
## User Input
```text
$ARGUMENTS
```

## Outline
1. Step 1...
"""
```
