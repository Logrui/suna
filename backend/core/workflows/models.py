from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field
from datetime import datetime

class Workflow(BaseModel):
    """Complete workflow object from database"""
    id: str
    agent_id: str
    name: str
    description: Optional[str] = None
    status: Literal['draft', 'active', 'paused', 'archived'] = 'draft'
    trigger_phrase: Optional[str] = None
    is_default: bool = False
    created_at: datetime
    updated_at: datetime

    # Mode and data
    mode: Literal['simple', 'advanced', 'advanced-legacy'] = 'simple'
    steps: Optional[List[Dict[str, Any]]] = None # Simple mode
    graph_definition: Optional[Dict[str, Any]] = None # Advanced mode
    compiled_logic: Optional[Dict[str, Any]] = None # Advanced mode

    # Note: Previously had a validator enforcing graph_definition for advanced mode
    # Removed to allow seamless mode switching without requiring Langflow data upfront
    # The new 'advanced' mode uses suna-advanced-workflows (Langflow) which manages its own data

    class Config:
        from_attributes = True  # Replaces orm_mode=True in Pydantic v2
        populate_by_name = True


class CreateWorkflowRequest(BaseModel):
    """
    Request model for creating a new workflow.
    
    Only includes fields the frontend should send.
    DB-generated fields (id, agent_id, created_at, updated_at) are excluded.
    """
    name: str
    description: Optional[str] = None
    trigger_phrase: Optional[str] = None
    is_default: bool = False
    status: Literal['draft', 'active', 'paused', 'archived'] = 'draft'
    mode: Literal['simple', 'advanced', 'advanced-legacy'] = 'simple'
    steps: Optional[List[Dict[str, Any]]] = None  # Simple mode
    graph_definition: Optional[Dict[str, Any]] = None  # Advanced mode
    compiled_logic: Optional[Dict[str, Any]] = None  # Advanced mode


class UpdateWorkflowRequest(BaseModel):
    """
    Request model for updating an existing workflow.
    
    All fields are optional to support partial updates (PATCH semantics).
    """
    name: Optional[str] = None
    description: Optional[str] = None
    trigger_phrase: Optional[str] = None
    is_default: Optional[bool] = None
    status: Optional[Literal['draft', 'active', 'paused', 'archived']] = None
    mode: Optional[Literal['simple', 'advanced', 'advanced-legacy']] = None
    steps: Optional[List[Dict[str, Any]]] = None  # Simple mode
    graph_definition: Optional[Dict[str, Any]] = None  # Advanced mode
    compiled_logic: Optional[Dict[str, Any]] = None  # Advanced mode
