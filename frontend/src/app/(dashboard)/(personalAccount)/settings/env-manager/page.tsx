'use client';

import { isLocalMode } from "@/lib/config";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield } from "lucide-react";
import { LocalEnvManager } from "@/components/env-manager/local-env-manager";
import { useAdminRole } from "@/hooks/admin/use-admin-role";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LocalEnvManagerPage() {
  const { data: adminRole, isLoading } = useAdminRole();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Local .Env Manager</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!isLocalMode()) {
    return (
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Local .Env Manager is only available in local mode.
        </AlertDescription>
      </Alert>
    );
  }

  if (!adminRole?.isAdmin) {
    return (
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          You do not have permission to access the Local .Env Manager. Admin access is required.
        </AlertDescription>
      </Alert>
    );
  }

  return <LocalEnvManager />
}