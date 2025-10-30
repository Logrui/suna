'use server'
import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  const headerStore = await headers()

  // For server-side, try to get the origin from request headers
  // This allows the app to work from both localhost:3000 and kortix.syhc.dev
  const origin = headerStore.get('x-forwarded-host') || headerStore.get('host')
  const protocol = headerStore.get('x-forwarded-proto') || 'http'
  const supabaseUrl = origin ? `${protocol}://${origin}` : process.env.NEXT_PUBLIC_SUPABASE_URL!

  return createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
