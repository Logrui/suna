export interface ToolPermissionSettings {
  default_mode: "turbo" | "agent_decide" | "strict";
  global_whitelist: string[];
  global_blacklist: string[];
  tool_overrides: Record<string, ToolPermissionOverride>;
}

export interface ToolPermissionOverride {
  tool_name: string;
  mode?: "turbo" | "agent_decide" | "strict";
  parameter_constraints?: any[]; // For future use
}

export interface Agent {
  agent_id: string;
  name: string;
  description?: string;
  system_prompt?: string;
  model?: string;
  configured_mcps: any[];
  custom_mcps: any[];
  agentpress_tools: Record<string, any>;
  is_default: boolean;
  icon_name?: string;
  icon_color?: string;
  icon_background?: string;
  created_at: string;
  updated_at?: string;
  current_version_id?: string;
  permission_settings?: ToolPermissionSettings;
}
