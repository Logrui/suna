'use client';

import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function MaintenanceToggle() {
    const [enabled, setEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/admin/maintenance', { credentials: 'include' });
            if (!res.ok) throw new Error('Failed to fetch status');
            const data = await res.json();
            setEnabled(data.enabled === true);
        } catch (error) {
            console.error('Error fetching maintenance status:', error);
            toast.error('Failed to load maintenance status');
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (checked: boolean) => {
        setUpdating(true);
        // Optimistic update
        setEnabled(checked);

        try {
            const res = await fetch('/api/admin/maintenance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: checked }),
                credentials: 'include',
            });

            if (!res.ok) throw new Error('Failed to update status');

            const data = await res.json();
            if (data.success) {
                toast.success(checked ? 'Maintenance mode enabled' : 'Maintenance mode disabled');
            } else {
                throw new Error('Update failed');
            }
        } catch (error) {
            console.error('Error updating maintenance status:', error);
            toast.error('Failed to update maintenance status');
            // Revert on error
            setEnabled(!checked);
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="p-6 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-orange-500/20 bg-orange-500/5">
            <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    <CardTitle className="text-lg">System Maintenance</CardTitle>
                </div>
                <CardDescription>
                    Enable maintenance mode to block access for non-admin users.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between space-x-4">
                    <div className="flex flex-col space-y-1">
                        <Label htmlFor="maintenance-mode" className="font-medium">
                            Maintenance Mode
                        </Label>
                        <span className="text-sm text-muted-foreground">
                            {enabled ? 'System is currently offline for users' : 'System is online'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {updating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                        <Switch
                            id="maintenance-mode"
                            checked={enabled}
                            onCheckedChange={handleToggle}
                            disabled={updating}
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
