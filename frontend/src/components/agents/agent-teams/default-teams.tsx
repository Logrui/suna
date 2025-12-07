import { BaseTeamData } from '@/components/agents/agent-teams/agent-team-card';



interface DefaultTeamData extends BaseTeamData {
    slug: string;
    is_default?: boolean;
}

export const DEFAULT_TEAMS: DefaultTeamData[] = [
    {
        id: 'team-1',
        name: 'Suna Superworker Team',
        description: 'For complex general long running tasks. Manus like loop coordination and organization loop cycle. Planner -> Executor -> Verifier Loop',
        agents: [
            { id: 'a1', name: 'Suna Planner', role: 'Planning', icon_name: 'Search', icon_color: '#fdfdfdff', icon_background: '#000000ff' },
            { id: 'a2', name: 'Suna Worker', role: 'Execution', icon_name: 'BarChart', icon_color: '#ffffffff', icon_background: '#000000ff' },
            { id: 'a3', name: 'Suna Verifier', role: 'Verification', icon_name: 'PenTool', icon_color: '#ffffffff', icon_background: '#000000ff' },
        ],
        created_at: '2025-12-03T10:00:00Z',
        is_public: false,
        is_default: true,
        slug: 'superworker',
        metadata: {
            is_suna_default: true
        }
    },
    {
        id: 'team-2',
        name: 'Suna Wide Research Team',
        description: 'Deploy up to 100 independent, parallel full-context AI agents simultaneously to tackle large-scale tasks (like analyzing 250 companies or generating 50 assets) in minutes rather than hours',
        agents: [
            { id: 'a4', name: 'Suna Task Mapper', role: 'Task Mapping Tool Use', icon_name: 'Lightbulb', icon_color: '#f59e0b', icon_background: '#fffbeb' },
            { id: 'a5', name: 'Suna Worker', role: 'General Task Execution', icon_name: 'BarChart', icon_color: '#ffffffff', icon_background: '#000000ff' },
        ],
        created_at: '2025-12-03T14:30:00Z',
        is_public: false,
        is_default: true,
        slug: 'wide-research',
        icon_name: 'Globe',
        icon_color: '#3b82f6',
        icon_background: '#eff6ff',
        metadata: {
            is_suna_default: true
        }
    },
    {
        id: 'team-3',
        name: 'Suna Development Team',
        description: 'For long running and complex development tasks, automating development workflows, error log analysis, fixes, and deployment management for Github repositories.',
        agents: [
            { id: 'a6', name: 'Suna Architect', role: 'Systems Architect', icon_name: 'Server', icon_color: '#6366f1', icon_background: '#eef2ff' },
            { id: 'a7', name: 'Suna Git Worker', role: 'Version Control', icon_name: 'GitBranch', icon_color: '#f97316', icon_background: '#fff7ed' },
            { id: 'a8', name: 'Suna Worker', role: 'General Code Development', icon_name: 'Shield', icon_color: '#14b8a6', icon_background: '#f0fdfa' },
            { id: 'a9', name: 'Suna Deploy', role: 'Deployment Agent', icon_name: 'Rocket', icon_color: '#8b5cf6', icon_background: '#f5f3ff' },
        ],
        created_at: '2025-12-03T09:15:00Z',
        is_public: false,
        is_default: true,
        slug: 'devops-assistants',
        icon_name: 'Terminal',
        icon_color: '#ffffffff',
        icon_background: '#000000ff',
        metadata: {
            is_suna_default: true
        }
    }
];