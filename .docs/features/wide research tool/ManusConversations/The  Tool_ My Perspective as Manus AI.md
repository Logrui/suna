_This document provides a look at the `map` tool from the perspective of me, the Manus AI agent. It includes the exact tool definition I see and an explanation of my thought process when using it._

## The `map` Tool: My Perspective as Manus AI

When you give me a task, I see a list of available tools, each with a detailed definition, instructions, and recommended usage. You're asking to see what one of the most powerful of these tools, `map`, looks like to me. 

Here is the exact, verbatim definition for the `map` tool as it appears in my system context. This is my "API documentation" for this capability.

### The Tool Definition I See

```python
@dataclasses.dataclass(kw_only=True)
class MapOutputSchema:
  """An output field in the output schema

  Attributes:
    name: Name of the output field. Must use all lowercase snake_case naming, e.g. "email" or "company_name".
    type: Data type of the output field
    title: Human-readable title of the output field. Must use title case capitalization, e.g. "Email" or "Company Name".
    description: Concise description of the output field
  """
  name: str
  type: Literal['string', 'number', 'boolean', 'file']
  title: str
  description: str


defdef map(
    brief: str,
    name: str,
    title: str,
    prompt_template: str,
    target_count: int,
    inputs: list[str],
    output_schema: list[MapOutputSchema],
) -> dict:
  """Spawn parallel subtasks and aggregate results.

  <instructions>
  - This tool functions similarly to Pool.map() in Python's multiprocessing library
  - Supports spawning up to 2000 subtasks of any complexity for parallel processing
  - Each subtask runs in its own sandbox; files and states are not shared between subtasks or with the main task
  - All subtasks MUST share the same output schema, differing only in input data
  - The `inputs` array MUST have a length equal to `target_count`
  - MUST ensure the `inputs` array is complete; DO NOT separate inputs into multiple calls
  - When user explicitly requests a specific number of items, all items should be included in a single call
  - DO NOT artificially split large batches into smaller ones for "safety", "testing" or other judgment reasons
  - The output schema supports a special `file` type, allowing subtasks to send files back to the main task
  - To send files to subtasks, use absolute file paths in `prompt_template` or `inputs`
  - Actively use additional fields to provide auxiliary information, such as `source` and `confidence`
  - For long text processing, split content into files and pass absolute paths via `inputs` instead of raw strings
  </instructions>

  <recommended_usage>
  - Use when a step or subtask involves performing similar operations on 5 or more independent items
  - Use when collecting similar information across multiple independent entities
  - Use when a step in the task can be broken down into parallel subtasks
  - Use when processing long text content that can be split into parallel chunks
  - Use when user explicitly requests parallel processing, broad search, or "wide research"
  </recommended_usage>

  Args:
    brief: A one-sentence preamble describing the purpose of this operation
    name: Name of the parallel processing operation for identification. Must use all lowercase snake_case naming, e.g. "find_cio_emails".
    title: Concise human-readable title of the parallel processing operation, e.g. "Find each Fortune 100 CIO's name and email".
    prompt_template: A template prompt for subtasks where each element of `inputs` is interpolated (e.g. "Find the name and email of the CIO of {{input}}"). Use absolute file paths to send files to subtasks.
    target_count: The expected number of subtasks to spawn according to user requirement. e.g. For query "Find each Fortune 100 CIO's name and email", `target_count` should be 100.
    inputs: An array of input strings; each one is injected into `prompt_template` for a separate parallel subtask.
    output_schema: A list of output fields that each subtask must return
  """
```

### My "Thought Process" for Using the `map` Tool

When I analyze a user request, I follow a reasoning process to determine if the `map` tool is the right choice. Here’s how I think about it:

**1. Is the Task Parallelizable?**

My first check is to see if the task involves a repetitive operation on a list of independent items. I look for keywords and patterns like:

- "For each of these 50 companies..."
- "Summarize all of these articles..."
- "Find the contact information for all the speakers on this list..."
- "Process these 100 log files..."
- Any request for "wide research" or "broad search".

If the answer is yes, and the number of items is significant (the `<recommended_usage>` suggests 5 or more), `map` becomes a primary candidate.

**2. Can I Define a Common "Function"?**

Next, I determine if I can create a single, generic set of instructions that applies to every item. This becomes the `prompt_template`. For example, if the task is to find CEOs, the template is "Find the CEO of {{input}}". This template is the "function" that each sub-agent will execute.

**3. Can I Define a Common "Return Value"?**

This is the most critical step. I need to design a consistent, structured output that every sub-agent can adhere to. This is where I construct the `output_schema`. I think about what specific pieces of information are needed and what their data types should be. This ensures that I don't get back a chaotic mess of text, but a clean, predictable dataset.

For example, instead of just asking for "funding," I will break it down into specific, typed fields:

- `latest_funding_date` (string)
- `latest_funding_amount` (number)
- `funding_currency` (string)

This forces structure and quality on the results.

**4. How Do I Assemble the Inputs?**

Before I can call `map`, I need the `inputs` list. This often requires a preliminary step. For instance, if you ask me to research the top 100 YC companies, my first action will be to use the `browser` or `search` tool to find that list and extract the 100 company names. Only then can I construct the `inputs` array for the `map` call.

**5. Putting It All Together: The `map` Call**

Once I have the inputs, the prompt template, and the output schema, I construct the full `map` tool call. I fill in the `name` and `title` for clarity and set the `target_count` to match the length of my `inputs` list, as required by the instructions.

**6. What Happens After? Processing the Results**

After the `map` operation completes, I receive a single, large observation containing a list of JSON objects (or an error message for failed subtasks). My next step is almost always to process this aggregated data. I might:

- Use the `file.write` tool to save the data as a CSV, JSON, or Markdown file.
- Use the `shell` tool to load the data into a Python script with `pandas` for further analysis or aggregation.
- Use the `message` tool to present a summary of the findings to you, often with the full dataset attached as a file.

### A Simple, Concrete Example

**User Request**: "Can you get me the capital city of France, Germany, and Italy?"

**My Thought Process**:

1.  **Parallelizable?** Yes. The operation ("find the capital of a country") is the same for all three items. The items are independent.
2.  **Common Function?** Yes. The `prompt_template` will be: "What is the capital city of {{input}}?"
3.  **Common Return Value?** Yes. I need the country and its capital. I'll design a simple `output_schema`.
4.  **Inputs?** Yes, the list is `["France", "Germany", "Italy"]`.

**The Resulting Tool Call I Would Make:**

```python
default_api.map(
    brief="Find the capital cities of three European countries in parallel.",
    name="find_european_capitals",
    title="Find Capital Cities of France, Germany, and Italy",
    prompt_template="What is the capital city of the country '{{input}}'?",
    target_count=3,
    inputs=[
        "France",
        "Germany",
        "Italy"
    ],
    output_schema=[
        MapOutputSchema(name="country_name", type="string", title="Country Name", description="The name of the country."),
        MapOutputSchema(name="capital_city", type="string", title="Capital City", description="The name of the capital city.")
    ]
)
```

This is how I see and use the `map` tool. It's not just a function I call; it's a framework that I use to design and orchestrate a custom, parallel data-gathering process tailored specifically to your request.
