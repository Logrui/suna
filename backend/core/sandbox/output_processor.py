"""
Output Processor for PTY Sessions

Handles cleaning, parsing, and detecting patterns in terminal output.
Based on Agent Zero's output processing logic.
"""

import re
from typing import Optional


class OutputProcessor:
    """
    Process and analyze terminal output from PTY sessions.

    Features:
    - ANSI escape code removal
    - Shell prompt detection
    - Dialog/prompt detection (Y/N, password, etc.)
    - Output normalization
    """

    # Patterns for detecting shell prompts (command completed)
    PROMPT_PATTERNS = [
        re.compile(r'\(venv\).+[$#]\s*$'),                      # (venv) user@host:~$
        re.compile(r'root@[^:]+:[^#]+#\s*$'),                   # root@container:~#
        re.compile(r'[a-zA-Z0-9_.-]+@[^:]+:[^$#]+[$#]\s*$'),   # user@host:~$
        re.compile(r'\(?.*\)?\s*PS\s+[^>]+>\s*$'),             # PowerShell >
        re.compile(r'>>>\s*$'),                                 # Python REPL >>>
        re.compile(r'\.\.\.\s*$'),                              # Python continuation ...
    ]

    # Patterns for detecting interactive dialogs (waiting for user input)
    DIALOG_PATTERNS = [
        re.compile(r'Y/N', re.IGNORECASE),          # [Y/n] prompts
        re.compile(r'yes/no', re.IGNORECASE),       # yes/no prompts
        re.compile(r':\s*$'),                       # Lines ending with colon (password:)
        re.compile(r'\?\s*$'),                      # Questions
        re.compile(r'\[Y/n\]', re.IGNORECASE),      # Explicit [Y/n]
        re.compile(r'\(y/n\)', re.IGNORECASE),      # (y/n)
        re.compile(r'continue\?', re.IGNORECASE),   # "Do you want to continue?"
    ]

    @staticmethod
    def clean_ansi(text: str) -> str:
        """
        Remove ANSI escape codes from text.

        Args:
            text: Raw terminal output with ANSI codes

        Returns:
            Clean text without ANSI codes
        """
        if not text:
            return ""

        # Remove ANSI escape codes
        ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
        cleaned = ansi_escape.sub('', text)

        # Remove null bytes
        cleaned = cleaned.replace('\x00', '')

        # Remove ipython \r\r\n> sequences from the start
        cleaned = re.sub(r'^[ \r]*(?:\r*\n>[ \r]*)*', '', cleaned)

        # Also remove any amount of '> ' sequences from the start
        cleaned = re.sub(r'^(>\s*)+', '', cleaned)

        # Replace '\r\n' with '\n'
        cleaned = cleaned.replace('\r\n', '\n')

        # Remove leading \r and spaces
        cleaned = cleaned.lstrip('\r ')

        # Handle carriage returns within lines
        lines = cleaned.split('\n')
        processed_lines = []

        for line in lines:
            # Handle carriage returns by splitting and taking the last part
            parts = [part for part in line.split('\r') if part.strip()]
            if parts:
                processed_lines.append(parts[-1].rstrip())
            else:
                processed_lines.append('')

        return '\n'.join(processed_lines)

    @staticmethod
    def detect_prompt(output: str) -> bool:
        """
        Detect if output contains a shell prompt (command completed).

        Checks the last 3 lines for common shell prompt patterns.

        Args:
            output: Terminal output to check

        Returns:
            True if prompt detected, False otherwise
        """
        if not output:
            return False

        # Check last 3 lines for prompt patterns
        lines = output.splitlines()[-3:]

        for line in lines:
            line_stripped = line.strip()
            if not line_stripped:
                continue

            for pattern in OutputProcessor.PROMPT_PATTERNS:
                if pattern.search(line_stripped):
                    return True

        return False

    @staticmethod
    def detect_dialog(output: str) -> bool:
        """
        Detect if output contains an interactive prompt waiting for input.

        Checks the last 2 lines for dialog patterns like Y/N, password:, etc.

        Args:
            output: Terminal output to check

        Returns:
            True if dialog detected, False otherwise
        """
        if not output:
            return False

        # Check last 2 lines for dialog patterns
        lines = output.splitlines()[-2:]

        for line in lines:
            line_stripped = line.strip()
            if not line_stripped:
                continue

            for pattern in OutputProcessor.DIALOG_PATTERNS:
                if pattern.search(line_stripped):
                    return True

        return False

    @staticmethod
    def extract_error(output: str) -> Optional[str]:
        """
        Extract error messages from output.

        Looks for common error indicators and extracts the error message.

        Args:
            output: Terminal output

        Returns:
            Error message if found, None otherwise
        """
        if not output:
            return None

        error_indicators = [
            'Error:',
            'error:',
            'ERROR:',
            'Exception:',
            'Traceback',
            'Failed:',
            'fatal:',
        ]

        lines = output.splitlines()

        for i, line in enumerate(lines):
            for indicator in error_indicators:
                if indicator in line:
                    # Return this line and next 2 lines as error context
                    error_lines = lines[i:i+3]
                    return '\n'.join(error_lines)

        return None

    @staticmethod
    def normalize_output(output: str) -> str:
        """
        Normalize output by cleaning ANSI codes and formatting.

        This is the main entry point for output processing.

        Args:
            output: Raw terminal output

        Returns:
            Cleaned and normalized output
        """
        if not output:
            return ""

        # Clean ANSI codes
        cleaned = OutputProcessor.clean_ansi(output)

        # Remove excessive blank lines (more than 2 consecutive)
        cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)

        # Strip trailing whitespace from each line
        lines = [line.rstrip() for line in cleaned.splitlines()]

        return '\n'.join(lines)

    @staticmethod
    def get_command_status(output: str) -> dict:
        """
        Analyze output and determine command execution status.

        Returns a dict with status information:
        - completed: bool - command finished executing
        - waiting_input: bool - waiting for user input
        - has_error: bool - output contains error
        - error_message: str - extracted error message if any

        Args:
            output: Terminal output to analyze

        Returns:
            Dict with status information
        """
        has_prompt = OutputProcessor.detect_prompt(output)
        has_dialog = OutputProcessor.detect_dialog(output)
        error_msg = OutputProcessor.extract_error(output)

        return {
            "completed": has_prompt and not has_dialog,
            "waiting_input": has_dialog,
            "has_error": error_msg is not None,
            "error_message": error_msg
        }
