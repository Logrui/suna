from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field, validator
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
    mode: Literal['simple', 'advanced'] = 'simple'
    steps: Optional[List[Dict[str, Any]]] = None # Simple mode
    graph_definition: Optional[Dict[str, Any]] = None # Advanced mode
    compiled_logic: Optional[Dict[str, Any]] = None # Advanced mode

    @validator('graph_definition')
    def validate_advanced_mode_data(cls, v, values):
        """Ensure advanced mode has required data"""
        if values.get('mode') == 'advanced' and v is None:
            raise ValueError('Advanced mode workflows must have graph_definition')
        return v

    class Config:
        from_attributes = True  # Replaces orm_mode=True in Pydantic v2
        populate_by_name = True
