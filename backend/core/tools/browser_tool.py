from core.agentpress.tool import ToolResult, openapi_schema, tool_metadata
from core.agentpress.thread_manager import ThreadManager
from core.sandbox.tool_base import SandboxToolsBase
from core.utils.logger import logger
from core.utils.s3_upload_utils import upload_base64_image
import asyncio
import json
import base64
import io
import traceback
from PIL import Image
from core.utils.config import config

# Browser extension support
from core.services.browser_extension import (
    session_manager,
    send_browser_command,
    CommandResult,
)
from core.tools.browser_ai import browser_interpreter

@tool_metadata(
    display_name="Web Browser",
    description="Browse websites, click buttons, fill forms, and extract information from web pages",
    icon="Globe",
    color="bg-cyan-100 dark:bg-cyan-800/50",
    weight=60,
    visible=True,
    usage_guide="""
### BROWSER AUTOMATION CAPABILITIES

**CORE BROWSER FUNCTIONS:**
- browser_navigate_to with url parameter - Navigate to any URL
- browser_act with action, variables, iframes, filePath parameters - Perform ANY browser action using natural language
  * Examples: "click the login button", "fill in email with user@example.com", "scroll down", "select option from dropdown"
  * Supports variables for secure data entry (not shared with LLM providers)
  * Handles iframes when needed
  * CRITICAL: Include filePath parameter for ANY action involving file uploads to prevent accidental file dialog triggers
- browser_extract_content with instruction and iframes parameters - Extract structured content from pages
  * Example: "extract all product prices", "get apartment listings with address and price"
- browser_screenshot with name parameter - Take screenshots of the current page

**WHAT YOU CAN DO:**
- Navigate to any URL and browse websites
- Click buttons, links, and any interactive elements
- Fill out forms with text, numbers, emails, etc.
- Select options from dropdowns and menus
- Scroll pages (up, down, to specific elements)
- Handle dynamic content and JavaScript-heavy sites
- Extract structured data from pages
- Take screenshots at any point
- Press keyboard keys (Enter, Escape, Tab, etc.)
- Handle iframes and embedded content
- Upload files (use filePath parameter in browser_act)
- Navigate browser history (go back, forward)
- Wait for content to load
- The browser is in a sandboxed environment, so nothing to worry about

**CRITICAL BROWSER VALIDATION WORKFLOW:**
- Every browser action automatically provides a screenshot - ALWAYS review it carefully
- When entering values (phone numbers, emails, text), explicitly verify the screenshot shows the exact values you intended
- Only report success when visual confirmation shows the exact intended values are present
- For any data entry action, your response should include: "Verified: [field] shows [actual value]" or "Error: Expected [intended] but field shows [actual]"
- The screenshot is automatically included with every browser action - use it to verify results
- Never assume form submissions worked correctly without reviewing the provided screenshot

**SCREENSHOT SHARING:**
- To share browser screenshots permanently, use `upload_file` tool
- Capture & Upload Workflow: Browser action → Screenshot generated → Upload to cloud → Share URL for documentation
"""
)
class BrowserTool(SandboxToolsBase):
    """
    Browser Tool for browser automation using local Stagehand API.
    
    This tool provides browser automation capabilities using a local Stagehand API server,
    replacing the sandbox browser tool functionality.
    
    Only 4 core functions that can handle everything:
    - browser_navigate_to: Navigate to URLs
    - browser_act: Perform any action (click, type, scroll, dropdowns etc.)
    - browser_extract_content: Extract content from pages
    - browser_screenshot: Take screenshots
    """


    def __init__(self, project_id: str, thread_id: str, thread_manager: ThreadManager, browser_id: str = None):
        super().__init__(project_id, thread_manager)
        self.thread_id = thread_id
        self.browser_id = browser_id  # Extension browser ID from thread metadata
        
        # Debug: Log browser tool initialization
        logger.info(f"🚨 [BROWSER_ROUTER] BrowserTool.__init__ called with browser_id={browser_id}")
        logger.info(f"🚨 [BROWSER_ROUTER] thread_id={thread_id}, project_id={project_id}")
        if browser_id:
            logger.info(f"🌐 [BROWSER_TOOL] ✅ Initialized with extension browser_id={browser_id}")
        else:
            logger.warning(f"🌐 [BROWSER_TOOL] ⚠️ Initialized WITHOUT browser extension (browser_id=None)")
    
    async def _is_extension_available(self) -> bool:
        """Check if browser extension is configured and online."""
        # Check instance variable first
        browser_id = self.browser_id
        
        # Fallback to thread_manager if instance variable is missing
        if not browser_id and hasattr(self, 'thread_manager') and self.thread_manager:
            browser_id = getattr(self.thread_manager, 'browser_id', None)
            if browser_id:
                logger.info(f"🚨 [BROWSER_ROUTER] Found browser_id in thread_manager: {browser_id}")
                self.browser_id = browser_id # Cache it for later
        
        logger.info(f"🚨 [BROWSER_ROUTER] _is_extension_available() called. browser_id={browser_id}")
        
        if not browser_id:
            logger.warning(f"🚨 [BROWSER_ROUTER] No browser_id → will use SANDBOX")
            return False
        
        is_online = await session_manager.is_browser_online(browser_id)
        logger.info(f"🚨 [BROWSER_ROUTER] is_browser_online({browser_id}) returned: {is_online}")
        
        if is_online:
            logger.info(f"🌐 [BROWSER_TOOL] ✅ Extension is ONLINE → routing to EXTENSION")
        else:
            logger.warning(f"🌐 [BROWSER_TOOL] ❌ Extension is OFFLINE → routing to SANDBOX")
        return is_online
    
    async def _execute_via_extension(self, action: str, params: dict = None) -> ToolResult:
        """
        Execute a browser action via the connected extension.
        
        This method mirrors _execute_stagehand_api behavior:
        - Saves browser_state message to thread
        - Returns clean_result with message_id
        - Uses consistent key names (image_url, not screenshot_url)
        
        Args:
            action: Command action (navigate, act, extract, screenshot)
            params: Command parameters
            
        Returns:
            ToolResult with success/failure status, or None to signal fallback
        """
        logger.info(f"🌐 [BROWSER_TOOL] Executing via extension: action={action}, browser_id={self.browser_id}")
        logger.debug(f"🌐 [BROWSER_TOOL] Extension command params: {params}")
        
        try:
            import time
            final_response_data = {}
            
            if action in ["act", "extract"]:
                # Extension doesn't have AI capabilities locally, use Backend AI Interpreter
                logger.info(f"🌐 [BROWSER_TOOL] Extension: AI-powered {action} requested. Fetching current page state...")
                
                # 1. Get current state (screenshot + URL)
                state_res = await send_browser_command(
                    browser_id=self.browser_id,
                    action="screenshot",
                    params={},
                )
                
                if state_res is None:
                    logger.warning(f"🌐 [BROWSER_TOOL] Extension offline while getting state for AI {action}")
                    return None # Fallback to sandbox
                
                if not state_res.success:
                    return self.fail_response(f"Failed to get browser state for AI {action}: {state_res.error}")
                
                screenshot_base64 = state_res.data.get("screenshot_base64")
                current_url = state_res.data.get("url", "")
                current_title = state_res.data.get("title", "")
                
                if not screenshot_base64:
                    return self.fail_response(f"No screenshot received from extension for AI {action}")
                
                # 2. Interpret command via Backend AI
                instruction = params.get("action") if action == "act" else params.get("instruction")
                file_path = params.get("filePath")
                variables = params.get("variables")
                
                if action == "act":
                    # Multi-step action loop
                    max_steps = 10
                    steps = 0
                    previous_actions = []
                    last_thought = ""
                    
                    while steps < max_steps:
                        # 2. Interpret step via Backend AI
                        ai_result = await browser_interpreter.interpret_act(
                            instruction, 
                            screenshot_base64, 
                            current_url, 
                            filePath=file_path,
                            variables=variables,
                            previous_actions=previous_actions
                        )
                        
                        last_thought = ai_result.get("thought", "")
                        logger.info(f"🌐 [BROWSER_TOOL] AI interpreted act step {steps+1}: {ai_result.get('action')} - {last_thought}")
                        
                        if ai_result["action"] == "complete":
                            final_response_data = {
                                "success": True,
                                "message": f"Completed: {last_thought}",
                                "url": current_url,
                                "title": current_title,
                                "screenshot_base64": screenshot_base64
                            }
                            break
                        
                        elif ai_result["action"] == "error":
                            return self.fail_response(f"AI failed to interpret action: {ai_result.get('error') or ai_result.get('thought')}")
                            
                        elif ai_result["action"] in ["click", "type", "navigate", "scroll_down", "scroll_up", "set_file_input_files", "press_key", "hover"]:
                            # 3. Execute primitive action via extension
                            exec_params = ai_result.get("params", {})
                            
                            # Handle file upload mapping
                            if ai_result["action"] == "set_file_input_files":
                                if file_path:
                                    exec_params["files"] = [file_path] if isinstance(file_path, str) else file_path
                                else:
                                    return self.fail_response("AI requested file upload but no filePath was provided.")
    
                            # Execute command
                            exec_res = await send_browser_command(
                                browser_id=self.browser_id,
                                action=ai_result["action"],
                                params=exec_params,
                            )
                            
                            if exec_res is None:
                                logger.warning("🌐 [BROWSER_TOOL] Extension went offline during multi-step action")
                                return None # Fallback
                                
                            if not exec_res.success:
                                return self.fail_response(f"Step {steps+1} failed ({ai_result['action']}): {exec_res.error}")
                                
                            # Action successful, record it
                            previous_actions.append(ai_result)
                            steps += 1
                            
                            # Update state for next iteration
                            if exec_res.data and "screenshot_base64" in exec_res.data:
                                screenshot_base64 = exec_res.data.get("screenshot_base64")
                                current_url = exec_res.data.get("url", current_url)
                                current_title = exec_res.data.get("title", current_title)
                            else:
                                # Refresh state explicitly
                                refresh_res = await send_browser_command(
                                    browser_id=self.browser_id,
                                    action="screenshot",
                                    params={},
                                )
                                if refresh_res and refresh_res.success:
                                    screenshot_base64 = refresh_res.data.get("screenshot_base64")
                                    current_url = refresh_res.data.get("url", current_url)
                                    current_title = refresh_res.data.get("title", current_title)
                                else:
                                    logger.warning("🌐 [BROWSER_TOOL] Failed to refresh state after action step")
                        else:
                            return self.fail_response(f"AI returned unknown action: {ai_result.get('action')}")
                    
                    if steps >= max_steps:
                        return self.fail_response(f"Action timed out after {max_steps} steps. Last state: {last_thought}")
                
                else:  # extract
                    # Fetch DOM content for better context
                    dom_res = await send_browser_command(
                        browser_id=self.browser_id,
                        action="extractContent",
                        params={}
                    )
                    
                    if dom_res is None:
                        logger.warning("🌐 [BROWSER_TOOL] Extension offline during extraction")
                        return None
                        
                    dom_text = dom_res.data.get("content", "") if dom_res.success and dom_res.data else ""
                    
                    extract_data = await browser_interpreter.interpret_extract(
                        instruction, 
                        screenshot_base64, 
                        current_url,
                        dom_text=dom_text
                    )
                    
                    final_response_data = {
                        "success": True,
                        "data": extract_data,
                        "url": current_url,
                        "title": current_title,
                        "screenshot_base64": screenshot_base64,
                        "message": f"Extracted content for: {instruction}"
                    }
                

            else:
                # Regular command execution (navigate, screenshot, etc.)
                result = await send_browser_command(
                    browser_id=self.browser_id,
                    action=action,
                    params=params or {},
                )
                
                if result is None:
                    logger.warning(f"🌐 [BROWSER_TOOL] Extension offline for command {action}")
                    return None
                
                if not result.success:
                    return self.fail_response(f"Extension command {action} failed: {result.error}")
                
                final_response_data = result.data or {}
                final_response_data["success"] = True
            
            # --- POST-PROCESSING (Consistent for all extension paths) ---
            
            # 1. Handle Screenshot Mapping
            image_url = None
            screenshot_base64 = final_response_data.get("screenshot_base64") or final_response_data.get("screenshot")
            
            if screenshot_base64:
                is_valid, error_msg = self._validate_base64_image(screenshot_base64)
                if is_valid:
                    image_url = await upload_base64_image(
                        base64_data=screenshot_base64,
                        bucket_name="browser-screenshots"
                    )
                    logger.debug(f"🌐 [BROWSER_TOOL] Screenshot uploaded: {image_url}")
                else:
                    logger.warning(f"🌐 [BROWSER_TOOL] Screenshot validation failed: {error_msg}")
                
                # Clean up large base64 data
                final_response_data.pop("screenshot_base64", None)
                final_response_data.pop("screenshot", None)

            # 2. Build Thread State Record (Matches Sandbox)
            thread_payload = {
                **final_response_data,
                "input": params,
                "image_url": image_url
            }
            
            # Save to database
            try:
                added_message = await self.thread_manager.add_message(
                    thread_id=self.thread_id,
                    type="browser_state",
                    content=thread_payload,
                    is_llm_message=False
                )
                message_id = added_message.get("message_id")
            except Exception as e:
                logger.error(f"🌐 [BROWSER_TOOL] Database error saving browser state: {e}")
                message_id = None

            # 3. Build Final Tool Result
            clean_result = {
                "success": True,
                "message": final_response_data.get("message", f"Browser {action} completed"),
                "url": final_response_data.get("url"),
                "title": final_response_data.get("title"),
                "image_url": image_url,
                "message_id": message_id
            }
            
            # Include extraction data if present
            if "data" in final_response_data:
                clean_result["data"] = final_response_data["data"]

            return self.success_response(clean_result)
                
        except TimeoutError as e:
            logger.warning(f"🌐 [BROWSER_TOOL] Extension timeout: {e}")
            return None  # Fallback
        except Exception as e:
            logger.error(f"🌐 [BROWSER_TOOL] Unexpected error in extension path: {e}")
            logger.debug(traceback.format_exc())
            return self.fail_response(f"Error executing via extension: {str(e)}")
    
    def _validate_base64_image(self, base64_string: str, max_size_mb: int = 10) -> tuple[bool, str]:
        """
        Comprehensive validation of base64 image data.
        
        Args:
            base64_string (str): The base64 encoded image data
            max_size_mb (int): Maximum allowed image size in megabytes
            
        Returns:
            tuple[bool, str]: (is_valid, error_message)
        """
        try:
            # Check if data exists and has reasonable length
            if not base64_string or len(base64_string) < 10:
                return False, "Base64 string is empty or too short"
            
            # Remove data URL prefix if present (data:image/jpeg;base64,...)
            if base64_string.startswith('data:'):
                try:
                    base64_string = base64_string.split(',', 1)[1]
                except (IndexError, ValueError):
                    return False, "Invalid data URL format"
            
            # Check if string contains only valid base64 characters
            # Base64 alphabet: A-Z, a-z, 0-9, +, /, = (padding)
            import re
            if not re.match(r'^[A-Za-z0-9+/]*={0,2}$', base64_string):
                return False, "Invalid base64 characters detected"
            
            # Check if base64 string length is valid (must be multiple of 4)
            if len(base64_string) % 4 != 0:
                return False, "Invalid base64 string length"
            
            # Attempt to decode base64
            try:
                image_data = base64.b64decode(base64_string, validate=True)
            except Exception as e:
                return False, f"Base64 decoding failed: {str(e)}"
            
            # Check decoded data size
            if len(image_data) == 0:
                return False, "Decoded image data is empty"
            
            # Check if decoded data size exceeds limit
            max_size_bytes = max_size_mb * 1024 * 1024
            if len(image_data) > max_size_bytes:
                return False, f"Image size ({len(image_data)} bytes) exceeds limit ({max_size_bytes} bytes)"
            
            # Validate that decoded data is actually a valid image using PIL
            try:
                image_stream = io.BytesIO(image_data)
                with Image.open(image_stream) as img:
                    # Verify the image by attempting to load it
                    img.verify()
                    
                    # Check if image format is supported
                    supported_formats = {'JPEG', 'PNG', 'GIF', 'BMP', 'WEBP', 'TIFF'}
                    if img.format not in supported_formats:
                        return False, f"Unsupported image format: {img.format}"
                    
                    return True, "Image validation successful"
                    
            except Exception as e:
                return False, f"Image validation failed: {str(e)}"
                
        except Exception as e:
            return False, f"Image validation error: {str(e)}"
    
    async def _debug_sandbox_services(self) -> str:
        """Debug method to check what services are running in the sandbox"""
        try:
            await self._ensure_sandbox()
            
            # Check what processes are running
            ps_cmd = "ps aux | grep -E '(python|uvicorn|stagehand|node)' | grep -v grep"
            response = await self.sandbox.process.exec(ps_cmd, timeout=10)
            
            processes = response.result if response.exit_code == 0 else "Failed to get process list"
            
            # Check what ports are listening
            netstat_cmd = "netstat -tlnp 2>/dev/null | grep -E ':(8003|8004)' || ss -tlnp 2>/dev/null | grep -E ':(8003|8004)' || echo 'No netstat/ss available'"
            response2 = await self.sandbox.process.exec(netstat_cmd, timeout=10)
            
            ports = response2.result if response2.exit_code == 0 else "Failed to get port list"
            
            debug_info = f"""
            === Sandbox Services Debug Info ===
            Running processes:
            {processes}

            Listening ports:
            {ports}

            === End Debug Info ===
            """
            return debug_info
            
        except Exception as e:
            return f"Error getting debug info: {e}"

    async def _check_stagehand_api_health(self) -> bool:
        """Check if the Stagehand API server is running and accessible"""
        try:
            await self._ensure_sandbox()
            
            # Retry logic: The browser API server takes a few seconds to start
            # after the sandbox initializes. We'll retry with exponential backoff.
            max_retries = 5
            retry_delays = [1, 2, 3, 5, 5]  # seconds between retries
            
            for attempt in range(max_retries):
                # Simple health check curl command
                curl_cmd = "curl -s -X GET 'http://localhost:8004/api' -H 'Content-Type: application/json'"
                
                if attempt > 0:
                    logger.info(f"Retrying Stagehand API health check (attempt {attempt + 1}/{max_retries})...")
                
                response = await self.sandbox.process.exec(curl_cmd, timeout=10)
                
                if response.exit_code == 0:
                    try:
                        result = json.loads(response.result)
                        if result.get("status") == "healthy":
                            logger.info("✅ Stagehand API server is running and healthy")
                            return True
                        else:
                            # If the browser api is not healthy, we need to initialize it
                            logger.info("Stagehand API server responded but browser not initialized. Initializing...")
                            # Pass API key securely as environment variable instead of command line argument
                            env_vars = {"GEMINI_API_KEY": config.GEMINI_API_KEY}

                            response = await self.sandbox.process.exec(
                                'curl -s -X POST "http://localhost:8004/api/init" -H "Content-Type: application/json" -d "{\\"api_key\\": \\"$GEMINI_API_KEY\\"}"',
                                timeout=90,
                                env=env_vars
                            )
                            if response.exit_code == 0:
                                try:
                                    init_result = json.loads(response.result)
                                    if init_result.get("status") == "healthy":
                                        logger.info("✅ Stagehand API server initialized successfully")
                                        return True
                                    else:
                                        logger.warning(f"Stagehand API initialization failed: {init_result}")
                                        # Don't return False yet, might succeed on retry
                                except json.JSONDecodeError:
                                    logger.warning(f"Init endpoint returned invalid JSON: {response.result}")
                            else:
                                logger.warning(f"Stagehand API initialization request failed: {response.result}")
                    except json.JSONDecodeError:
                        logger.warning(f"Stagehand API server responded but with invalid JSON: {response.result}")
                elif response.exit_code == 7:
                    # Connection refused - server not ready yet
                    logger.debug(f"Browser API server not ready yet (connection refused)")
                else:
                    logger.debug(f"Health check failed with exit code {response.exit_code}")
                
                # Wait before retrying (except on last attempt)
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_delays[attempt])
            
            # All retries exhausted
            logger.error(f"Stagehand API server failed to start after {max_retries} attempts")
            return False
                
        except Exception as e:
            logger.error(f"Error checking Stagehand API health: {e}")
            return False

    async def _execute_stagehand_api(self, endpoint: str, params: dict = None, method: str = "POST") -> ToolResult:
        """Execute a Stagehand action through the sandbox API"""
        try:
            # Check if Gemini API key is configured
            if not config.GEMINI_API_KEY:
                return self.fail_response("Browser tool is not available. GEMINI_API_KEY is not configured.")
            
            # Ensure sandbox is initialized
            await self._ensure_sandbox()
            
            # Check if Stagehand API server is running
            stagehand_healthy = await self._check_stagehand_api_health()
            
            if not stagehand_healthy:
                error_msg = "Stagehand API server is not running. Please ensure the Stagehand API server is running. Error: {response}"
                
                # Add debug information
                debug_info = await self._debug_sandbox_services()
                error_msg += f"\n\nDebug information:\n{debug_info}"
                
                logger.error(error_msg)
                return self.fail_response(error_msg)
            
            
            # Build the curl command to call the local Stagehand API
            url = f"http://localhost:8004/api/{endpoint}"  # Fixed localhost as curl runs inside container
            
            if method == "GET" and params:
                query_params = "&".join([f"{k}={v}" for k, v in params.items()])
                url = f"{url}?{query_params}"
                curl_cmd = f"curl -s -X {method} '{url}' -H 'Content-Type: application/json'"
            else:
                curl_cmd = f"curl -s -X {method} '{url}' -H 'Content-Type: application/json'"
                if params:
                    json_data = json.dumps(params)
                    curl_cmd += f" -d '{json_data}'"
            
            # logger.debug(f"\033[95mExecuting curl command:\033[0m\n{curl_cmd}")
            
            response = await self.sandbox.process.exec(curl_cmd, timeout=30)  # Execute curl inside sandbox
            
            if response.exit_code == 0:
                try:
                    result = json.loads(response.result)
                    logger.debug(f"Stagehand API result: {result}")

                    logger.debug("Stagehand API request completed successfully")

                    if "screenshot_base64" in result:
                        try:
                            screenshot_data = result["screenshot_base64"]
                            is_valid, validation_message = self._validate_base64_image(screenshot_data)
                            
                            if is_valid:
                                logger.debug(f"Screenshot validation passed: {validation_message}")
                                image_url = await upload_base64_image(screenshot_data, "browser-screenshots")
                                result["image_url"] = image_url
                                logger.debug(f"Uploaded screenshot to {image_url}")
                            else:
                                logger.warning(f"Screenshot validation failed: {validation_message}")
                                result["image_validation_error"] = validation_message
                                
                            del result["screenshot_base64"]
                            
                        except Exception as e:
                            logger.error(f"Failed to process screenshot: {e}")
                            result["image_upload_error"] = str(e)
                    
                    result["input"] = params
                    added_message = await self.thread_manager.add_message(
                        thread_id=self.thread_id,
                        type="browser_state",
                        content=result,
                        is_llm_message=False
                    )

                    # Prepare clean response for agent (filter out internal metadata)
                    # Only include data that's useful for the agent's decision making
                    clean_result = {
                        "success": result.get("success", True),
                        "message": result.get("message", "Stagehand action completed successfully")
                    }

                    # Include only data that actually comes from browserApi.ts
                    if result.get("url"):
                        clean_result["url"] = result["url"]
                    if result.get("title"):
                        clean_result["title"] = result["title"]
                    if result.get("action"):
                        clean_result["action"] = result["action"]
                    if result.get("image_url"):  # This is screenshot_base64 converted to image_url
                        clean_result["image_url"] = result["image_url"]
                    
                    # Include any error context that's useful for the agent
                    if result.get("image_validation_error"):
                        clean_result["screenshot_issue"] = f"Screenshot processing issue: {result['image_validation_error']}"
                    if result.get("image_upload_error"):
                        clean_result["screenshot_issue"] = f"Screenshot upload issue: {result['image_upload_error']}"
                    clean_result["message_id"] = added_message.get("message_id")

                    if clean_result.get("success"):
                        return self.success_response(clean_result)
                    else:
                        # Handle error responses with helpful context  
                        error_msg = result.get("error", result.get("message", "Unknown error"))
                        clean_result["message"] = error_msg
                        return self.fail_response(clean_result)

                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse response JSON: {response.result} {e}")
                    return self.fail_response(f"Failed to parse response JSON: {response.result} {e}")
            else:
                # Check if it's a connection error (exit code 7)
                if response.exit_code == 7:
                    error_msg = f"Stagehand API server is not available on port 8004. Please ensure the Stagehand API server is running. Error: {response}"
                    logger.error(error_msg)
                    return self.fail_response(error_msg)
                else:
                    logger.error(f"Stagehand API request failed: {response}")
                    return self.fail_response(f"Stagehand API request failed: {response}")

        except Exception as e:
            logger.error(f"Error executing Stagehand action: {e}")
            logger.debug(traceback.format_exc())
            return self.fail_response(f"Error executing Stagehand action: {e}")

    # Core Functions Only
    
    @openapi_schema({
        "type": "function",
        "function": {
            "name": "browser_navigate_to",
            "description": "Navigate to a specific url. **🚨 PARAMETER NAMES**: Use EXACTLY this parameter name: `url` (REQUIRED).",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "**REQUIRED** - The URL to navigate to. Example: 'https://example.com'"
                    }
                },
                "required": ["url"],
                "additionalProperties": False
            }
        }
    })
    async def browser_navigate_to(self, url: str) -> ToolResult:
        """Navigate to a URL using Stagehand or browser extension."""
        logger.info(f"🚨 [BROWSER_ROUTER] EXECUTING TOOL: browser_navigate_to with url='{url}'")
        logger.debug(f"🚨 [BROWSER_ROUTER] self.browser_id = {self.browser_id}")
        
        # Try extension first if available
        extension_available = await self._is_extension_available()
        logger.info(f"🚨 [BROWSER_ROUTER] _is_extension_available() returned: {extension_available}")
        
        if extension_available:
            logger.info(f"🚨 [BROWSER_ROUTER] → Routing to EXTENSION")
            result = await self._execute_via_extension("navigate", {"url": url})
            if result is not None:
                logger.info(f"🚨 [BROWSER_ROUTER] Extension returned valid result: success={result.success}")
                return result
            # DEBUG: For now, FAIL instead of falling back to sandbox
            logger.error(f"🚨 [BROWSER_ROUTER] Extension returned None! Would normally fallback to sandbox.")
            return self.fail_response("Extension failed and sandbox fallback is disabled for debugging")
        
        logger.debug(f"🚨 [BROWSER_ROUTER] → Routing to SANDBOX (extension not available)")
        return await self._execute_stagehand_api("navigate", {"url": url})
    
    @openapi_schema({
        "type": "function",
        "function": {
            "name": "browser_act",
            "description": "Perform any browser action using natural language description. CRITICAL: This tool automatically provides a screenshot with every action. For data entry actions (filling forms, entering text, selecting options), you MUST review the provided screenshot to verify that displayed values exactly match what was intended. Report mismatches immediately. CRITICAL FILE UPLOAD RULE: ANY action that involves clicking, interacting with, or locating upload buttons, file inputs, resume upload sections, or any element that might trigger a choose file dialog MUST include the filePath parameter with filePath. This includes actions like 'click upload button', 'locate resume section', 'find file input' etc. Always err on the side of caution - if there's any possibility the action might lead to a file dialog, include filePath. This prevents accidental file dialog triggers without proper file handling. **🚨 PARAMETER NAMES**: Use EXACTLY these parameter names: `action` (REQUIRED), `variables` (optional), `iframes` (optional), `filePath` (optional).",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "description": "**REQUIRED** - The action to perform. Examples: 'click the login button', 'fill in the email field with %email%', 'scroll down to see more content', 'select option 2 from the dropdown', 'press Enter', 'go back', 'wait 5 seconds', 'click at coordinates 100,200', 'select United States from the country dropdown'"
                    },
                    "variables": {
                        "type": "object",
                        "description": "**OPTIONAL** - Variables to use in the action. Variables in the action string are referenced using %variable_name%. These variables are NOT shared with LLM providers for security. Default: {}.",
                        "additionalProperties": {"type": "string"},
                        "default": {}
                    },
                    "iframes": {
                        "type": "boolean",
                        "description": "**OPTIONAL** - Whether to include iframe content in the action. Set to true if the target element is inside an iframe. Default: true.",
                        "default": True
                    },
                    "filePath": {
                        "type": "string",
                        "description": "**OPTIONAL** - CRITICAL: REQUIRED for ANY action that might involve file uploads. This includes: clicking upload buttons, locating resume sections, finding file inputs, scrolling to upload areas, or any action that could potentially trigger a file dialog. Always include this parameter when dealing with upload-related elements to prevent accidental file dialog triggers. The tool will automatically handle the file upload after the action is performed."
                    }
                },
                "required": ["action"],
                "additionalProperties": False
            }
        }
    })
    async def browser_act(self, action: str, variables: dict = None, iframes: bool = False, filePath: str = None) -> ToolResult:
        """Perform any browser action using Stagehand or browser extension."""
        logger.debug(f"🚨 [BROWSER_ROUTER] browser_act() called with action={action}")
        logger.debug(f"🚨 [BROWSER_ROUTER] self.browser_id = {self.browser_id}")
        
        # Try extension first if available
        extension_available = await self._is_extension_available()
        logger.debug(f"🚨 [BROWSER_ROUTER] _is_extension_available() returned: {extension_available}")
        
        if extension_available:
            params = {
                "action": action,
                "variables": variables,
                "iframes": iframes,
                "filePath": filePath,
            }
            result = await self._execute_via_extension("act", params)
            if result is not None:
                return result
            
            logger.warning(f"🌐 [BROWSER_ROUTER] Extension failed (returned None) → falling back to sandbox")
        
        # Fallback to Sandbox
        params = {"action": action, "iframes": iframes, "variables": variables}
        if filePath:
            params["filePath"] = filePath
        return await self._execute_stagehand_api("act", params)
    
    @openapi_schema({
        "type": "function",
        "function": {
            "name": "browser_extract_content",
            "description": "Extract structured content from the current page using Stagehand. **🚨 PARAMETER NAMES**: Use EXACTLY these parameter names: `instruction` (REQUIRED), `iframes` (optional).",
            "parameters": {
                "type": "object",
                "properties": {
                    "instruction": {
                        "type": "string",
                        "description": "**REQUIRED** - What content to extract. Example: 'extract all product prices', 'get the main heading', 'extract apartment listings with address and price'"
                    },
                    "iframes": {
                        "type": "boolean",
                        "description": "**OPTIONAL** - Whether to include iframe content in the extraction. Set to true if the target content is inside an iframe. Default: true.",
                        "default": True
                    }
                },
                "required": ["instruction"],
                "additionalProperties": False
            }
        }
    })
    async def browser_extract_content(self, instruction: str, iframes: bool = False) -> ToolResult:
        """Extract structured content from the current page using Stagehand or browser extension."""
        logger.debug(f"🚨 [BROWSER_ROUTER] browser_extract_content() called with instruction={instruction}")
        logger.debug(f"🚨 [BROWSER_ROUTER] self.browser_id = {self.browser_id}")
        
        # Try extension first if available
        extension_available = await self._is_extension_available()
        logger.debug(f"🚨 [BROWSER_ROUTER] _is_extension_available() returned: {extension_available}")
        
        if extension_available:
            params = {"instruction": instruction, "iframes": iframes}
            result = await self._execute_via_extension("extract", params)
            if result is not None:
                return result
            
            logger.warning(f"🌐 [BROWSER_ROUTER] Extension failed (returned None) → falling back to sandbox")
        
        # Fallback to Sandbox
        params = {"instruction": instruction, "iframes": iframes}
        return await self._execute_stagehand_api("extract", params)
    
    @openapi_schema({
        "type": "function",
        "function": {
            "name": "browser_screenshot",
            "description": "Take a screenshot of the current page. **🚨 PARAMETER NAMES**: Use EXACTLY this parameter name: `name` (optional).",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "**OPTIONAL** - Name for the screenshot. Default: 'screenshot'.",
                        "default": "screenshot"
                    }
                },
                "required": [],
                "additionalProperties": False
            }
        }
    })
    async def browser_screenshot(self, name: str = "screenshot") -> ToolResult:
        """Take a screenshot using Stagehand or browser extension."""
        logger.info(f"🚨 [BROWSER_ROUTER] EXECUTING TOOL: browser_screenshot with name='{name}'")
        logger.debug(f"🚨 [BROWSER_ROUTER] self.browser_id = {self.browser_id}")
        
        # Try extension first if available
        extension_available = await self._is_extension_available()
        logger.info(f"🚨 [BROWSER_ROUTER] _is_extension_available() returned: {extension_available}")
        
        if extension_available:
            result = await self._execute_via_extension("screenshot", {"name": name})
            if result is not None:
                return result
            
            logger.warning(f"🌐 [BROWSER_ROUTER] Extension failed (returned None) → falling back to sandbox")
            
        # Fallback to Sandbox
        return await self._execute_stagehand_api("screenshot", {"name": name})
