'use client';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { Loader2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface DevLoginDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DevLoginDialog({ open, onOpenChange }: DevLoginDialogProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !password) {
            toast.error('Please enter both email and admin password');
            return;
        }

        setIsLoading(true);

        try {
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

            // Note: NEXT_PUBLIC_BACKEND_URL already includes /v1, so we don't add it again
            const response = await fetch(`${backendUrl}/dev/admin-login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email,
                    admin_password: password,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Failed to generate session');
            }

            if (data.success && data.access_token && data.refresh_token) {
                // We have session tokens - set them using Supabase client
                const supabase = createClient();

                const { error: sessionError } = await supabase.auth.setSession({
                    access_token: data.access_token,
                    refresh_token: data.refresh_token,
                });

                if (sessionError) {
                    throw new Error(`Failed to set session: ${sessionError.message}`);
                }

                toast.success(`Logged in as ${email}`);
                onOpenChange(false);

                // Navigate to dashboard
                router.push('/dashboard');
                router.refresh();
            } else {
                toast.error(data.message || 'Login failed');
            }
        } catch (error) {
            console.error('Dev login error:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to login');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <KeyRound className="h-5 w-5" />
                        Developer Login
                    </DialogTitle>
                    <DialogDescription>
                        Login as any user account for local development.
                        Requires MASTER_ADMIN_PASSWORD.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="dev-email">User Email</Label>
                        <Input
                            id="dev-email"
                            type="email"
                            placeholder="user@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="dev-password">Admin Password</Label>
                        <Input
                            id="dev-password"
                            type="password"
                            placeholder="MASTER_ADMIN_PASSWORD"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={isLoading}
                        />
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Logging in...
                                </>
                            ) : (
                                'Login'
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
