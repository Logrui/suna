'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { KortixLoader } from '@/components/ui/kortix-loader';
import { useApiHealth } from '@/hooks/usage/use-health';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { isLocalMode } from '@/lib/config';
import { AnimatedBg } from '@/components/ui/animated-bg';
import { KortixLogo } from '@/components/sidebar/kortix-logo';
import { cn } from '@/lib/utils';

interface ServiceStatusCardProps {
  title: string;
  status: 'online' | 'offline' | 'checking';
}

function ServiceStatusCard({ title, status }: ServiceStatusCardProps) {
  const isOnline = status === 'online';
  const isChecking = status === 'checking';

  let statusText = 'Checking...';
  if (isOnline) statusText = 'Connected';
  if (status === 'offline') statusText = 'Offline';

  return (
    <Card className="flex-1 bg-card border border-border">
      <CardContent className="p-4 h-full flex flex-col items-center justify-center gap-1">
        <span className="text-sm font-medium text-muted-foreground">
          {title}
        </span>
        <div className="flex items-center gap-2">
          <div className={cn(
            "h-2 w-2 rounded-full",
            isChecking ? "bg-yellow-500 animate-pulse" : isOnline ? "bg-green-500" : "bg-red-500"
          )} />
          <span className={cn(
            "text-sm font-medium",
            isChecking ? "text-yellow-400" : isOnline ? "text-green-400" : "text-red-400"
          )}>
            {statusText}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function MaintenancePage() {
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [frontendStatus, setFrontendStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [supabaseStatus, setSupabaseStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  const { data: healthData, isLoading: isCheckingHealth, refetch, isError: isBackendError } = useApiHealth();

  const checkServices = async () => {
    setFrontendStatus('checking');
    setSupabaseStatus('checking');
    setBackendStatus('checking');

    // Check Frontend
    try {
      const frontendUrl = process.env.NEXT_PUBLIC_URL || window.location.origin;
      await fetch(frontendUrl, { method: 'HEAD', mode: 'no-cors' });
      setFrontendStatus('online');
    } catch (e) {
      setFrontendStatus('offline');
    }

    // Check Supabase
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (supabaseUrl) {
        await fetch(supabaseUrl, { method: 'HEAD', mode: 'no-cors' });
        setSupabaseStatus('online');
      } else {
        setSupabaseStatus('offline');
      }
    } catch (e) {
      setSupabaseStatus('offline');
    }

    // Check Backend
    try {
      // Use direct fetch to bypass react-query cache and ensure real-time status
      const res = await fetch('/api/health', { cache: 'no-store' });
      if (res.ok) {
        setBackendStatus('online');
      } else {
        setBackendStatus('offline');
      }
    } catch (e) {
      setBackendStatus('offline');
    }
  };

  const checkHealth = async () => {
    checkServices();
    try {
      const result = await refetch();
      if (result.data) {
        window.location.reload();
      }
    } catch (error) {
      console.error('API health check failed:', error);
    } finally {
      setLastChecked(new Date());
    }
  };

  useEffect(() => {
    setLastChecked(new Date());
    checkServices();
  }, []);

  return (
    <div className="w-full relative overflow-hidden min-h-screen">
      <div className="relative flex flex-col items-center w-full px-4 sm:px-6 min-h-screen justify-center">
        {/* Animated background - exactly like hero section */}
        <AnimatedBg variant="hero" />

        <div className="relative z-10 w-full max-w-[456px] flex flex-col items-center gap-8">
          {/* Logo - 32px height */}
          <KortixLogo size={32} />

          {/* Title - 43px */}
          <h1 className="text-[43px] font-normal tracking-tight textforeground leading-none">
            We'll Be Right Back
          </h1>

          {/* Description - 16px */}
          <p className="text-[16px] text-foreground/60 text-center leading-relaxed">
            {isLocalMode() ? (
              "Performing scheduled maintenance to enhance system stability. All services will resume shortly."
            ) : (
              "Performing scheduled maintenance to enhance system stability. All services will resume shortly."
            )}
          </p>

          {/* Status Card - 456px width, 96px height */}
          <Card className="w-full h-24 bg-card border border-border">
            <CardContent className="p-6 h-full">
              <div className="flex items-center justify-between h-full">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <div className='flex items-center gap-2'>
                      <div className="h-2.5 w-2.5 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-base font-medium text-red-400">Services Offline</span>
                    </div>
                    <p className="text-base text-gray-400">All Worker executions are currently paused.</p>
                  </div>
                </div>
                <Button
                  onClick={checkHealth}
                  disabled={isCheckingHealth}
                  size="icon"
                  variant="ghost"
                  className="h-12 w-12 bg-border"
                >
                  {isCheckingHealth ? (
                    <KortixLoader size="small" customSize={20} />
                  ) : (
                    <RefreshCw className="h-5 w-5 text-foreground" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Individual Service Statuses */}
          <div className="flex gap-4 w-full">
            <ServiceStatusCard title="Frontend" status={frontendStatus} />
            <ServiceStatusCard title="Backend" status={backendStatus} />
            <ServiceStatusCard title="Supabase" status={supabaseStatus} />
          </div>
        </div>

        {/* Grain texture overlay - ON TOP OF EVERYTHING */}
        <div
          className="absolute inset-0 opacity-[0.15] pointer-events-none z-50"
          style={{
            backgroundImage: 'url(/grain-texture.png)',
            backgroundRepeat: 'repeat',
            mixBlendMode: 'overlay'
          }}
        />
      </div>
    </div>
  );
}
