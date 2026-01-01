'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAdminModels, useTestModels } from '@/hooks/admin/use-admin-models';
import { AdminModelsTable } from '@/components/admin/admin-models-table';
import { 
  Activity, 
  Settings, 
  RefreshCw, 
  FlaskConical, 
  Database
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminModelsPage() {
  const { data: models, isLoading, refetch } = useAdminModels();
  const testMutation = useTestModels();
  
  const [includeLocal, setIncludeLocal] = useState(false);
  const [disableFallbacks, setDisableFallbacks] = useState(true);
  const [testResults, setTestResults] = useState<any[]>([]);

  const handleRunAllTests = async () => {
    try {
      const results = await testMutation.mutateAsync({
        include_local: includeLocal,
        disable_fallbacks: disableFallbacks
      });
      setTestResults(results);
      toast.success('All model tests completed');
    } catch (error) {
      toast.error('Failed to run model tests');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Model Diagnostics
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitor and test registered AI model endpoints
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              className="hover:bg-primary/5"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Registry
            </Button>
            <Button 
              size="sm" 
              onClick={handleRunAllTests}
              disabled={testMutation.isPending}
              className="shadow-md shadow-primary/20"
            >
              <FlaskConical className="h-4 w-4 mr-2" />
              {testMutation.isPending ? 'Testing...' : 'Run All Tests'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="shadow-sm border-primary/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                Total Models
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{models?.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Registered in registry.py
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-primary/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" />
                Test Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="include-local" className="text-xs">Include Local Models</Label>
                <Switch 
                  id="include-local" 
                  checked={includeLocal} 
                  onCheckedChange={setIncludeLocal} 
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="disable-fallbacks" className="text-xs">Disable Fallbacks</Label>
                <Switch 
                  id="disable-fallbacks" 
                  checked={disableFallbacks} 
                  onCheckedChange={setDisableFallbacks} 
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-primary/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Status Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full ${testResults.length > 0 ? (testResults.some(r => r.status === 'FAIL') ? 'bg-amber-500' : 'bg-green-500') : 'bg-slate-300'} animate-pulse`} />
                <span className="text-sm font-medium">
                  {testResults.length > 0 ? (testResults.some(r => r.status === 'FAIL') ? 'Issues Detected' : 'All Clear') : 'Unknown'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Based on last connectivity check
              </p>
            </CardContent>
          </Card>
        </div>

        <AdminModelsTable 
          models={models || []} 
          isLoading={isLoading} 
          testResults={testResults}
        />
      </div>
    </div>
  );
}
