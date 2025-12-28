import type { ConditionalStep } from '@/components/workflows/types';

/**
 * Represents a step type that can be added to a workflow.
 */
export interface StepType {
    id: string;
    name: string;
    description: string;
    icon: string;
    /** URL for image-based icons (e.g., Composio toolkit logos) */
    iconUrl?: string;
    /** Group name for organizing tools (e.g., Composio toolkit or MCP server name) */
    group?: string;
    /** Group icon URL */
    groupIconUrl?: string;
    category: string;
    config?: Record<string, unknown>;
}

/**
 * Category definition for organizing step types.
 */
export interface Category {
    id: string;
    name: string;
    description: string;
}

/**
 * Grouped steps structure used for rendering collapsible groups.
 */
export interface StepGroup {
    name: string;
    iconUrl?: string;
    /** Toolkit slug for dynamic icon fetching (Composio tools) */
    toolkitSlug?: string;
    steps: StepType[];
}

/**
 * Props shared across panel components.
 */
export interface BasePanelProps {
    onClose: () => void;
}

/**
 * Props for the AddStepPanel component.
 */
export interface AddStepPanelProps extends BasePanelProps {
    availableStepTypes: StepType[];
    categories: Category[];
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onStepTypeClick: (stepType: StepType) => void;
}

/**
 * Props for the EditStepPanel component.
 */
export interface EditStepPanelProps extends BasePanelProps {
    selectedStep: ConditionalStep;
    onUpdateStep: (updates: Partial<ConditionalStep>) => void;
    onDeleteStep: (stepId: string) => void;
}

/**
 * Props for the CategorySection component.
 */
export interface CategorySectionProps {
    category: Category;
    steps: StepType[];
    searchQuery: string;
    onStepTypeClick: (stepType: StepType) => void;
}

/**
 * Props for the StepTypeButton component.
 */
export interface StepTypeButtonProps {
    stepType: StepType;
    onClick: () => void;
    /** Compact mode uses smaller padding and icons */
    compact?: boolean;
    /** Icon URL inherited from parent group (used when step's own iconUrl is missing) */
    inheritedIconUrl?: string;
}

/**
 * Props for the StepTypeGroup component.
 */
export interface StepTypeGroupProps {
    group: StepGroup;
    /** If true, expands the group when user is searching */
    isSearching?: boolean;
    /** If true, the group starts collapsed by default */
    defaultCollapsed?: boolean;
    onStepTypeClick: (stepType: StepType) => void;
}
