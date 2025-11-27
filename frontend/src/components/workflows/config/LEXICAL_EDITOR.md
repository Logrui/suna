# Lexical Rich Text Editor for Prompts

Advanced prompt editing with variable mention support using Lexical.

## Overview

The prompt editor provides a modern, user-friendly interface for writing AI prompts with built-in support for workflow variable references.

**Key Features**:
- ✅ Rich text editing (bold, italic, underline)
- ✅ @ variable mention autocomplete
- ✅ Inline variable validation and styling
- ✅ Full undo/redo support
- ✅ Keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+U)
- ✅ Dark mode support
- ✅ Accessibility features

## Components

### PromptEditor
Main editor component that wraps Lexical with all necessary plugins.

**Props**:
```typescript
interface PromptEditorProps {
  value?: string;           // Current prompt text
  onChange?: (text: string) => void;  // Text change callback
  variables?: Variable[];   // Available variables for autocomplete
  placeholder?: string;     // Custom placeholder
  className?: string;       // CSS class
  readOnly?: boolean;       // Read-only mode
  minHeight?: string;       // Minimum editor height
}
```

**Usage**:
```tsx
import { PromptEditor } from '@/components/workflows/config';

<PromptEditor
  value={prompt}
  onChange={setPrompt}
  variables={[
    {
      name: 'user_email',
      type: 'string',
      source: 'trigger',
      alwaysDefined: true,
    },
    {
      name: 'response',
      type: 'string',
      source: 'node_output',
      alwaysDefined: false,
      description: 'Output from previous AI step'
    }
  ]}
/>
```

### VariableMentionNode
Custom Lexical node representing @variable mentions.

**Features**:
- Styled as inline elements with visual distinction
- Supports validation (valid/invalid states)
- Optional warning messages for conditional variables
- Exports to JSON for persistence

**Class**: `VariableMentionNode extends DecoratorNode`

**Methods**:
- `getTextContent()` - Returns `@variable`
- `exportJSON()` - Serializes to JSON
- `importJSON()` - Deserializes from JSON

**Styling**:
```css
/* Valid variable */
.variable-mention--valid {
  background: rgb(229, 245, 255);
  color: rgb(30, 64, 175);
  border: 1px solid rgb(147, 197, 253);
}

/* Invalid variable */
.variable-mention--invalid {
  background: rgb(254, 226, 226);
  color: rgb(185, 28, 28);
  border: 1px solid rgb(252, 165, 165);
}
```

### VariableMentionPlugin
Handles @ trigger and autocomplete dropdown for variable mentions.

**Props**:
```typescript
interface VariableMentionPluginProps {
  variables: Variable[];     // Available variables
  onVariableAdded?: (variable: string) => void;  // Added callback
}
```

**Features**:
- Triggers on @ character
- Real-time filtering as user types
- Shows up to 10 matching variables
- Displays variable type, source, and description
- Warning indicators for conditional variables
- Keyboard navigation support

## Variable System

### Variable Interface
```typescript
interface Variable {
  name: string;              // e.g., 'user_email'
  type: string;              // e.g., 'string', 'number', 'object'
  source: string;            // 'trigger' or 'node_output'
  description?: string;      // Optional help text
  alwaysDefined: boolean;    // Whether available in all execution paths
}
```

### Variable Sources

1. **Trigger Variables** (`source: 'trigger'`)
   - Defined by workflow trigger
   - Usually always available
   - Prefix: `@trigger.*` for nested fields
   - Example: `@user_email`, `@request.body.content`

2. **Node Output Variables** (`source: 'node_output'`)
   - Output from previous AI steps
   - Named using `output_variable` config
   - May be conditional (only available if specific path taken)
   - Example: `@step_1_output`, `@analysis_result`

## Usage Examples

### Basic Prompt with Variables
```tsx
const variables: Variable[] = [
  {
    name: 'customer_name',
    type: 'string',
    source: 'trigger',
    description: 'Customer name from request',
    alwaysDefined: true,
  },
  {
    name: 'previous_context',
    type: 'string',
    source: 'node_output',
    description: 'Context from previous analysis step',
    alwaysDefined: true,
  },
];

<PromptEditor
  value={prompt}
  onChange={setPrompt}
  variables={variables}
/>

// User types:
// "Analyze the request from @cust..."
// → Shows dropdown with "customer_name"
// → User selects it
// → Becomes: "Analyze the request from @customer_name..."
```

### In AIStepConfig
```tsx
import { AIStepConfig } from '@/components/workflows/config';

const workflowVariables: Variable[] = getAvailableVariables(workflow);

<AIStepConfig
  nodeData={selectedNode.data}
  onConfigChange={updateNode}
  availableVariables={workflowVariables}
/>

// AIStepConfig uses PromptEditor internally
// when editing the prompt field
```

### With Validation
```tsx
import { useAIStepValidation } from '@/hooks/workflows';

const { errors, warnings } = useAIStepValidation(config, variables);

// Warnings alert user to undefined variables:
// "⚠️ Variable @response is not defined"

// Can extract variables from config:
const extractedVariables = [...config.prompt.matchAll(/@([a-zA-Z_]\w*)/g)]
  .map(m => m[1])
  .filter(name => !variables.some(v => v.name === name));

if (extractedVariables.length > 0) {
  // Show warnings for undefined variables
}
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `@` | Start variable mention |
| `↑ ↓` | Navigate autocomplete options |
| `Enter` | Select highlighted option |
| `Esc` | Close autocomplete |
| `Ctrl+B` | Toggle bold |
| `Ctrl+I` | Toggle italic |
| `Ctrl+U` | Toggle underline |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |

## Styling and Theming

### Dark Mode
All components support dark mode with tailwind classes:
- Editor background: `bg-white dark:bg-gray-800`
- Text color: `text-gray-900 dark:text-gray-100`
- Border color: `border-gray-300 dark:border-gray-600`

### Custom CSS
Override variable mention styling in your CSS:
```css
/* Customize mention appearance */
[data-variable] {
  /* Valid mention */
  background-color: #dbeafe;
  color: #1e40af;
}

[data-variable][data-valid="false"] {
  /* Invalid mention */
  background-color: #fee2e2;
  color: #dc2626;
}
```

## Integration with Zustand Store

Variables are automatically synced through the Zustand canvas store:

```tsx
// In PromptEditor onChange:
onChange?.(text);  // Calls parent handler

// In AIStepConfig handlePromptChange:
onConfigChange({ prompt: text });  // Updates Zustand

// In PropertiesPanel:
updateNodeConfig(nodeId, config);  // Syncs to store
```

## Performance Optimizations

1. **Memo Components**: All components wrapped with `React.memo`
2. **Lazy Variable Filtering**: Filtered on-demand, not pre-computed
3. **Limited Autocomplete**: Shows max 10 variables
4. **Debounced Updates**: onChange debounced internally by Lexical

## Error Handling

### Common Issues

**Issue**: Autocomplete not showing
- Ensure @ is typed before variable name
- Check that variables array is not empty
- Verify variable names follow pattern: `[a-zA-Z_][a-zA-Z0-9_]*`

**Issue**: Variable mention not styled
- Check that `VariableMentionNode` is in editor config nodes
- Ensure CSS is loaded (check `theme` in `editorConfig`)

**Issue**: Text not syncing
- Verify `OnChangePlugin` is included
- Check that `onChange` callback is properly connected
- Look for console errors in editor error boundary

## Data Persistence

Variable mentions are preserved when:
1. **Saving workflows** - Mentions saved in `graph_definition.nodes[].config.prompt`
2. **Exporting JSON** - Uses `exportJSON()` from VariableMentionNode
3. **Loading workflows** - Uses `importJSON()` to restore mentions

## Future Enhancements

- [ ] **Rich formatting**: Bold, italic, code blocks persistence
- [ ] **Mention validation**: Real-time highlighting of undefined variables
- [ ] **Formatting toolbar**: Visual buttons for bold, italic, etc.
- [ ] **Mention snippets**: Frequently used variable templates
- [ ] **Comment support**: Ability to add notes within prompts
- [ ] **Variable hints**: Inline documentation on hover

## Testing

### Unit Tests
```typescript
describe('PromptEditor', () => {
  it('should insert variable mention on selection', () => {
    // Test @ trigger and selection
  });

  it('should validate variables on insert', () => {
    // Test validation feedback
  });
});
```

### Integration Tests
```typescript
describe('AIStepConfig with PromptEditor', () => {
  it('should sync prompt changes to Zustand store', () => {
    // Test store integration
  });

  it('should show available variables in autocomplete', () => {
    // Test variable filtering
  });
});
```

## Files

```
frontend/src/components/workflows/config/
├── PromptEditor.tsx           # Main editor component (130 lines)
├── VariableMentionNode.tsx    # Lexical node (180 lines)
├── VariableMentionPlugin.tsx  # Autocomplete plugin (200 lines)
├── AIStepConfig.tsx           # Uses PromptEditor (updated)
└── LEXICAL_EDITOR.md          # This file
```

## Dependencies

- `lexical` - Core editor library
- `@lexical/react` - React integration
- `@lexical/utils` - Utility functions
- `tailwindcss` - Styling

## Contributing

When modifying the editor:
1. Update VariableMentionNode if changing node structure
2. Update VariableMentionPlugin if changing autocomplete behavior
3. Update PromptEditor theme if changing styling
4. Update this documentation with examples

## References

- [Lexical Documentation](https://lexical.dev/)
- [Building Lexical Plugins](https://lexical.dev/docs/overview)
- [Custom Nodes](https://lexical.dev/docs/concepts/nodes)
