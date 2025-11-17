# Wide Research Mode - Frontend Implementation

## Overview

Wide Research is a new content mode in the Suna chat interface that enables users to conduct structured research across large datasets with configurable depth levels and visualization preferences. Users can select research depth (Exploratory, Detailed, Competitive Intelligence) and preferred visualization types (Timeline, Network, Comparison, etc.) before submitting their research query.

## Files Modified

### 1. `frontend/src/components/dashboard/suna-modes-panel.tsx`

**Changes:**
- Added `'wide-research'` to the `ModeType` union type
- Created complete mode configuration object with:
  - **ID**: `'wide-research'`
  - **Label**: "Wide Research"
  - **Icon**: Search icon from lucide-react
  - **24 Sample Prompts**: Research-focused examples covering biotech, academia, startups, and general research topics
  - **Options**: 3 research depth levels (Exploratory, Detailed, Competitive Intelligence)
  - **Chart Types**: 8 visualization options (Timeline, Comparison, Network, Treemap, Sankey, Matrix, Bar, Line)

**UI Rendering:**
- Added conditional rendering for wide-research mode options (lines 1564-1629)
- Displays research depth as a grid of selectable cards with checkmark indicators
- Updated chart types section to render for both `data` and `wide-research` modes (line 1634)

### 2. `frontend/src/components/thread/chat-input/chat-input.tsx`

**Changes:**
- Updated `getModeIcon()` function to handle `'wide-research'` case (line 55-56)
- Added `generateWideResearchMarkdown()` function (lines 371-391):
  - Generates markdown configuration based on selected depth and visualizations
  - Only generates markdown if mode is active and options are selected
  - Format: `**Wide Research Configuration:**` with depth and visualization preferences
- Updated `handleSubmit()` to append wide-research markdown to message (lines 489-493)
- Added `generateWideResearchMarkdown` to useCallback dependency array (line 508)

**Message Assembly Order:**
1. User's typed message
2. Slash command injections (if active)
3. Uploaded files (if any)
4. Data options markdown (if data mode)
5. Slides template markdown (if slides mode)
6. **Wide research markdown (if wide-research mode)** ← New

### 3. `frontend/src/stores/suna-modes-store.ts`

**Changes:**
- Updated `setSelectedMode()` logic to preserve `selectedCharts` and `selectedOutputFormat` when switching between `data` and `wide-research` modes (line 28)
- Both modes now share the same state for depth/format and visualization preferences

## State Management

### Zustand Store (`useSunaModesStore`)

**Persisted State:**
- `selectedMode`: Current mode (`'wide-research'` or null)
- `selectedOutputFormat`: Research depth (exploratory/detailed/competitive)
- `selectedCharts`: Array of selected visualization types
- `selectedTemplate`: Unused for wide-research (slides-only)

**Auto-Reset Behavior:**
- When switching away from wide-research: clears `selectedCharts` and `selectedOutputFormat`
- When switching to wide-research from data: preserves existing chart and format selections
- Persisted to localStorage via `suna-modes-storage` key

## User Experience Flow

1. **Mode Selection**: User clicks "Wide Research" button in mode selector
2. **Configuration**: UI displays:
   - Research depth options as selectable cards
   - Visualization preferences as multi-select grid
3. **Sample Prompts**: 24 research-focused prompts available for quick selection
4. **Message Submission**: User types query and selects options, then submits
5. **Markdown Injection**: Configuration appended to message as structured markdown
6. **Backend Processing**: Agent receives full message with embedded research hints

## Sample Prompts

**24 Total Prompts** organized by category:

**Biotech & Pharma (10):**
- Biotechnology startups (Series funding, locations, websites)
- Biotech researchers (PhD institutions, publications, h-index)
- Clinical trial databases (drug names, phases, efficacy rates)
- Venture capital partners (biotech-focused)
- Academic conferences (disciplines, acceptance rates)
- Pharmaceutical compounds (mechanisms, targets, approvals)
- Medical device companies (FDA approvals, market caps)
- University research centers (focus areas, funding)
- Drug development timelines (phases, costs, regulatory hurdles)

**General Research (5):**
- NeuroPS researchers (areas, affiliations, citations)
- Sneaker comparison (features, pricing, resale metrics)
- NASA legends (biographies, missions, quotes)
- Indie game developers (portfolios, genres, revenue)
- Vinyl records (artists, decades, conditions)

**Startup Ecosystem (9):**
- Early-stage founders (backgrounds, exits, funding stage)
- Series A venture funds (check sizes, portfolio, returns)
- Startup accelerators (acceptance rates, alumni success)
- SaaS startups (ARR, CAC, churn metrics)
- Startup pitch decks (valuations, funding rounds)
- Startup employees (roles, salaries, equity)
- Startup failure case studies (reasons, lessons)
- Startup ecosystems (funding volumes, talent, exits)
- Startup metrics dashboards (KPIs, growth, unit economics)
- Startup go-to-market strategies (segments, pricing, channels)

## Research Depth Options

| Option | ID | Description |
|--------|----|----|
| Exploratory | `exploratory` | High-level summary for each researched item |
| Detailed | `detailed` | In-depth analysis for each researched item |
| Competitive Intelligence | `competitive` | Competitive analysis for each researched item |

## Visualization Types

| Type | ID | Description |
|------|----|----|
| Timeline | `timeline` | Timeline visualization |
| Comparison | `comparison` | Comparison chart |
| Network | `network` | Network diagram |
| Treemap | `treemap` | Treemap visualization |
| Sankey | `sankey` | Sankey diagram |
| Matrix | `matrix` | Matrix visualization |
| Bar | `bar` | Bar chart |
| Line | `line` | Line chart |

## Example Output

When a user selects "Detailed" depth and "Network" + "Timeline" visualizations, the markdown appended to their message is:

```
----

** Wide Research Configuration:**

- **Output Format:** detailed
- **Preferred Visualizations:**
  - network
  - timeline
```

## Integration Points

- **UI Components**: Integrated into existing mode selector and options panel
- **State Management**: Uses existing Zustand store with shared state for data/wide-research
- **Message Submission**: Appended during `handleSubmit()` alongside other mode configurations
- **Persistence**: Automatically persisted to localStorage
- **Icons**: Uses existing lucide-react Search icon

## Testing Checklist

- [ ] Mode appears in mode selector
- [ ] Sample prompts populate input when clicked
- [ ] Research depth options are selectable
- [ ] Chart type preferences are multi-selectable
- [ ] State persists across page reloads
- [ ] Markdown is generated and appended correctly
- [ ] Mode resets when switching to different mode
- [ ] UI animations and transitions work smoothly
- [ ] Mobile responsive layout works
