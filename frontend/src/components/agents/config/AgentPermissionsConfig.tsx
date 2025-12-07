import { ToolPermissionSettings } from "@/types/agent";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Shield } from "lucide-react";
import { useState } from "react";

interface AgentPermissionsConfigProps {
  permissionSettings: ToolPermissionSettings | null | undefined;
  onUpdate: (settings: ToolPermissionSettings) => void;
}

export function AgentPermissionsConfig({ permissionSettings, onUpdate }: AgentPermissionsConfigProps) {
  const settings = permissionSettings || {
    default_mode: "turbo",
    global_whitelist: [],
    global_blacklist: [],
    tool_overrides: {}
  };

  const [newWhitelistItem, setNewWhitelistItem] = useState("");
  const [newBlacklistItem, setNewBlacklistItem] = useState("");

  const handleModeChange = (mode: string) => {
    onUpdate({ ...settings, default_mode: mode as any });
  };

  const addWhitelistItem = () => {
    if (!newWhitelistItem.trim()) return;
    const current = settings.global_whitelist || [];
    if (!current.includes(newWhitelistItem.trim())) {
      onUpdate({ ...settings, global_whitelist: [...current, newWhitelistItem.trim()] });
    }
    setNewWhitelistItem("");
  };

  const removeWhitelistItem = (item: string) => {
    onUpdate({
      ...settings,
      global_whitelist: (settings.global_whitelist || []).filter((i) => i !== item)
    });
  };

  const addBlacklistItem = () => {
    if (!newBlacklistItem.trim()) return;
    const current = settings.global_blacklist || [];
    if (!current.includes(newBlacklistItem.trim())) {
      onUpdate({ ...settings, global_blacklist: [...current, newBlacklistItem.trim()] });
    }
    setNewBlacklistItem("");
  };

  const removeBlacklistItem = (item: string) => {
    onUpdate({
      ...settings,
      global_blacklist: (settings.global_blacklist || []).filter((i) => i !== item)
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-medium">Permission Control</h3>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Default Permission Mode</CardTitle>
          <CardDescription>
            Sets the default behavior for all tools unless overridden.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={settings.default_mode} onValueChange={handleModeChange}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="turbo">Turbo (Auto-Run)</SelectItem>
              <SelectItem value="agent_decide">Let Agent Decide</SelectItem>
              <SelectItem value="strict">Strict (Ask First)</SelectItem>
            </SelectContent>
          </Select>
          <div className="mt-2 text-sm text-muted-foreground">
            {settings.default_mode === "turbo" && "Tools run automatically without asking."}
            {settings.default_mode === "agent_decide" && "Agent can choose to run tools or ask for permission."}
            {settings.default_mode === "strict" && "All tools require user approval before execution."}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Global Whitelist</CardTitle>
            <CardDescription>Tools that are ALWAYS allowed (bypasses Strict mode).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Tool name (e.g. web_search)"
                value={newWhitelistItem}
                onChange={(e) => setNewWhitelistItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addWhitelistItem()}
              />
              <Button size="sm" onClick={addWhitelistItem}><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {settings.global_whitelist?.map((item) => (
                <Badge key={item} variant="secondary" className="flex items-center gap-1 bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300">
                  {item}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeWhitelistItem(item)} />
                </Badge>
              ))}
              {(!settings.global_whitelist || settings.global_whitelist.length === 0) && (
                <span className="text-sm text-muted-foreground italic">No whitelisted tools</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Global Blacklist</CardTitle>
            <CardDescription>Tools that are NEVER allowed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Tool name (e.g. delete_file)"
                value={newBlacklistItem}
                onChange={(e) => setNewBlacklistItem(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addBlacklistItem()}
              />
              <Button size="sm" onClick={addBlacklistItem} variant="outline"><Plus className="h-4 w-4" /></Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {settings.global_blacklist?.map((item) => (
                <Badge key={item} variant="destructive" className="flex items-center gap-1">
                  {item}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeBlacklistItem(item)} />
                </Badge>
              ))}
              {(!settings.global_blacklist || settings.global_blacklist.length === 0) && (
                <span className="text-sm text-muted-foreground italic">No blacklisted tools</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
