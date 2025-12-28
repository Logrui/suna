# Workflow Configuration Components

Configuration UI components for the Advanced Visual Workflow Builder.

## Quick Start

```tsx
import { AIStepConfig } from '@/components/workflows/config';

const workflowVariables = [
  {
    name: 'user_email',
    type: 'string',
    source: 'trigger',
    alwaysDefined: true,
  },
];

<AIStepConfig
  nodeData={selectedNode.data}
  onConfigChange={updateNode}
  availableVariables={workflowVariables}
/>
```

## Components

### AIStepConfig
Property panel for configuring AI step nodes with:
- **Basic Tab**: Model selection, tool selection, rich text prompt editor with @ variable mentions
- **Advanced Tab**: Temperature, max tokens, system prompt
- **Output Tab**: Output variable naming and configuration summary

**Props**:
- `nodeData`: AI step node data with configuration
- `onConfigChange`: Callback when any config value changes
- `availableVariables`: List of available workflow variables
- `errors`: Validation errors to display

**Maps to**: T037 (Phase 4: User Story 2)

### ModelSelector
Dropdown for selecting LLM models with:
- Models grouped by provider (Anthropic, OpenAI, Google)
- Model descriptions and max token limits
- Visual selection indicator

Supports models:
- `claude-3-5-sonnet-20241022` (Anthropic)
- `claude-3-5-haiku-20241022` (Anthropic)
- `gpt-4o` (OpenAI)
- `gpt-4o-mini` (OpenAI)
- `gemini-2.0-flash-exp` (Google)

**Maps to**: T038 (Phase 4: User Story 2)

### ToolSelector
Multi-select dropdown for choosing tools available to AI steps with:
- Tools grouped by category (Search, Content, Web, Data, Media, Other)
- Selected tools shown as removable badges
- Optional max tool limit

Available tools:
- **Search**: Web search, people search, company search, paper search, image search
- **Web**: Browser automation
- **Content**: Knowledge base, file management, shell commands
- **Media**: Image editing, presentations
- **Data**: Data providers API access
- **Communication**: Message sending

**Maps to**: T039 (Phase 4: User Story 2)

### PromptEditor
Rich text editor for prompts with variable mention support using Lexical:
- Full rich text support (bold, italic, underline)
- @ variable mention autocomplete
- Inline variable validation and styling
- Undo/redo support
- Keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+U)
- Dark mode support

**Props**:
- `value`: Current prompt text
- `onChange`: Callback on text changes
- `variables`: Available variables for autocomplete
- `placeholder`: Custom placeholder text
- `minHeight`: Minimum editor height

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
  ]}
  minHeight="120px"
/>
```

For detailed information about the Lexical editor and variable system, see [LEXICAL_EDITOR.md](./LEXICAL_EDITOR.md).

**Maps to**: T041, T087-T089 (Phase 4/7)

## Usage

### In a Properties Panel
```typescript
import { AIStepConfig, ModelSelector, ToolSelector } from '@/components/workflows/config';

<AIStepConfig
  nodeData={selectedNode.data}
  onConfigChange={(config) => updateNode(selectedNode.id, config)}
  availableVariables={variables}
  errors={validationErrors}
/>
```

### Standalone Model Selector
```typescript
<ModelSelector
  value={model}
  onChange={(modelId) => setModel(modelId)}
  showDescriptions={true}
/>
```

### Standalone Tool Selector
```typescript
<ToolSelector
  value={selectedTools}
  onChange={(tools) => setTools(tools)}
  maxTools={10}
/>
```

## Validation

Configuration is validated using the `useAIStepValidation` hook:

```typescript
import { useAIStepValidation } from '@/hooks/workflows';

const { isValid, errors, warnings } = useAIStepValidation(
  config,
  availableVariables
);
```

Validates:
- Required fields (prompt, model, tools)
- Field formats (temperature range, max tokens range, output variable pattern)
- Variable references (@variable syntax)
- Configuration completeness

## Integration

### With Zustand Store
Configuration changes are synced to the canvas store via the `updateNodeConfig` action:

```typescript
const updateNodeConfig = useCanvasStore((state) => state.updateNodeConfig);

// In AIStepConfig:
const handleConfigChange = (config) => {
  updateNodeConfig(nodeId, config);
};
```

### With Properties Panel
The `PropertiesPanel` component wraps `AIStepConfig` and handles:
- Selecting which node to configure
- Managing validation display
- Showing/hiding the panel based on node selection
- Displaying configuration status

## Data Structure

Configuration is stored in `AIStepNodeData.config`:

```typescript
interface AIStepNodeData {
  config: {
    prompt: string;           // Required: Prompt with @variable references
    model: string;            // Required: Model ID
    tools: string[];          // Required: Tool IDs
    temperature?: number;     // Optional: 0.0-2.0, default 0.7
    max_tokens?: number;      // Optional: 1-200000
    system_prompt?: string;   // Optional: Override system prompt
    output_variable?: string; // Optional: Store output in variable
  };
}
```

## Keyboard Shortcuts

- **Enter** in prompt field: Insert newline (use Shift+Enter for different behavior)
- **Temperature slider**: Arrow keys for fine-grained adjustment
- **Output variable field**: Standard text input shortcuts

## Type Safety

All components are fully typed with TypeScript:
- Model interfaces with provider info
- Tool interfaces with category and description
- Configuration validation types
- Error and warning types

## Roadmap

### Phase 4 (Current)
✓ AI step configuration UI
✓ Model and tool selectors
✓ Validation hooks
✓ Properties panel integration

### Phase 5
- Condition node configuration (rule-based and LLM-based)
- Execution monitoring
- Real-time visual updates

### Phase 7
- Lexical editor integration for advanced prompt editing
- Variable mention plugin with @autocomplete
- Prompt validation against available variables

### Phase 9
- Auto-layout button configuration
- Dag layout algorithm settings

## Files

```
frontend/src/components/workflows/config/
├── AIStepConfig.tsx          # Main configuration component
├── ModelSelector.tsx         # Model selection dropdown
├── ToolSelector.tsx          # Tool selection multi-select
├── index.ts                  # Exports
└── README.md                 # This file

frontend/src/components/workflows/canvas/
└── PropertiesPanel.tsx       # Integration panel

frontend/src/hooks/workflows/
├── useAIStepValidation.ts    # Validation hook
└── index.ts                  # Exports
```

## Testing

Components follow the project's testing patterns:
- Props validation
- Default values
- Error states
- Accessibility attributes (aria-invalid, labels)
- Dark mode support

## Contributing

When adding new features:
1. Update configuration interface in `@/types/workflows`
2. Add UI component in this directory
3. Add validation in `useAIStepValidation`
4. Update PropertiesPanel to handle new configuration
5. Update this README
