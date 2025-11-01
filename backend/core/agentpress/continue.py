"""
Auto-Continue Module for AgentPress

This module handles the logic for automatically continuing agent responses
after tool execution, ensuring conversations always end with assistant messages.

The auto-continue system works by:
1. Detecting when a conversation ends on a tool/status message
2. Signaling the need for continuation
3. Adding continuation prompts
4. Re-invoking the LLM with updated context
5. Repeating until the agent provides a final assistant message

Usage:
    from core.agentpress.continue import AutoContinueManager, ContinueConfig
    
    # Create manager
    config = ContinueConfig(max_continues=25)
    manager = AutoContinueManager(config)
    
    # Check if should continue
    if manager.should_continue(state, tool_calls, last_message_type):
        prompt = manager.get_continuation_prompt(state, len(tool_calls))
        # Add prompt to conversation and continue...

Author: AgentPress Team
Date: November 1, 2025
Version: 1.0.0
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime, timezone
from core.utils.logger import logger


@dataclass
class ContinueConfig:
    """
    Configuration for auto-continue behavior.
    
    Attributes:
        max_continues: Maximum number of continuation iterations (default: 25)
        enable_continuation: Whether auto-continue is enabled (default: True)
        termination_tools: List of tool names that should stop continuation
        continuation_prompt_template: Template for continuation prompts
        max_duration_seconds: Maximum time allowed for auto-continue (default: 300 = 5 minutes)
        enable_loop_detection: Whether to detect repeated tool calls (default: True)
        loop_detection_threshold: Number of repeated tool patterns before stopping (default: 3)
    """
    max_continues: int = 25
    enable_continuation: bool = True
    termination_tools: List[str] = field(default_factory=lambda: [
        'ask', 
        'complete', 
        'present_presentation'
    ])
    continuation_prompt_template: str = (
        "Continue your response. {tool_count} tool(s) have been executed and their "
        "results are now in the conversation history. "
        "Do not repeat the tool calls or explain what you did - just continue naturally "
        "from where you left off. If you have fully completed the user's request, "
        "provide your final response without calling more tools."
    )
    max_duration_seconds: int = 300  # 5 minutes
    enable_loop_detection: bool = True
    loop_detection_threshold: int = 3
    
    def __post_init__(self):
        """Validate configuration after initialization."""
        if self.max_continues < 0:
            raise ValueError("max_continues must be non-negative")
        
        if self.max_duration_seconds <= 0:
            raise ValueError("max_duration_seconds must be positive")
        
        if self.loop_detection_threshold < 2:
            raise ValueError("loop_detection_threshold must be at least 2")
        
        if not self.termination_tools:
            logger.warning("No termination tools defined, using defaults")
            self.termination_tools = ['ask', 'complete', 'present_presentation']


@dataclass
class ContinueState:
    """
    State tracking for auto-continue iterations.
    
    Attributes:
        count: Current iteration count (starts at 0)
        active: Whether continuation is active
        last_tool_count: Number of tools executed in last iteration
        last_message_type: Type of the last message yielded
        continuous_state: Additional state data (e.g., accumulated content)
        start_time: When the auto-continue sequence started (for timeout detection)
        previous_tool_calls: History of tool calls to detect loops
        repeat_count: Number of times same tool pattern has repeated
    """
    count: int = 0
    active: bool = True
    last_tool_count: int = 0
    last_message_type: Optional[str] = None
    continuous_state: Dict[str, Any] = field(default_factory=lambda: {
        'accumulated_content': '',
        'thread_run_id': None
    })
    start_time: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    previous_tool_calls: List[str] = field(default_factory=list)
    repeat_count: int = 0
    
    def should_continue(self, config: ContinueConfig) -> bool:
        """
        Check if continuation should happen based on state and config.
        
        Args:
            config: Continue configuration
            
        Returns:
            True if continuation should happen
        """
        # Check basic continuation conditions
        if not (self.active and self.count < config.max_continues and config.enable_continuation):
            return False
        
        # Check timeout
        if self.is_timed_out(config):
            logger.warning(f"⏱️ Auto-continue timed out after {config.max_duration_seconds}s")
            return False
        
        return True
    
    def is_timed_out(self, config: ContinueConfig) -> bool:
        """
        Check if the auto-continue sequence has exceeded maximum duration.
        
        Args:
            config: Continue configuration
            
        Returns:
            True if timed out
        """
        elapsed = (datetime.now(timezone.utc) - self.start_time).total_seconds()
        return elapsed > config.max_duration_seconds
    
    def detect_loop(self, current_tools: List[str], config: ContinueConfig) -> bool:
        """
        Detect if agent is stuck in a loop calling the same tools repeatedly.
        
        Args:
            current_tools: List of tool names called in current iteration
            config: Continue configuration
            
        Returns:
            True if loop detected
        """
        if not config.enable_loop_detection:
            return False
        
        # Convert to sorted string for comparison (order doesn't matter)
        current_pattern = ','.join(sorted(current_tools))
        previous_pattern = ','.join(sorted(self.previous_tool_calls))
        
        if current_pattern == previous_pattern and current_pattern:
            self.repeat_count += 1
            logger.warning(
                f"⚠️ Repeated tool pattern detected ({self.repeat_count}/{config.loop_detection_threshold}): {current_pattern}"
            )
            
            if self.repeat_count >= config.loop_detection_threshold:
                logger.error(f"🔁 Loop detected! Agent has repeated same tools {self.repeat_count} times")
                return True
        else:
            # Different pattern, reset counter
            self.repeat_count = 0
        
        # Update history
        self.previous_tool_calls = current_tools.copy()
        return False
    
    def increment(self):
        """Increment the iteration counter."""
        self.count += 1
        logger.debug(f"🔄 Auto-continue iteration incremented: {self.count}")
    
    def reset(self):
        """Reset the state for a new agent run."""
        self.count = 0
        self.active = True
        self.last_tool_count = 0
        self.last_message_type = None
        self.continuous_state = {
            'accumulated_content': '',
            'thread_run_id': None
        }
        self.start_time = datetime.now(timezone.utc)
        self.previous_tool_calls = []
        self.repeat_count = 0
        logger.debug("Auto-continue state reset")


class ContinueDecisionMaker:
    """
    Makes decisions about when to continue agent execution.
    
    This class implements the logic for determining whether an agent
    should continue after tool execution. The decision is based on:
    - Whether tools were executed
    - What type of message ended the conversation
    - Whether a termination tool was called
    """
    
    def __init__(self, config: ContinueConfig):
        """
        Initialize the decision maker.
        
        Args:
            config: Continue configuration
        """
        self.config = config
    
    def should_continue_after_tools(
        self,
        tool_calls: List[Dict[str, Any]],
        last_message_type: str
    ) -> bool:
        """
        Determine if agent should continue after tool execution.
        
        Args:
            tool_calls: List of executed tool calls
            last_message_type: Type of the last message
            
        Returns:
            True if continuation is needed
        """
        # No tools = no continuation
        if not tool_calls:
            logger.debug("No tool calls, continuation not needed")
            return False
        
        # Check for termination tools
        for tool_call in tool_calls:
            tool_name = tool_call.get('function_name') or tool_call.get('name')
            if tool_name in self.config.termination_tools:
                logger.info(
                    f"🛑 Tool '{tool_name}' is a termination tool, not continuing"
                )
                return False
        
        # Continue if last message is not an assistant message
        # This ensures we don't end on tool/status messages
        non_final_types = [
            'tool',
            'tool_completed',
            'tool_failed',
            'tool_error',
            'status'
        ]
        
        if last_message_type in non_final_types:
            logger.info(
                f"🔄 Last message type '{last_message_type}' requires continuation"
            )
            return True
        
        logger.debug(
            f"Last message type '{last_message_type}' is final, no continuation needed"
        )
        return False
    
    def is_termination_tool(self, tool_name: str) -> bool:
        """
        Check if a tool is a termination tool.
        
        Args:
            tool_name: Name of the tool
            
        Returns:
            True if tool should terminate continuation
        """
        return tool_name in self.config.termination_tools


class ContinuePromptBuilder:
    """
    Builds continuation prompts based on context.
    
    This class generates the system messages that prompt the agent
    to continue its response after tool execution.
    """
    
    def __init__(self, config: ContinueConfig):
        """
        Initialize the prompt builder.
        
        Args:
            config: Continue configuration
        """
        self.config = config
    
    def build_continuation_prompt(
        self,
        tool_count: int,
        iteration: int,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Build a continuation prompt message.
        
        Args:
            tool_count: Number of tools executed
            iteration: Current iteration number
            context: Additional context for the prompt
            
        Returns:
            Message dict ready to add to conversation
        """
        content = self.config.continuation_prompt_template.format(
            tool_count=tool_count
        )
        
        metadata = {
            "auto_continue_iteration": iteration,
            "is_continuation_prompt": True,
            "tool_count": tool_count,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
        # Add any additional context to metadata
        if context:
            metadata.update(context)
        
        return {
            "role": "system",
            "content": content,
            "metadata": metadata
        }
    
    def build_max_iterations_prompt(self, max_continues: int) -> Dict[str, Any]:
        """
        Build prompt for when max iterations is reached.
        
        Args:
            max_continues: Maximum number of continues allowed
            
        Returns:
            System message dict
        """
        return {
            "role": "system",
            "content": (
                f"You have reached the maximum number of continuation iterations ({max_continues}). "
                f"Provide a final summary response based on all the work completed so far. "
                f"Do not call any more tools."
            ),
            "metadata": {
                "max_continues_reached": True,
                "max_continues": max_continues,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }
    
    def build_error_recovery_prompt(
        self,
        error_message: str,
        tool_name: str
    ) -> Dict[str, Any]:
        """
        Build prompt for recovering from tool errors.
        
        Args:
            error_message: The error message from the failed tool
            tool_name: Name of the tool that failed
            
        Returns:
            System message dict
        """
        return {
            "role": "system",
            "content": (
                f"The tool '{tool_name}' encountered an error: {error_message}. "
                f"Continue your response by acknowledging this issue and proceeding with "
                f"alternative approaches if possible."
            ),
            "metadata": {
                "is_error_recovery": True,
                "failed_tool": tool_name,
                "error": error_message,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }
    
    def build_final_message_prompt(self) -> Dict[str, Any]:
        """
        Build prompt for ensuring a final assistant message.
        
        Returns:
            System message dict
        """
        return {
            "role": "system",
            "content": (
                "Provide a final summary of the work completed. "
                "This will be your last message in this conversation."
            ),
            "metadata": {
                "is_final_message_prompt": True,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }
    
    def build_timeout_prompt(self, elapsed_seconds: float) -> Dict[str, Any]:
        """
        Build prompt for when timeout is reached.
        
        Args:
            elapsed_seconds: Time elapsed since start
            
        Returns:
            System message dict
        """
        return {
            "role": "system",
            "content": (
                f"The auto-continue sequence has exceeded the maximum time limit ({elapsed_seconds:.0f} seconds). "
                f"Provide a summary of the work completed so far and stop making tool calls."
            ),
            "metadata": {
                "is_timeout_prompt": True,
                "elapsed_seconds": elapsed_seconds,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }
    
    def build_loop_detected_prompt(self, repeated_tools: List[str], repeat_count: int) -> Dict[str, Any]:
        """
        Build prompt for when loop is detected.
        
        Args:
            repeated_tools: List of tools being repeated
            repeat_count: Number of times pattern repeated
            
        Returns:
            System message dict
        """
        tools_str = ', '.join(repeated_tools)
        return {
            "role": "system",
            "content": (
                f"You appear to be stuck in a loop, calling the same tools repeatedly ({tools_str}). "
                f"This pattern has repeated {repeat_count} times. "
                f"Please provide a final response based on the information you have gathered so far, "
                f"without calling any more tools."
            ),
            "metadata": {
                "is_loop_detected_prompt": True,
                "repeated_tools": repeated_tools,
                "repeat_count": repeat_count,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }


class AutoContinueManager:
    """
    Main manager for auto-continue functionality.
    
    This class orchestrates the auto-continue process, including:
    - Decision making about when to continue
    - State tracking across iterations
    - Prompt generation
    - Validation of final messages
    
    Usage:
        manager = AutoContinueManager(config)
        state = manager.create_state()
        
        if manager.should_continue(state, tool_calls, last_message_type):
            prompt = manager.get_continuation_prompt(state, len(tool_calls))
            # Add prompt and continue...
    """
    
    def __init__(self, config: Optional[ContinueConfig] = None):
        """
        Initialize the auto-continue manager.
        
        Args:
            config: Continue configuration (uses defaults if None)
        """
        self.config = config or ContinueConfig()
        self.decision_maker = ContinueDecisionMaker(self.config)
        self.prompt_builder = ContinuePromptBuilder(self.config)
        logger.info(
            f"✅ AutoContinueManager initialized (max_continues={self.config.max_continues})"
        )
    
    def create_state(self) -> ContinueState:
        """
        Create a new continue state.
        
        Returns:
            Fresh ContinueState instance
        """
        return ContinueState()
    
    def should_continue(
        self,
        state: ContinueState,
        tool_calls: List[Dict[str, Any]],
        last_message_type: str
    ) -> bool:
        """
        Determine if continuation should happen.
        
        This is the main entry point for continuation decisions.
        
        Args:
            state: Current continue state
            tool_calls: Executed tool calls
            last_message_type: Type of last message
            
        Returns:
            True if should continue
        """
        # Check state limits first (includes timeout check)
        if not state.should_continue(self.config):
            logger.debug(
                f"State limits exceeded (count={state.count}, "
                f"active={state.active}, max={self.config.max_continues})"
            )
            return False
        
        # Check for loops (if enabled)
        if tool_calls:
            tool_names = [
                tc.get('function_name') or tc.get('name') 
                for tc in tool_calls 
                if tc.get('function_name') or tc.get('name')
            ]
            
            if state.detect_loop(tool_names, self.config):
                logger.error("🔁 Loop detected, stopping auto-continue")
                return False
        
        # Check continuation conditions
        should_cont = self.decision_maker.should_continue_after_tools(
            tool_calls,
            last_message_type
        )
        
        if should_cont:
            logger.info(
                f"✅ Auto-continue decision: YES "
                f"(iteration {state.count + 1}/{self.config.max_continues})"
            )
        else:
            logger.info("❌ Auto-continue decision: NO")
        
        return should_cont
    
    def get_continuation_prompt(
        self,
        state: ContinueState,
        tool_count: int
    ) -> Dict[str, Any]:
        """
        Get the continuation prompt for current iteration.
        
        Args:
            state: Current continue state
            tool_count: Number of tools that were executed
            
        Returns:
            System message dict
        """
        return self.prompt_builder.build_continuation_prompt(
            tool_count,
            state.count,
            context={"state": state.continuous_state}
        )
    
    def get_max_iterations_prompt(self) -> Dict[str, Any]:
        """
        Get the prompt for max iterations reached.
        
        Returns:
            System message dict
        """
        return self.prompt_builder.build_max_iterations_prompt(
            self.config.max_continues
        )
    
    def get_error_recovery_prompt(
        self,
        error_message: str,
        tool_name: str
    ) -> Dict[str, Any]:
        """
        Get error recovery prompt.
        
        Args:
            error_message: Error message from failed tool
            tool_name: Name of failed tool
            
        Returns:
            System message dict
        """
        return self.prompt_builder.build_error_recovery_prompt(
            error_message,
            tool_name
        )
    
    def get_final_message_prompt(self) -> Dict[str, Any]:
        """
        Get final message prompt.
        
        Returns:
            System message dict
        """
        return self.prompt_builder.build_final_message_prompt()
    
    def get_timeout_prompt(self, state: ContinueState) -> Dict[str, Any]:
        """
        Get timeout prompt.
        
        Args:
            state: Current continue state
            
        Returns:
            System message dict
        """
        elapsed = (datetime.now(timezone.utc) - state.start_time).total_seconds()
        return self.prompt_builder.build_timeout_prompt(elapsed)
    
    def get_loop_detected_prompt(self, state: ContinueState) -> Dict[str, Any]:
        """
        Get loop detected prompt.
        
        Args:
            state: Current continue state with loop information
            
        Returns:
            System message dict
        """
        return self.prompt_builder.build_loop_detected_prompt(
            state.previous_tool_calls,
            state.repeat_count
        )
    
    def validate_final_message_type(self, message_type: str) -> bool:
        """
        Validate that final message is appropriate type.
        
        Args:
            message_type: Type of the final message
            
        Returns:
            True if valid final message type
        """
        valid_types = ['assistant', 'llm_response_end']
        is_valid = message_type in valid_types
        
        if not is_valid:
            logger.warning(
                f"⚠️ Invalid final message type: '{message_type}'. "
                f"Should be one of: {valid_types}"
            )
        else:
            logger.debug(f"✅ Valid final message type: '{message_type}'")
        
        return is_valid
    
    def update_state_from_signal(
        self,
        state: ContinueState,
        signal: Dict[str, Any]
    ):
        """
        Update state based on auto-continue signal.
        
        Args:
            state: State to update
            signal: Auto-continue signal dict
        """
        state.active = signal.get('should_continue', False)
        state.last_tool_count = signal.get('tool_count', 0)
        state.last_message_type = signal.get('last_message_type')
        
        logger.debug(
            f"State updated from signal: active={state.active}, "
            f"tool_count={state.last_tool_count}, "
            f"last_type={state.last_message_type}"
        )


# Convenience functions for external use

def create_continue_manager(max_continues: int = 25) -> AutoContinueManager:
    """
    Create a continue manager with default config.
    
    Args:
        max_continues: Maximum number of continuation iterations
        
    Returns:
        AutoContinueManager instance
    """
    config = ContinueConfig(max_continues=max_continues)
    return AutoContinueManager(config)


def should_continue_after_tools(
    tool_calls: List[Dict[str, Any]],
    last_message_type: str,
    max_continues: int = 25
) -> bool:
    """
    Convenience function to check if continuation is needed.
    
    Args:
        tool_calls: Executed tool calls
        last_message_type: Type of last message
        max_continues: Maximum iterations allowed
        
    Returns:
        True if should continue
    """
    manager = create_continue_manager(max_continues)
    state = manager.create_state()
    return manager.should_continue(state, tool_calls, last_message_type)


def create_continuation_signal(
    tool_count: int,
    last_message_type: str
) -> Dict[str, Any]:
    """
    Create an auto-continue signal message.
    
    This signal is yielded by the response processor to indicate
    that continuation is needed. It is NOT saved to the database.
    
    Args:
        tool_count: Number of tools executed
        last_message_type: Type of the last message
        
    Returns:
        Auto-continue signal dict
    """
    return {
        'type': 'auto_continue_signal',
        'should_continue': True,
        'tool_count': tool_count,
        'last_message_type': last_message_type,
        'timestamp': datetime.now(timezone.utc).isoformat()
    }


# Version and metadata
__version__ = "1.0.0"
__author__ = "AgentPress Team"
__date__ = "November 1, 2025"

# Export public API
__all__ = [
    'ContinueConfig',
    'ContinueState',
    'ContinueDecisionMaker',
    'ContinuePromptBuilder',
    'AutoContinueManager',
    'create_continue_manager',
    'should_continue_after_tools',
    'create_continuation_signal',
]
