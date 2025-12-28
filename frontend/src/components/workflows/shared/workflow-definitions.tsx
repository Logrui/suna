import {
    FileText, Terminal, Rocket, Computer, Eye, Search, Globe, GitBranch,
    Settings, MonitorPlay, Cog, Key, Presentation, FileOutput, Table2,
    MessageSquare, Users, Building, BookOpen, Mic, Bot, Zap, Wrench,
    Upload, Image, Database, FolderOpen, Play, Share2, Code, Layers,
    Palette, FileSearch, UserSearch, Briefcase, ScrollText, Phone,
    type LucideIcon
} from 'lucide-react';
import type { ToolMetadata } from '@/hooks/tools/use-tools-metadata';

export interface StepDefinition {
    id: string;
    name: string;
    description: string;
    icon: LucideIcon;
    /** Optional image URL for the icon (used for Composio toolkit icons) */
    iconUrl?: string;
    category: string;
    /** Optional group name for organizing tools (e.g., Composio toolkit name or MCP server name) */
    group?: string;
    /** Optional group icon URL (e.g., Composio toolkit logo) */
    groupIconUrl?: string;
    color: string;
    config?: Record<string, unknown>;
}

export interface CategoryDefinition {
    id: string;
    name: string;
    description: string;
}

/**
 * Map of icon string names (from backend) to Lucide React components.
 * The backend returns icon names like "FolderOpen", we need to map them to actual components.
 */
export const ICON_NAME_MAP: Record<string, LucideIcon> = {
    // File and folder icons
    'FileText': FileText,
    'FolderOpen': FolderOpen,
    'File': FileText,
    'Files': FileText,
    'Upload': Upload,

    // Terminal and code
    'Terminal': Terminal,
    'Code': Code,
    'Console': Terminal,

    // Deployment and exposure
    'Rocket': Rocket,
    'Deploy': Rocket,
    'Computer': Computer,
    'Server': Computer,
    'Share': Share2,
    'Share2': Share2,
    'Play': Play,

    // Vision and media
    'Eye': Eye,
    'Vision': Eye,
    'Image': Image,
    'ImageEdit': Image,
    'Palette': Palette,

    // Search icons
    'Search': Search,
    'FileSearch': FileSearch,
    'UserSearch': UserSearch,

    // Presentation and documents
    'Presentation': Presentation,
    'Slides': Presentation,
    'FileOutput': FileOutput,
    'Table': Table2,
    'Table2': Table2,
    'Spreadsheet': Table2,
    'ScrollText': ScrollText,

    // Communication
    'MessageSquare': MessageSquare,
    'Message': MessageSquare,
    'Chat': MessageSquare,
    'Phone': Phone,
    'Mic': Mic,
    'Voice': Mic,

    // People and organizations
    'Users': Users,
    'User': Users,
    'Building': Building,
    'Building2': Building,
    'Briefcase': Briefcase,
    'BookOpen': BookOpen,

    // Version control
    'GitBranch': GitBranch,
    'Git': GitBranch,

    // Configuration and settings
    'Settings': Settings,
    'Cog': Cog,
    'Gear': Cog,
    'Key': Key,
    'Lock': Key,

    // Web and network
    'Globe': Globe,
    'Web': Globe,
    'Browser': MonitorPlay,
    'MonitorPlay': MonitorPlay,

    // Database
    'Database': Database,
    'Storage': Database,
    'Layers': Layers,

    // AI and automation
    'Bot': Bot,
    'Robot': Bot,
    'Zap': Zap,
    'Lightning': Zap,
    'Trigger': Zap,

    // Generic
    'Wrench': Wrench,
    'Tool': Wrench,
};

// Base step definitions
export const BASE_STEP_DEFINITIONS: StepDefinition[] = [
    {
        id: 'instruction',
        name: 'Instruction',
        description: 'Add a custom instruction step',
        icon: FileText,
        category: 'actions',
        color: 'from-gray-500/20 to-gray-600/10 border-gray-500/20 text-gray-500'
    },
    {
        id: 'condition',
        name: 'If/Then',
        description: 'Add conditional logic',
        icon: Settings,
        category: 'conditions',
        color: 'from-orange-500/20 to-orange-600/10 border-orange-500/20 text-orange-500'
    },
    {
        id: 'mcp_configuration',
        name: 'Add a New Custom MCP Server',
        description: 'Add a new Custom MCP server for your Agent',
        icon: Cog,
        category: 'configuration',
        color: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/20 text-indigo-500',
        config: { step_type: 'mcp_configuration' }
    },
    {
        id: 'credentials_profile',
        name: 'Enable a New Composio App',
        description: 'Select and configure credentials and profiles via Composio for authentication',
        icon: Globe,
        category: 'configuration',
        color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20 text-emerald-500',
        config: { step_type: 'credentials_profile' }
    },
];

// Category definitions
export const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
    {
        id: 'actions',
        name: 'Prompts and Playbooks',
        description: 'Configure Prompts and Playbooks'
    },
    {
        id: 'conditions',
        name: 'Logic',
        description: 'Add logic and branching'
    },

    {
        id: 'tools',
        name: 'Native Tools',
        description: 'Use specific tools and integrations'
    },
    {
        id: 'integrations',
        name: 'App Integrations',
        description: 'Connect to Composio Apps and Custom MCP Servers'
    },
    {
        id: 'configuration',
        name: 'Add New Tools',
        description: 'Setup and configure new tools and integrations'
    },
];

// Default fallback icon for unknown tools
export const DEFAULT_TOOL_ICON: LucideIcon = Wrench;

// Default color for tools without color metadata
export const DEFAULT_TOOL_COLOR = 'from-gray-500/20 to-gray-600/10 border-gray-500/20 text-gray-500';

/**
 * Map of base color names to gradient classes.
 * Used to convert backend color strings like "bg-blue-100" to our gradient format.
 */
export const COLOR_BASE_MAP: Record<string, string> = {
    'blue': 'from-blue-500/20 to-blue-600/10 border-blue-500/20 text-blue-500',
    'purple': 'from-purple-500/20 to-purple-600/10 border-purple-500/20 text-purple-500',
    'green': 'from-green-500/20 to-green-600/10 border-green-500/20 text-green-500',
    'emerald': 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20 text-emerald-500',
    'orange': 'from-orange-500/20 to-orange-600/10 border-orange-500/20 text-orange-500',
    'red': 'from-red-500/20 to-red-600/10 border-red-500/20 text-red-500',
    'yellow': 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/20 text-yellow-500',
    'amber': 'from-amber-500/20 to-amber-600/10 border-amber-500/20 text-amber-500',
    'cyan': 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/20 text-cyan-500',
    'teal': 'from-teal-500/20 to-teal-600/10 border-teal-500/20 text-teal-500',
    'indigo': 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/20 text-indigo-500',
    'violet': 'from-violet-500/20 to-violet-600/10 border-violet-500/20 text-violet-500',
    'pink': 'from-pink-500/20 to-pink-600/10 border-pink-500/20 text-pink-500',
    'rose': 'from-rose-500/20 to-rose-600/10 border-rose-500/20 text-rose-500',
    'slate': 'from-slate-500/20 to-slate-600/10 border-slate-500/20 text-slate-500',
    'gray': 'from-gray-500/20 to-gray-600/10 border-gray-500/20 text-gray-500',
    'sky': 'from-sky-500/20 to-sky-600/10 border-sky-500/20 text-sky-500',
};

/**
 * Convert a backend color class to our gradient format.
 * Backend format: "bg-blue-100 dark:bg-blue-800/50" 
 * Our format: "from-blue-500/20 to-blue-600/10 border-blue-500/20 text-blue-500"
 */
export function convertBackendColorToGradient(backendColor?: string): string {
    if (!backendColor) return DEFAULT_TOOL_COLOR;

    // Extract color name from backend format like "bg-blue-100"
    const match = backendColor.match(/bg-(\w+)-\d+/);
    if (match && match[1]) {
        const colorName = match[1];
        return COLOR_BASE_MAP[colorName] || DEFAULT_TOOL_COLOR;
    }

    return DEFAULT_TOOL_COLOR;
}

/**
 * Get the icon component from a string icon name.
 * Uses ICON_NAME_MAP to resolve string names to Lucide components.
 */
export function getIconFromName(iconName?: string): LucideIcon {
    if (!iconName) return DEFAULT_TOOL_ICON;
    return ICON_NAME_MAP[iconName] || DEFAULT_TOOL_ICON;
}

/**
 * Format a snake_case tool name into a human-readable display name.
 * e.g., "sb_files_tool" -> "Sandbox Files"
 */
export function formatToolName(toolName: string): string {
    return toolName
        .replace(/^sb_/, 'Sandbox ')      // sb_files_tool -> Sandbox files_tool
        .replace(/_tool$/, '')             // Sandbox files_tool -> Sandbox files
        .replace(/_/g, ' ')                // Sandbox files -> Sandbox files
        .replace(/\b\w/g, l => l.toUpperCase()); // Sandbox Files
}

/**
 * Format a Composio tool name by stripping the toolkit prefix and converting to Title Case.
 * e.g., "GOOGLESHEETS_CREATE_CHART" with toolkitSlug "googlesheets" -> "Create Chart"
 * 
 * @param toolName - The raw Composio tool name (e.g., "GOOGLESHEETS_CREATE_CHART")
 * @param toolkitSlug - The toolkit slug to strip as prefix (e.g., "googlesheets")
 * @returns Human-readable tool name (e.g., "Create Chart")
 */
export function formatComposioToolName(toolName: string, toolkitSlug?: string): string {
    if (!toolName) return 'Unknown Tool';

    let name = toolName;

    // Try to strip the toolkit prefix (e.g., GOOGLESHEETS_)
    if (toolkitSlug) {
        // Convert toolkit slug to expected prefix format (uppercase, no special chars)
        const prefix = toolkitSlug.toUpperCase().replace(/[^A-Z0-9]/g, '') + '_';
        if (name.toUpperCase().startsWith(prefix)) {
            name = name.substring(prefix.length);
        }
    }

    // Also try common prefixes if no toolkit slug provided or didn't match
    // Handle cases like "GOOGLECALENDAR_LIST_EVENTS" without knowing the toolkit
    const commonPrefixes = [
        'GOOGLESHEETS_', 'GOOGLECALENDAR_', 'GOOGLEDRIVE_', 'GMAIL_',
        'SLACK_', 'NOTION_', 'GITHUB_', 'JIRA_', 'ASANA_', 'TRELLO_',
        'AIRTABLE_', 'HUBSPOT_', 'SALESFORCE_', 'ZENDESK_', 'INTERCOM_',
        'STRIPE_', 'TWILIO_', 'SENDGRID_', 'MAILCHIMP_', 'DROPBOX_',
        'LINEAR_', 'FIGMA_', 'DISCORD_', 'TELEGRAM_', 'WHATSAPP_'
    ];

    for (const prefix of commonPrefixes) {
        if (name.toUpperCase().startsWith(prefix)) {
            name = name.substring(prefix.length);
            break;
        }
    }

    // Convert SCREAMING_SNAKE_CASE to Title Case
    return name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
        .trim();
}

/**
 * Format an MCP tool name into a human-readable display name.
 * MCP tools typically use lowercase_snake_case or camelCase.
 * e.g., "list_directory" -> "List Directory"
 * e.g., "readFile" -> "Read File"
 */
export function formatMcpToolName(toolName: string): string {
    if (!toolName) return 'Unknown Tool';

    // Handle camelCase by inserting spaces before capitals
    const spacedCamel = toolName.replace(/([a-z])([A-Z])/g, '$1 $2');

    // Handle snake_case by replacing underscores with spaces
    const spacedSnake = spacedCamel.replace(/_/g, ' ');

    // Title case each word
    return spacedSnake
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
        .trim();
}

/**
 * Get a tool definition from its name.
 * ALWAYS returns a definition - uses backend metadata for icon/color when available.
 * Falls back to ICON_NAME_MAP for icons and convertBackendColorToGradient for colors.
 */
export function getToolDefinition(
    toolName: string,
    metadata?: { display_name?: string; description?: string; icon?: string; color?: string }
): StepDefinition {
    // Use backend icon if available, otherwise fallback to default
    const icon = metadata?.icon ? getIconFromName(metadata.icon) : DEFAULT_TOOL_ICON;

    // Use backend color if available, convert to gradient format
    const color = metadata?.color
        ? convertBackendColorToGradient(metadata.color)
        : DEFAULT_TOOL_COLOR;

    const displayName = metadata?.display_name || formatToolName(toolName);
    const description = metadata?.description || `Use ${displayName}`;

    return {
        id: `tool_${toolName}`,
        name: displayName,
        description,
        icon,
        category: 'tools',
        color,
        // Pass the raw icon name in config so it can be re-serialized or used by helpers
        config: {
            tool_name: toolName,
            tool_type: 'agentpress',
            icon_name: metadata?.icon // Store raw icon name
        }
    };
}

// Helper function to get step definition by ID
export function getStepDefinition(
    stepId: string,
    toolsMetadata?: Record<string, ToolMetadata>
): StepDefinition | null {
    const baseStep = BASE_STEP_DEFINITIONS.find(step => step.id === stepId);
    if (baseStep) return baseStep;

    // Check if it's a tool
    if (stepId.startsWith('tool_')) {
        const toolName = stepId.replace('tool_', '');
        const metadata = toolsMetadata?.[toolName];
        return getToolDefinition(toolName, {
            display_name: metadata?.display_name,
            description: metadata?.description,
            icon: metadata?.icon,
            color: metadata?.color
        });
    }

    return null;
}

// Input type for getStepIconAndColor - works with both full StepDefinition and simpler StepType objects
interface StepIconInput {
    id?: string;
    category?: string;
    config?: Record<string, unknown>;
    icon?: LucideIcon | string;
    iconUrl?: string;
    group?: string;
    groupIconUrl?: string;
}

// Return type for getStepIconAndColor
export interface StepIconResult {
    icon: LucideIcon;
    color: string;
    /** URL for image-based icons (e.g., Composio toolkit logos) */
    iconUrl?: string;
    /** Group name for organizing tools (e.g., Composio toolkit or MCP server name) */
    group?: string;
    /** Group icon URL */
    groupIconUrl?: string;
}

// Helper function to get icon and color for any step
export function getStepIconAndColor(stepType: StepIconInput): StepIconResult {
    if (stepType.category === 'tools') {
        // If the step already has a resolved icon component, use it
        if (stepType.icon && typeof stepType.icon !== 'string') {
            // Fallback color logic
            const colorFromConfig = stepType.config?.color as string | undefined;
            const color = colorFromConfig ? convertBackendColorToGradient(colorFromConfig) : DEFAULT_TOOL_COLOR;
            return { icon: stepType.icon as LucideIcon, color };
        }

        // Otherwise fallback to config lookup
        const iconName = stepType.config?.icon_name as string | undefined;
        const icon = iconName ? getIconFromName(iconName) : DEFAULT_TOOL_ICON;
        // Use stored color from config, or fallback to default
        const colorFromConfig = stepType.config?.color as string | undefined;
        const color = colorFromConfig ? convertBackendColorToGradient(colorFromConfig) : DEFAULT_TOOL_COLOR;
        return { icon, color };
    } else if (stepType.category === 'integrations') {
        const toolName = stepType.config?.tool_name as string | undefined;
        const iconUrl = stepType.iconUrl || (stepType.config?.icon_url as string | undefined);
        const group = stepType.group || (stepType.config?.group as string | undefined);
        const groupIconUrl = stepType.groupIconUrl || (stepType.config?.group_icon_url as string | undefined);

        // Use more appropriate icons for different integration types
        let icon: LucideIcon = Globe; // Default icon for integrations
        if (toolName?.includes('composio')) {
            icon = Globe;
        } else if (toolName?.includes('mcp')) {
            icon = Cog;
        }
        const color = 'from-purple-500/20 to-purple-600/10 border-purple-500/20 text-purple-500';
        return { icon, color, iconUrl, group, groupIconUrl };
    } else if (stepType.category === 'conditions') {
        return { icon: Settings, color: 'from-orange-500/20 to-orange-600/10 border-orange-500/20 text-orange-500' };
    } else if (stepType.category === 'configuration') {
        const stepTypeId = (stepType.config?.step_type || stepType.id) as string;
        if (stepTypeId === 'mcp_configuration') {
            return { icon: Cog, color: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/20 text-indigo-500' };
        } else if (stepTypeId === 'credentials_profile') {
            return { icon: Key, color: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20 text-emerald-500' };
        }
        return { icon: Cog, color: 'from-indigo-500/20 to-indigo-600/10 border-indigo-500/20 text-indigo-500' };
    } else {
        // Try to resolve icon from serialized name using ICON_NAME_MAP
        const iconName = typeof stepType.icon === 'string' ? stepType.icon : undefined;
        const icon = iconName ? getIconFromName(iconName) : FileText;
        return { icon, color: DEFAULT_TOOL_COLOR };
    }
}

/**
 * Generate available step types from agent tools.
 * 
 * @param agentTools - Tools enabled for the agent (from useAgentTools)
 * @param toolsMetadata - Full metadata registry (from useToolsMetadata) - optional but recommended
 * @returns Array of step definitions for all enabled tools
 */
export function generateAvailableStepTypes(
    agentTools?: {
        agentpress_tools: Array<{ name: string; description?: string; icon?: string; enabled: boolean }>;
        mcp_tools: Array<{
            name: string;
            description?: string;
            icon?: string;
            server?: string;
            // Extended fields for Composio/MCP integrations
            toolkit_slug?: string;
            toolkit_name?: string;
            icon_url?: string;
        }>;
    },
    toolsMetadata?: Record<string, ToolMetadata>
): StepDefinition[] {
    const allSteps = [...BASE_STEP_DEFINITIONS];

    // Add ALL enabled AgentPress tools (no whitelist filtering!)
    if (agentTools?.agentpress_tools) {
        agentTools.agentpress_tools.forEach(tool => {
            if (tool.enabled) {
                // Look up rich metadata from backend if available
                const metadata = toolsMetadata?.[tool.name];
                const stepDef = getToolDefinition(tool.name, {
                    display_name: metadata?.display_name,
                    description: tool.description || metadata?.description,
                    icon: metadata?.icon,  // Pass icon from backend metadata
                    color: metadata?.color  // Pass color from backend metadata
                });
                allSteps.push(stepDef);
            }
        });
    }

    // Add MCP tools to integrations category
    if (agentTools?.mcp_tools) {
        // Debug: Log raw MCP tools data to trace icon_url
        console.log('[generateAvailableStepTypes] MCP tools received:',
            agentTools.mcp_tools.map(t => ({
                name: t.name,
                icon_url: t.icon_url || '(none)',
                toolkit_name: t.toolkit_name || '(none)',
                toolkit_slug: t.toolkit_slug || '(none)',
                server: t.server || '(none)',
            }))
        );

        agentTools.mcp_tools.forEach(tool => {
            // Determine display name based on tool source
            let displayName: string;
            if (tool.toolkit_slug) {
                // This is a Composio tool - use special formatting
                displayName = formatComposioToolName(tool.name, tool.toolkit_slug);
            } else {
                // Regular MCP tool
                displayName = formatMcpToolName(tool.name);
            }

            // Determine group name for grouping in UI
            const group = tool.toolkit_name || tool.server;

            allSteps.push({
                id: `mcp_${tool.name}`,
                name: displayName,
                description: tool.description || '', //`MCP tool from ${group || 'MCP server'}`
                icon: Cog,
                iconUrl: tool.icon_url,  // Composio toolkit icon URL
                category: 'integrations',
                group: group,  // Group by toolkit name or server
                groupIconUrl: tool.icon_url,  // Use toolkit icon for group
                color: '',
                config: {
                    tool_name: tool.name,
                    tool_type: 'mcp',
                    server: tool.server,
                    toolkit_slug: tool.toolkit_slug,
                    toolkit_name: tool.toolkit_name,
                    icon_url: tool.icon_url,
                    group: group,
                    group_icon_url: tool.icon_url
                }
            });
        });
    }

    return allSteps;
}