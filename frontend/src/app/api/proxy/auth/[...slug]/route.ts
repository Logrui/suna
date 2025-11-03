'use client'

import { NextRequest, NextResponse } from 'next/server'

/**
 * Proxy handler for Supabase Auth API requests
 * This allows the app to work with both localhost:8888 and kortix.syhc.dev
 * 
 * Flow:
 * 1. Browser requests: /auth/v1/...
 * 2. Next.js API route receives it
 * 3. We determine the Supabase backend (localhost:8888 for local, supabase-kong:8000 for docker)
 * 4. Proxy the request to the real Supabase
 * 5. Return response to browser
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params
  const pathSegments = slug || []
  const path = pathSegments.join('/')

  // Determine Supabase backend based on environment
  const host = request.headers.get('host') || 'localhost:3000'
  const protocol = request.headers.get('x-forwarded-proto') || 'http'

  let supabaseBackend: string

  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    // Local development: route to local Kong
    supabaseBackend = 'http://localhost:8888'
  } else {
    // Production/Cloudflare: route to Kong subdomain (e.g., kong.kortix.syhc.dev)
    // This ensures auth requests go to the actual Supabase backend, not the frontend
    supabaseBackend = `${protocol}://kong.${host}`
  }

  const url = `${supabaseBackend}/auth/v1/${path}`
  const queryString = request.nextUrl.search
  const fullUrl = queryString ? `${url}?${queryString.substring(1)}` : url

  try {
    const response = await fetch(fullUrl, {
      method: request.method,
      headers: {
        // Forward headers (but avoid conflicts)
        ...Object.fromEntries(
          Array.from(request.headers.entries()).filter(
            ([key]) =>
              !['host', 'connection', 'content-length'].includes(key.toLowerCase())
          )
        ),
      },
      body: request.method !== 'GET' && request.method !== 'HEAD' 
        ? await request.text() 
        : undefined,
    })

    // Clone the response and return it
    const data = await response.text()
    return new NextResponse(data, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
        // Preserve CORS and auth-related headers
        ...Object.fromEntries(
          Array.from(response.headers.entries()).filter(
            ([key]) =>
              [
                'set-cookie',
                'content-type',
                'cache-control',
                'access-control-allow-origin',
              ].includes(key.toLowerCase())
          )
        ),
      },
    })
  } catch (error) {
    console.error(`[Auth Proxy] Error proxying ${fullUrl}:`, error)
    return NextResponse.json(
      { error: 'Failed to proxy request' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  return GET(request, { params })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  return GET(request, { params })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  return GET(request, { params })
}
