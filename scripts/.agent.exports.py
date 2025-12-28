"""
.agent.exports.py - Antigravity to Gemini CLI Workflow Converter
=================================================================

Converts Antigravity IDE workflow files (.agent/workflows/*.md) into 
Gemini CLI custom command files (.gemini/commands/*.toml).

This enables workflows defined for Antigravity to be reused as slash 
commands in the Gemini CLI.

Usage:
------
    python .agent.exports.py

    Run from the scripts/ directory. The script will:
    1. Scan all .md files in ../.agent/workflows/
    2. Parse YAML frontmatter for description metadata
    3. Transform the markdown body for Gemini CLI compatibility
    4. Output .toml command files to ../.gemini/commands/

Input Format (Antigravity workflow .md):
----------------------------------------
    ---
    description: Short description of the command
    ---
    
    # Workflow instructions...
    
    ```text
    $ARGUMENTS
    ```

Output Format (Gemini CLI .toml):
---------------------------------
    description = "Short description of the command"
    prompt = \"\"\"
    # Workflow instructions...
    
    ```text
    {{args}}
    ```
    \"\"\"

Transformations Applied:
------------------------
    - $ARGUMENTS placeholders → {{args}} (Gemini template syntax)
    - check-prerequisites.ps1 commands → wrapped in !{ } for execution
    - Auto-appends ## Context section with {{args}} if not present

Dependencies:
-------------
    pip install pyyaml

Author: Suna Kortix Team
"""

import os
import glob
import yaml

INPUT_ROOT = "../.agent/workflows"
OUTPUT_ROOT = "../.gemini/commands"


def escape_toml_string(s: str) -> str:
    if not s:
        return ""
    return s.replace("\\", "\\\\").replace('"', '\\"')


def transform_antigravity_body_to_gemini_prompt(body: str) -> str:
    """
    - Replace $ARGUMENTS blocks with {{args}} (and track if present).
    - Wrap the check-prerequisites.ps1 command in !{ ... } so it executes.
    - If no $ARGUMENTS block was found, append a '## Context\n\n{{args}}' section.
    """
    lines = body.splitlines()
    output_lines = []
    in_args_block = False
    saw_args_block = False

    fence = "`" * 3  # avoids literal ```

    for line in lines:
        stripped = line.strip()

        # Detect the fenced code block starting the arguments block
        if (not in_args_block
                and stripped.startswith(fence)
                and "text" in stripped):
            output_lines.append(line)  # keep opening fence
            in_args_block = True
            continue

        if in_args_block:
            # Closing fence ends the block
            if stripped.startswith(fence):
                output_lines.append(line)
                in_args_block = False
                continue

            if "$ARGUMENTS" in line:
                output_lines.append("{{args}}")
                saw_args_block = True
            else:
                output_lines.append(line)
            continue

        # Wrap the specific PowerShell command in !{ ... }
        if "check-prerequisites.ps1" in line and "!{" not in line:
            indent = line[: len(line) - len(line.lstrip())]
            cmd = line.strip()
            output_lines.append(f"{indent}!{{ {cmd} }}")
            continue

        output_lines.append(line)

    prompt_body = "\n".join(output_lines).strip()

    # If no $ARGUMENTS block was present, add a Context section using {{args}}
    if not saw_args_block and "{{args}}" not in prompt_body:
        prompt_body += "\n\n## Context\n\n{{args}}"

    return prompt_body


def convert_workflows(input_root=INPUT_ROOT, output_root=OUTPUT_ROOT):
    os.makedirs(output_root, exist_ok=True)
    file_count = 0

    for root, _, files in os.walk(input_root):
        for file in files:
            if not file.endswith(".md"):
                continue

            input_path = os.path.join(root, file)

            rel_dir = os.path.relpath(root, input_root)
            output_dir = output_root if rel_dir == "." else os.path.join(output_root, rel_dir)
            os.makedirs(output_dir, exist_ok=True)

            command_name = os.path.splitext(file)[0]  # Get filename without extension

            with open(input_path, "r", encoding="utf-8") as f:
                content = f.read()

            description = "Custom workflow command"
            body = content

            # Parse YAML frontmatter
            if content.startswith("---"):
                parts = content.split("---", 2)
                if len(parts) >= 3:
                    frontmatter_raw = parts[1]
                    body = parts[2].strip()  # Strip the body content after frontmatter
                    try:
                        meta = yaml.safe_load(frontmatter_raw) or {}
                        if isinstance(meta, dict) and "description" in meta:
                            description = str(meta["description"])
                    except Exception as e:
                        print(f"Warning: failed to parse frontmatter for {input_path}: {e}")

            prompt_body = transform_antigravity_body_to_gemini_prompt(body)

            safe_description = escape_toml_string(description)
            safe_prompt = prompt_body.replace('"""', '\\"\\"\\"')

            toml_content = f'''description = "{safe_description}"
            prompt = \"\"\" 
            {safe_prompt}
            \"\"\" 
            '''

            output_path = os.path.join(output_dir, f"{command_name}.toml")
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(toml_content)

            if rel_dir == ".":
                ns = ""
            else:
                ns = rel_dir.replace(os.sep, ":") + ":"
            print(f"converted: {input_path} -> /{ns}{command_name}")
            file_count += 1

    print(f"\nSuccess! Converted {file_count} workflows into {output_root}")
    print("Restart Gemini CLI to load new commands.")


if __name__ == "__main__":
    convert_workflows()