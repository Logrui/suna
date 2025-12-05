# PR Title
feat: Update Daytona sandbox streaming resolution to 1440x900

# PR Description

## Summary

This PR updates the Daytona sandbox streaming resolution from 1048x768 (backend) / 1024x768 (frontend/Docker) to a consistent **1440x900** resolution across all components.

## Changes

- ✅ Updated backend sandbox configuration to use 1440x900 resolution
- ✅ Updated frontend VNC preloader iframe dimensions to match
- ✅ Updated Daytona Docker image default environment variables
- ✅ Added comprehensive customization guide documentation

## Files Modified

1. **`backend/core/sandbox/sandbox.py`** (lines 99-101)
   - Changed `RESOLUTION` env var from `1048x768x24` to `1440x900x24`
   - Updated `RESOLUTION_WIDTH` from `1048` to `1440`
   - Updated `RESOLUTION_HEIGHT` from `768` to `900`

2. **`frontend/src/hooks/files/useVncPreloader.ts`** (lines 48-49)
   - Changed preloader iframe width from `1024px` to `1440px`
   - Changed preloader iframe height from `768px` to `900px`

3. **`backend/core/sandbox/docker/Dockerfile`** (lines 124, 127-128)
   - Updated default `RESOLUTION` from `1024x768x24` to `1440x900x24`
   - Updated default `RESOLUTION_WIDTH` from `1024` to `1440`
   - Updated default `RESOLUTION_HEIGHT` from `768` to `900`

4. **`STREAMING_RESOLUTION_CUSTOMIZATION_GUIDE.md`** (new file)
   - Comprehensive guide on how the resolution system works
   - Step-by-step instructions for future customization
   - Troubleshooting section and performance considerations
   - Architecture overview and related components documentation

## Why This Change?

**Before:** The codebase had inconsistent resolution values:
- Backend: 1048x768
- Frontend: 1024x768
- Docker: 1024x768

**After:** All components now use 1440x900, which:
- ✅ Provides better display quality for modern screens
- ✅ Uses 16:10 aspect ratio (common for web interfaces)
- ✅ Balances quality with reasonable resource usage (~150MB memory, 4-6 Mbps streaming)
- ✅ Eliminates scaling artifacts from dimension mismatches

## Technical Details

The resolution affects three layers:

1. **Backend (`sandbox.py`)**: Sets env vars when creating Daytona sandbox instances
2. **Frontend (`useVncPreloader.ts`)**: Configures iframe dimensions for VNC stream display
3. **Docker (`Dockerfile`)**: Provides default values for Xvfb (X Virtual Framebuffer)

All three must be synchronized to prevent scaling issues and ensure optimal rendering.

## Testing Recommendations

1. Create a new sandbox by triggering a browser tool action
2. Verify VNC stream displays at 1440x900 without distortion
3. Check aspect ratio appears correct (16:10)
4. Monitor sandbox resource usage doesn't exceed limits
5. Test on different screen sizes to verify responsive scaling

## Breaking Changes

⚠️ **Existing sandboxes** created before this change will retain their original resolution (1048x768 or 1024x768). They will continue to work but won't benefit from the higher resolution until they are deleted and recreated.

**Impact:** Minimal - VNC streaming will continue to function, just at the old resolution for existing sandboxes.

## Documentation

See the new **`STREAMING_RESOLUTION_CUSTOMIZATION_GUIDE.md`** for:
- How to customize resolution for your specific needs
- Performance impact of different resolutions
- Troubleshooting common issues
- Advanced customization options (per-user, per-agent resolution)

## Checklist

- [x] Backend resolution updated
- [x] Frontend resolution updated
- [x] Docker image resolution updated
- [x] All three components use identical dimensions
- [x] Documentation added
- [x] Commit message follows conventional commits format
