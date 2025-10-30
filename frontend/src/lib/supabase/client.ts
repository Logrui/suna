import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Use NEXT_PUBLIC_SUPABASE_PUBLIC_URL for browser-side requests (can resolve localhost)
  // Falls back to NEXT_PUBLIC_SUPABASE_URL if not set
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
  
  return createBrowserClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      isSingleton: true,
    }
  )
}
