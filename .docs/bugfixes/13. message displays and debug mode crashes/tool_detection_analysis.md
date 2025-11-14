# Tool Detection & Rendering Analysis

## The Problem with Your Example

Your example contains a `create_tasks` tool call that uses **nested parameters**, which breaks the current XML parser. The tool is NOT being detected as a separate entity and is instead being displayed as raw markdown text.

### Your Example XML Structure

```xml
<function_calls>
<invoke name="create_tasks">
<parameter name="sections">
<parameter name="sections">  <!-- ⚠️ NESTED PARAMETER - PARSER BREAKS HERE -->
<parameter name="title">Research & Setup</parameter>
<parameter name="tasks">
<parameter name="tasks">  <!-- ⚠️ ANOTHER NESTED LEVEL -->
<item>Search for LLMs...</item>
<item>Filter search results...</item>
</parameter>
</parameter>
...
</parameter>
</parameter>
</invoke>
</function_calls>
```

---

## How Tool Detection Currently Works

### Step 1: Detection Phase (isNewXmlFormat)
**File**: `frontend/src/components/thread/tool-views/xml-parser.ts` (line 139)

```typescript
export function isNewXmlFormat(content: string): boolean {
  return /<function_calls>[\s\S]*<invoke\s+name=/.test(content);
}
```

✅ **Status**: DETECTS new format successfully
- Looks for `<function_calls>` opening tag
- Looks for `<invoke name=` attribute
- Returns TRUE → proceeds to parsing

### Step 2: Parsing Phase (parseXmlToolCalls)
**File**: `frontend/src/components/thread/tool-views/xml-parser.ts` (lines 17-47)

```typescript
export function parseXmlToolCalls(content: string): ParsedToolCall[] {
  const toolCalls: ParsedToolCall[] = [];

  // REGEX 1: Find all function_calls blocks
  const functionCallsRegex = /<function_calls>([\s\S]*?)<\/function_calls>/gi;
  let functionCallsMatch;
  
  while ((functionCallsMatch = functionCallsRegex.exec(content)) !== null) {
    const functionCallsContent = functionCallsMatch[1];
    
    // REGEX 2: Find all invoke blocks
    const invokeRegex = /<invoke\s+name=["']([^"']+)["']>([\s\S]*?)<\/invoke>/gi;
    let invokeMatch;
    
    while ((invokeMatch = invokeRegex.exec(functionCallsContent)) !== null) {
      const functionName = invokeMatch[1].replace(/_/g, '-');
      const invokeContent = invokeMatch[2];
      const parameters: Record<string, any> = {};
      
      // REGEX 3: Find all parameters (⚠️ PROBLEM STARTS HERE)
      const paramRegex = /<parameter\s+name=["']([^"']+)["']>([\s\S]*?)<\/parameter>/gi;
      let paramMatch;
      
      while ((paramMatch = paramRegex.exec(invokeContent)) !== null) {
        const paramName = paramMatch[1];
        const paramValue = paramMatch[2].trim();
        
        parameters[paramName] = parseParameterValue(paramValue);
      }
      
      toolCalls.push({
        functionName,
        parameters,
        rawXml: invokeMatch[0]
      });
    }
  }
  
  return toolCalls;
}
```

### The Critical Issue: Regex 3 (paramRegex)

**Pattern**: `/<parameter\s+name=["']([^"']+)["']>([\s\S]*?)<\/parameter>/gi`

**What it does**:
- Finds opening `<parameter name="x">` 
- Captures everything until FIRST `</parameter>` (non-greedy matching: `*?`)
- Repeats for all matches

**Why it fails with nested parameters**:

```xml
<parameter name="sections">
  <parameter name="sections">       ← First nested parameter
    <parameter name="title">Research & Setup</parameter>
    <parameter name="tasks">
      <parameter name="tasks">       ← Second nested level
        <item>...</item>
      </parameter>
    </parameter>
  </parameter>
</parameter>
```

When the regex encounters the outer `<parameter name="sections">`, it matches from the opening tag to the **FIRST** `</parameter>` it finds, which is the inner `</parameter>` for the title parameter. This breaks the parse tree.

### Example of What Gets Parsed

```typescript
// Expected for name="sections":
parameters["sections"] = {
  sections: { /* nested structure */ },
  title: "Research & Setup",
  tasks: { /* nested structure */ }
}

// Actual (WRONG):
parameters["sections"] = "<parameter name=\"sections\">\n<parameter name=\"title\">..."
// Because the regex stops at the first </parameter> tag
```

---

## Step 3: Rendering Phase
**File**: `frontend/src/components/thread/content/ThreadContent.tsx` (lines 125-291)

### What Happens When Parser Fails:

```typescript
export function renderMarkdownContent(
    content: string,
    handleToolClick,
    messageId,
    fileViewerHandler,
    sandboxId,
    project,
    debugMode
) {
    // Content is preprocessed to remove text-only tools
    content = preprocessTextOnlyTools(content);

    if (debugMode) {
        // DEBUG MODE: Shows raw content in <pre> tag
        return <pre>{content}</pre>;
    }

    // PRODUCTION MODE: Check if new XML format
    if (isNewXmlFormat(content)) {  // ✅ RETURNS TRUE
        // Try to parse tool calls
        const contentParts: React.ReactNode[] = [];
        let lastIndex = 0;

        const functionCallsRegex = /<function_calls>([\s\S]*?)<\/function_calls>/gi;
        let match: RegExpExecArray | null = null;

        while ((match = functionCallsRegex.exec(content)) !== null) {
            // Add text before the function_calls block
            if (match.index > lastIndex) {
                const textBeforeBlock = content.substring(lastIndex, match.index);
                if (textBeforeBlock.trim()) {
                    contentParts.push(
                        <ComposioUrlDetector key={`md-${lastIndex}`} 
                            content={textBeforeBlock} 
                            className="..." />
                    );
                }
            }

            // Parse the tool calls in this block
            const toolCalls = parseXmlToolCalls(match[0]);  // ⚠️ PARSER FAILS

            // If toolCalls is empty or malformed:
            toolCalls.forEach((toolCall, index) => {
                // Loop doesn't execute because toolCalls is empty
                // OR contains malformed data
            });

            lastIndex = match.index + match[0].length;
        }

        // Since nothing was added, contentParts is empty or incomplete
        // Falls through to fallback rendering
        return contentParts.length > 0 ? contentParts : 
            <ComposioUrlDetector content={content} className="..." />;
            // ⚠️ THIS RENDERS THE RAW XML AS MARKDOWN TEXT
    }

    // Fall back to old XML format handling...
}
```

---

## Complete Tool Detection Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│         Message Content (assistant response)            │
│                                                          │
│  "It appears my task list was cleared...\n\n          │
│   <function_calls>\n                                    │
│   <invoke name=\"create_tasks\">\n                     │
│   <parameter name=\"sections\">\n                      │
│   <parameter name=\"sections\">..."                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │  renderMarkdownContent()   │
        │  (ThreadContent.tsx:104)   │
        └────────────────────┬───────┘
                             │
                    ┌────────┴────────┐
                    ▼                 ▼
          ┌──────────────────┐  ┌──────────────────┐
          │  preprocessText  │  │  debugMode?      │
          │  OnlyTools()     │  │                  │
          │  (lines 54-101)  │  │  if YES: return  │
          │                  │  │  <pre> ✅        │
          │ Strips text-only │  │                  │
          │ tools (ask,      │  │  if NO:          │
          │ complete, etc)   │  │  proceed         │
          └──────────────────┘  └────────┬─────────┘
                                         │
                                         ▼
                         ┌───────────────────────────────┐
                         │  isNewXmlFormat()             │
                         │  (xml-parser.ts:139)          │
                         │                               │
                         │  Regex: /<function_calls>     │
                         │         [\s\S]*               │
                         │         <invoke\s+name=/      │
                         │                               │
                         │  Result: TRUE ✅              │
                         └────────────┬──────────────────┘
                                      │
                                      ▼
                         ┌───────────────────────────────┐
                         │  parseXmlToolCalls()          │
                         │  (xml-parser.ts:17)           │
                         │                               │
                         │  Step 1: Extract              │
                         │  <function_calls>...          │
                         │  </function_calls> ✅         │
                         │                               │
                         │  Step 2: Extract              │
                         │  <invoke name="X">...         │
                         │  </invoke> ✅                 │
                         │                               │
                         │  Step 3: Extract parameters   │
                         │  /<parameter name=...>/       │
                         │                               │
                         │  ⚠️ FAILS ON NESTED           │
                         │  PARAMETERS                   │
                         │                               │
                         │  Returns:                     │
                         │  toolCalls = []               │
                         │  (empty or malformed)         │
                         └────────────┬──────────────────┘
                                      │
                            ┌─────────┴──────────┐
                            ▼                    ▼
                    ┌──────────────────┐  ┌──────────────────┐
                    │ toolCalls has    │  │ toolCalls is     │
                    │ items?           │  │ empty?           │
                    │ forEach loop     │  │ Skip forEach     │
                    │ executes (rare)  │  │ (MOST CASES) ⚠️  │
                    └──────────────────┘  └────────┬─────────┘
                                                   │
                                                   ▼
                         ┌───────────────────────────────────┐
                         │ contentParts is empty             │
                         │                                   │
                         │ return contentParts.length > 0 ?  │
                         │   contentParts                    │
                         │   :                               │
                         │   <ComposioUrlDetector            │
                         │     content={content}/>           │
                         │   (fallback)                      │
                         │                                   │
                         │ ⚠️ RENDERS RAW XML AS MARKDOWN    │
                         └───────────────────────────────────┘
                                      │
                                      ▼
                    ┌──────────────────────────────────┐
                    │ ComposioUrlDetector component    │
                    │                                  │
                    │ Tries to render:                 │
                    │ "...                             │
                    │ <function_calls>                 │
                    │ <invoke name="create_tasks">     │
                    │ ..."                             │
                    │                                  │
                    │ As MARKDOWN (not as tool!)       │
                    │                                  │
                    │ Result: User sees raw XML text   │
                    │ in the message ⚠️                │
                    └──────────────────────────────────┘
```

---

## Why Nested Parameters Fail

### The Core Problem: Regex Greedy vs Non-Greedy Matching

```
Pattern: /<parameter\s+name=["']([^"']+)["']>([\s\S]*?)<\/parameter>/gi
                                                   ^^
                                           Non-greedy (stops at first match)
```

### Visual Breakdown:

```xml
<parameter name="sections">          ← Regex starts here (Match 1)
  <parameter name="sections">        ← Regex starts here (Match 2)
    <parameter name="title">...</parameter>
                                     ↑
    <parameter name="tasks">         ↑
      <parameter name="tasks">...</parameter>
                                     ↑ First </parameter> found
                                     ↑ Regex stops here (non-greedy)
                                     ✅ Correct for Match 3 (title)
  </parameter>
                ↑
     Used for Match 1, but regex already stopped above
</parameter>
   ↑ Never reached because regex stops at first closing tag
```

### Example Trace:

```
Iteration 1:
  name="sections" → match until first </parameter>
                 → Gets only: <parameter name="title">...</parameter>
                 → WRONG! Should get entire nested structure

Iteration 2:
  name="sections" (inner) → match until first </parameter>
                         → Gets only: <parameter name="title">...</parameter>
                         → But that was already consumed!
                         → Chaos ensues
```

---

## Solution Required: Recursive XML Parsing

The current flat regex parsing **cannot handle nested structures**. You need one of:

### Option A: Implement Recursive Parameter Parsing
```typescript
function parseParameterRecursive(content: string): any {
  // Check if this is XML with nested parameters
  if (content.includes('<parameter')) {
    const result: Record<string, any> = {};
    
    // Parse nested parameters recursively
    const paramRegex = /<parameter\s+name=["']([^"']+)["']>([\s\S]*?)<\/parameter>/gi;
    let match;
    
    while ((match = paramRegex.exec(content)) !== null) {
      const paramName = match[1];
      const paramContent = match[2];
      
      // Recursively parse nested parameters
      result[paramName] = parseParameterRecursive(paramContent);
    }
    
    return result;
  }
  
  // Base case: Not XML, return as value
  return parseParameterValue(content);
}
```

### Option B: Use XML Library
```typescript
import { parseStringPromise } from 'xml2js';

const parsed = await parseStringPromise(xmlContent);
```

### Option C: Stack-Based Parser
Track opening/closing tags with a stack to properly match nested parameters.

---

## Why Your Message Doesn't Show as a Tool

### Your Message Content JSON:

```json
{
  "role": "assistant",
  "content": "It appears my task list was cleared...\n\n<function_calls>...",
  "tool_calls": null
}
```

### Processing Path:

1. ✅ **Detection**: `isNewXmlFormat()` returns TRUE
   - Finds `<function_calls>` and `<invoke name=`

2. ❌ **Parsing**: `parseXmlToolCalls()` returns empty or malformed
   - Nested `<parameter>` tags confuse the regex
   - Returns `toolCalls: []`

3. ❌ **Rendering**: Falls back to `ComposioUrlDetector`
   - Treats entire XML as markdown text
   - Shows raw XML to user ⚠️

4. ❌ **Result**: Tool NOT shown as separate UI element
   - No tool button with icon
   - No clickable interaction
   - Just raw text display

---

## Example: What WOULD Work (Flat Parameters)

```xml
<function_calls>
<invoke name="search_llms">
<parameter name="query">LLMs with 200K context</parameter>
<parameter name="filter_by_tokens">200000</parameter>
<parameter name="filter_by_quantization">int8</parameter>
</invoke>
</function_calls>
```

✅ This works because:
- No nested `<parameter>` tags
- Regex can cleanly match each parameter
- Parses successfully
- Renders as tool button UI

```xml
<parameter name="query">LLMs with 200K context</parameter>
↓ regex stops here at first </parameter> ✅ CORRECT
<parameter name="filter_by_tokens">...
```

---

## Current Tool Rendering Logic

Once parsing succeeds, `renderMarkdownContent()` handles these special tool names:

### Special Tools (Have Custom UI)

1. **ask**: User question tool
   - Parameter: `text`
   - Renders with attachment support
   - Shows in styled message bubble

2. **complete**: Task completion tool
   - Parameter: `text`
   - Renders with attachment support
   - Shows in styled message bubble

3. **present_presentation**: Slide presentation tool
   - Parameter: `text`
   - Custom rendering logic

### Generic Tools (Show as Buttons)

Any other tool name:
- Shows as clickable button with icon
- Displays tool name
- Shows primary parameter (if any)
- On click: opens side panel with tool execution details

---

## Why Your Task Tool Doesn't Show

**Tool Name**: `create_tasks`
- ✅ Would normally show as button
- ❌ Parser fails before reaching render phase
- ❌ Content treated as markdown instead
- ❌ Button never created

The parsing failure prevents the tool from being recognized at all.

---

## Summary Table

| Stage | Status | Issue |
|-------|--------|-------|
| **Format Detection** | ✅ Works | Detects XML format correctly |
| **XML Extraction** | ✅ Works | Extracts `<function_calls>` block |
| **Invoke Extraction** | ✅ Works | Extracts `<invoke name="X">` |
| **Parameter Parsing** | ❌ FAILS | Regex breaks on nested parameters |
| **Tool Recognition** | ❌ FAILS | Returns empty toolCalls array |
| **Rendering** | ❌ FAILS | Falls back to markdown rendering |
| **Display** | ❌ FAILS | Shows raw XML text instead of tool UI |

---

## Verification: Check Browser Dev Tools

When viewing a message with your nested XML:

1. Open DevTools Console → No errors (silent failure)
2. Inspect message element → Look for:
   - ✅ `<ComposioUrlDetector>` rendering (markdown fallback)
   - ❌ `<button>` with tool icon (should be present if parsing worked)
3. View page source → See raw XML in the message content

This confirms the tool was never parsed and rendered.