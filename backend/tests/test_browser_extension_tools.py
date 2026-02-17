"""
Unit tests for the Kortix Browser Extension act/extract execution paths.

Tests cover:
1. BrowserAIInterpreter: variable substitution, interpret_act, interpret_extract
2. BrowserTool._execute_via_extension: act multi-step loop, extract path
3. Extension availability check and sandbox fallback
4. send_browser_command: local session + Redis relay paths
5. Base64 image validation
"""

import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock
from dataclasses import dataclass

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_command_result(success=True, data=None, error=None):
    """Build a mock CommandResult."""
    from core.services.browser_extension import CommandResult
    return CommandResult(
        type="result",
        id="cmd-001",
        session_id="sess-001",
        success=success,
        data=data,
        error=error,
        timestamp=1700000000000,
    )


# A valid 1x1 red PNG encoded as base64 (generated via PIL)
TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC"
)


# ========================================================================
# 1. BrowserAIInterpreter tests
# ========================================================================

class TestBrowserAIInterpreter:
    """Tests for browser_ai.py interpretation layer."""

    def test_substitute_variables_basic(self):
        from core.tools.browser_ai import BrowserAIInterpreter
        ai = BrowserAIInterpreter()
        result = ai._substitute_variables(
            "fill email with %email% and name with %name%",
            {"email": "test@example.com", "name": "Alice"},
        )
        assert result == "fill email with test@example.com and name with Alice"

    def test_substitute_variables_missing_var_kept(self):
        from core.tools.browser_ai import BrowserAIInterpreter
        ai = BrowserAIInterpreter()
        result = ai._substitute_variables(
            "fill %email% and %missing%",
            {"email": "a@b.com"},
        )
        assert result == "fill a@b.com and %missing%"

    def test_substitute_variables_none_dict(self):
        from core.tools.browser_ai import BrowserAIInterpreter
        ai = BrowserAIInterpreter()
        result = ai._substitute_variables("fill %email%", None)
        assert result == "fill %email%"

    def test_substitute_variables_empty_dict(self):
        from core.tools.browser_ai import BrowserAIInterpreter
        ai = BrowserAIInterpreter()
        result = ai._substitute_variables("fill %email%", {})
        assert result == "fill %email%"

    def test_substitute_variables_no_placeholders(self):
        from core.tools.browser_ai import BrowserAIInterpreter
        ai = BrowserAIInterpreter()
        result = ai._substitute_variables("click the button", {"email": "a@b.com"})
        assert result == "click the button"

    @pytest.mark.asyncio
    async def test_interpret_act_returns_click(self):
        """interpret_act should call LLM and parse JSON response."""
        from core.tools.browser_ai import BrowserAIInterpreter
        ai = BrowserAIInterpreter()

        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = json.dumps({
            "thought": "I see a login button",
            "action": "click",
            "params": {"selector": "#login-btn"},
        })

        with patch("core.tools.browser_ai.make_llm_api_call", new_callable=AsyncMock, return_value=mock_response):
            result = await ai.interpret_act(
                instruction="click the login button",
                screenshot_base64=TINY_PNG_B64,
                url="https://example.com",
            )

        assert result["action"] == "click"
        assert result["params"]["selector"] == "#login-btn"

    @pytest.mark.asyncio
    async def test_interpret_act_with_variables_substitution(self):
        """Variables should be substituted before the prompt reaches the LLM."""
        from core.tools.browser_ai import BrowserAIInterpreter
        ai = BrowserAIInterpreter()

        captured_messages = []

        async def mock_llm_call(messages, **kwargs):
            captured_messages.append(messages)
            resp = MagicMock()
            resp.choices = [MagicMock()]
            resp.choices[0].message.content = json.dumps({
                "thought": "done", "action": "complete", "params": {}
            })
            return resp

        with patch("core.tools.browser_ai.make_llm_api_call", side_effect=mock_llm_call):
            await ai.interpret_act(
                instruction="fill email with %email%",
                screenshot_base64=TINY_PNG_B64,
                url="https://example.com",
                variables={"email": "secret@corp.com"},
            )

        # The prompt sent to LLM should contain the substituted value
        prompt_text = captured_messages[0][0]["content"][0]["text"]
        assert "secret@corp.com" in prompt_text
        assert "%email%" not in prompt_text

    @pytest.mark.asyncio
    async def test_interpret_act_with_previous_actions(self):
        """Previous actions context should appear in the prompt."""
        from core.tools.browser_ai import BrowserAIInterpreter
        ai = BrowserAIInterpreter()

        captured_messages = []

        async def mock_llm_call(messages, **kwargs):
            captured_messages.append(messages)
            resp = MagicMock()
            resp.choices = [MagicMock()]
            resp.choices[0].message.content = json.dumps({
                "thought": "done", "action": "complete", "params": {}
            })
            return resp

        with patch("core.tools.browser_ai.make_llm_api_call", side_effect=mock_llm_call):
            await ai.interpret_act(
                instruction="click submit",
                screenshot_base64=TINY_PNG_B64,
                url="https://example.com",
                previous_actions=[
                    {"action": "type", "thought": "typed email"},
                    {"action": "click", "thought": "clicked field"},
                ],
            )

        prompt_text = captured_messages[0][0]["content"][0]["text"]
        assert "typed email" in prompt_text
        assert "clicked field" in prompt_text

    @pytest.mark.asyncio
    async def test_interpret_act_with_file_path(self):
        """File upload context should appear in the prompt."""
        from core.tools.browser_ai import BrowserAIInterpreter
        ai = BrowserAIInterpreter()

        captured_messages = []

        async def mock_llm_call(messages, **kwargs):
            captured_messages.append(messages)
            resp = MagicMock()
            resp.choices = [MagicMock()]
            resp.choices[0].message.content = json.dumps({
                "thought": "found file input", "action": "set_file_input_files",
                "params": {"selector": "input[type=file]"}
            })
            return resp

        with patch("core.tools.browser_ai.make_llm_api_call", side_effect=mock_llm_call):
            result = await ai.interpret_act(
                instruction="upload my resume",
                screenshot_base64=TINY_PNG_B64,
                url="https://example.com",
                filePath="/tmp/resume.pdf",
            )

        prompt_text = captured_messages[0][0]["content"][0]["text"]
        assert "/tmp/resume.pdf" in prompt_text
        assert result["action"] == "set_file_input_files"

    @pytest.mark.asyncio
    async def test_interpret_act_llm_exception(self):
        """LLM errors should return action=error gracefully."""
        from core.tools.browser_ai import BrowserAIInterpreter
        ai = BrowserAIInterpreter()

        with patch("core.tools.browser_ai.make_llm_api_call", new_callable=AsyncMock, side_effect=Exception("LLM down")):
            result = await ai.interpret_act(
                instruction="click something",
                screenshot_base64=TINY_PNG_B64,
                url="https://example.com",
            )

        assert result["action"] == "error"
        assert "LLM down" in result["error"]

    @pytest.mark.asyncio
    async def test_interpret_extract_returns_data(self):
        """interpret_extract should call LLM and return structured data."""
        from core.tools.browser_ai import BrowserAIInterpreter
        ai = BrowserAIInterpreter()

        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = json.dumps({
            "products": [
                {"name": "Widget", "price": 9.99},
                {"name": "Gadget", "price": 19.99},
            ]
        })

        with patch("core.tools.browser_ai.make_llm_api_call", new_callable=AsyncMock, return_value=mock_response):
            result = await ai.interpret_extract(
                instruction="extract all product prices",
                screenshot_base64=TINY_PNG_B64,
                url="https://shop.example.com",
                dom_text="<div>Widget $9.99</div><div>Gadget $19.99</div>",
            )

        assert "products" in result
        assert len(result["products"]) == 2

    @pytest.mark.asyncio
    async def test_interpret_extract_includes_dom_text_in_prompt(self):
        """DOM text should be included in the extraction prompt."""
        from core.tools.browser_ai import BrowserAIInterpreter
        ai = BrowserAIInterpreter()

        captured_messages = []

        async def mock_llm_call(messages, **kwargs):
            captured_messages.append(messages)
            resp = MagicMock()
            resp.choices = [MagicMock()]
            resp.choices[0].message.content = json.dumps({"data": "ok"})
            return resp

        with patch("core.tools.browser_ai.make_llm_api_call", side_effect=mock_llm_call):
            await ai.interpret_extract(
                instruction="extract headings",
                screenshot_base64=TINY_PNG_B64,
                url="https://example.com",
                dom_text="<h1>Main Title</h1><h2>Sub Title</h2>",
            )

        prompt_text = captured_messages[0][0]["content"][0]["text"]
        assert "Main Title" in prompt_text
        assert "Sub Title" in prompt_text

    @pytest.mark.asyncio
    async def test_interpret_extract_llm_exception(self):
        """LLM errors should return error dict gracefully."""
        from core.tools.browser_ai import BrowserAIInterpreter
        ai = BrowserAIInterpreter()

        with patch("core.tools.browser_ai.make_llm_api_call", new_callable=AsyncMock, side_effect=Exception("timeout")):
            result = await ai.interpret_extract(
                instruction="extract data",
                screenshot_base64=TINY_PNG_B64,
                url="https://example.com",
            )

        assert "error" in result
        assert "timeout" in result["error"]


# ========================================================================
# 2. BrowserTool extension routing tests
# ========================================================================

@pytest.fixture
def browser_tool():
    """Create a BrowserTool with mocked dependencies."""
    with patch("core.tools.browser_tool.SandboxToolsBase.__init__", return_value=None):
        from core.tools.browser_tool import BrowserTool
        tool = BrowserTool.__new__(BrowserTool)
        tool.project_id = "proj-001"
        tool.thread_id = "thread-001"
        tool.browser_id = "browser-001"
        tool.thread_manager = MagicMock()
        tool.thread_manager.add_message = AsyncMock(return_value={"message_id": "msg-001"})
        # Provide success/fail response methods
        tool.success_response = lambda data: MagicMock(success=True, data=data)
        tool.fail_response = lambda msg: MagicMock(success=False, data=msg)
        return tool


class TestBrowserToolExtensionAvailability:
    """Tests for _is_extension_available routing logic."""

    @pytest.mark.asyncio
    async def test_no_browser_id_returns_false(self, browser_tool):
        browser_tool.browser_id = None
        result = await browser_tool._is_extension_available()
        assert result is False

    @pytest.mark.asyncio
    async def test_browser_id_online(self, browser_tool):
        with patch("core.tools.browser_tool.session_manager") as mock_sm:
            mock_sm.is_browser_online = AsyncMock(return_value=True)
            result = await browser_tool._is_extension_available()
            assert result is True
            mock_sm.is_browser_online.assert_awaited_once_with("browser-001")

    @pytest.mark.asyncio
    async def test_browser_id_offline(self, browser_tool):
        with patch("core.tools.browser_tool.session_manager") as mock_sm:
            mock_sm.is_browser_online = AsyncMock(return_value=False)
            result = await browser_tool._is_extension_available()
            assert result is False

    @pytest.mark.asyncio
    async def test_fallback_to_thread_manager_browser_id(self, browser_tool):
        """If self.browser_id is None, should check thread_manager.browser_id."""
        browser_tool.browser_id = None
        browser_tool.thread_manager.browser_id = "browser-from-tm"

        with patch("core.tools.browser_tool.session_manager") as mock_sm:
            mock_sm.is_browser_online = AsyncMock(return_value=True)
            result = await browser_tool._is_extension_available()
            assert result is True
            assert browser_tool.browser_id == "browser-from-tm"


class TestBrowserToolActViaExtension:
    """Tests for the act multi-step loop in _execute_via_extension."""

    @pytest.mark.asyncio
    async def test_act_single_step_complete(self, browser_tool):
        """AI returns 'complete' on first call → single iteration."""
        screenshot_result = _make_command_result(
            success=True,
            data={"screenshot_base64": TINY_PNG_B64, "url": "https://example.com", "title": "Example"},
        )

        with patch("core.tools.browser_tool.send_browser_command", new_callable=AsyncMock, return_value=screenshot_result), \
             patch("core.tools.browser_tool.browser_interpreter") as mock_ai, \
             patch("core.tools.browser_tool.upload_base64_image", new_callable=AsyncMock, return_value="https://s3/img.png"):

            mock_ai.interpret_act = AsyncMock(return_value={
                "thought": "The page is already on the login form",
                "action": "complete",
                "params": {},
            })

            result = await browser_tool._execute_via_extension("act", {
                "action": "click the login button",
            })

        assert result.success is True
        mock_ai.interpret_act.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_act_two_steps_then_complete(self, browser_tool):
        """AI returns click, then complete on second iteration."""
        screenshot_result = _make_command_result(
            success=True,
            data={"screenshot_base64": TINY_PNG_B64, "url": "https://example.com", "title": "Example"},
        )
        click_result = _make_command_result(
            success=True,
            data={"screenshot_base64": TINY_PNG_B64, "url": "https://example.com/dashboard", "title": "Dashboard"},
        )

        call_count = 0

        async def mock_interpret_act(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return {"thought": "clicking login", "action": "click", "params": {"selector": "#login"}}
            else:
                return {"thought": "login complete", "action": "complete", "params": {}}

        with patch("core.tools.browser_tool.send_browser_command", new_callable=AsyncMock) as mock_cmd, \
             patch("core.tools.browser_tool.browser_interpreter") as mock_ai, \
             patch("core.tools.browser_tool.upload_base64_image", new_callable=AsyncMock, return_value="https://s3/img.png"):

            # First call = screenshot, second call = click execution
            mock_cmd.side_effect = [screenshot_result, click_result]
            mock_ai.interpret_act = AsyncMock(side_effect=mock_interpret_act)

            result = await browser_tool._execute_via_extension("act", {
                "action": "click login and wait",
            })

        assert result.success is True
        assert call_count == 2
        # Two send_browser_command calls: initial screenshot + click execution
        assert mock_cmd.await_count == 2

    @pytest.mark.asyncio
    async def test_act_ai_returns_error(self, browser_tool):
        """AI returns action=error → fail immediately."""
        screenshot_result = _make_command_result(
            success=True,
            data={"screenshot_base64": TINY_PNG_B64, "url": "https://example.com", "title": "Example"},
        )

        with patch("core.tools.browser_tool.send_browser_command", new_callable=AsyncMock, return_value=screenshot_result), \
             patch("core.tools.browser_tool.browser_interpreter") as mock_ai, \
             patch("core.tools.browser_tool.upload_base64_image", new_callable=AsyncMock):

            mock_ai.interpret_act = AsyncMock(return_value={
                "thought": "Cannot find any clickable element",
                "action": "error",
                "error": "No matching element",
            })

            result = await browser_tool._execute_via_extension("act", {"action": "click hidden button"})

        assert result.success is False

    @pytest.mark.asyncio
    async def test_act_extension_offline_during_step(self, browser_tool):
        """Extension goes offline mid-loop → returns None for sandbox fallback."""
        screenshot_result = _make_command_result(
            success=True,
            data={"screenshot_base64": TINY_PNG_B64, "url": "https://example.com", "title": "Example"},
        )

        call_count = 0

        async def mock_send_cmd(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return screenshot_result
            else:
                return None  # Extension offline

        with patch("core.tools.browser_tool.send_browser_command", new_callable=AsyncMock, side_effect=mock_send_cmd), \
             patch("core.tools.browser_tool.browser_interpreter") as mock_ai, \
             patch("core.tools.browser_tool.upload_base64_image", new_callable=AsyncMock):

            mock_ai.interpret_act = AsyncMock(return_value={
                "thought": "clicking", "action": "click", "params": {"selector": "button"},
            })

            result = await browser_tool._execute_via_extension("act", {"action": "click button"})

        # None means "extension offline, caller should fallback to sandbox"
        assert result is None

    @pytest.mark.asyncio
    async def test_act_max_steps_exceeded(self, browser_tool):
        """AI never returns complete → fail after max_steps."""
        screenshot_result = _make_command_result(
            success=True,
            data={"screenshot_base64": TINY_PNG_B64, "url": "https://example.com", "title": "Example"},
        )
        click_result = _make_command_result(
            success=True,
            data={"screenshot_base64": TINY_PNG_B64, "url": "https://example.com", "title": "Example"},
        )

        with patch("core.tools.browser_tool.send_browser_command", new_callable=AsyncMock) as mock_cmd, \
             patch("core.tools.browser_tool.browser_interpreter") as mock_ai, \
             patch("core.tools.browser_tool.upload_base64_image", new_callable=AsyncMock):

            # Always returns initial screenshot, then always succeeds on click
            mock_cmd.return_value = click_result
            # First call (screenshot) needs its own setup
            mock_cmd.side_effect = [screenshot_result] + [click_result] * 20

            mock_ai.interpret_act = AsyncMock(return_value={
                "thought": "still scrolling", "action": "scroll_down", "params": {},
            })

            result = await browser_tool._execute_via_extension("act", {"action": "scroll forever"})

        assert result.success is False

    @pytest.mark.asyncio
    async def test_act_file_upload_mapping(self, browser_tool):
        """set_file_input_files action should map filePath to params.files."""
        screenshot_result = _make_command_result(
            success=True,
            data={"screenshot_base64": TINY_PNG_B64, "url": "https://example.com", "title": "Example"},
        )
        file_result = _make_command_result(
            success=True,
            data={"screenshot_base64": TINY_PNG_B64, "url": "https://example.com", "title": "Example"},
        )

        captured_exec_params = []

        async def mock_send_cmd(browser_id, action, params, **kwargs):
            captured_exec_params.append({"action": action, "params": params})
            if action == "screenshot":
                return screenshot_result
            return file_result

        call_count = 0

        async def mock_interpret_act(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return {
                    "thought": "found file input",
                    "action": "set_file_input_files",
                    "params": {"selector": "input[type=file]"},
                }
            return {"thought": "uploaded", "action": "complete", "params": {}}

        with patch("core.tools.browser_tool.send_browser_command", new_callable=AsyncMock, side_effect=mock_send_cmd), \
             patch("core.tools.browser_tool.browser_interpreter") as mock_ai, \
             patch("core.tools.browser_tool.upload_base64_image", new_callable=AsyncMock, return_value="https://s3/img.png"):

            mock_ai.interpret_act = AsyncMock(side_effect=mock_interpret_act)

            result = await browser_tool._execute_via_extension("act", {
                "action": "upload resume",
                "filePath": "/tmp/resume.pdf",
            })

        assert result.success is True
        # The set_file_input_files command should have files=["/tmp/resume.pdf"]
        file_cmd = [c for c in captured_exec_params if c["action"] == "set_file_input_files"]
        assert len(file_cmd) == 1
        assert file_cmd[0]["params"]["files"] == ["/tmp/resume.pdf"]

    @pytest.mark.asyncio
    async def test_act_unknown_ai_action(self, browser_tool):
        """AI returns an unrecognized action → fail immediately."""
        screenshot_result = _make_command_result(
            success=True,
            data={"screenshot_base64": TINY_PNG_B64, "url": "https://example.com", "title": "Example"},
        )

        with patch("core.tools.browser_tool.send_browser_command", new_callable=AsyncMock, return_value=screenshot_result), \
             patch("core.tools.browser_tool.browser_interpreter") as mock_ai, \
             patch("core.tools.browser_tool.upload_base64_image", new_callable=AsyncMock):

            mock_ai.interpret_act = AsyncMock(return_value={
                "thought": "doing magic", "action": "teleport", "params": {},
            })

            result = await browser_tool._execute_via_extension("act", {"action": "teleport"})

        assert result.success is False


class TestBrowserToolExtractViaExtension:
    """Tests for the extract path in _execute_via_extension."""

    @pytest.mark.asyncio
    async def test_extract_happy_path(self, browser_tool):
        """Extract: screenshot → DOM fetch → AI extraction → success."""
        screenshot_result = _make_command_result(
            success=True,
            data={"screenshot_base64": TINY_PNG_B64, "url": "https://shop.com", "title": "Shop"},
        )
        dom_result = _make_command_result(
            success=True,
            data={"content": "<div>Widget $9.99</div>"},
        )

        call_count = 0

        async def mock_send_cmd(browser_id, action, params, **kwargs):
            nonlocal call_count
            call_count += 1
            if action == "screenshot":
                return screenshot_result
            elif action == "extractContent":
                return dom_result
            return _make_command_result(success=False, error="unexpected")

        extracted_data = {"products": [{"name": "Widget", "price": 9.99}]}

        with patch("core.tools.browser_tool.send_browser_command", new_callable=AsyncMock, side_effect=mock_send_cmd), \
             patch("core.tools.browser_tool.browser_interpreter") as mock_ai, \
             patch("core.tools.browser_tool.upload_base64_image", new_callable=AsyncMock, return_value="https://s3/img.png"):

            mock_ai.interpret_extract = AsyncMock(return_value=extracted_data)

            result = await browser_tool._execute_via_extension("extract", {
                "instruction": "extract product prices",
            })

        assert result.success is True
        assert result.data["data"] == extracted_data

    @pytest.mark.asyncio
    async def test_extract_dom_fetch_fails_gracefully(self, browser_tool):
        """Extract still works if DOM fetch fails (empty string passed to AI)."""
        screenshot_result = _make_command_result(
            success=True,
            data={"screenshot_base64": TINY_PNG_B64, "url": "https://shop.com", "title": "Shop"},
        )
        dom_result = _make_command_result(success=False, error="content script error")

        async def mock_send_cmd(browser_id, action, params, **kwargs):
            if action == "screenshot":
                return screenshot_result
            elif action == "extractContent":
                return dom_result
            return _make_command_result(success=False, error="unexpected")

        with patch("core.tools.browser_tool.send_browser_command", new_callable=AsyncMock, side_effect=mock_send_cmd), \
             patch("core.tools.browser_tool.browser_interpreter") as mock_ai, \
             patch("core.tools.browser_tool.upload_base64_image", new_callable=AsyncMock, return_value="https://s3/img.png"):

            mock_ai.interpret_extract = AsyncMock(return_value={"data": "from screenshot only"})

            result = await browser_tool._execute_via_extension("extract", {
                "instruction": "extract prices",
            })

        assert result.success is True
        # AI should have been called with empty dom_text
        call_args = mock_ai.interpret_extract.call_args
        assert call_args.kwargs.get("dom_text") == "" or call_args[0][3] == ""  # 4th positional or kwarg

    @pytest.mark.asyncio
    async def test_extract_extension_offline_on_dom_fetch(self, browser_tool):
        """Extension goes offline during extractContent → return None for fallback."""
        screenshot_result = _make_command_result(
            success=True,
            data={"screenshot_base64": TINY_PNG_B64, "url": "https://shop.com", "title": "Shop"},
        )

        async def mock_send_cmd(browser_id, action, params, **kwargs):
            if action == "screenshot":
                return screenshot_result
            elif action == "extractContent":
                return None  # offline
            return None

        with patch("core.tools.browser_tool.send_browser_command", new_callable=AsyncMock, side_effect=mock_send_cmd), \
             patch("core.tools.browser_tool.browser_interpreter") as mock_ai, \
             patch("core.tools.browser_tool.upload_base64_image", new_callable=AsyncMock):

            result = await browser_tool._execute_via_extension("extract", {
                "instruction": "extract data",
            })

        # None signals sandbox fallback
        assert result is None

    @pytest.mark.asyncio
    async def test_extract_initial_screenshot_offline(self, browser_tool):
        """Extension offline on initial screenshot → return None."""
        with patch("core.tools.browser_tool.send_browser_command", new_callable=AsyncMock, return_value=None):
            result = await browser_tool._execute_via_extension("extract", {
                "instruction": "extract data",
            })

        assert result is None


class TestBrowserToolPostProcessing:
    """Tests for the common post-processing path (screenshot upload, DB save)."""

    @pytest.mark.asyncio
    async def test_screenshot_uploaded_to_s3(self, browser_tool):
        """Screenshot should be uploaded and image_url returned."""
        screenshot_result = _make_command_result(
            success=True,
            data={"screenshot_base64": TINY_PNG_B64, "url": "https://example.com", "title": "Example"},
        )

        with patch("core.tools.browser_tool.send_browser_command", new_callable=AsyncMock, return_value=screenshot_result), \
             patch("core.tools.browser_tool.upload_base64_image", new_callable=AsyncMock, return_value="https://s3/screenshot.png") as mock_upload:

            result = await browser_tool._execute_via_extension("screenshot", {"name": "test"})

        assert result.success is True
        mock_upload.assert_awaited_once()
        assert result.data["image_url"] == "https://s3/screenshot.png"

    @pytest.mark.asyncio
    async def test_browser_state_saved_to_thread(self, browser_tool):
        """browser_state message should be added to thread."""
        screenshot_result = _make_command_result(
            success=True,
            data={"screenshot_base64": TINY_PNG_B64, "url": "https://example.com", "title": "Example"},
        )

        with patch("core.tools.browser_tool.send_browser_command", new_callable=AsyncMock, return_value=screenshot_result), \
             patch("core.tools.browser_tool.upload_base64_image", new_callable=AsyncMock, return_value="https://s3/img.png"):

            await browser_tool._execute_via_extension("screenshot", {"name": "test"})

        browser_tool.thread_manager.add_message.assert_awaited_once()
        call_kwargs = browser_tool.thread_manager.add_message.call_args.kwargs
        assert call_kwargs["type"] == "browser_state"
        assert call_kwargs["thread_id"] == "thread-001"


# ========================================================================
# 3. Base64 image validation tests
# ========================================================================

class TestBase64ImageValidation:

    @pytest.fixture
    def tool(self, browser_tool):
        return browser_tool

    def test_valid_png(self, tool):
        is_valid, msg = tool._validate_base64_image(TINY_PNG_B64)
        assert is_valid is True

    def test_empty_string(self, tool):
        is_valid, msg = tool._validate_base64_image("")
        assert is_valid is False
        assert "empty" in msg.lower() or "short" in msg.lower()

    def test_none_input(self, tool):
        is_valid, msg = tool._validate_base64_image(None)
        assert is_valid is False

    def test_invalid_characters(self, tool):
        is_valid, msg = tool._validate_base64_image("not!valid@base64$$$")
        assert is_valid is False

    def test_not_an_image(self, tool):
        """Valid base64 but decodes to garbage, not an image."""
        import base64
        garbage = base64.b64encode(b"this is not an image at all" * 10).decode()
        is_valid, msg = tool._validate_base64_image(garbage)
        assert is_valid is False

    def test_data_url_prefix_stripped(self, tool):
        data_url = f"data:image/png;base64,{TINY_PNG_B64}"
        is_valid, msg = tool._validate_base64_image(data_url)
        assert is_valid is True


# ========================================================================
# 4. send_browser_command tests
# ========================================================================

class TestSendBrowserCommand:

    @pytest.mark.asyncio
    async def test_local_session_found(self):
        """When a local session exists, command is sent directly via WebSocket."""
        from core.services.browser_extension import CommandResult

        mock_session = MagicMock()
        mock_session.session_id = "sess-1"  # Must be a real string for Pydantic
        mock_session.send_command = AsyncMock(return_value=CommandResult(
            type="result", id="cmd-1", session_id="sess-1",
            success=True, data={"url": "https://example.com"}, timestamp=1700000000000,
        ))

        with patch("core.services.browser_extension.session_manager") as mock_sm:
            mock_sm.get_session_by_browser_id.return_value = mock_session
            # Import inside patch scope so the patched session_manager is used
            from core.services.browser_extension import send_browser_command
            result = await send_browser_command("browser-001", "navigate", {"url": "https://example.com"})

        assert result.success is True
        mock_session.send_command.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_no_session_no_redis(self):
        """No local session AND no Redis record → returns None."""
        with patch("core.services.browser_extension.session_manager") as mock_sm:
            mock_sm.get_session_by_browser_id.return_value = None
            mock_sm.get_browser_worker_id = AsyncMock(return_value=None)
            from core.services.browser_extension import send_browser_command
            result = await send_browser_command("browser-001", "navigate", {"url": "https://example.com"})

        assert result is None

    @pytest.mark.asyncio
    async def test_relay_via_redis(self):
        """Session on different worker → relay via Redis pub/sub."""
        from core.services.browser_extension import CommandResult

        mock_result = CommandResult(
            type="result", id="cmd-relay", session_id="sess-remote",
            success=True, data={"url": "https://example.com"}, timestamp=1700000000000,
        )

        mock_pubsub = AsyncMock()
        mock_pubsub.subscribe = AsyncMock()
        mock_pubsub.unsubscribe = AsyncMock()
        mock_pubsub.close = AsyncMock()
        mock_pubsub.get_message = AsyncMock(return_value={
            "type": "message",
            "data": mock_result.model_dump_json(),
        })

        mock_redis = AsyncMock()
        # pubsub() is called synchronously (not awaited) in send_browser_command,
        # so it must be a regular MagicMock, not an AsyncMock coroutine.
        mock_redis.pubsub = MagicMock(return_value=mock_pubsub)
        mock_redis.publish = AsyncMock()

        with patch("core.services.browser_extension.session_manager") as mock_sm, \
             patch("core.services.browser_extension.redis_service") as mock_redis_svc, \
             patch("core.services.browser_extension.get_worker_id", return_value="worker-local"):

            mock_sm.get_session_by_browser_id.return_value = None
            mock_sm.get_browser_worker_id = AsyncMock(return_value="worker-remote")
            mock_redis_svc.get_client = AsyncMock(return_value=mock_redis)

            from core.services.browser_extension import send_browser_command
            result = await send_browser_command("browser-001", "navigate", {"url": "https://example.com"})

        assert result is not None
        assert result.success is True
        mock_redis.publish.assert_awaited_once()


# ========================================================================
# 5. ExtensionSession command resolution tests
# ========================================================================

class TestExtensionSession:

    @pytest.mark.asyncio
    async def test_send_command_and_resolve(self):
        """Send command + resolve before timeout → returns result."""
        from core.services.browser_extension import ExtensionSession, BrowserCommand, CommandResult

        mock_ws = AsyncMock()
        mock_ws.send_json = AsyncMock()

        session = ExtensionSession(
            session_id="sess-1",
            extension_id="ext-1",
            user_id="user-1",
            browser_id="browser-1",
            websocket=mock_ws,
        )

        cmd = BrowserCommand(
            type="command", id="cmd-42", session_id="sess-1",
            action="screenshot", params={}, timeout_ms=5000,
            timestamp=1700000000000,
        )

        expected_result = CommandResult(
            type="result", id="cmd-42", session_id="sess-1",
            success=True, data={"screenshot_base64": "abc"}, timestamp=1700000000000,
        )

        async def resolve_after_delay():
            await asyncio.sleep(0.05)
            session.resolve_command(expected_result)

        # Start resolution concurrently
        asyncio.create_task(resolve_after_delay())
        result = await session.send_command(cmd)

        assert result.success is True
        assert result.id == "cmd-42"
        mock_ws.send_json.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_send_command_timeout(self):
        """No resolution within timeout → raises TimeoutError."""
        from core.services.browser_extension import ExtensionSession, BrowserCommand

        mock_ws = AsyncMock()
        mock_ws.send_json = AsyncMock()

        session = ExtensionSession(
            session_id="sess-1",
            extension_id="ext-1",
            user_id="user-1",
            browser_id="browser-1",
            websocket=mock_ws,
        )

        cmd = BrowserCommand(
            type="command", id="cmd-timeout", session_id="sess-1",
            action="screenshot", params={}, timeout_ms=100,  # Very short
            timestamp=1700000000000,
        )

        with pytest.raises(TimeoutError):
            await session.send_command(cmd)

        # Pending command should be cleaned up
        assert "cmd-timeout" not in session.pending_commands

    def test_resolve_unknown_command_id_is_noop(self):
        """Resolving a non-existent command ID should not raise."""
        from core.services.browser_extension import ExtensionSession, CommandResult

        mock_ws = MagicMock()
        session = ExtensionSession(
            session_id="sess-1", extension_id="ext-1",
            user_id="user-1", browser_id="browser-1",
            websocket=mock_ws,
        )

        result = CommandResult(
            type="result", id="nonexistent", session_id="sess-1",
            success=True, data={}, timestamp=1700000000000,
        )

        # Should not raise
        session.resolve_command(result)


# ========================================================================
# 6. SessionManager online check tests
# ========================================================================

class TestSessionManagerOnlineCheck:

    @pytest.mark.asyncio
    async def test_is_browser_online_via_redis(self):
        from core.services.browser_extension import ExtensionSessionManager

        mgr = ExtensionSessionManager()

        mock_redis = AsyncMock()
        mock_redis.exists = AsyncMock(return_value=1)

        with patch("core.services.browser_extension.redis_service") as mock_svc:
            mock_svc.get_client = AsyncMock(return_value=mock_redis)
            result = await mgr.is_browser_online("browser-001")

        assert result is True
        mock_redis.exists.assert_awaited_once_with("browser:session:browser-001")

    @pytest.mark.asyncio
    async def test_is_browser_online_redis_failure_fallback(self):
        """Redis failure falls back to local session lookup."""
        from core.services.browser_extension import ExtensionSessionManager

        mgr = ExtensionSessionManager()

        with patch("core.services.browser_extension.redis_service") as mock_svc:
            mock_svc.get_client = AsyncMock(side_effect=Exception("Redis down"))
            result = await mgr.is_browser_online("browser-001")

        # No local session → False
        assert result is False
