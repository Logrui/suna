import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Use the current browser origin for Supabase requests
  // This allows the app to work from both localhost:3000 and kortix.syhc.dev
  // Next.js rewrites will proxy /auth/v1/* to the actual Supabase instance
  const supabaseUrl = typeof window !== 'undefined' 
    ? window.location.origin 
    : 'http://localhost:3000' // Fallback for SSR (shouldn't happen for browser client)
  
  return createBrowserClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      isSingleton: true,
    }
  )
}
