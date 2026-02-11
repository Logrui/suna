/**
 * Agent Tools Module Index
 * 
 * This module provides API-driven tool configuration for agents.
 * All tool metadata is fetched from the backend auto-discovery system.
 */

// Export granular tool configuration component
export { GranularToolConfiguration } from './granular-tool-configuration';

// Export tool groups utilities and types
export {
    type ToolMethod,
    type ToolGroup,
    normalizeToolGroup,
    sortToolsByWeight,
    getToolGroup,
    getAllToolGroups,
    hasGranularControl,
    getEnabledMethodsForTool,
    validateToolConfig,
    convertLegacyToolConfig,
    TOOL_GROUPS
} from './tool-groups';

// Legacy compatibility - empty object since we're now API-driven
// Use useToolsMetadata() hook to fetch actual tool definitions
export const AGENTPRESS_TOOL_DEFINITIONS: Record<string, { isCore?: boolean }> = {};
