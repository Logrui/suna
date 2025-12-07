import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldAlert, Check, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useThreadContext } from "@/contexts/thread-context";
import { CodeBlock } from "@/components/ui/code-block";
import { useStartAgentMutation } from "@/hooks/threads/use-agent-run";

interface PermissionRequestViewProps {
  message: any;
  isLast: boolean;
}

export function PermissionRequestView({ message, isLast }: PermissionRequestViewProps) {
  const { threadId } = useThreadContext();
  const [status, setStatus] = useState<"pending" | "approved" | "denied">("pending");
  const [isLoading, setIsLoading] = useState(false);
  const startAgentMutation = useStartAgentMutation();

  const content = typeof message.content === "string"
    ? JSON.parse(message.content)
    : message.content;

  const toolName = content.function_name || "Unknown Tool";
  const args = content.arguments || {};
  const reason = content.reason || "The agent needs permission to execute this tool.";

  const handleAction = async (action: "approve" | "deny") => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/threads/${threadId}/permissions/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: message.message_id }),
      });

      if (!response.ok) throw new Error("Failed to process permission");

      setStatus(action === "approve" ? "approved" : "denied");
      toast.success(`Permission ${action === "approve" ? "granted" : "denied"}`);

      if (action === "approve") {
        // Trigger agent run to resume execution
        startAgentMutation.mutate({ threadId });
        toast.info("Resuming agent execution...");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  // Determine status from message content if already processed (future enhancement)
  // For now, local state handles immediate feedback

  return (
    <Card className="w-full max-w-2xl mx-auto my-4 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <ShieldAlert className="h-5 w-5" />
          <CardTitle className="text-lg">Permission Requested</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          {reason}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Tool:</span>
            <Badge variant="outline" className="font-mono">{toolName}</Badge>
          </div>

          <div className="space-y-1">
            <span className="font-semibold text-sm">Arguments:</span>
            <div className="max-h-[200px] overflow-y-auto rounded-md border bg-muted/50 text-xs">
               <CodeBlock
                  language="json"
                  value={JSON.stringify(args, null, 2)}
                />
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex justify-end gap-2 pt-2 border-t bg-amber-100/20 dark:bg-amber-900/20">
        {status === "pending" ? (
          <>
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => handleAction("deny")}
              disabled={isLoading}
            >
              <X className="mr-2 h-4 w-4" />
              Deny
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => handleAction("approve")}
              disabled={isLoading}
            >
              <Check className="mr-2 h-4 w-4" />
              Approve
            </Button>
          </>
        ) : (
          <div className={`flex items-center gap-2 font-medium ${status === "approved" ? "text-green-600" : "text-destructive"}`}>
            {status === "approved" ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
            {status === "approved" ? "Approved" : "Denied"}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
