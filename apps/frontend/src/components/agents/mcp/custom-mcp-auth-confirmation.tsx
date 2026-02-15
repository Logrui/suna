import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Shield, ExternalLink } from 'lucide-react';

interface CustomMCPAuthConfirmationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  serverName: string;
  serverUrl: string;
}

export const CustomMCPAuthConfirmation: React.FC<CustomMCPAuthConfirmationProps> = ({
  open,
  onOpenChange,
  onConfirm,
  serverName,
  serverUrl,
}) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <AlertDialogTitle>Authentication Required</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-3">
            <p>
              To use tools from <strong>{serverName}</strong>, you need to authenticate with the external service.
            </p>
            <div className="p-3 bg-muted rounded-md text-xs font-mono text-muted-foreground break-all">
              {serverUrl}
            </div>
            <p>
              You will be redirected to their login page. After approving access, you'll be returned here automatically.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="gap-2">
            Proceed to Login <ExternalLink className="h-4 w-4" />
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
