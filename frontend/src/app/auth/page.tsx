'use client';
import Link from 'next/link';
import GoogleSignIn from '@/components/GoogleSignIn';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { KortixLoader } from '@/components/ui/kortix-loader';
import { useAuth } from '@/components/AuthProvider';
import { KortixLogo } from '@/components/sidebar/kortix-logo';
import { AnimatedBg } from '@/components/ui/animated-bg';
import { ReleaseBadge } from '@/components/auth/release-badge';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const returnUrl = searchParams.get('returnUrl') || searchParams.get('redirect');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!isLoading && user) {
      router.push(returnUrl || '/dashboard');
    }
  }, [user, isLoading, router, returnUrl]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <KortixLoader size="large" />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <KortixLoader size="large" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative">
      <div className="absolute top-6 left-6 z-10">
        <Link href="/" className="flex items-center space-x-2">
          <KortixLogo size={28} />
        </Link>
      </div>
      <div className="flex min-h-screen">
        <div className="relative flex-1 flex items-center justify-center p-4 lg:p-8">
          <div className="w-full max-w-sm">
            <div className="mb-6 flex items-center flex-col gap-3 sm:gap-4 justify-center">
              <h1 className="text-xl sm:text-2xl font-semibold text-foreground text-center leading-tight">
                Acesse sua conta
              </h1>
              <p className="text-sm text-muted-foreground text-center">
                Use seu email @douravita.com.br para continuar
              </p>
            </div>
            <div className="space-y-3">
              <GoogleSignIn returnUrl={returnUrl || undefined} />
            </div>
            <div className="mt-6 text-center text-xs text-muted-foreground">
              <p>Apenas emails @douravita.com.br são permitidos</p>
            </div>
          </div>
        </div>
        <div className="hidden lg:flex flex-1 items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-accent/10" />
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            <AnimatedBg
              variant="hero"
              customArcs={{
                left: [
                  { pos: { left: -120, top: 150 }, opacity: 0.15 },
                  { pos: { left: -120, top: 400 }, opacity: 0.18 },
                ],
                right: [
                  { pos: { right: -150, top: 50 }, opacity: 0.2 },
                  { pos: { right: 10, top: 650 }, opacity: 0.17 },
                ]
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
