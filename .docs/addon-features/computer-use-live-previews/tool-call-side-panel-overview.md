# Tool Call Side Panel Overview

## 📍 Location
`frontend/src/components/thread/tool-call-side-panel.tsx`

## 📋 Component Summary

The **ToolCallSidePanel** is the main UI component responsible for displaying and managing the "Suna's Computer" feature. It's a comprehensive panel that:

- Displays tool execution results and details
- Provides real-time VNC preview of the agent's desktop environment
- Manages intelligent view switching between Tools View and Browser View
- Handles navigation between multiple tool calls
- Renders tool-specific visualizations

**File Size**: ~1,052 lines of TypeScript/React code

---

## 🎯 Primary Purpose

To provide users with:
1. **Visibility** into what their AI agent is doing
2. **Transparency** through tool results and screenshots
3. **Real-time feedback** via VNC desktop streaming
4. **Interactive control** with view switching and navigation

---

## 🏗️ Architecture & Structure

### Main Interface

```typescript
interface ToolCallSidePanelProps {
  isOpen: boolean;                              // Panel visibility
  onClose: () => void;                          // Close handler
  toolCalls: ToolCallInput[];                   // Array of tool calls
  currentIndex: number;                         // Current position
  onNavigate: (newIndex: number) => void;       // Navigation callback
  externalNavigateToIndex?: number;             // External navigation
  messages?: ApiMessageType[];                  // Thread messages
  agentStatus: string;                          // 'running' | 'idle'
  project?: Project;                            // Project with sandbox info
  renderAssistantMessage?: (content) => ReactNode;
  renderToolResult?: (content, isSuccess) => ReactNode;
  isLoading?: boolean;
  agentName?: string;                           // For title customization
  onFileClick?: (filePath: string) => void;
  disableInitialAnimation?: boolean;
  compact?: boolean;
}
```

### Input Data Structure

```typescript
interface ToolCallInput {
  assistantCall: {
    content?: string;
    name?: string;              // Tool name (e.g., "browser-screenshot")
    timestamp?: string;
  };
  toolResult?: {
    content?: string;           // Result content or URL
    isSuccess?: boolean;
    timestamp?: string;
  };
  messages?: ApiMessageType[];
}
```

### Internal State Management

```typescript
// View mode tracking
const [currentView, setCurrentView] = useState<'tools' | 'browser'>('tools');

// Navigation & indexing
const [internalIndex, setInternalIndex] = useState(0);
const [navigationMode, setNavigationMode] = useState<'live' | 'manual'>('live');

// Tool call snapshots
const [toolCallSnapshots, setToolCallSnapshots] = useState<ToolCallSnapshot[]>([]);

// VNC management
const [vncRefreshKey, setVncRefreshKey] = useState(0);

// Initialization flag
const [isInitialized, setIsInitialized] = useState(false);
```

### Tool Call Snapshot Structure

```typescript
interface ToolCallSnapshot {
  id: string;                    // Unique identifier
  toolCall: ToolCallInput;       // The tool call data
  index: number;                 // Position in array
  timestamp: number;             // When captured
}
```

---

## 🎨 Component Hierarchy

```
ToolCallSidePanel
├── PanelHeader
│   ├── Title (dynamic based on agentName)
│   ├── Status Badge (if streaming)
│   └── Close/Minimize Button
│
├── ViewToggle
│   ├── Tools View Button (🔧)
│   └── Browser View Button (🌐)
│
├── Navigation Controls
│   ├── Previous Button (◀)
│   ├── Call Counter (X of Y)
│   └── Next Button (▶)
│
├── Content Area (based on currentView)
│   │
│   ├─── TOOLS VIEW
│   │    ├── ToolView Wrapper
│   │    │   ├── BrowserToolView (for browser operations)
│   │    │   ├── SeeImageToolView (for image analysis)
│   │    │   ├── FileToolView (for file operations)
│   │    │   └── ... (other tool-specific views)
│   │    │
│   │    └── Assistant/Tool Message Rendering
│   │
│   └─── BROWSER VIEW
│        └── HealthCheckedVncIframe
│            └── VNC Preview of Agent Desktop
│
└── Status Footer
    ├── Loading indicators
    └── Tool execution status
```

---

## 🔄 View Switching Logic

### Two View Modes

#### 1. **Tools View** (Default)
Shows structured results from tool executions:
- Browser screenshots with metadata
- File operation results
- Command outputs
- Tool-specific formatted data

#### 2. **Browser View**
Shows live desktop environment:
- Real-time VNC preview
- Active browser window
- Desktop applications
- Live agent interactions

### Auto-Switching Algorithm

The component implements intelligent view switching based on agent state and tool type:

```typescript
// Helper function to detect browser tools
const isBrowserTool = (toolName: string | undefined): boolean => {
  const browserTools = [
    'browser-navigate-to',
    'browser-act',
    'browser-extract-content',
    'browser-screenshot'
  ];
  return toolName ? browserTools.includes(toolName.toLowerCase()) : false;
};

// Auto-switch logic
useEffect(() => {
  if (agentStatus === 'idle') {
    // When idle: switch to browser view for latest browser tool
    if (isCurrentSnapshotBrowserTool && currentViewRef.current === 'tools') {
      setCurrentView('browser');
    }
  } else if (agentStatus === 'running') {
    // When running: auto-switch for streaming tools
    if (isStreamingBrowserTool && currentViewRef.current === 'tools') {
      setCurrentView('browser');
    }
  }
}, [toolCallSnapshots, internalIndex, isBrowserTool, agentStatus]);
```

### View Toggle Component

```typescript
interface ViewToggleProps {
  currentView: 'tools' | 'browser';
  onViewChange: (view: 'tools' | 'browser') => void;
}

// Renders animated toggle with sliding background
// Buttons: [🔧 Tools] [🌐 Browser]
```

---

## 🖼️ VNC Integration

### VNC Iframe Management

```typescript
// Persistent VNC iframe component
const persistentVncIframe = useMemo(() => {
  if (!sandbox || !sandbox.vnc_preview || !sandbox.pass || !sandbox.id) 
    return null;
  
  return (
    <HealthCheckedVncIframe 
      key={vncRefreshKey}  // Force re-render on refresh
      sandbox={{
        id: sandbox.id,
        vnc_preview: sandbox.vnc_preview,
        pass: sandbox.pass
      }}
    />
  );
}, [sandbox, vncRefreshKey]);
```

### VNC Refresh Mechanism

```typescript
// Refresh handler
const handleVncRefresh = useCallback(() => {
  setVncRefreshKey(prev => prev + 1);  // Force iframe remount
}, []);

// Used when VNC preview gets stuck or needs updating
```

### HealthCheckedVncIframe Component

Located at: `frontend/src/components/thread/HealthCheckedVncIframe.tsx`

Responsibilities:
- Embeds noVNC web client in iframe
- Monitors VNC connection health
- Auto-reconnects on failure
- Handles credential passing
- Manages iframe lifecycle

---

## 📊 Navigation System

### Navigation Modes

```typescript
type NavigationMode = 'live' | 'manual';

// LIVE MODE: Always follows latest tool call
// MANUAL MODE: User controls navigation, displays stable view
```

### Navigation Logic

```typescript
// Initialize to last completed tool call
if (!isInitialized && newSnapshots.length > 0) {
  const lastCompletedIndex = newSnapshots.findLastIndex(s =>
    s.toolCall.toolResult?.content &&
    s.toolCall.toolResult.content !== 'STREAMING'
  );
  setInternalIndex(lastCompletedIndex);
}

// Live mode: follow latest
if (navigationMode === 'live' && hasNewSnapshots) {
  setInternalIndex(newSnapshots.length - 1);
}
```

### Navigation Controls

```typescript
// Previous/Next buttons
<Button onClick={() => navigate(internalIndex - 1)}>◀</Button>
<span>{internalIndex + 1} of {totalCalls}</span>
<Button onClick={() => navigate(internalIndex + 1)}>▶</Button>

// Keyboard shortcuts (if implemented)
// Arrow keys: Navigate left/right
// Escape: Close panel
```

---

## 🎬 Animation & Transitions

### Used Libraries
- **Framer Motion**: Smooth animations and layout transitions
- **Motion.div**: Animated components with layout IDs

### Key Animations

```typescript
// View toggle sliding animation
<motion.div
  initial={false}
  animate={{
    x: currentView === 'tools' ? 0 : 32
  }}
  transition={{
    type: "spring",
    stiffness: 300,
    damping: 30
  }}
/>

// Panel appear/disappear
<AnimatePresence mode="wait">
  {isOpen && (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      {/* Content */}
    </motion.div>
  )}
</AnimatePresence>
```

---

## 🖨️ Panel Header Variants

The component supports multiple header styles for different contexts:

```typescript
interface PanelHeaderProps {
  agentName?: string;           // Dynamic title: "{AgentName}'s Computer"
  onClose: () => void;
  isStreaming?: boolean;
  variant?: 'drawer' | 'desktop' | 'motion';
  showMinimize?: boolean;
  layoutId?: string;
}

// Title generation
const getComputerTitle = (agentName?: string): string => {
  return agentName ? `${agentName}'s Computer` : "Suna's Computer";
};
```

### Header Variants

1. **Drawer** - Mobile/drawer layout header
2. **Desktop** - Standard desktop header
3. **Motion** - Animated header with Framer Motion

---

## 🔌 External Integration Points

### Data Input

```typescript
// Receives tool calls from parent component
toolCalls: ToolCallInput[]

// Receives messages for context
messages: ApiMessageType[]

// Receives project sandbox info
project?: Project  // Contains: sandbox.id, vnc_preview, pass
```

### Event Output

```typescript
// Notify parent when closed
onClose: () => void

// Notify navigation changes
onNavigate: (newIndex: number) => void

// Handle file clicks (e.g., open in editor)
onFileClick?: (filePath: string) => void
```

---

## 🛠️ Tool View Rendering System

### ToolView Wrapper Component

```typescript
import { ToolView } from './tool-views/wrapper';

// Generic wrapper that:
// 1. Detects tool type from name
// 2. Routes to appropriate view component
// 3. Passes normalized tool data
// 4. Handles errors gracefully
```

### Supported Tool Views

Each tool type has a specialized view component:

| Tool Type | Component | Shows |
|-----------|-----------|-------|
| `browser-*` | BrowserToolView | Screenshots, URL, page title |
| `see-image` | SeeImageToolView | Image preview, analysis results |
| `load-image` | ImageToolView | Image metadata and preview |
| `web-search` | WebSearchToolView | Search results, citations |
| `web-scrape` | WebScrapeToolView | Scraped content preview |
| `shell-*` | ShellToolView | Command output, exit code |
| `files-*` | FileToolView | File paths, operations |
| `docs-*` | DocsToolView | Document preview |
| `slides-*` | SlidesToolView | Slide preview |
| Default | GenericToolView | JSON/text output |

---

## 📱 Mobile & Responsive Behavior

### Mobile Detection

```typescript
const isMobile = useIsMobile();  // From hooks/use-mobile

// Adjusts:
// - Drawer vs side panel layout
// - Compact view mode
// - Touch-friendly controls
```

### Compact Mode

```typescript
compact?: boolean  // Prop to enable compact layout
// Reduces padding, font sizes, and spacing
```

---

## 🎯 Keyboard Shortcuts & Accessibility

### Available Shortcuts

```typescript
// In parent thread component (thread-site-header.tsx)
CMD+I / CTRL+I  // Toggle Computer Preview

// Potentially available (verify implementation):
Escape          // Close panel
Arrow Left      // Previous tool
Arrow Right     // Next tool
```

### Accessibility Features

- Semantic HTML structure
- ARIA labels for icon buttons
- Keyboard navigation support
- Focus management
- Proper heading hierarchy

---

## ⚡ Performance Considerations

### Optimization Techniques

```typescript
// Memoization of expensive calculations
const newSnapshots = useMemo(() => {
  return toolCalls.map((toolCall, index) => ({
    id: `${index}-${toolCall.assistantCall.timestamp || Date.now()}`,
    toolCall,
    index,
    timestamp: Date.now(),
  }));
}, [toolCalls]);

// Useref for avoiding re-renders
const currentViewRef = useRef(currentView);

// Callback memoization
const isBrowserTool = useCallback((toolName) => {
  // ... logic
}, []);

// Persistent VNC iframe to prevent remounting
const persistentVncIframe = useMemo(() => {
  // ... VNC setup
}, [sandbox, vncRefreshKey]);
```

### Snapshot Management

```typescript
// Prevents unnecessary recalculations of snapshot arrays
// Only updates when toolCalls array changes
// Uses index as unique identifier for stability
```

---

## 🐛 Error Handling & Edge Cases

### Handled Scenarios

1. **Empty Tool Calls**
   - Gracefully shows "No tool calls" message
   - Disables navigation buttons

2. **Invalid Index**
   ```typescript
   const safeIndex = Math.min(
     internalIndex,
     Math.max(0, toolCallSnapshots.length - 1)
   );
   ```

3. **Missing Sandbox**
   - VNC preview hidden if sandbox unavailable
   - Tools view still displays normally

4. **Streaming Content**
   - Displays "STREAMING" status badge
   - Prevents navigation while tool is running
   - Shows loading indicators

5. **VNC Connection Issues**
   - HealthCheckedVncIframe handles reconnection
   - Manual refresh button available
   - Graceful fallback to tools view

---

## 🔍 Debugging & Development

### Useful Debug Points

```typescript
// Log current state
console.log('currentView:', currentView);
console.log('navigationMode:', navigationMode);
console.log('internalIndex:', internalIndex);
console.log('toolCallSnapshots:', toolCallSnapshots);

// Monitor auto-switching logic
console.log('isCurrentSnapshotBrowserTool:', isCurrentSnapshotBrowserTool);
console.log('agentStatus:', agentStatus);
```

### Component Props to Test

```typescript
// Test with all prop combinations
<ToolCallSidePanel
  isOpen={true}
  onClose={() => {}}
  toolCalls={[/* test data */]}
  currentIndex={0}
  onNavigate={(idx) => console.log(idx)}
  agentStatus="running"
  agentName="TestAgent"
  compact={false}
  project={{ sandbox: { /* vnc data */ } }}
/>
```

---

## 📚 Related Components & Files

### Frontend Dependencies
- `ToolView` - Tool result rendering wrapper
- `HealthCheckedVncIframe` - VNC preview display
- `BrowserToolView` - Browser-specific visualization
- `PanelHeader` - Header component
- `ViewToggle` - View switching control

### Utilities & Hooks
- `useIsMobile()` - Responsive detection
- `cn()` - Class name utilities
- `useDocumentModalStore()` - State management

### Backend Connections
- Tool execution results from API
- Project sandbox information
- Agent status updates

---

## 🚀 Future Enhancement Ideas

1. **Record & Replay**
   - Record agent actions
   - Playback at different speeds
   - Share recordings

2. **Advanced Filtering**
   - Filter by tool type
   - Search tool results
   - Timeline view

3. **Enhanced Controls**
   - Pause agent mid-action
   - Modify agent instructions mid-run
   - Take manual screenshots

4. **Analytics**
   - Tool execution metrics
   - Performance tracking
   - Failure analysis

5. **Multi-Agent Support**
   - Show multiple agents' computers
   - Synchronized view
   - Inter-agent communication

6. **Custom Tool Views**
   - Plugin system for tool visualizations
   - Domain-specific displays
   - Data type-specific renderers

---

## 📝 Code Examples

### Basic Usage

```typescript
import { ToolCallSidePanel } from '@/components/thread/tool-call-side-panel';

export function ChatThread() {
  const [toolCalls, setToolCalls] = useState<ToolCallInput[]>([]);
  const [isComputerOpen, setIsComputerOpen] = useState(false);

  return (
    <>
      <ToolCallSidePanel
        isOpen={isComputerOpen}
        onClose={() => setIsComputerOpen(false)}
        toolCalls={toolCalls}
        currentIndex={toolCalls.length - 1}
        onNavigate={(idx) => console.log(`Navigated to ${idx}`)}
        agentStatus={agentIsRunning ? 'running' : 'idle'}
        project={currentProject}
        agentName="Suna"
      />
    </>
  );
}
```

### Handling Tool Results

```typescript
function handleToolResult(
  toolName: string,
  result: ToolCallInput['toolResult']
) {
  const newToolCall: ToolCallInput = {
    assistantCall: {
      name: toolName,
      timestamp: new Date().toISOString(),
    },
    toolResult: {
      content: result.content,
      isSuccess: result.isSuccess,
      timestamp: new Date().toISOString(),
    },
  };
  
  setToolCalls(prev => [...prev, newToolCall]);
}
```

---

## 🎓 Learning Resources

### Key Concepts to Understand
1. React hooks (useState, useEffect, useRef, useCallback, useMemo)
2. Framer Motion animations
3. TypeScript interfaces and types
4. VNC protocol basics
5. Tool-based UI patterns
6. State management patterns

### Files to Study (in order)
1. This overview document
2. `tool-call-side-panel.tsx` - Main component
3. `HealthCheckedVncIframe.tsx` - VNC integration
4. `tool-views/wrapper.tsx` - Tool routing logic
5. `tool-views/BrowserToolView.tsx` - Example tool view

---

## 📞 Support & Questions

For issues or questions about the ToolCallSidePanel:

1. **Check existing issues** in the repository
2. **Review this documentation**
3. **Check component props** for configuration options
4. **Inspect browser DevTools** for state and rendering
5. **Check backend logs** for tool execution errors
6. **Verify VNC connection** for preview issues

---

## ✅ Checklist for Implementation/Modification

- [ ] Understand component purpose and architecture
- [ ] Review ViewToggle and auto-switching logic
- [ ] Study VNC integration approach
- [ ] Understand tool view rendering system
- [ ] Review navigation and state management
- [ ] Check performance optimizations
- [ ] Test with various tool types
- [ ] Test on mobile devices
- [ ] Verify keyboard shortcuts work
- [ ] Check error handling scenarios
- [ ] Review animation smoothness
- [ ] Test with long tool call lists
