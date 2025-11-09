# Comparative Analysis: Suna/Kortix vs. Manus AI (Detailed)

_This document provides a detailed comparison between the Suna/Kortix platform and Manus AI. This version has been updated to include specific, accurate technical details about the Manus AI platform, addressing the previous version's lack of specificity._

## Executive Summary

Both Suna/Kortix and Manus AI are sophisticated platforms for deploying autonomous AI agents. While they share high-level architectural patterns, they differ fundamentally in their deployment model, developer experience, and the specificity of their provided tools. Suna/Kortix is an **open-source platform** for building a fleet of custom AI agents, whereas Manus AI is a **managed service** offering a single, powerful, generalist agent with a meticulously defined and transparent toolset.

## 1. Core Architecture

### 1.1 Sandboxed Execution Environments

Both platforms provide isolated computing environments. The use of Daytona in production by both is a significant point of convergence.

| Feature | Suna/Kortix | Manus AI (Specifics) |
|---|---|---|
| **Isolation Technology** | Docker containers (local), Daytona (cloud) | Daytona-managed sandboxed virtual machine |
| **Operating System** | Linux (unspecified) | **Ubuntu 22.04 linux/amd64** |
| **Python Environment** | Python 3.11+ | **Python 3.11.0rc1** with pre-installed libraries (`pandas`, `numpy`, `matplotlib`, `requests`, `beautifulsoup4`, `openpyxl`, `fpdf2`, etc.) |
| **Node.js Environment** | Not specified | **Node.js 22.13.0** with `pnpm` and `yarn` pre-installed |
| **Browser Support** | Chrome browser via VNC | **Chromium (stable)** with persistent login state and download directory at `/home/ubuntu/Downloads/` |
| **Sandbox Lifecycle** | Per-agent persistent containers | Per-task, on-demand sandboxes with automatic hibernation and state persistence |

### 1.2 LLM & Agent Core

| Aspect | Suna/Kortix | Manus AI (Specifics) |
|---|---|---|
| **LLM Abstraction** | LiteLLM | Custom abstraction via OpenAI-compatible API format |
| **Supported Models** | Anthropic, OpenAI, etc. | `gpt-4.1-mini`, `gpt-4.1-nano`, `gemini-2.5-flash` |
| **Agent Core Loop** | Dramatiq for background tasks, `agent_runs.py` | **Agent Loop**: Analyze -> Think -> Select Tool -> Execute -> Receive Observation -> Iterate |
| **Task Planning** | Implicit through agent logic | **Explicit `plan` tool** with `update` and `advance` actions, defining phases and capabilities (`data_analysis`, `web_development`, etc.) |

## 2. Tool Ecosystem: A Detailed Comparison

This is where the platforms differ most significantly. Suna's tools are Python scripts in a directory, while Manus's tools are explicitly defined functions with schemas, available in the prompt context.

| Tool Category | Suna/Kortix Tool | Manus AI Tool (and key features) |
|---|---|---|
| **Shell Interaction** | `sb_shell_tool.py` | **`shell`**: `exec`, `view`, `wait`, `send`, `kill` actions. Supports sessions, timeouts, and stdin. |
| **File System** | `sb_files_tool.py` | **`file`**: `read`, `write`, `append`, `edit`, `view` actions. Supports line/page ranges and targeted edits. |
| **Pattern Matching** | `python-ripgrep` (dependency) | **`match`**: `glob` (for paths) and `grep` (for content) actions with regex support. |
| **Web Search** | `web_search_tool.py` (Tavily/Exa) | **`search`**: Multi-type (`info`, `image`, `api`, `news`, `tool`, `data`, `research`) with time filters. |
| **Web Browsing** | `browser_tool.py` | **`browser`**: Navigates with `intent` (`navigational`, `informational`, `transactional`) and a `focus` parameter. |
| **Web Development** | General code execution | **`webdev_init_project`**: Scaffolds a full project (`web-static` or `web-db-user`) with a specific structure. |
| **Scheduling** | `apscheduler` (dependency) | **`schedule`**: `cron` or `interval` based scheduling with `repeat` and `playbook` options. |
| **Parallel Processing**| Not explicitly defined | **`map`**: Spawns up to 2000 parallel subtasks with a defined `output_schema` and `prompt_template`. |
| **Media Generation** | `sb_image_edit_tool.py` | **`generate`**: Enters a dedicated mode for creating/editing images, video, audio, and speech. |
| **Presentations** | `sb_presentation_tool.py` | **`slides`**: Enters a dedicated mode, requiring a `slide_content_file_path` and `slide_count`. |
| **User Interaction** | `message_tool.py` | **`message`**: `info`, `ask`, `result` types with attachments and `suggested_action` (e.g., `confirm_browser_operation`). |
| **Port Exposure** | `sb_expose_tool.py` | **`expose`**: Exposes a local sandbox port to a temporary public domain. |

### 2.1 Pre-installed Utilities

Manus AI also comes with a set of command-line utilities that are not present in the Suna repository, further specializing its environment.

- `manus-render-diagram`: Renders `.mmd`, `.d2`, `.puml` files to PNG.
- `manus-md-to-pdf`: Converts Markdown to PDF.
- `manus-speech-to-text`: Transcribes audio/video files.
- `manus-mcp-cli`: Interacts with Model Context Protocol servers.
- `manus-upload-file`: Uploads a file to S3 and returns a public URL.
- `manus-export-slides`: Exports `manus-slides://` URIs to PDF or PPT.

## 3. External Integrations

Both platforms support integrations, but Manus AI's are more explicitly defined and pre-configured.

| Integration | Suna/Kortix | Manus AI (Specifics) |
|---|---|---|
| **MCP** | Generic MCP module (`mcp_module/`) | **`manus-mcp-cli`** with pre-configured servers: `notion`, `vercel`, `hugging-face`, `gmail`. Includes automatic OAuth. |
| **GitHub** | Via Composio or custom code | **GitHub CLI (`gh`)** is pre-configured and logged in. |
| **n8n** | Via Composio or custom code | **n8n API** is pre-configured with `N8N_INSTANCE_URL` and `N8N_API_KEY` environment variables. |
| **Cloud Storage** | `boto3` for AWS S3 | **`manus-upload-file`** utility for direct S3 uploads. |

## 4. Developer and User Experience

The specificity of the Manus AI environment leads to a different developer and user experience.

| Aspect | Suna/Kortix | Manus AI |
|---|---|---|
| **Onboarding** | Run `setup.py` (14 steps), configure services. | Sign up and start interacting immediately. |
| **Extensibility** | **Code-based**: Add new Python tool scripts to the backend. Requires redeployment. | **Configuration-based**: Configure new MCP servers. No redeployment needed. |
| **Task Complexity** | Handled by agent's internal logic. | **Explicitly managed** via `plan` tool, `map` for parallelism, and `schedule` for future execution. |
| **Transparency** | Logs and VNC access to the sandbox. | Visible agent loop, tool calls, and reasoning in the chat interface. |
| **Documentation** | `README.md` files in each directory. | **Live System Prompt**: The entire tool definition and system context is available to the agent at all times. |

## Conclusion: Platform vs. Product

You were right to point out the lack of detail. With the specifics laid bare, the distinction becomes even clearer.

- **Suna/Kortix** is a **platform or framework**. It provides the architectural components (`backend`, `frontend`, `sandbox`) and a flexible, code-first way to build your own agent ecosystem. It's powerful for those who want to build a custom, multi-agent solution from the ground up.

- **Manus AI** is a **product or managed service**. It provides a single, highly-capable agent operating within a meticulously defined, feature-rich environment. The power comes not from building new agents, but from leveraging the powerful and specific toolset of the existing agent to accomplish complex tasks.

The relationship is akin to a game engine (like Unreal Engine) versus a finished game (like Fortnite). Suna gives you the engine to build your own game; Manus gives you a powerful character to play with in a rich, pre-built world.
