# Fix Embedded Desktop Header

## Summary
Fixed the embedded desktop header behavior in Kortix Computer to distinguish between embedded and fullscreen modes, implementing a toggle functionality.

### Changes
- **ToolbarButtons.tsx**: 
    - Added `isEmbedded` and `isExpanded` props.
    - Added `Minimize2` icon.
    - Implemented logic to toggle between "Expand" (`Maximize2`) and "Restore" (`Minimize2`) buttons when embedded.
- **PanelHeader.tsx**:
    - Updated to accept `isEmbedded`, `isExpanded`, and `onMaximize` props.
    - Removed unused `isSuiteMode` legacy code.
    - Passed new props down to `ToolbarButtons`.
- **Desktop.tsx**: 
    - Updated `SandboxDesktop` to accept `isEmbedded`, `isExpanded` props.
    - Passed these props to the internal `PanelHeader`.
- **KortixComputer.tsx**:
    - Updated `SandboxDesktop` usage to pass `isEmbedded={true}`, `isExpanded={isMaximized}`.
    - Updated `onMaximize` callback to toggle state: `() => setIsMaximized(!isMaximized)`.
    - Removed legacy `isSuiteMode` state.

### Outcome
The embedded `SandboxDesktop` component now correctly reflects the Kortix Computer's state. When embedded:
- If minimized (normal), showing "Expand" button.
- If maximized (fullscreen), showing "Restore" button.
This "Expand/Restore" toggle replaces the confusing "Close" button in the embedded view, ensuring clean state management and UI behavior.
