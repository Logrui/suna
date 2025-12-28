"""
Trigger execution service - executes agents or workflows when triggers fire.

This is a thin wrapper that reuses existing agent_runs and workflow execution infrastructure.
"""
import json
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from core.services.supabase import DBConnection
from core.services import redis
from core.utils.logger import logger, structlog
from core.utils.config import config, EnvMode
from .trigger_service import TriggerEvent, TriggerResult


class ExecutionService:
    """Executes agents or workflows when triggers fire, reusing core infrastructure."""

    def __init__(self, db_connection: DBConnection):
        self._db = db_connection
    
    async def execute_trigger_result(
        self,
        agent_id: str,
        trigger_result: TriggerResult,
        trigger_event: TriggerEvent,
        execution_type: str = "agent",
        workflow_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Execute an agent or workflow based on trigger result.
        
        Args:
            agent_id: The agent ID
            trigger_result: Result from trigger processing
            trigger_event: The trigger event data
            execution_type: "agent" or "workflow"
            workflow_id: Required when execution_type is "workflow"
        
        Returns:
            Execution result dict with success status and relevant IDs
        """
        if execution_type == "workflow" and workflow_id:
            return await self._execute_workflow(
                agent_id=agent_id,
                workflow_id=workflow_id,
                trigger_result=trigger_result,
                trigger_event=trigger_event
            )
        else:
            return await self._execute_agent(
                agent_id=agent_id,
                trigger_result=trigger_result,
                trigger_event=trigger_event
            )
    
    async def _execute_agent(
        self,
        agent_id: str,
        trigger_result: TriggerResult,
        trigger_event: TriggerEvent
    ) -> Dict[str, Any]:
        """Execute an agent conversation based on trigger result."""
        try:
            logger.debug(f"Executing agent trigger for agent {agent_id}")
            
            client = await self._db.client
            agent_result = await client.table('agents').select('account_id').eq('agent_id', agent_id).single().execute()
            if not agent_result.data:
                return {
                    "success": False,
                    "error": f"Agent {agent_id} not found",
                    "message": "Failed to execute trigger"
                }
            account_id = agent_result.data['account_id']
            
            if config.ENV_MODE != EnvMode.LOCAL:
                from core.utils.limits_checker import check_project_count_limit, check_thread_limit
                
                project_limit = await check_project_count_limit(client, account_id)
                if not project_limit['can_create']:
                    logger.warning(f"Trigger execution blocked: project limit reached for account {account_id} ({project_limit['current_count']}/{project_limit['limit']})")
                    return {
                        "success": False,
                        "error": f"Project limit reached ({project_limit['current_count']}/{project_limit['limit']}). Upgrade your plan to run more triggers.",
                        "message": "Failed to execute trigger - project limit exceeded"
                    }
                
                thread_limit = await check_thread_limit(client, account_id)
                if not thread_limit['can_create']:
                    logger.warning(f"Trigger execution blocked: thread limit reached for account {account_id} ({thread_limit['current_count']}/{thread_limit['limit']})")
                    return {
                        "success": False,
                        "error": f"Thread limit reached ({thread_limit['current_count']}/{thread_limit['limit']}). Upgrade your plan to run more triggers.",
                        "message": "Failed to execute trigger - thread limit exceeded"
                    }
            
            rendered_prompt = self._render_prompt(
                trigger_result.agent_prompt,
                trigger_result.execution_variables,
                trigger_event
            )
            
            from core.agent_runs import start_agent_run
            
            model_name = trigger_result.model if hasattr(trigger_result, 'model') and trigger_result.model else None
            
            result = await start_agent_run(
                account_id=account_id,
                prompt=rendered_prompt,
                agent_id=agent_id,
                model_name=model_name,
                metadata={
                    "trigger_execution": True,
                    "trigger_id": trigger_event.trigger_id,
                    "trigger_variables": trigger_result.execution_variables
                },
                skip_limits_check=True
            )
            
            return {
                "success": True,
                "thread_id": result.get("thread_id"),
                "agent_run_id": result.get("agent_run_id"),
                "message": "Worker execution started successfully"
            }
                
        except Exception as e:
            logger.error(f"Failed to execute agent trigger: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to execute trigger"
            }
    
    async def _execute_workflow(
        self,
        agent_id: str,
        workflow_id: str,
        trigger_result: TriggerResult,
        trigger_event: TriggerEvent
    ) -> Dict[str, Any]:
        """Execute a workflow based on trigger result."""
        try:
            logger.debug(f"Executing workflow trigger for agent {agent_id}, workflow {workflow_id}")
            
            client = await self._db.client
            
            # Get agent account_id
            agent_result = await client.table('agents').select('account_id').eq('agent_id', agent_id).single().execute()
            if not agent_result.data:
                return {
                    "success": False,
                    "error": f"Agent {agent_id} not found",
                    "message": "Failed to execute workflow trigger"
                }
            account_id = agent_result.data['account_id']
            
            # Fetch workflow
            workflow_result = await client.table('agent_workflows').select('*').eq('id', workflow_id).single().execute()
            if not workflow_result.data:
                return {
                    "success": False,
                    "error": f"Workflow {workflow_id} not found",
                    "message": "Failed to execute workflow trigger"
                }
            
            workflow = workflow_result.data
            
            # Check workflow status
            if workflow.get('status') != 'active':
                return {
                    "success": False,
                    "error": f"Workflow is not active (status: {workflow.get('status')})",
                    "message": "Failed to execute workflow trigger - workflow is not active"
                }
            
            # Get compiled logic
            compiled_logic = workflow.get('compiled_logic')
            if not compiled_logic:
                return {
                    "success": False,
                    "error": "Workflow has no compiled logic",
                    "message": "Failed to execute workflow trigger - workflow is not compiled"
                }
            
            # Create execution thread for monitoring
            thread_id = str(uuid.uuid4())
            
            # Create thread record
            await client.table('threads').insert({
                'thread_id': thread_id,
                'account_id': account_id,
                'agent_id': agent_id,
                'status': 'active',
                'created_at': datetime.now(timezone.utc).isoformat(),
                'updated_at': datetime.now(timezone.utc).isoformat()
            }).execute()
            
            # Build trigger context from trigger event
            trigger_context = {
                "trigger_id": trigger_event.trigger_id,
                "trigger_type": trigger_event.trigger_type.value if hasattr(trigger_event.trigger_type, 'value') else str(trigger_event.trigger_type),
                "raw_data": trigger_event.raw_data,
                "timestamp": trigger_event.timestamp.isoformat(),
                "context": trigger_event.context,
                "execution_variables": trigger_result.execution_variables,
                "agent_prompt": trigger_result.agent_prompt
            }
            
            # Create workflow execution record
            execution_id = str(uuid.uuid4())
            await client.table('workflow_executions').insert({
                'id': execution_id,
                'workflow_id': workflow_id,
                'thread_id': thread_id,
                'status': 'running',
                'started_at': datetime.now(timezone.utc).isoformat(),
                'trigger_context': trigger_context
            }).execute()
            
            # Execute workflow using GraphExecutor
            try:
                from core.workflows.executor import GraphExecutor
                
                executor = GraphExecutor(thread_manager=None, redis_client=redis.client if hasattr(redis, 'client') else None)
                
                execution_result = await executor.execute(
                    workflow_id=workflow_id,
                    thread_id=thread_id,
                    compiled_logic=compiled_logic,
                    trigger_context=trigger_context
                )
                
                # Update execution record with result
                final_status = "completed" if execution_result.get("success", False) else "failed"
                await client.table('workflow_executions').update({
                    'status': final_status,
                    'completed_at': datetime.now(timezone.utc).isoformat(),
                    'result': execution_result.get("final_variables", {}),
                    'error_message': execution_result.get("error")
                }).eq('id', execution_id).execute()
                
                return {
                    "success": True,
                    "thread_id": thread_id,
                    "execution_id": execution_id,
                    "workflow_id": workflow_id,
                    "message": "Workflow execution completed",
                    "result": execution_result
                }
                
            except Exception as exec_error:
                # Update execution as failed
                await client.table('workflow_executions').update({
                    'status': 'failed',
                    'completed_at': datetime.now(timezone.utc).isoformat(),
                    'error_message': str(exec_error)
                }).eq('id', execution_id).execute()
                
                raise exec_error
                
        except Exception as e:
            logger.error(f"Failed to execute workflow trigger: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "message": "Failed to execute workflow trigger"
            }
    
    def _render_prompt(
        self,
        prompt: str,
        trigger_variables: Optional[Dict[str, Any]],
        trigger_event: TriggerEvent
    ) -> str:
        """Render trigger variables into the prompt template."""
        rendered = prompt
        
        try:
            # Get context from trigger event
            ctx = {}
            if hasattr(trigger_event, "context") and isinstance(trigger_event.context, dict):
                ctx = trigger_event.context
            
            # Merge with execution variables
            if trigger_variables:
                ctx.update(trigger_variables)
            
            payload = ctx.get("payload")
            trigger_slug = ctx.get("trigger_slug")
            webhook_id = ctx.get("webhook_id")
            
            def _to_json(obj: Any) -> str:
                try:
                    return json.dumps(obj, ensure_ascii=False, indent=2)
                except Exception:
                    return str(obj)
            
            # Replace template variables
            if "{{payload}}" in rendered:
                rendered = rendered.replace("{{payload}}", _to_json(payload))
            if "{{trigger_slug}}" in rendered:
                rendered = rendered.replace("{{trigger_slug}}", str(trigger_slug or ""))
            if "{{webhook_id}}" in rendered:
                rendered = rendered.replace("{{webhook_id}}", str(webhook_id or ""))
            
            # Append full context for reference
            if ctx:
                context_json = _to_json(ctx)
                rendered = f"{rendered}\n\n---\nContext\n{context_json}"
                
        except Exception as e:
            logger.warning(f"Failed to render prompt variables: {e}")
            # Return original prompt on error
            
        return rendered


def get_execution_service(db_connection: DBConnection) -> ExecutionService:
    """Factory function for ExecutionService."""
    return ExecutionService(db_connection)

