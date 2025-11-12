# Database Tab Bar Architecture & Sizing Guide

## Overview

The knowledge base section in Suna uses a sophisticated tab navigation system called **FancyTabs** that intelligently sizes and displays database-related tabs. This document explains the complete architecture, sizing strategy, and component hierarchy.

---

## Component Hierarchy

```
KnowledgeBasePage
├── KnowledgeBasePageHeader
├── KBTabsNavigation          ← Tab bar wrapper
│   └── FancyTabs             ← Core tab component (sizing logic here)
│       └── TabButton × N     ← Individual tab buttons
└── Content Area (Conditional)
    ├── KnowledgeBaseManager  (if activeTab === "knowledge-base")
    ├── PromptsTab            (if activeTab === "prompts")
    └── DatabasesTab          (if activeTab === "databases")
```

---

## Tab Configuration

### Available Tabs

The tab bar displays a fixed set of tabs defined in `kb-tabs-navigation.tsx`:

```typescript
const kbTabs: TabConfig[] = [
  {
    value: 'knowledge-base',
    icon: BookOpen,
    label: 'Knowledge Base',
  },
  {
    value: 'prompts',
    icon: Zap,
    label: 'Prompts',
  },
  {
    value: 'databases',
    icon: Database,
    label: 'Databases',
  },
];
```

### Optional "Add New" Tab

If `onAddDatabase` callback is provided, a fourth tab is dynamically added:

```typescript
if (onAddDatabase) {
  return [
    ...kbTabs,
    { value: 'add-database', icon: Plus, label: 'Add New' }
  ];
}
```

---

## FancyTabs Sizing Strategy

### Container Sizing

The **FancyTabs** component uses a CSS Grid-based layout for automatic tab sizing:

```tsx
<div 
  className="overflow-hidden grid w-full max-w-lg mx-auto rounded-3xl p-1.5"
  style={{
    gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
    // Dynamic: repeat(3, 1fr) or repeat(4, 1fr) depending on tab count
  }}
>
```

**Key measurements:**

| Property | Value | Purpose |
|----------|-------|---------|
| `w-full` | 100% width | Takes full container width |
| `max-w-lg` | 32rem (512px) | Maximum container width |
| `rounded-3xl` | 24px border radius | Fully rounded pill-shaped container |
| `p-1.5` | 6px padding | Internal spacing around grid |
| `overflow-hidden` | Hidden | Clips tabs to rounded corners |

### Grid Layout

The grid uses **equal-width columns** that automatically adjust to tab count:

```typescript
// For 3 tabs (Knowledge Base, Prompts, Databases)
gridTemplateColumns: `repeat(3, 1fr)`  // 1fr + 1fr + 1fr = equal width

// For 4 tabs (+ Add New)
gridTemplateColumns: `repeat(4, 1fr)`  // 1fr + 1fr + 1fr + 1fr = equal width
```

**Calculation Example (3 tabs):**
- Container width: 512px
- Padding: 6px × 2 = 12px
- Available space: 512px - 12px = 500px
- Per tab: 500px ÷ 3 = ~166.67px

### Individual Tab Button Sizing

Each tab button (`TabButton` component) has fixed sizing:

```tsx
className={cn(
  "relative flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium",
  // Sizing: px-4 (16px horizontal padding), py-2.5 (10px vertical padding)
)}
```

**Tab Button Measurements:**

| Property | Value | Purpose |
|----------|-------|---------|
| `px-4` | 16px | Horizontal padding (both sides) |
| `py-2.5` | 10px | Vertical padding (both sides) |
| `rounded-2xl` | 16px | Border radius for button |
| `text-sm` | 14px | Font size for label text |
| `gap-2` | 8px | Space between icon and label |

**Icon Sizing:**
```tsx
<Icon className="h-4 w-4" />  // 16px × 16px icon
```

---

## Responsive Behavior

### Mobile vs Desktop

The tab bar includes responsive text display:

```tsx
<span className="hidden sm:inline">{tab.label}</span>      {/* Desktop: Show full label */}
{tab.shortLabel && (
  <span className="sm:hidden">{tab.shortLabel}</span>      {/* Mobile: Show short label */}
)}
```

**Breakpoint:** `sm` = 640px

**Current Labels:**

| Tab | Full Label | Short Label |
|-----|-----------|------------|
| Knowledge Base | "Knowledge Base" | (none defined) |
| Prompts | "Prompts" | (none defined) |
| Databases | "Databases" | (none defined) |
| Add New | "Add New" | (none defined) |

> 💡 **Note:** Currently no short labels are defined, so labels are hidden on mobile and only icons show.

### Mobile Layout (< 640px)

On screens < 640px:
- Tab labels are hidden
- Only icons display
- More space-efficient layout
- Container can scale down further if needed

### Desktop Layout (≥ 640px)

On screens ≥ 640px:
- Tab labels are visible
- Icons + labels displayed side-by-side
- Full semantic information available

---

## Visual States

### Active Tab

When a tab is active (`activeTab === tab.value`):

**Dark Mode:**
```tsx
isActive 
  ? isDark ? "text-white" : "text-foreground bg-background border border-border/50"
  : isDark ? "text-white/60 hover:text-white/85" : "text-muted-foreground hover:text-foreground"
```

With glassmorphism effect:
```tsx
background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.08))',
backdropFilter: 'blur(12px)',
boxShadow: `
  0 4px 8px rgba(0, 0, 0, 0.1),
  0 0 20px rgba(255, 255, 255, 0.1),
  0 0 40px rgba(255, 255, 255, 0.1),
  inset 0 1px 0 rgba(255, 255, 255, 0.2)
`
```

**Light Mode:**
```tsx
text-foreground bg-background border border-border/50
```

### Inactive Tab

Hover effect:
```tsx
!isActive && (isDark ? "hover:bg-white/8" : "hover:bg-muted/60")
```

Text color:
```tsx
isDark ? "text-white/60 hover:text-white/85" : "text-muted-foreground hover:text-foreground"
```

### Transitions

```tsx
className="transition-all duration-300 ease-out"
```

- Duration: 300ms
- Easing: ease-out (smooth deceleration)
- Properties animated: all (color, background, border, etc.)

---

## Container Layout in KnowledgeBasePage

The tab bar is positioned within a sticky container:

```tsx
<div className="sticky top-0 z-50">
  <div className="absolute inset-0 backdrop-blur-md" style={{
    maskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 100%)',
    WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 60%, transparent 100%)'
  }}></div>
  <div className="relative bg-gradient-to-b from-background/95 via-background/70 to-transparent">
    <div className="container mx-auto max-w-7xl px-4 py-4">
      <KBTabsNavigation {...props} />
    </div>
  </div>
</div>
```

**Container Measurements:**

| Property | Value | Purpose |
|----------|-------|---------|
| `sticky top-0` | Top: 0px | Sticks to viewport top |
| `z-50` | Stack: 50 | Above most content (but not modals/dialogs) |
| `max-w-7xl` | 80rem (1280px) | Max width wrapper |
| `px-4` | 16px | Horizontal padding |
| `py-4` | 16px | Vertical padding |
| `rounded-3xl` | 24px | FancyTabs border radius |

**Background Effects:**
- Gradient: `from-background/95 via-background/70 to-transparent`
- Backdrop blur: 12px blur
- Gradient mask: Fades from opaque (0%) to transparent (100%)

---

## Data Flow

### Tab Selection Flow

```
User clicks TabButton
    ↓
onClick() triggered
    ↓
onTabChange(value) called
    ↓
If value === 'add-database':
    → Call onAddDatabase() callback
Else:
    → Update URL search params: ?tab={value}
    → KnowledgeBasePage re-renders
    ↓
activeTab state updates
    ↓
Conditional content renders (KnowledgeBaseManager, PromptsTab, DatabasesTab)
```

### State Management (URL-Based)

```typescript
// In KnowledgeBasePage
const activeTab = useMemo(() => {
  const tab = searchParams.get('tab');
  return tab || 'knowledge-base';  // Default: knowledge-base
}, [searchParams]);

const handleTabChange = (newTab: string) => {
  const params = new URLSearchParams(searchParams.toString());
  params.set('tab', newTab);
  router.replace(`${pathname}?${params.toString()}`);  // Update URL
};
```

**URL Examples:**
- `/knowledge-base` → `?tab=knowledge-base` (default)
- `/knowledge-base?tab=prompts` → Shows Prompts tab
- `/knowledge-base?tab=databases` → Shows Databases tab

---

## Current Implementation: DatabasesTab

The **Databases** tab currently displays a placeholder:

```tsx
export const DatabasesTab = () => {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-400px)]">
      <div className="text-center">
        <div className="text-muted-foreground text-lg mb-2">
          Databases
        </div>
        <p className="text-sm text-muted-foreground">
          Database management coming soon
        </p>
      </div>
    </div>
  );
};
```

**Sizing:**
- `min-h-[calc(100vh-400px)]` - Takes most of viewport height
- Centered content using flexbox
- Placeholder text styled with muted colors

---

## CSS Variables & Theme Integration

### Dark Mode Detection

```typescript
const { theme } = useTheme();
const isDark = theme === 'dark';
```

### Conditional Styling

Different styles applied based on `isDark`:

**Dark Mode:**
```tsx
background: 'rgba(255, 255, 255, 0.05)',
backdropFilter: 'blur(20px)',
```

**Light Mode:**
```tsx
"border-border/20 bg-muted"
```

### Design Tokens Used

| Token | Usage | Example Value |
|-------|-------|--------------|
| `background` | Container background | `#000000` (dark) / `#ffffff` (light) |
| `foreground` | Text color | `#ffffff` (dark) / `#000000` (light) |
| `muted-foreground` | Disabled/secondary text | `rgba(255, 255, 255, 0.6)` |
| `border` | Border color | `rgba(255, 255, 255, 0.1)` |
| `border/20` | Lighter borders | `rgba(..., 0.2)` |

---

## Performance Considerations

### Memoization

```typescript
const tabs = React.useMemo(() => {
  if (onAddDatabase) {
    return [...kbTabs, { value: 'add-database', ... }];
  }
  return kbTabs;
}, [onAddDatabase]);
```

- Prevents unnecessary tab array recreation
- Only recreates if `onAddDatabase` callback changes

### Transition Optimization

```tsx
className="transition-all duration-300 ease-out"
```

- Hardware-accelerated CSS transitions
- Uses `ease-out` for smoother feel
- 300ms duration balances responsiveness and smoothness

---

## Sizing Summary Table

### FancyTabs Container

| Aspect | Value | Breakpoint |
|--------|-------|-----------|
| Width | 100% / max 512px | All |
| Height | Auto (content-based) | All |
| Padding | 6px | All |
| Border Radius | 24px | All |
| Grid Columns | 3 or 4 equal | All |
| Backdrop Blur | 20px | Dark mode |

### Individual Tab Button

| Aspect | Value | Notes |
|--------|-------|-------|
| Padding (horizontal) | 16px | `px-4` |
| Padding (vertical) | 10px | `py-2.5` |
| Border Radius | 16px | `rounded-2xl` |
| Font Size | 14px | `text-sm` |
| Icon Size | 16px | `h-4 w-4` |
| Icon-Label Gap | 8px | `gap-2` |
| Min Height | ~36-40px | Content dependent |
| Transition Duration | 300ms | `duration-300` |

### Responsive Breakpoints

| Screen Size | Layout | Labels |
|------------|--------|--------|
| < 640px (mobile) | Icon only | Hidden |
| ≥ 640px (desktop) | Icon + Label | Visible |

---

## Key Features

✅ **Equal-width distribution** - All tabs same size using CSS Grid `1fr`  
✅ **Responsive** - Icons only on mobile, labels on desktop  
✅ **Glassmorphic design** - Backdrop blur + gradient effects  
✅ **Theme-aware** - Different styling for dark/light modes  
✅ **Sticky positioning** - Stays at top while scrolling  
✅ **URL state management** - Tab selection persists in URL  
✅ **Smooth transitions** - 300ms ease-out animations  
✅ **Accessibility** - Clear visual states for active/inactive tabs  
✅ **Extensible** - Easy to add new tabs dynamically  

---

## Future Considerations

1. **Short Labels** - Could add abbreviations for mobile (e.g., "KB" for "Knowledge Base")
2. **Dynamic Tab Width** - Could make tabs equal to content width instead of equal distribution
3. **Tab Icons Only Mode** - Option to hide labels entirely for compact UI
4. **Drag-to-Reorder** - Could allow users to customize tab order
5. **Tab Badges** - Add notification badges (e.g., count of items)
6. **Keyboard Navigation** - Arrow keys to switch tabs
7. **Virtualization** - If many tabs needed in future
