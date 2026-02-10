"""
Project Memory Tool — Agent tool for saving and deleting project-specific memories.

Gives the worker agent agency over project knowledge. The agent can save important
facts, decisions, and preferences that persist across conversations within the same project.
"""

from core.agentpress.tool import Tool, ToolResult, openapi_schema, tool_metadata
from core.sandbox.tool_base import SandboxToolsBase
from core.utils.logger import logger


@tool_metadata(
    display_name="Project Memory",
    description="Save and manage project-specific knowledge and context",
    icon="Brain",
    color="bg-purple-100 dark:bg-purple-800/50",
    is_core=True,
    weight=10,
    visible=True,
    usage_guide="""
### PROJECT MEMORY — Persistent Project Knowledge

Use these tools to build and maintain the project's long-term knowledge base.
Project memories persist across all conversations within this project and are
automatically provided as context in future interactions.

**WHEN TO SAVE MEMORIES:**
- Important project decisions ("We chose PostgreSQL over MongoDB because...")
- Technical architecture details ("The API uses FastAPI with Supabase backend")
- User preferences for this project ("Use dark mode, OKLCH colors, glassmorphism")
- Key constraints or requirements ("API rate limit is 100 req/min")
- Learned facts about the codebase ("The auth flow uses JWT tokens stored in httpOnly cookies")
- Corrections to previous understanding ("Actually, the frontend uses Vite not Next.js")

**WHEN NOT TO SAVE:**
- Temporary information only relevant to current conversation
- Information already in the codebase (code comments, READMEs)
- Trivial or obvious facts

**MEMORY TYPES:**
- `fact`: Technical facts, architecture decisions, codebase knowledge (default)
- `preference`: User preferences for this project (style, tools, conventions)
- `context`: Background context, business rules, domain knowledge

**IMPORTANT:** Be concise but specific. Each memory should be self-contained and
understandable without additional context.
""",
)
class ProjectMemoryTool(SandboxToolsBase):
    """Tool for agent-driven project memory management (save/delete)."""

    def __init__(self, project_id: str, thread_manager, thread_id: str, account_id: str):
        super().__init__(project_id, thread_manager)
        self.thread_id = thread_id
        self.account_id = account_id

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "save_project_memory",
            "description": (
                "Save an important fact, decision, or preference as a persistent project memory. "
                "This memory will be automatically provided as context in all future conversations "
                "within this project. Use this when you learn something important about the project "
                "that should be remembered. Be concise but specific — each memory should be "
                "self-contained. **🚨 PARAMETER NAMES**: Use EXACTLY these parameter names: "
                "`content` (REQUIRED), `memory_type` (optional)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "content": {
                        "type": "string",
                        "description": (
                            "**REQUIRED** — The memory content to save. Should be a concise, "
                            "self-contained statement. Examples: 'The backend uses FastAPI with "
                            "Supabase for the database layer', 'User prefers OKLCH color space "
                            "with glassmorphism UI patterns', 'API authentication uses JWT tokens "
                            "with httpOnly cookies'."
                        ),
                    },
                    "memory_type": {
                        "type": "string",
                        "enum": ["fact", "preference", "context"],
                        "description": (
                            "**OPTIONAL** — Category of memory. 'fact' for technical facts and "
                            "decisions (default), 'preference' for user/project preferences, "
                            "'context' for background/domain knowledge."
                        ),
                    },
                },
                "required": ["content"],
                "additionalProperties": False,
            },
        },
    })
    async def save_project_memory(
        self, content: str, memory_type: str = "fact"
    ) -> ToolResult:
        """Save a project memory."""
        try:
            if not content or not content.strip():
                return self.fail_response("Memory content cannot be empty")

            # Validate memory_type
            valid_types = {"fact", "preference", "context", "conversation_summary"}
            if memory_type not in valid_types:
                memory_type = "fact"

            from core.memory.project_memory_service import project_memory_service

            memory = await project_memory_service.create_memory(
                account_id=self.account_id,
                project_id=self.project_id,
                content=content.strip(),
                memory_type=memory_type,
                confidence_score=1.0,
                source_thread_id=self.thread_id,
            )

            return self.success_response(
                f"✅ Project memory saved (id: {memory.memory_id}, type: {memory.memory_type.value})"
            )

        except Exception as e:
            logger.error(f"Error saving project memory: {e}")
            return self.fail_response(f"Failed to save project memory: {str(e)}")

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "delete_project_memory",
            "description": (
                "Delete a project memory by its ID. Use this when a previously saved memory "
                "is no longer accurate, relevant, or has been superseded by updated information. "
                "**🚨 PARAMETER NAMES**: Use EXACTLY this parameter name: `memory_id` (REQUIRED)."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "memory_id": {
                        "type": "string",
                        "description": (
                            "**REQUIRED** — The UUID of the project memory to delete."
                        ),
                    },
                },
                "required": ["memory_id"],
                "additionalProperties": False,
            },
        },
    })
    async def delete_project_memory(self, memory_id: str) -> ToolResult:
        """Delete a project memory by ID."""
        try:
            if not memory_id or not memory_id.strip():
                return self.fail_response("Memory ID cannot be empty")

            from core.memory.project_memory_service import project_memory_service

            deleted = await project_memory_service.delete_memory(
                account_id=self.account_id,
                project_id=self.project_id,
                memory_id=memory_id.strip(),
            )

            if not deleted:
                return self.fail_response(f"Memory with id '{memory_id}' not found in this project")

            return self.success_response(
                f"✅ Project memory deleted (id: {memory_id})"
            )

        except Exception as e:
            logger.error(f"Error deleting project memory: {e}")
            return self.fail_response(f"Failed to delete project memory: {str(e)}")
