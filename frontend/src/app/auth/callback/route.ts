import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Intelligently detect the correct redirect URI for OAuth callbacks
 *
 * This supports multi-domain deployments:
 * - localhost:3000 (local development)
 * - https://kortix.syhc.dev (Cloudflare Tunnel)
 *
 * Priority:
 * 1. NEXT_PUBLIC_URL (explicit override, backward compatible)
 * 2. Request headers (x-forwarded-proto/host for proxies, host header)
 * 3. Fallback to localhost:3000
 */
function getBaseUrl(request: NextRequest): string {
  // If NEXT_PUBLIC_URL is explicitly set, use it (backward compatibility)
  if (process.env.NEXT_PUBLIC_URL) {
    return process.env.NEXT_PUBLIC_URL
  }

  // Extract the protocol from the request
  // x-forwarded-proto is set by Cloudflare Tunnel and other reverse proxies
  const protocol = request.headers.get('x-forwarded-proto') || 'http'

  // Extract the host from the request
  // x-forwarded-host is set by Cloudflare Tunnel
  // host header is used for direct access
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost:3000'

  const baseUrl = `${protocol}://${host}`

  console.log('🔐 OAuth Callback URL Detection:', {
    protocol,
    host,
    baseUrl,
    xForwardedProto: request.headers.get('x-forwarded-proto'),
    xForwardedHost: request.headers.get('x-forwarded-host'),
    hostHeader: request.headers.get('host'),
  })

  return baseUrl
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('returnUrl') || searchParams.get('redirect') || '/dashboard'

  const baseUrl = getBaseUrl(request)
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  if (error) {
    console.error('❌ Auth callback error:', error, errorDescription)
    return NextResponse.redirect(`${baseUrl}/auth?error=${encodeURIComponent(error)}`)
  }

  if (code) {
    const supabase = await createClient()
    
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('❌ Error exchanging code for session:', error)
        return NextResponse.redirect(`${baseUrl}/auth?error=${encodeURIComponent(error.message)}`)
      }

      // URL to redirect to after sign in process completes
      return NextResponse.redirect(`${baseUrl}${next}`)
    } catch (error) {
      console.error('❌ Unexpected error in auth callback:', error)
      return NextResponse.redirect(`${baseUrl}/auth?error=unexpected_error`)
    }
  }
  return NextResponse.redirect(`${baseUrl}/auth`)
}
