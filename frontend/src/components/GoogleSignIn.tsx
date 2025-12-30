'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Icons } from './home/icons';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
interface GoogleSignInProps {
  returnUrl?: string;
}
export default function GoogleSignIn({ returnUrl }: GoogleSignInProps) {
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();
  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      
      // Always redirect back to current origin + returnUrl (or /dashboard)
      // This overrides Supabase's SITE_URL and provides true dual support
      const redirectUrl = returnUrl ? `${window.location.origin}${returnUrl}` : `${window.location.origin}/dashboard`;
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            hd: 'douravita.com.br',  // Restrict to douravita.com.br domain only
          },
        },
      });
      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      toast.error(error.message || 'Failed to sign in with Google');
      setIsLoading(false);
    }
  };
  return (
    <Button
      onClick={handleGoogleSignIn}
      disabled={isLoading}
      variant="outline"
      size="lg"
      className="w-full h-12"
      type="button"
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Icons.google className="w-4 h-4" />
      )}
      <span>
        {isLoading ? 'Signing in...' : 'Continue with Google'}
      </span>
    </Button>
  );
}
