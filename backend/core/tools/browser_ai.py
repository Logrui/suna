
import base64
import json
from typing import Dict, Any, Optional, List
from core.utils.logger import logger
from core.services.llm import make_llm_api_call

class BrowserAIInterpreter:
    """
    Interpretation layer for browser actions and extractions using LLM Vision.
    
    This provides 'Stagehand-like' capabilities to the browser extension by
    using an LLM to interpret screenshots and map instructions to primitive actions.
    """
    
    def __init__(self, model_name: str = "gemini-2.5-flash"):
        self.model_name = model_name

    async def interpret_act(self, instruction: str, screenshot_base64: str, url: str) -> Dict[str, Any]:
        """
        Interpret a natural language 'act' instruction based on a screenshot.
        Returns a primitive action for the extension to execute.
        """
        prompt = f"""
You are a browser automation expert. Your task is to interpret a user's instruction and convert it into a SINGLE primitive browser action based on the provided screenshot of the current page.

CURRENT URL: {url}
USER INSTRUCTION: "{instruction}"

RESPONSE FORMAT (JSON ONLY):
{{
    "thought": "Briefly explain why you chose this action",
    "action": "click" | "type" | "navigate" | "scroll_down" | "scroll_up",
    "params": {{
        "selector": "CSS selector or text to find element",
        "text": "text to type (only for type action)",
        "url": "url to navigate to (only for navigate action)"
    }}
}}

PRIMITIVE ACTIONS:
- click: Requires 'selector'. Use a precise CSS selector or unique text label.
- type: Requires 'selector' and 'text'.
- navigate: Requires 'url'.
- scroll_down / scroll_up: No params needed.

If the instruction is already completed or impossible, return:
{{
    "thought": "Instruction completed/impossible",
    "action": "complete",
    "params": {{}}
}}

Look at the screenshot carefully to identify the elements.
"""
        try:
            messages = [
                {{
                    "role": "user",
                    "content": [
                        {{"type": "text", "text": prompt}},
                        {{
                            "type": "image_url",
                            "image_url": {{
                                "url": f"data:image/png;base64,{screenshot_base64}"
                            }}
                        }}
                    ]
                }}
            ]
            
            # Call Gemini (or chosen model)
            # Use non-streaming for short JSON response
            response = await make_llm_api_call(
                messages=messages,
                model_name=self.model_name,
                response_format={{"type": "json_object"}},
                stream=False
            )
            
            # Parse response
            content = response.choices[0].message.content
            return json.loads(content)
            
        except Exception as e:
            logger.error(f"Failed to interpret browser act: {e}")
            return {{"action": "error", "error": str(e)}}

    async def interpret_extract(self, instruction: str, screenshot_base64: str, url: str) -> Dict[str, Any]:
        """
        Interpret a natural language 'extract' instruction based on a screenshot.
        Returns the extracted data.
        """
        prompt = f"""
You are a data extraction expert. Your task is to extract specific information from the provided screenshot of a web page based on the user's instruction.

CURRENT URL: {url}
USER INSTRUCTION: "{instruction}"

RESPONSE FORMAT (JSON ONLY):
Return the extracted data in a clean, structured JSON format that directly answers the instruction.

Look at the screenshot carefully to capture all relevant details.
"""
        try:
            messages = [
                {{
                    "role": "user",
                    "content": [
                        {{"type": "text", "text": prompt}},
                        {{
                            "type": "image_url",
                            "image_url": {{
                                "url": f"data:image/png;base64,{screenshot_base64}"
                            }}
                        }}
                    ]
                }}
            ]
            
            response = await make_llm_api_call(
                messages=messages,
                model_name=self.model_name,
                response_format={{"type": "json_object"}},
                stream=False
            )
            
            content = response.choices[0].message.content
            return json.loads(content)
            
        except Exception as e:
            logger.error(f"Failed to interpret browser extract: {e}")
            return {{"error": str(e)}}

# Singleton instance
browser_interpreter = BrowserAIInterpreter()
