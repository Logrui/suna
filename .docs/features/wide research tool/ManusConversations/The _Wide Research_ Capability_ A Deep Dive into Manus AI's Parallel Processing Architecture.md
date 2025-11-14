_This document provides a deep dive into the "wide research" capability of Manus AI, which is powered by the `map` tool for parallel processing. It explains the architecture, workflow, and benefits of this powerful feature._

## The "Wide Research" Capability: A Deep Dive into Manus AI's Parallel Processing Architecture

The term "wide research" in the context of Manus AI refers to the ability to conduct broad, parallel investigations across a large number of similar topics simultaneously. Instead of researching items one by one (sequentially), Manus can spawn hundreds or even thousands of independent sub-agents, each tackling a small piece of the larger research goal. This capability is not a single tool but an emergent strategy built upon the foundation of the `map` tool.

## The `map` Tool: The Engine of Parallelism

The `map` tool is the core enabler of wide research. It functions similarly to the `Pool.map()` concept in multiprocessing libraries, applying the same operation to a list of different inputs. Its purpose is to take a large, repetitive task and break it down into independent, parallel subtasks.

### `map` Tool Parameters

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `name` | `string` | An internal name for the operation (e.g., `find_ceo_emails`). |
| `title` | `string` | A human-readable title for the operation. |
| `prompt_template` | `string` | A template for the subtask's prompt. It must contain `{{input}}` where each input value will be injected. |
| `target_count` | `int` | The total number of subtasks to spawn. Must match the length of the `inputs` array. |
| `inputs` | `list[string]` | An array of input strings, one for each subtask. |
| `output_schema` | `list[object]` | A structured schema defining the exact fields and data types that each subtask **must** return. This enforces consistency. |

## The Wide Research Workflow

A typical wide research task follows a three-stage process: **Fan-Out**, **Execute in Parallel**, and **Fan-In**.

Let's illustrate this with a concrete example.

**Goal**: "Find the CEO, headquarters location, and latest funding round for the top 50 companies in the Y Combinator Top Companies list."

### Stage 1: Fan-Out (Preparation in the Main Task)

First, the main agent prepares the inputs for the parallel subtasks.

1.  **Gather Inputs**: The agent uses the `browser` or `search` tool to find the "Y Combinator Top Companies" list and extracts the names of the top 50 companies.
2.  **Define the Schema**: The agent defines the structure of the data it wants to collect for each company.
3.  **Invoke `map`**: The agent calls the `map` tool to spawn 50 parallel sub-agents.

**Example `map` tool call:**

```python
default_api.map(
    brief="Gather CEO, HQ, and funding info for 50 YC companies in parallel.",
    name="gather_yc_company_info",
    title="Gather Information on Top 50 YC Companies",
    prompt_template="For the company '{{input}}', find the current CEO, the city and country of its headquarters, and the date and amount of its latest funding round. Cite your sources.",
    target_count=50,
    inputs=[
        "Stripe",
        "Instacart",
        "Coinbase",
        # ... 47 more company names
    ],
    output_schema=[
        MapOutputSchema(name="company_name", type="string", title="Company Name", description="The name of the company."),
        MapOutputSchema(name="ceo_name", type="string", title="CEO Name", description="The full name of the current CEO."),
        MapOutputSchema(name="hq_location", type="string", title="HQ Location", description="The city and country of the headquarters."),
        MapOutputSchema(name="latest_funding_date", type="string", title="Latest Funding Date", description="The date of the latest funding round (YYYY-MM-DD)."),
        MapOutputSchema(name="latest_funding_amount", type="string", title="Latest Funding Amount", description="The amount of the latest funding round in USD."),
        MapOutputSchema(name="source_url", type="string", title="Source URL", description="The URL where the information was found.")
    ]
)
```

### Stage 2: Execute in Parallel (Subtask Execution)

Once `map` is called, the platform spawns 50 identical but independent sub-agents. Each sub-agent:

1.  **Receives a Unique Prompt**: For example, the first sub-agent gets the prompt: "For the company 'Stripe', find the current CEO, the city and country of its headquarters...". The second gets the same prompt but for 'Instacart'.
2.  **Operates in Isolation**: Each sub-agent runs in its own clean sandbox. It cannot see or interact with other sub-agents or the main agent.
3.  **Performs Standard Research**: The sub-agent uses its own `search` and `browser` tools to find the required information. It might search for "Stripe CEO", "Stripe headquarters", and "Stripe latest funding round".
4.  **Extracts and Formats Data**: It reads articles, press releases, or Crunchbase/PitchBook pages to find the answers.
5.  **Returns Structured Data**: After finding the information, it formats the output to perfectly match the `output_schema` and terminates.

### Stage 3: Fan-In (Aggregation in the Main Task)

The main agent waits for all 50 subtasks to complete.

1.  **Receive Aggregated Results**: The platform gathers the structured JSON output from all successful subtasks and presents it to the main agent as a single, aggregated result (typically as a list of 50 JSON objects).
2.  **Process the Data**: The main agent now has a clean, structured dataset. It can easily perform subsequent actions, such as:
    *   Writing the data to a CSV or Markdown table using the `file` tool.
    *   Performing data analysis using Python with pandas.
    *   Creating visualizations with matplotlib.
    *   Summarizing the findings for the user.

## Architectural Diagram of Wide Research

This diagram illustrates the "Fan-Out, Fan-In" architecture.

![Wide Research Architecture](https://private-us-east-1.manuscdn.com/sessionFile/gErdg7aLkJKZQHCIEyzqxt/sandbox/Q6yxvAT3VxcCR5fzPfQVUw-images_1762586384958_na1fn_L2hvbWUvdWJ1bnR1L3dpZGVfcmVzZWFyY2hfYXJjaGl0ZWN0dXJl.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvZ0VyZGc3YUxrSktaUUhDSUV5enF4dC9zYW5kYm94L1E2eXh2QVQzVnhjQ1I1ZnpQZlFWVXctaW1hZ2VzXzE3NjI1ODYzODQ5NThfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwzZHBaR1ZmY21WelpXRnlZMmhmWVhKamFHbDBaV04wZFhKbC5wbmciLCJDb25kaXRpb24iOnsiRGF0ZUxlc3NUaGFuIjp7IkFXUzpFcG9jaFRpbWUiOjE3OTg3NjE2MDB9fX1dfQ__&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=uHTseCoJP7L81Lk~DruRZ5xc5rjY7MsjimeJdnrnEYM0U4QHqapgkDkibHVUAKox4Y8SGo2k00vN0aM-f8C1M9zQlr~My-lBLRH9fjcFT0rKI-f2a7JgTNfbrqa4zXs6GcNyhWIrl15OeXXJAdoI8AuzVjJjffhuLQ~yEnmHdlwHRqz82Dxayodzo0Whu4OYbODEGeeNCQxdFCvmcgIan1c2YGVVB5e~qCkn-i2DvsWTDPbxqiSssk0fm6xnqJ29~yd5lY6bUejvIb~OynJwa0u1AjtxDv5n1WLRDwWkY64kt-BVntTH2RKaALmDKyx6C7ywBmqnCfpHT577G5WGYA__)

## Key Advantages of this Architecture

1.  **Massive Speed Improvement**: A research task that would take hours if done sequentially can be completed in the time it takes to run the single longest subtask. For 50 similar tasks, the speedup is theoretically close to 50x.

2.  **Scalability**: The architecture is designed to scale. The `map` tool supports up to **2000** parallel subtasks, allowing for research on an industrial scale.

3.  **Data Quality and Consistency**: The mandatory `output_schema` is the most critical feature for research. It forces every sub-agent to return data in the exact same format, transforming messy, unstructured information from the web into a clean, structured, and immediately usable dataset.

4.  **Resilience**: The subtasks are completely isolated. If one sub-agent fails to find information for a particularly obscure company or encounters an error, it does not affect the other 49 subtasks. The main agent simply receives results from the successful runs.

5.  **Efficiency**: It allows the main, more powerful agent to focus on high-level strategy (planning the research and analyzing the results) while offloading the repetitive, low-level "grunt work" to thousands of temporary, specialized sub-agents.

In essence, the "wide research" capability transforms Manus AI from a single agent into an orchestrator of a massive, on-demand research workforce, enabling it to tackle large-scale data gathering and analysis tasks with incredible speed and precision.
