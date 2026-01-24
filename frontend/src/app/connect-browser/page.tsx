'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useRegisterBrowser } from '@/hooks/browser/use-user-browsers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Check,
  User,
  X,
  UserPlus,
  Loader2,
  ExternalLink,
  RefreshCw,
  Info,
  Globe,
  Zap,
  Shield,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

// ========== Types ==========

interface ExtensionStatus {
  type: 'KORTIX_EXTENSION_STATUS';
  installed: boolean;
  connected: boolean;
  extensionId: string | null;
}

interface ConnectionResult {
  type: 'KORTIX_EXTENSION_CONNECTED';
  success: boolean;
  error?: string;
}

type PageState =
  | 'checking'
  | 'not_installed'
  | 'not_logged_in'
  | 'ready'
  | 'connecting'
  | 'success'
  | 'already_connected'
  | 'error';

// ========== Component ==========

export default function ConnectBrowserPage() {
  const { user, isLoading: authLoading } = useAuth();
  const registerBrowser = useRegisterBrowser();
  const router = useRouter();

  const [pageState, setPageState] = useState<PageState>('checking');
  const [extensionStatus, setExtensionStatus] =
    useState<ExtensionStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [browserName, setBrowserName] = useState<string>('');

  // Listen for extension messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const data = event.data;
      if (data?.type === 'KORTIX_EXTENSION_STATUS') {
        setExtensionStatus(data);

        if (data.installed) {
          if (data.connected) {
            setPageState('already_connected');
          } else if (user) {
            setPageState('ready');
          } else {
            setPageState('not_logged_in');
          }
        } else {
          setPageState('not_installed');
        }
      }

      if (data?.type === 'KORTIX_EXTENSION_CONNECTED') {
        if (data.success) {
          setPageState('success');
        } else {
          setPageState('error');
          setErrorMessage(data.error || 'Connection failed');
        }
      }

      if (data?.type === 'KORTIX_EXTENSION_DISCONNECTED') {
        setPageState('ready');
      }
    };

    window.addEventListener('message', handleMessage);

    const fallbackTimer = setTimeout(() => {
      if (!extensionStatus) {
        setPageState('not_installed');
      }
    }, 3000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(fallbackTimer);
    };
  }, [extensionStatus, user]);

  // Initial status request
  useEffect(() => {
    const requestStatus = () => {
      window.postMessage(
        { type: 'KORTIX_CHECK_EXTENSION' },
        window.location.origin,
      );
    };

    requestStatus();
    const timer = setTimeout(requestStatus, 1000);

    return () => clearTimeout(timer);
  }, []);

  // Update state when auth changes
  useEffect(() => {
    if (!authLoading && extensionStatus?.installed) {
      if (user) {
        if (extensionStatus.connected) {
          setPageState('already_connected');
        } else {
          setPageState('ready');
        }
      } else {
        setPageState('not_logged_in');
      }
    }
  }, [authLoading, user, extensionStatus]);

  // Handle connect button
  const handleConnect = async () => {
    if (!extensionStatus?.extensionId || !user) return;

    setPageState('connecting');

    try {
      const result = await registerBrowser.mutateAsync({
        extensionId: extensionStatus.extensionId,
        browserInfo: {
          browser: navigator.userAgent,
          os: navigator.platform,
        },
        name: browserName.trim() || undefined,
      });

      window.postMessage(
        {
          type: 'KORTIX_BROWSER_TOKEN',
          token: result.token,
          browserInfo: {
            name: `${navigator.platform} Browser`,
            browser: navigator.userAgent,
            os: navigator.platform,
          },
        },
        window.location.origin,
      );
    } catch (error) {
      setPageState('error');
      setErrorMessage(
        error instanceof Error ? error.message : 'Registration failed',
      );
    }
  };

  // Handle reconnect button
  const handleReconnect = () => {
    window.postMessage(
      { type: 'KORTIX_DISCONNECT_EXTENSION' },
      window.location.origin,
    );
    setPageState('ready');
    setBrowserName('');
  };

  // Get browser details
  const getBrowserDetails = () => {
    const ua = navigator.userAgent;
    let browserName = 'Unknown Browser';
    const osName = navigator.platform;

    if (ua.includes('Chrome')) browserName = 'Chrome';
    else if (ua.includes('Firefox')) browserName = 'Firefox';
    else if (ua.includes('Safari')) browserName = 'Safari';
    else if (ua.includes('Edge')) browserName = 'Edge';

    return { browserName, osName };
  };

  const browserDetails = getBrowserDetails();

  // ========== Render ==========

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden relative flex items-center justify-center">
      {/* Brandmark Background */}
      <div
        className="fixed inset-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        <img
          src="/kortix-brandmark-bg.svg"
          alt=""
          className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-[160vw] min-w-[1000px] h-auto object-contain select-none invert dark:invert-0"
          draggable={false}
        />
      </div>

      {/* Animated Background Orbs - White */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* White Orb - Top Left */}
        <div
          className="absolute w-[500px] h-[500px] rounded-full animate-[float_20s_ease-in-out_infinite]"
          style={{
            background:
              'radial-gradient(circle, oklch(1 0 0 / 0.15) 0%, transparent 70%)',
            filter: 'blur(80px)',
            top: '-10%',
            left: '-10%',
          }}
        />
        {/* White Orb - Bottom Right */}
        <div
          className="absolute w-[400px] h-[400px] rounded-full animate-[float_20s_ease-in-out_7s_infinite]"
          style={{
            background:
              'radial-gradient(circle, oklch(1 0 0 / 0.12) 0%, transparent 70%)',
            filter: 'blur(80px)',
            bottom: '-10%',
            right: '-10%',
          }}
        />
        {/* White Orb - Center */}
        <div
          className="absolute w-[350px] h-[350px] rounded-full animate-[float_20s_ease-in-out_14s_infinite]"
          style={{
            background:
              'radial-gradient(circle, oklch(1 0 0 / 0.1) 0%, transparent 70%)',
            filter: 'blur(80px)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>

      {/* Main Content - Centered */}
      <div className="relative z-10 w-full max-w-[520px] px-4 py-8">
        {/* Glassmorphism Card */}
        <div
          className={cn(
            'w-full rounded-3xl p-6 sm:p-8 animate-[fadeInUp_0.8s_ease-out_forwards]',
            'bg-card/100 backdrop-blur-xl border border-border/50',
            'shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
          )}
        >
          {/* Header with Kortix Logo */}
          <div className="text-center mb-6">
            <div className="relative inline-flex items-center justify-center w-28 h-24 mb-2">
              {/* Background effect - slightly larger outline */}
              <Image
                src="/kortix-brandmark-effect-full.svg"
                alt=""
                fill
                className="object-contain opacity-40"
              />
              {/* Main logo - centered within */}
              <Image
                src="/kortix-symbol.svg"
                alt="Kortix"
                width={60}
                height={50}
                className="relative dark:invert"
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
              Browser Operator
            </h1>
          </div>

          {/* Divider */}
          <div className="h-px mb-6 bg-gradient-to-r from-transparent via-muted-foreground/30 to-transparent" />

          {/* Dynamic Content Based on State */}
          <div className="animate-[fadeInUp_0.8s_ease-out_0.1s_forwards] opacity-0">
            {/* Checking */}
            {pageState === 'checking' && (
              <div className="flex flex-col items-center py-8">
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-secondary" />
                  </div>
                  <div className="absolute inset-0 rounded-full bg-secondary/20 animate-ping" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Searching for extension...
                </p>
              </div>
            )}

            {/* Not Installed */}
            {pageState === 'not_installed' && (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
                  <Info className="w-8 h-8 text-amber-400" />
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  Kortix Operator Extension Not Detected
                </h2>
                <p className="text-sm text-muted-foreground text-center mb-6 leading-relaxed">
                  Install Kortix Browser Operator to enable your Workers access
                  to your personal browser context.
                </p>

                {process.env.NEXT_PUBLIC_EXTENSION_DOWNLOAD_URL ? (
                  <div className="w-full flex flex-col items-center space-y-4">
                    <Button asChild size="sm" className="gap-2">
                      <a
                        href={process.env.NEXT_PUBLIC_EXTENSION_DOWNLOAD_URL}
                        download
                      >
                        <ExternalLink className="w-4 h-4" />
                        Download Extension
                      </a>
                    </Button>
                    <p className="text-[11px] text-center text-muted-foreground px-4">
                      Download the ZIP, extract it, then load unpacked at{' '}
                      <a
                        href="chrome://extensions"
                        className="text-secondary hover:underline"
                        onClick={(e) => {
                          e.preventDefault();
                          navigator.clipboard.writeText('chrome://extensions');
                        }}
                        title="Click to copy (paste in address bar)"
                      >
                        chrome://extensions
                      </a>
                    </p>
                  </div>
                ) : (
                  <div className="w-full space-y-4">
                    <div className="p-4 rounded-xl bg-muted/50 border border-border text-center">
                      <p className="text-medium font-medium text-foreground/80 mb-1">
                        Self-Hosted Setup Instructions
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        (1) Build the extension from source (if needed)
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        (2) Navigate to chrome://extensions and enable developer
                        mode
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        (3) Click on "Load unpacked" and select the dist/ folder
                        or .zip file
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Not Logged In */}
            {pageState === 'not_logged_in' && (
              <div className="flex flex-col items-center py-4">
                <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mb-4">
                  <Shield className="w-8 h-8 text-secondary" />
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  Sign In Required
                </h2>
                <p className="text-sm text-muted-foreground text-center mb-6">
                  Please sign in to connect your browser to Kortix
                </p>
                <Button asChild>
                  <a href="/auth">Sign In to Continue</a>
                </Button>
              </div>
            )}

            {/* Ready to Connect */}
            {pageState === 'ready' && (
              <div className="flex flex-col items-center">
                <div className="relative mb-4">
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Check className="w-8 h-8 text-green-400" />
                  </div>
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  Ready to Connect
                </h2>
                <p className="text-sm text-muted-foreground text-center mb-6">
                  Kortix Extension Successfully Installed! Name your browser
                </p>

                {/* Browser Details */}
                <div className="w-full p-3 rounded-xl bg-muted/50 border border-border mb-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Globe className="w-3.5 h-3.5" />
                    <span>
                      {browserDetails.browserName} on {browserDetails.osName}
                    </span>
                  </div>
                  {extensionStatus?.extensionId && (
                    <div className="text-[10px] text-muted-foreground/60 mt-1 font-mono truncate">
                      ID: {extensionStatus.extensionId.slice(0, 20)}...
                    </div>
                  )}
                </div>

                <div className="w-full mb-6">
                  <Input
                    placeholder="e.g., Living Room PC, Work Laptop"
                    value={browserName}
                    onChange={(e) => setBrowserName(e.target.value)}
                    className="h-12 text-center"
                  />
                </div>
                <Button
                  onClick={handleConnect}
                  className="w-full h-12 text-base font-medium"
                >
                  <Zap className="w-5 h-5 mr-2" />
                  Connect Browser
                </Button>
              </div>
            )}

            {/* Connecting */}
            {pageState === 'connecting' && (
              <div className="flex flex-col items-center py-8">
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-secondary" />
                  </div>
                  <div className="absolute inset-0 rounded-full bg-secondary/20 animate-ping" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">
                  Establishing connection...
                </p>
              </div>
            )}

            {/* Already Connected */}
            {pageState === 'already_connected' && (
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                  <Check className="w-8 h-8 text-green-400" />
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  Browser Connected
                </h2>
                <p className="text-sm text-muted-foreground text-center mb-6">
                  This browser is already linked to Kortix.
                </p>

                <div className="w-full p-3 rounded-xl bg-muted/50 border border-border mb-6">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Globe className="w-3.5 h-3.5" />
                    <span>
                      {browserDetails.browserName} on {browserDetails.osName}
                    </span>
                  </div>
                  {extensionStatus?.extensionId && (
                    <div className="text-[10px] text-muted-foreground/60 mt-1 font-mono truncate">
                      ID: {extensionStatus.extensionId.slice(0, 20)}...
                    </div>
                  )}
                </div>

                <div className="flex gap-3 w-full">
                  <Button variant="outline" asChild className="flex-1">
                    <a href="/dashboard">Dashboard</a>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReconnect}
                    className="flex-1 gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reconnect
                  </Button>
                </div>

                <p className="text-[11px] text-muted-foreground/60 mt-4 text-center">
                  Click Reconnect if your browser was removed from the
                  dashboard.
                </p>
              </div>
            )}

            {/* Success */}
            {pageState === 'success' && (
              <div className="flex flex-col items-center">
                <div className="relative mb-4">
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Check className="w-8 h-8 text-green-400" />
                  </div>
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  Browser Connected!
                </h2>
                <p className="text-sm text-muted-foreground text-center mb-6">
                  You can now use &quot;My Browser&quot; in your Kortix threads.
                </p>

                <div className="w-full p-3 rounded-xl bg-muted/50 border border-border mb-6">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Globe className="w-3.5 h-3.5" />
                    <span>
                      {browserDetails.browserName} on {browserDetails.osName}
                    </span>
                  </div>
                  {browserName && (
                    <div className="text-sm font-medium text-foreground mt-1">
                      &quot;{browserName}&quot;
                    </div>
                  )}
                </div>

                <Button asChild className="w-full">
                  <a href="/dashboard">Go to Dashboard</a>
                </Button>
              </div>
            )}

            {/* Error */}
            {pageState === 'error' && (
              <div className="flex flex-col items-center py-4">
                <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
                  <X className="w-8 h-8 text-destructive" />
                </div>
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  Connection Failed
                </h2>
                <p className="text-sm text-muted-foreground text-center mb-6">
                  {errorMessage || 'An error occurred while connecting'}
                </p>
                <Button onClick={() => setPageState('ready')}>Try Again</Button>
              </div>
            )}
          </div>
        </div>
        {/* Use Cases Section - Only show when not_installed */}
        {pageState === 'not_installed' && (
          <div
            className={cn(
              'w-full rounded-3xl p-6 mt-6 animate-[fadeInUp_0.8s_ease-out_0.2s_forwards] opacity-0',
              'bg-card/50 backdrop-blur-sm border border-border/30',
            )}
          >
            {/* Getting Started Section */}
            <h3 className="text-xl font-semibold mb-3 text-center text-foreground">
              Getting Started
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed text-center mb-6">
              Enable your Kortix Workers to access your personal context for
              everyday tasks, workflows, and assistance.
            </p>

            {/* Divider */}
            <div className="h-px mb-6 bg-gradient-to-r from-transparent via-muted-foreground/20 to-transparent" />

            <h4 className="text-sm font-semibold text-foreground mb-4">
              Example Use Cases
            </h4>
            <div className="space-y-3">
              {[
                {
                  icon: User,
                  color: 'text-secondary',
                  bg: 'bg-secondary/10',
                  text: 'Apply for jobs and roles across any website or workflow',
                },
                {
                  icon: Zap,
                  color: 'text-amber-400',
                  bg: 'bg-amber-500/10',
                  text: 'Automate repetitive tasks like form filling',
                },
                {
                  icon: Globe,
                  color: 'text-green-400',
                  bg: 'bg-green-500/10',
                  text: 'Navigate and interact with complex web applications',
                },
                {
                  icon: Shield,
                  color: 'text-rose-400',
                  bg: 'bg-rose-500/10',
                  text: 'Access sites that require your login credentials',
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50 transition-colors hover:bg-muted/50"
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                      item.bg,
                    )}
                  >
                    <item.icon className={cn('w-4 h-4', item.color)} />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {item.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CSS Keyframes */}
      <style jsx global>{`
        @keyframes float {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          33% {
            transform: translate(30px, -30px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
