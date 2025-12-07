from typing import Any, Dict
from core.agentpress.tool import Tool, tool_metadata, ToolResult, openapi_schema

@tool_metadata(
    display_name="Ask Permission",
    description="Explicitly ask the user for permission to execute a specific tool call.",
    icon="ShieldAlert",
    color="bg-amber-100 dark:bg-amber-800/50",
    is_core=True,
    weight=0
)
class AskPermissionTool(Tool):

    @openapi_schema({
        "type": "function",
        "function": {
            "name": "ask_permission",
            "description": "Ask the user for permission to run a tool. This will pause execution until the user approves or denies.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tool_name": {
                        "type": "string",
                        "description": "The name of the tool you want to run."
                    },
                    "arguments": {
                        "type": "object",
                        "description": "The exact arguments you intend to pass to the tool."
                    },
                    "reason": {
                        "type": "string",
                        "description": "Explanation of why you need to run this tool."
                    }
                },
                "required": ["tool_name", "arguments", "reason"]
            }
        }
    })
    async def ask_permission(self, tool_name: str, arguments: Dict[str, Any], reason: str) -> ToolResult:
        """
        This method is a placeholder. The actual stopping logic is handled
        by the ResponseProcessor when it detects this tool call.

        If we reach here, it means the system executed it "normally",
        which technically shouldn't happen if the processor intercepts it correctly.
        However, if we design it such that this tool *returns* a special status,
        we can do that here too.

        But per the plan, the ResponseProcessor will intercept this call
        and treat it as a 'REQUIRES_APPROVAL' signal.
        """
        # We return a success result here, but the side effect (stopping)
        # happens in the processor.
        # Actually, if the processor executes this tool, it means permission was *already*
        # granted (or not needed) for 'ask_permission' itself.
        # But the *intent* of this tool is to stop the *next* thing.

        # Strategy: The ResponseProcessor will see this tool call,
        # and instead of running it and continuing, it will STOP.

        return self.success_response("Permission request sent to user.")
