# Frontend Performance Optimizations

This document outlines the performance optimizations implemented and additional recommendations for the Kortix frontend application.

## Implemented Optimizations

### 1. Dynamic Imports for Tool Views (Critical)
**File**: `src/components/thread/tool-views/wrapper/ToolViewRegistry.tsx`

**Problem**: All 82 tool view components were statically imported, causing them to be included in the initial bundle even if never used.

**Solution**: 
- Converted all static imports to Next.js `dynamic()` imports with SSR disabled
- Added Suspense wrapper with loading fallback for lazy-loaded components
- Components now load on-demand when a specific tool is used

**Impact**: 
- Significantly reduced initial bundle size
- Faster initial page load
- Better code splitting

### 2. React.memo for ThreadContent (Critical)
**File**: `src/components/thread/content/ThreadContent.tsx`

**Problem**: The ThreadContent component (1210 lines) re-rendered on every parent state change, even when its props hadn't changed.

**Solution**: 
- Wrapped the component with React.memo
- Prevents unnecessary re-renders when props remain the same

**Impact**:
- Reduced re-render frequency for chat/thread views
- Improved rendering performance during streaming

### 3. Image Optimization (High Priority)
**Files**: 
- `src/components/ui/docs-card.tsx`
- `src/components/agents/marketplace-agent-preview-dialog.tsx`

**Problem**: Using regular `<img>` tags instead of Next.js Image component, missing automatic optimization.

**Solution**:
- Replaced `<img>` with Next.js `Image` component
- Added proper sizing attributes
- Configured responsive sizes

**Impact**:
- Automatic WebP/AVIF conversion
- Lazy loading by default
- Responsive image sizing

### 4. Next.js Configuration Enhancements
**File**: `frontend/next.config.ts`

**Added optimizations**:
- Image optimization with AVIF and WebP formats
- SWC minification enabled
- Console removal in production (keeping error/warn)
- Advanced webpack chunk splitting:
  - Separate vendor chunk for node_modules
  - Common chunk for shared code
  - Lib chunk for React/Next.js core

**Impact**:
- Better code splitting
- Smaller bundle sizes
- Faster builds with SWC

### 5. useCallback Optimizations
**File**: `src/components/thread/chat-input/chat-input.tsx`

**Problem**: Event handlers not wrapped in useCallback, causing unnecessary re-renders of child components.

**Solution**:
- Wrapped `handlePaste`, `handleDragOver`, and `handleDragLeave` in useCallback
- Added proper dependency arrays

**Impact**:
- Prevents recreation of handler functions on every render
- Reduces re-renders of child components receiving these handlers as props

## Additional Recommendations

### 1. Additional Image Optimizations
**Priority**: Medium

There are still 80+ files using `<img>` tags that could be optimized:
- `src/components/file-renderers/authenticated-markdown-renderer.tsx`
- `src/components/agents/mcp/mcp-server-card.tsx`
- `src/components/agents/composio/composio-app-card.tsx`
- Various home page animation components

**Note**: Some uses like `image-renderer.tsx` are acceptable as they need direct manipulation for zoom/rotate features.

### 2. List Rendering Optimizations
**Priority**: Medium

Components that could benefit from additional memoization:
- File attachment lists in `attachment-group.tsx`
- Navigation items in sidebar components
- Agent/template lists in marketplace

**Recommendation**: 
- Use `useMemo` for filtered/sorted lists
- Add stable `key` props (avoid using array indices)
- Consider React.memo for list item components

### 3. Virtual Scrolling
**Priority**: Low-Medium

For long lists (threads, messages, templates), implement virtual scrolling:
- Consider `react-virtual` or `react-window`
- Most beneficial for thread message lists with 100+ messages

### 4. State Management Optimization
**Priority**: Medium

**Current observations**:
- Some components have many useState calls
- Consider consolidating related state with useReducer
- Zustand is already used for agent selection (good pattern)

**Recommendations**:
- Evaluate if more global state should use Zustand
- Reduce prop drilling by using context for deeply nested components

### 5. Debouncing and Throttling
**Priority**: Low

**Already implemented well in**:
- Search components use debouncing (300ms)

**Could benefit from**:
- Window resize handlers
- Scroll event handlers
- Input validation

### 6. Code Splitting for Routes
**Priority**: Medium

**Current state**: Limited use of dynamic imports (only 1 found before our changes)

**Recommendations**:
- Dynamic import heavy dashboard sections
- Lazy load admin panels
- Lazy load billing components
- Consider route-based code splitting for non-critical pages

### 7. Bundle Analysis
**Priority**: High (for monitoring)

**Recommendation**: Add bundle analysis to development workflow:

```bash
npm install --save-dev @next/bundle-analyzer
```

Add to `next.config.ts`:
```typescript
import withBundleAnalyzer from '@next/bundle-analyzer';

const bundleAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

// Wrap the config function with bundle analyzer
const nextConfigWithAnalyzer = () => bundleAnalyzer(nextConfig());

export default nextConfigWithAnalyzer;
```

Run with: `ANALYZE=true npm run build`

### 8. React Query Optimization
**Priority**: Low-Medium

**Current state**: React Query is already in use (good)

**Recommendations**:
- Review staleTime and cacheTime configurations
- Implement optimistic updates where applicable
- Consider prefetching for predictable navigation paths

### 9. Font Optimization
**Priority**: Low

**Check**:
- Ensure fonts are self-hosted or using Next.js font optimization
- Verify font-display: swap is used
- Remove unused font weights

### 10. Third-Party Script Optimization
**Priority**: Medium

**Observed**: PostHog and other analytics

**Recommendations**:
- Ensure analytics load asynchronously
- Consider loading analytics after user interaction
- Use Next.js Script component with appropriate strategy

## Performance Monitoring

### Recommended Tools:
1. **Lighthouse CI** - Automated performance testing
2. **Web Vitals** - Already using @vercel/analytics (good)
3. **React DevTools Profiler** - Identify expensive renders
4. **Chrome DevTools Performance** - Analyze runtime performance

### Key Metrics to Monitor:
- **LCP (Largest Contentful Paint)**: Target < 2.5s
- **FID (First Input Delay)**: Target < 100ms
- **CLS (Cumulative Layout Shift)**: Target < 0.1
- **TTI (Time to Interactive)**: Target < 3.8s
- **Bundle Size**: Monitor for regressions

## Testing the Optimizations

### Before Deployment:
1. Run production build: `npm run build`
2. Test critical user flows
3. Verify lazy loading works correctly
4. Check for any broken images
5. Ensure tool views load properly on demand

### Potential Issues to Watch:
1. **Suspense boundaries**: Ensure loading states are smooth
2. **Image domains**: May need to add external image domains to next.config.ts
3. **Chunk loading**: Monitor for any chunk loading errors in production

## Summary

The implemented optimizations target the most critical performance bottlenecks:
- ✅ Reduced initial bundle size via dynamic imports
- ✅ Prevented unnecessary re-renders with React.memo
- ✅ Optimized images with Next.js Image component
- ✅ Enhanced build configuration for better splitting
- ✅ Stabilized event handlers with useCallback

These changes should provide noticeable improvements in initial load time and runtime performance, particularly for users accessing the thread/chat interface.
