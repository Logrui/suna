# ActiveView Pattern - Quick Reference Guide

## 🎯 The Pattern in One Image

```
                    ┌──────────────────────────┐
                    │   activeView State       │
                    │ ('chats' | 'agents' |    │
                    │  'starred' | ...)        │
                    └────────┬─────────────────┘
                             │
                ┌────────────┴────────────┐
                ▼                         ▼
        ┌──────────────┐          ┌─────────────┐
        │ Button CSS   │          │ Content     │
        │ (Styling)    │          │ Render      │
        │              │          │             │
        │ activeView   │          │ activeView  │
        │ === 'agents' │          │ === 'agents'│
        │ ? active :   │          │ && Render   │
        │ inactive     │          │ NavAgents   │
        └──────────────┘          └─────────────┘
```

---

## 📋 The Three Layers

### Layer 1: Initialize
```typescript
const [activeView, setActiveView] = useState<'chats' | 'agents' | 'starred' | ...>('chats');
```
**Sets:** Initial state = `'chats'`

### Layer 2: Mutate (On Click)
```typescript
onClick={(e) => {
  e.preventDefault();
  setActiveView(view);  // ← Update state
}}
```
**Changes:** `'chats'` → `'agents'` (or other view)

### Layer 3: Use (Render)
```typescript
{activeView === 'agents' ? 'bg-card' : 'transparent'}          // Styling
{activeView === 'agents' && <NavAgentsView />}                // Content
```
**Outputs:** Visual changes in UI

---

## 🔄 The Complete Loop

```
1. User Clicks "Workers" Button
                    ↓
2. onClick Handler Fires
   - e.preventDefault()
   - setActiveView('agents')
                    ↓
3. React State Updates
   - activeView changes from 'chats' to 'agents'
                    ↓
4. Component Re-renders
   - All buttons check: activeView === view?
   - Content area checks: activeView === 'agents'?
                    ↓
5. UI Updates
   - "Workers" button now has 'bg-card' background
   - Content area shows NavAgentsView instead of NavAgents
```

---

## 🎨 Button State Logic

```typescript
// Single Button Component Logic:

const isActive = activeView === view;  // true or false

const className = cn(
  // Base styles
  "w-[64px] h-[64px] rounded-2xl transition-colors",
  
  // Hover state (always)
  "hover:bg-muted/60 hover:border-[1.5px] hover:border-border",
  
  // Active vs Inactive
  isActive 
    ? 'bg-card border-[1.5px] border-border'      // Active (highlighted)
    : 'border-[1.5px] border-transparent'         // Inactive (subtle)
);
```

**Visual Progression:**
```
Default (Inactive)           Hover (Inactive)           Active
├─ bg: transparent       ├─ bg: muted/60         ├─ bg: card
├─ border: transparent   ├─ border: border       ├─ border: border
└─ icon: small           └─ icon: small          └─ icon: small
```

---

## 📍 Where activeView is Used (Quick Map)

```typescript
// File: sidebar-left.tsx

Line 186:  ┌─ INITIALIZATION
           └─ const [activeView, setActiveView] = useState<...>('chats');

Line 209:  ┌─ SYNC FROM URL
           └─ if (pathname?.includes('/triggers')) setActiveView('starred');

Line 394:  ┌─ MUTATION (Collapsed Mode)
           └─ onClick={() => setActiveView(view)};

Line 403:  ┌─ STYLING (Collapsed Mode)
           └─ activeView === view ? 'bg-card' : '';

Line 465:  ┌─ MUTATION (Expanded Row 1)
           └─ onClick={() => setActiveView(view)};

Line 472:  ┌─ STYLING (Expanded Row 1)
           └─ activeView === view ? 'bg-card' : 'border-transparent';

Line 496:  ┌─ MUTATION (Expanded Row 2)
           └─ onClick={() => setActiveView(view)};

Line 503:  ┌─ STYLING (Expanded Row 2)
           └─ activeView === view ? 'bg-card' : 'border-transparent';

Lines     ┌─ CONTENT RENDERING
518-543:  └─ {activeView === 'chats' && <NavAgents />}
          └─ {activeView === 'agents' && <NavAgentsView />}
          └─ ... etc for all 6 views
```

---

## 🧮 State Transitions

### Valid Transitions (All Possible)

```
Any View can transition to Any Other View:

'chats' ──→ 'agents', 'starred', 'workspaces', 'knowledge', 'inbox'
'agents' ──→ 'chats', 'starred', 'workspaces', 'knowledge', 'inbox'
'starred' ──→ 'chats', 'agents', 'workspaces', 'knowledge', 'inbox'
'workspaces' ──→ 'chats', 'agents', 'starred', 'knowledge', 'inbox'
'knowledge' ──→ 'chats', 'agents', 'starred', 'workspaces', 'inbox'
'inbox' ──→ 'chats', 'agents', 'starred', 'workspaces', 'knowledge'
```

### Transition Triggers

| Trigger | Sets activeView To | Effect |
|---------|-------------------|--------|
| User clicks button | Clicked button's view | Button highlights, content changes |
| URL changes to `/triggers` | `'starred'` | Auto-sync from pathname |
| URL changes to `/knowledge` | `'starred'` | Auto-sync from pathname |
| Component mounts | `'chats'` (default) | Initial view on page load |

---

## 💾 Type Safety in Action

```typescript
// ✅ GOOD - TypeScript accepts this
setActiveView('agents');        // Valid type
setActiveView('chats');         // Valid type

// ❌ BAD - TypeScript rejects this
setActiveView('workers');       // ✗ Type Error - not in union
setActiveView('AGENTS');        // ✗ Type Error - case matters
setActiveView('');              // ✗ Type Error - empty string not valid
setActiveView(null);            // ✗ Type Error - null not valid
```

**Benefit:** Catch typos at compile time, not runtime

---

## 🔍 Debugging Tips

### Check Current activeView
```typescript
// In React DevTools
// Look for activeView state in component

// Or in code
console.log('Current view:', activeView);
```

### Trace a Button Click
```typescript
// Add logging to onClick
onClick={(e) => {
  console.log('Clicked view:', view);          // What was clicked
  console.log('Previous view:', activeView);   // What was active
  e.preventDefault();
  setActiveView(view);
  console.log('New view:', view);              // What it will be
}}
```

### Check Content Rendering
```typescript
// Content area should show EXACTLY ONE component
// If none show: activeView doesn't match any condition
// If multiple show: Duplicate condition (bug)

// Count active components:
const activeComponents = [
  activeView === 'chats' ? 1 : 0,
  activeView === 'agents' ? 1 : 0,
  activeView === 'starred' ? 1 : 0,
  // ... etc
].reduce((a,b) => a+b, 0);

console.assert(activeComponents === 1, 'Expected exactly 1 active component');
```

---

## 🧪 Testing Examples

```typescript
// Test 1: Initial state
expect(activeView).toBe('chats');

// Test 2: Update on button click
fireEvent.click(agentsButton);
expect(activeView).toBe('agents');

// Test 3: Correct component renders
fireEvent.click(agentsButton);
expect(queryByText('NavAgentsView')).toBeInTheDocument();
expect(queryByText('NavAgents')).not.toBeInTheDocument();

// Test 4: Button styling
const agentsButton = getByText('Workers');
fireEvent.click(agentsButton);
expect(agentsButton).toHaveClass('bg-card');

// Test 5: URL sync
// Simulate navigation to /triggers
act(() => {
  window.history.pushState({}, '', '/triggers');
});
expect(activeView).toBe('starred');
```

---

## 📊 Pattern Complexity Rating

| Aspect | Complexity | Why |
|--------|-----------|-----|
| **Understanding** | ⭐ Low | Simple state machine |
| **Implementation** | ⭐ Low | Just `useState` + conditionals |
| **Maintenance** | ⭐ Low | Adding views is straightforward |
| **Testing** | ⭐ Low | Each view tested independently |
| **Debugging** | ⭐⭐ Moderate | URL mismatch can be confusing |
| **Scaling** | ⭐⭐⭐ Moderate | Works to ~15 views, then consider refactor |

---

## 🚀 Performance Characteristics

```
User clicks button
         │
         ▼
    Re-render triggered
         │
    ┌────┴────┐
    ▼         ▼
  Buttons  Content Area
  (Small)  (Large, but...)
    │         │
    └─────────┴── Only 1 active component mounted
                 Other components NOT in DOM
                 
Result: Minimal performance impact
```

**Cost per View Switch:**
- 6 buttons re-render (small)
- 1 new component mounts (depends on size)
- Previous component unmounts
- ~15-50ms depending on component complexity

---

## 🎓 Related Concepts

| Concept | Connection |
|---------|-----------|
| **Discriminated Union** | Type safety for activeView values |
| **Exhaustive Conditionals** | Each view explicitly handled |
| **Event Delegation** | Multiple buttons share pattern |
| **Controlled Component** | activeView controls what renders |
| **State Machine** | activeView has finite states |
| **Lazy Rendering** | Only active component renders |

---

## 📚 Code Snippets to Copy

### Add New View (3 Steps)

```typescript
// 1. Update type
const [activeView, setActiveView] = useState<
  'chats' | 'agents' | 'starred' | 'newView'  // ← Add here
>('chats');

// 2. Add button to appropriate row
{ view: 'newView' as const, icon: NewIcon, label: 'New' }

// 3. Add content renderer
{activeView === 'newView' && <NewViewComponent />}
```

### Add View Sync from URL

```typescript
// Inside useEffect that depends on pathname
if (pathname?.includes('/newroute')) {
  setActiveView('newView');
}
```

### Memoize Content (Performance)

```typescript
const renderContent = useMemo(() => {
  switch(activeView) {
    case 'chats': return <NavAgents />;
    case 'agents': return <NavAgentsView />;
    case 'starred': return <NavGlobalConfig />;
    // ... etc
    default: return null;
  }
}, [activeView]);

return (
  <div className="px-6 flex-1 overflow-hidden">
    {renderContent}
  </div>
);
```

---

**Last Updated:** November 2, 2025  
**Quick Reference Version:** 1.0  
**For Full Details:** See `ACTIVEVIEW_PATTERN.md`
