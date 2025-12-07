'use client';

import React from 'react';
import { HardDrive, User, Building, Search, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MemoryScreenProps {
    agentId: string;
}

export function MemoryScreen({ agentId }: MemoryScreenProps) {
    // Mock Data
    const projectMemories = [
        { id: '1', content: 'Project "Apollo" deadline is set for Q4 2024.', type: 'fact', confidence: 0.95, created_at: '2024-01-15' },
        { id: '2', content: 'The preferred deployment environment is Kubernetes on AWS.', type: 'preference', confidence: 0.88, created_at: '2024-02-10' },
        { id: '3', content: 'Design system tokens are stored in `design-tokens.json`.', type: 'fact', confidence: 0.92, created_at: '2024-03-05' },
    ];

    const userMemories = [
        { id: '1', content: 'User prefers concise, bulleted responses.', type: 'preference', confidence: 0.98, created_at: '2024-01-20' },
        { id: '2', content: 'User is working on the frontend authentication flow.', type: 'context', confidence: 0.85, created_at: '2024-04-12' },
    ];

    return (
        <div className="flex-1 overflow-auto pb-6 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700 scrollbar-track-transparent">
            <div className="px-1 pt-1 space-y-6">

                {/* Header / Actions */}
                <div className="flex items-center justify-start gap-4">
                    <Button variant="outline" size="sm" className="flex items-center gap-2 h-10">
                        <Plus className="h-4 w-4" />
                        Add Memory
                    </Button>
                    <div className="max-w-md w-full">
                        <div className="relative">
                            <Input
                                type="text"
                                placeholder="Search memories..."
                                className="pl-10 h-10"
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                <Search className="h-4 w-4" />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-[2000px]">
                    {/* Project Memories */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                            <Building className="h-5 w-5 text-primary" />
                            <h2 className="text-lg font-semibold">Project Memories</h2>
                            <Badge variant="secondary" className="ml-auto">{projectMemories.length}</Badge>
                        </div>
                        <Card className="flex-1 bg-muted/30 border-border/50 overflow-hidden">
                            <ScrollArea className="h-[600px]">
                                <div className="p-4 space-y-3">
                                    {projectMemories.map((memory) => (
                                        <SpotlightCard key={memory.id} className="bg-card border border-border">
                                            <div className="p-4 space-y-2">
                                                <p className="text-sm text-foreground">{memory.content}</p>
                                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="text-[10px] h-5 px-1.5">{memory.type}</Badge>
                                                        <span>{memory.created_at}</span>
                                                    </div>
                                                    <span>{Math.round(memory.confidence * 100)}% confidence</span>
                                                </div>
                                            </div>
                                        </SpotlightCard>
                                    ))}
                                </div>
                            </ScrollArea>
                        </Card>
                    </div>

                    {/* User Memories */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                            <User className="h-5 w-5 text-primary" />
                            <h2 className="text-lg font-semibold">User Memories</h2>
                            <Badge variant="secondary" className="ml-auto">{userMemories.length}</Badge>
                        </div>
                        <Card className="flex-1 bg-muted/30 border-border/50 overflow-hidden">
                            <ScrollArea className="h-[600px]">
                                <div className="p-4 space-y-3">
                                    {userMemories.map((memory) => (
                                        <SpotlightCard key={memory.id} className="bg-card border border-border">
                                            <div className="p-4 space-y-2">
                                                <p className="text-sm text-foreground">{memory.content}</p>
                                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className="text-[10px] h-5 px-1.5">{memory.type}</Badge>
                                                        <span>{memory.created_at}</span>
                                                    </div>
                                                    <span>{Math.round(memory.confidence * 100)}% confidence</span>
                                                </div>
                                            </div>
                                        </SpotlightCard>
                                    ))}
                                </div>
                            </ScrollArea>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
