# Agent Skills Architecture

## Overview
**Agent Skills** allow you to configure agents based on high-level capabilities rather than individual tools. A Skill bundles tools, knowledge, and behavioral instructions into a reusable package.

## Concepts

### The Skill
A Skill (defined in `backend/core/skills/`) is a semantic grouping of:
1.  **Tools:** The executable functions required (e.g., `git`, `file_ops`).
2.  **Prompting:** Specialized instructions (e.g., "Always use strict typing").

### Available Skills

| Skill | Description | Tools Included |
| :--- | :--- | :--- |
| **`coding`** | Software Engineering | `sb_files_tool`, `sb_shell_tool`, `sb_upload_file_tool`, `sb_expose_tool` |
| **`research`** | Internet Research | `web_search_tool`, `browser_tool`, `image_search_tool` |

## Configuration

You can activate skills in two ways: via the static python config (for the default agent) or via JSON (for dynamic agents).

### Option A: Default Agent (`suna_config.py`)
Edit `backend/core/suna_config.py` to include the `skills` list.

```python
SUNA_CONFIG = {
    "name": "Suna",
    # ...
    "skills": ["coding", "research"], # <--- Just add this!
}
```

### Option B: Dynamic Agents (JSON/DB)
When creating an agent via API or database, add the `skills` field to the configuration object.

```json
{
  "name": "DevOps Bot",
  "skills": ["coding"], 
  "agentpress_tools": {
      "slack_tool": true 
  }
}
```

### Automatic Activation
When a skill is enabled:
1.  **Tool Resolution**: ALL tools required by the skill are **automatically enabled** (even if false in the config).
2.  **Prompt Injection**: The skill's specialized prompt section is injected into the system message.
