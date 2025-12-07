import pytest
import asyncio
from unittest.mock import MagicMock, AsyncMock
from core.workflows.executor import GraphExecutor
from core.workflows.types import CompiledLogic

@pytest.mark.asyncio
async def test_graph_executor_simple_flow():
    # Mock dependencies
    mock_thread_manager = MagicMock()
    mock_redis = AsyncMock()
    
    executor = GraphExecutor(thread_manager=mock_thread_manager, redis_client=mock_redis)
    
    # Define simple linear workflow: Start -> AI Step -> End
    compiled_logic: CompiledLogic = {
        'start_node_id': 'start',
        'nodes': {
            'start': {
                'id': 'start',
                'type': 'start',
                'config': {},
                'next_nodes': ['step1']
            },
            'step1': {
                'id': 'step1',
                'type': 'ai_step',
                'config': {
                    'prompt': 'Hello {{name}}',
                    'model': 'gpt-4',
                    'system_prompt': 'You are helpful'
                },
                'next_nodes': ['end'],
                'output_variable': 'response'
            },
            'end': {
                'id': 'end',
                'type': 'end',
                'config': {
                    'message': 'Done'
                },
                'next_nodes': []
            }
        },
        'variables': ['name', 'response']
    }
    
    trigger_context = {'name': 'World'}
    
    # Mock ThreadManager response
    mock_thread_manager.run_thread = AsyncMock(return_value={'content': 'Hello there!', 'status': 'completed'})
    
    # Execute
    result = await executor.execute(
        workflow_id='wf-1',
        thread_id='thread-1',
        compiled_logic=compiled_logic,
        trigger_context=trigger_context
    )
    
    # Verify result
    assert result['status'] == 'completed'
    assert result['final_variables']['response'] == 'Hello there!'
    assert len(result['execution_log']) > 0
    
    # Verify Redis events
    assert mock_redis.publish.call_count >= 3 # start, node events, complete
    
    # Verify ThreadManager call
    mock_thread_manager.run_thread.assert_called_once()
    call_args = mock_thread_manager.run_thread.call_args
    assert call_args.kwargs['latest_user_message_content'] == 'Hello World'

@pytest.mark.asyncio
async def test_graph_executor_rule_condition():
    # Mock dependencies
    mock_thread_manager = MagicMock()
    mock_redis = AsyncMock()
    
    executor = GraphExecutor(thread_manager=mock_thread_manager, redis_client=mock_redis)
    
    # Define branching workflow: Start -> Condition -> (True/False) -> End
    compiled_logic: CompiledLogic = {
        'start_node_id': 'start',
        'nodes': {
            'start': {
                'id': 'start',
                'type': 'start',
                'config': {},
                'next_nodes': ['condition']
            },
            'condition': {
                'id': 'condition',
                'type': 'rule_condition',
                'config': {
                    'rules': [
                        {
                            'variable': 'value',
                            'operator': 'gt',
                            'value': 10,
                            'next_node_id': 'end_true'
                        }
                    ],
                    'default_next_node_id': 'end_false'
                },
                'next_nodes': [] # Handled by rules
            },
            'end_true': {
                'id': 'end_true',
                'type': 'end',
                'config': {'message': 'True path'},
                'next_nodes': []
            },
            'end_false': {
                'id': 'end_false',
                'type': 'end',
                'config': {'message': 'False path'},
                'next_nodes': []
            }
        },
        'variables': ['value']
    }
    
    # Test True path
    result_true = await executor.execute(
        workflow_id='wf-1',
        thread_id='thread-1',
        compiled_logic=compiled_logic,
        trigger_context={'value': 20}
    )
    assert result_true['status'] == 'completed'
    # Check log for end_true execution
    log_nodes = [e['node_id'] for e in result_true['execution_log'] if e['event_type'] == 'node_started']
    assert 'end_true' in log_nodes
    assert 'end_false' not in log_nodes
    
    # Test False path
    result_false = await executor.execute(
        workflow_id='wf-1',
        thread_id='thread-2',
        compiled_logic=compiled_logic,
        trigger_context={'value': 5}
    )
    assert result_false['status'] == 'completed'
    log_nodes = [e['node_id'] for e in result_false['execution_log'] if e['event_type'] == 'node_started']
    assert 'end_false' in log_nodes
    assert 'end_true' not in log_nodes
