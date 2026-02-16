import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, X, CheckCircle2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

// Ported and adapted from ComposioToolsSelector for Custom MCP servers
interface MCPTool {
    name: string;
    description?: string;
    inputSchema?: any;
    enabled?: boolean;
}

interface CustomMCPToolsSelectorProps {
    tools: MCPTool[];
    selectedTools: string[];
    onToolsChange: (tools: string[]) => void;
    isLoading?: boolean;
    className?: string;
    searchPlaceholder?: string;
}

const ToolCard = ({ tool, isSelected, onToggle, searchTerm }: {
    tool: MCPTool;
    isSelected: boolean;
    onToggle: () => void;
    searchTerm: string;
}) => {
    const highlightText = (text: string, term: string) => {
        if (!term) return text;
        const regex = new RegExp(`(${term})`, 'gi');
        const parts = text.split(regex);
        return parts.map((part, i) =>
            regex.test(part) ? <span key={i} className="bg-primary/20 text-primary font-medium">{part}</span> : part
        );
    };

    return (
        <div
            className={cn(
                "group relative overflow-hidden rounded-xl border border-border/50 bg-card/50 p-4 transition-all hover:border-primary/30 cursor-pointer",
                isSelected && "border-primary/40 bg-primary/5 ring-1 ring-primary/10 shadow-sm"
            )}
            onClick={onToggle}
        >
            <div className="flex items-start gap-4 relaitve z-10">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                        <h3 className="font-semibold text-sm tracking-tight text-foreground/90 truncate">
                            {highlightText(tool.name, searchTerm)}
                        </h3>
                        {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-primary animate-enter" />}
                    </div>
                    <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2">
                        {highlightText(tool.description || 'Provides capabilities through this MCP server.', searchTerm)}
                    </p>
                </div>
                <div className="flex-shrink-0 pt-0.5">
                    <Checkbox
                        checked={isSelected}
                        onCheckedChange={onToggle}
                        className="rounded-md border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                </div>
            </div>
        </div>
    );
};

const ToolSkeleton = () => (
    <div className="rounded-xl border border-border/40 bg-muted/20 p-4 h-[88px] flex items-start gap-4">
        <div className="flex-1 space-y-2.5">
            <Skeleton className="h-4 w-32 bg-muted/40" />
            <Skeleton className="h-3 w-full bg-muted/40" />
            <Skeleton className="h-3 w-2/3 bg-muted/40" />
        </div>
        <Skeleton className="h-5 w-5 rounded-md bg-muted/40" />
    </div>
);

export const CustomMCPToolsSelector: React.FC<CustomMCPToolsSelectorProps> = ({
    tools,
    selectedTools,
    onToolsChange,
    isLoading = false,
    className,
    searchPlaceholder = "Search server tools..."
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredTools = useMemo(() => {
        if (!searchTerm) return tools;
        const term = searchTerm.toLowerCase();
        return tools.filter(tool =>
            tool.name.toLowerCase().includes(term) ||
            (tool.description && tool.description.toLowerCase().includes(term))
        );
    }, [tools, searchTerm]);

    const handleToolToggle = (toolName: string) => {
        const newSelection = selectedTools.includes(toolName)
            ? selectedTools.filter(t => t !== toolName)
            : [...selectedTools, toolName];
        onToolsChange(newSelection);
    };

    const handleSelectAll = (e: React.MouseEvent) => {
        e.preventDefault();
        const allToolNames = filteredTools.map(t => t.name);
        // If all currently shown tools are already selected, clear them. Otherwise select all shown.
        const allShownSelected = filteredTools.every(t => selectedTools.includes(t.name));

        if (allShownSelected) {
            onToolsChange(selectedTools.filter(name => !allToolNames.includes(name)));
        } else {
            onToolsChange(Array.from(new Set([...selectedTools, ...allToolNames])));
        }
    };

    return (
        <div className={cn("flex flex-col flex-1 min-h-0 h-full", className)}>
            <div className="flex items-center gap-3 mb-4 px-1">
                <div className="relative flex-1 group">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 transition-colors group-focus-within:text-primary" />
                    <Input
                        placeholder={searchPlaceholder}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-10 bg-muted/30 border-border/50 rounded-2xl focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:bg-background transition-all"
                    />
                    {searchTerm && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full text-muted-foreground hover:bg-muted"
                            onClick={() => setSearchTerm('')}
                        >
                            <X className="h-3 h-3" />
                        </Button>
                    )}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    className="h-10 rounded-2xl border-border/50 hover:bg-primary/5 hover:text-primary hover:border-primary/30 px-4"
                >
                    {filteredTools.every(t => selectedTools.includes(t.name)) ? 'Deselect All' : 'Select All'}
                </Button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar -mx-1 px-1">
                {isLoading ? (
                    <div className="grid grid-cols-1 gap-3 pb-4">
                        {Array.from({ length: 5 }).map((_, i) => <ToolSkeleton key={i} />)}
                    </div>
                ) : filteredTools.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 pb-4">
                        {filteredTools.map((tool) => (
                            <ToolCard
                                key={tool.name}
                                tool={tool}
                                isSelected={selectedTools.includes(tool.name)}
                                onToggle={() => handleToolToggle(tool.name)}
                                searchTerm={searchTerm}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-16 h-16 rounded-3xl bg-muted/30 flex items-center justify-center mb-4 text-muted-foreground/40 border border-border/50 border-dashed">
                            <Sparkles className="h-8 w-8" />
                        </div>
                        <h3 className="text-lg font-medium text-foreground/80 mb-1">No tools found</h3>
                        <p className="text-sm text-muted-foreground max-w-[250px]">
                            {searchTerm ? `No tools matching "${searchTerm}" were found in this server.` : 'This MCP server doesn\'t seem to expose any tools.'}
                        </p>
                    </div>
                )}
            </div>

            <div className="mt-4 pt-4 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground bg-background/50 backdrop-blur-sm -mx-1 px-2 rounded-xl">
                <span>Selected <strong>{selectedTools.length}</strong> tools</span>
                <span className="opacity-60 italic">Tools are enabled for the agent immediately after saving.</span>
            </div>
        </div>
    );
};
