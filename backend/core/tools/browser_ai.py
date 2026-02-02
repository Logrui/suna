
import base64
import json
import re
from typing import Dict, Any, Optional, List
from core.utils.logger import logger
from core.services.llm import make_llm_api_call

class BrowserAIInterpreter:
    """
    Interpretation layer for browser actions and extractions using LLM Vision.
    
    This provides 'Stagehand-like' capabilities to the browser extension by
    using an LLM to interpret screenshots and map instructions to primitive actions.
    """
    
    def __init__(self, model_name: str = "openrouter/google/gemini-3-flash-preview"):
        self.model_name = model_name

    def _substitute_variables(self, instruction: str, variables: Optional[Dict[str, str]] = None) -> str:
        """
        Substitute %variable% patterns with their values from the variables dict.
        Example: "fill email with %email%" + {"email": "test@example.com"} 
                 → "fill email with test@example.com"
        """
        if not variables:
            return instruction
        
        def replace_var(match):
            var_name = match.group(1)
            return variables.get(var_name, match.group(0))  # Keep original if not found
        
        return re.sub(r'%(\w+)%', replace_var, instruction)

    async def interpret_act(
        self, 
        instruction: str, 
        screenshot_base64: str, 
        url: str, 
        filePath: Optional[str] = None,
        variables: Optional[Dict[str, str]] = None,
        previous_actions: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Interpret a natural language 'act' instruction based on a screenshot.
        Returns a primitive action for the extension to execute.
        """
        # Substitute variables before sending to AI
        instruction = self._substitute_variables(instruction, variables)
        
        upload_context = ""
        if filePath:
            upload_context = f"\nFILE UPLOAD CONTEXT: The user wants to upload a file: {filePath}. Your goal is to find the <input type='file'> element or the upload button/area. Preference: Return 'set_file_input_files' if you can identify the file input element."

        history_context = ""
        if previous_actions:
            history_str = "\n".join([f"- {a.get('action')}: {a.get('thought')}" for a in previous_actions])
            history_context = f"\nPREVIOUS ACTIONS TAKEN:\n{history_str}\n"

        # Build prompt with escaped braces for the JSON example
        prompt = f"""You are a browser automation expert. Your task is to interpret a user's instruction and convert it into a SINGLE primitive browser action based on the provided screenshot of the current page.

{upload_context}

CURRENT URL: {url}
USER INSTRUCTION: "{instruction}"

{history_context}

IMPORTANT GUIDELINES:
1. Look at the screenshot carefully to identify elements.
2. If the user instruction is already satisfied or can't be done, return action "complete".
3. Use precise CSS selectors or unique text labels.
4. Return ONLY a valid JSON object.

RESPONSE FORMAT (JSON ONLY):
{{
    "thought": "Briefly explain why you chose this action",
    "action": "click" | "type" | "navigate" | "scroll_down" | "scroll_up" | "set_file_input_files" | "press_key" | "hover" | "complete",
    "params": {{
        "selector": "CSS selector or text to find element",
        "text": "text to type (only for type action)",
        "url": "url to navigate (only for navigate action)",
        "key": "key to press (only for press_key action, e.g., 'Enter', 'Tab')"
    }}
}}

PRIMITIVE ACTIONS:
- click: Requires 'selector'.
- type: Requires 'selector' and 'text'.
- navigate: Requires 'url'.
- scroll_down / scroll_up: No params needed.
- set_file_input_files: Requires 'selector'. For <input type="file"> elements.
- press_key: Requires 'key'.
- hover: Requires 'selector'."""

        try:
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{screenshot_base64}"
                            }
                        }
                    ]
                }
            ]
            
            # Call Gemini (or chosen model)
            # Use non-streaming for short JSON response
            response = await make_llm_api_call(
                messages=messages,
                model_name=self.model_name,
                response_format={"type": "json_object"},
                stream=False
            )
            
            # Parse response
            content = response.choices[0].message.content
            logger.debug(f"[BROWSER_AI] interpret_act raw response: {content[:500]}...")
            return json.loads(content)
            
        except Exception as e:
            logger.error(f"Failed to interpret browser act: {e}")
            return {"action": "error", "error": str(e)}

    async def interpret_extract(
        self, 
        instruction: str, 
        screenshot_base64: str, 
        url: str,
        dom_text: str = ""
    ) -> Dict[str, Any]:
        """
        Interpret a natural language 'extract' instruction based on a screenshot and DOM text.
        Returns the extracted data.
        """
        prompt = f"""You are a data extraction expert. Your task is to extract specific information from the provided screenshot of a web page and its text content based on the user's instruction.

CURRENT URL: {url}
USER INSTRUCTION: "{instruction}"

PAGE TEXT CONTENT (Truncated):
{dom_text[:15000]}... (more text available but truncated)

RESPONSE FORMAT (JSON ONLY):
Return the extracted data in a clean, structured JSON format that directly answers the instruction.

Look at the screenshot carefully to capture all relevant details, and use the text content to ensure accuracy."""

        try:
            messages = [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{screenshot_base64}"
                            }
                        }
                    ]
                }
            ]
            
            response = await make_llm_api_call(
                messages=messages,
                model_name=self.model_name,
                response_format={"type": "json_object"},
                stream=False
            )
            
            content = response.choices[0].message.content
            logger.debug(f"[BROWSER_AI] interpret_extract raw response: {content[:500]}...")
            return json.loads(content)
            
        except Exception as e:
            logger.error(f"Failed to interpret browser extract: {e}")
            return {"error": str(e)}

# Singleton instance
browser_interpreter = BrowserAIInterpreter()
