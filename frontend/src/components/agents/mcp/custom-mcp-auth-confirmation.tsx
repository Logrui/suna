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
      <AlertDialogContent className="rounded-3xl border-border/40 shadow-2xl">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <AlertDialogTitle className="text-xl font-semibold tracking-tight">
              Authentication Required
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p className="text-muted-foreground leading-relaxed">
                To use tools from <strong className="text-foreground">{serverName}</strong>, you need to authenticate with the external service.
              </p>
              <div className="p-3 bg-muted/50 rounded-xl text-xs font-mono text-muted-foreground break-all border border-border/50">
                {serverUrl}
              </div>
              <p className="text-muted-foreground leading-relaxed text-sm">
                You will be redirected to their login page in a new window. After approving access, this page will update automatically.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-3 pt-2">
          <AlertDialogCancel className="rounded-xl border-border/50 hover:bg-muted">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="gap-2 rounded-xl shadow-lg shadow-primary/20"
          >
            Proceed to Login <ExternalLink className="h-4 w-4" />
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
