'use client';

import { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Info, 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Timer,
  ChevronRight,
  Server
} from 'lucide-react';
import { ModelMetadata, TestResult } from '@/lib/api/admin-models';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AdminModelsTableProps {
  models: ModelMetadata[];
  isLoading: boolean;
  testResults: TestResult[];
}

export function AdminModelsTable({ models, isLoading, testResults }: AdminModelsTableProps) {
  const [selectedModel, setSelectedModel] = useState<ModelMetadata | null>(null);
  const [selectedTestResult, setSelectedTestResult] = useState<TestResult | null>(null);

  const getTestResult = (modelId: string) => {
    return testResults.find(r => r.model_id === modelId);
  };

  const getProviderColor = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'openai': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      case 'anthropic': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      case 'google': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'bedrock': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'ollama': return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
      case 'lm_studio': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4 border rounded-xl bg-background/50 border-primary/10">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-muted-foreground animate-pulse">Loading model registry...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card/50 backdrop-blur-sm shadow-xl border-primary/10 overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-[300px]">Model ID</TableHead>
            <TableHead>Provider</TableHead>
            <TableHead>Context</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Health</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {models.map((model) => {
            const testResult = getTestResult(model.id);
            return (
              <TableRow key={model.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-mono text-xs py-4">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold text-foreground">{model.name}</span>
                    <span className="text-muted-foreground opacity-70">{model.id}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={getProviderColor(model.provider)}>
                    {model.provider}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm font-medium">
                  {(model.context_window / 1000).toFixed(0)}k
                </TableCell>
                <TableCell>
                  <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{model.priority}</span>
                </TableCell>
                <TableCell>
                  <Badge variant={model.enabled ? "outline" : "destructive"} className="text-[10px] uppercase">
                    {model.enabled ? 'Active' : 'Disabled'}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  {testResult ? (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setSelectedTestResult(testResult)}
                      className="h-8 w-8 p-0 hover:bg-muted"
                    >
                      {testResult.status === 'PASS' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </Button>
                  ) : (
                    <span className="text-muted-foreground opacity-30">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 px-2"
                      onClick={() => setSelectedModel(model)}
                    >
                      <Info className="h-4 w-4 mr-1" />
                      Details
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Model Details Modal */}
      <Dialog open={!!selectedModel} onOpenChange={(open) => !open && setSelectedModel(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              Model Configuration
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase">LiteLLM ID</p>
                <p className="font-mono text-sm bg-muted p-2 rounded border">{selectedModel?.litellm_id}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground uppercase">Provider</p>
                <p className="font-semibold">{selectedModel?.provider}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase">Fallback Chain</p>
              <div className="flex flex-wrap gap-2">
                {selectedModel?.fallbacks.length ? (
                  selectedModel.fallbacks.map((f, i) => (
                    <div key={f} className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px]">{f}</Badge>
                      {i < selectedModel.fallbacks.length - 1 && <ChevronRight className="h-3 w-3 opacity-30" />}
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground italic">No fallbacks configured</span>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase">Capabilities</p>
              <div className="flex flex-wrap gap-2">
                {selectedModel?.capabilities.map(cap => (
                  <Badge key={cap} variant="secondary" className="text-[10px]">{cap}</Badge>
                ))}
              </div>
            </div>

            <div className="bg-muted/30 p-4 rounded-lg border border-primary/5">
              <pre className="text-[10px] leading-relaxed overflow-auto max-h-[300px]">
                {JSON.stringify(selectedModel, null, 2)}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Result Modal */}
      <Dialog open={!!selectedTestResult} onOpenChange={(open) => !open && setSelectedTestResult(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Test Outcome: {selectedTestResult?.model_id}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground uppercase">Status</span>
                  <span className={`font-bold ${selectedTestResult?.status === 'PASS' ? 'text-green-500' : 'text-red-500'}`}>
                    {selectedTestResult?.status}
                  </span>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground uppercase">Latency</span>
                  <span className="font-mono font-semibold flex items-center gap-1">
                    <Timer className="h-3 w-3" />
                    {selectedTestResult?.latency_ms.toFixed(2)} ms
                  </span>
                </div>
              </div>
              <Badge variant="outline">{selectedTestResult?.provider}</Badge>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase">Full Response / Error Log</p>
              <ScrollArea className="h-[400px] w-full rounded-md border bg-slate-950 p-4">
                <pre className="font-mono text-xs text-slate-300 whitespace-pre-wrap break-all leading-normal">
                  {selectedTestResult?.outcome}
                </pre>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
