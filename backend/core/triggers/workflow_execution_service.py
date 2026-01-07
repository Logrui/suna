"""
Workflow execution routing service.

Routes workflow execution based on workflow.mode:
- 'advanced' → Langflow webhook (suna-advanced-workflows)
- 'simple'   → Placeholder for future SimpleWorkflowExecutor (TODO)

DEPRECATED modes:
- 'advanced-legacy' → No longer supported, migrate to 'advanced'
"""

import os
from typing import Dict, Any

import httpx

from core.services.supabase import DBConnection
from core.utils.logger import logger
from .trigger_service import TriggerEvent, TriggerResult


class WorkflowExecutionService:
    """Routes workflow execution based on workflow mode."""
    
    def __init__(self, db_connection: DBConnection):
        self._db = db_connection
        self._langflow_url = os.getenv("ADVANCED_WORKFLOWS_BACKEND_URL")
        self._integration_secret = os.getenv("ADVANCED_WORKFLOWS_INTEGRATION_SECRET")
    
    async def execute(
        self,
        workflow_id: str,
        agent_id: str,
        trigger_result: TriggerResult,
        trigger_event: TriggerEvent
    ) -> Dict[str, Any]:
        """
        Execute workflow based on its mode field.
        
        Args:
            workflow_id: The workflow UUID (same as Langflow flow_id for advanced mode)
            agent_id: The agent this workflow belongs to
            trigger_result: Processed trigger result with prompt and variables
            trigger_event: Raw trigger event data
            
        Returns:
            Execution result dict with success status and metadata
        """
        client = await self._db.client
        
        # 1. Fetch workflow to determine mode
        workflow_result = await client.table('agent_workflows') \
            .select('*') \
            .eq('id', workflow_id) \
            .single() \
            .execute()
            
        if not workflow_result.data:
            return {
                "success": False,
                "error": f"Workflow {workflow_id} not found",
            }
        
        workflow = workflow_result.data
        mode = workflow.get('mode', 'simple')
        
        logger.info(
            f"Routing workflow execution: workflow_id={workflow_id}, mode={mode}",
            extra={"trigger_id": trigger_event.trigger_id}
        )
        
        # 2. Route based on mode
        if mode == "advanced":
            return await self._execute_via_langflow(
                workflow_id=workflow_id,
                agent_id=agent_id,
                workflow=workflow,
                trigger_result=trigger_result,
                trigger_event=trigger_event
            )
        
        elif mode == "simple":
            # TODO: Implement SimpleWorkflowExecutor when ready
            logger.warning(f"Simple workflow mode not yet implemented: workflow_id={workflow_id}")
            return {
                "success": False,
                "error": "Simple workflow execution not yet implemented",
                "message": "Simple workflow mode is under development. Please use 'advanced' mode."
            }
        
        elif mode == "advanced-legacy":
            # DEPRECATED: advanced-legacy is no longer supported
            logger.warning(
                f"DEPRECATED: advanced-legacy mode is no longer supported. "
                f"Please migrate workflow {workflow_id} to 'advanced' mode."
            )
            return {
                "success": False,
                "error": "advanced-legacy mode is deprecated",
                "message": "Please migrate this workflow to 'advanced' mode using the Advanced Workflows editor."
            }
        
        else:
            return {
                "success": False,
                "error": f"Unknown workflow mode: {mode}",
            }
    
    async def _execute_via_langflow(
        self,
        workflow_id: str,
        agent_id: str,
        workflow: Dict[str, Any],
        trigger_result: TriggerResult,
        trigger_event: TriggerEvent
    ) -> Dict[str, Any]:
        """Execute workflow via Langflow webhook endpoint."""
        try:
            if not self._langflow_url:
                return {
                    "success": False,
                    "error": "ADVANCED_WORKFLOWS_BACKEND_URL not configured",
                }
            
            # Build trigger payload for Langflow
            payload = {
                "trigger_id": trigger_event.trigger_id,
                "agent_id": agent_id,
                "trigger_type": str(trigger_event.trigger_type.value),
                "timestamp": trigger_event.timestamp.isoformat(),
                "event_data": trigger_event.raw_data,
                "context": trigger_event.context,
                "execution_variables": trigger_result.execution_variables,
                "agent_prompt": trigger_result.agent_prompt,
            }
            
            headers = {"Content-Type": "application/json"}
            if self._integration_secret:
                headers["X-Integration-Key"] = self._integration_secret
            
            # Use existing Langflow webhook endpoint
            # workflow_id == flow_id due to 1:1 mapping
            async with httpx.AsyncClient(timeout=30.0) as http_client:
                response = await http_client.post(
                    f"{self._langflow_url}/api/v1/webhook/{workflow_id}",
                    json=payload,
                    headers=headers
                )
                
                if response.status_code == 404:
                    return {
                        "success": False,
                        "error": f"Flow {workflow_id} not found in Langflow. "
                                 "Ensure the workflow was synced via Advanced Workflows editor."
                    }
                
                if response.status_code >= 400:
                    logger.error(f"Langflow error: {response.status_code} - {response.text}")
                    return {
                        "success": False,
                        "error": f"Langflow API error: {response.status_code}"
                    }
                
                logger.info(
                    f"Advanced workflow started: workflow_id={workflow_id}",
                    extra={"trigger_id": trigger_event.trigger_id}
                )
                
                return {
                    "success": True,
                    "workflow_id": workflow_id,
                    "mode": "advanced",
                    "status": "started",
                    "message": "Advanced workflow execution started via Langflow"
                }
                
        except httpx.TimeoutException:
            logger.error(f"Langflow timeout for workflow {workflow_id}")
            return {"success": False, "error": "Langflow request timeout"}
        except httpx.RequestError as e:
            logger.error(f"Langflow request error: {e}")
            return {"success": False, "error": f"Langflow connection error: {str(e)}"}
        except Exception as e:
            logger.error(f"Langflow execution failed: {e}", exc_info=True)
            return {"success": False, "error": str(e)}


def get_workflow_execution_service(db_connection: DBConnection) -> WorkflowExecutionService:
    """Factory function for WorkflowExecutionService."""
    return WorkflowExecutionService(db_connection)

