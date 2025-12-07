import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: (process.env.NEXT_OUTPUT as 'standalone' | 'export') || undefined,

  // Enable source maps for easier debugging in browser console
  productionBrowserSourceMaps: true,

  // Cloudflare doesn't support Next.js Image Optimization
  images: {
    unoptimized: true,
  },

  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },

  async rewrites() {
    // Supabase URL detection:
    // - For local dev (localhost): use localhost:8888
    // - For docker/production: use docker internal hostname
    // Note: This is evaluated at BUILD time, but we use a pattern that works for both
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:8888'
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://backend:8000/api'

    return [
      // Proxy Backend API requests through Next.js
      // The backend URL is consistent across all deployments
      {
        source: '/api/:path*',
        destination: `${backendUrl}/:path*`,
      },

      // Proxy Supabase Auth API requests through Next.js
      // This allows OAuth callbacks to work via Cloudflare Tunnel
      // Browser client uses window.location.origin, so requests come to /auth/v1/*
      // Next.js rewrites them to the actual Supabase backend
      {
        source: '/auth/v1/:path*',
        destination: `${supabaseUrl}/auth/v1/:path*`,
      },
      {
        source: '/rest/v1/:path*',
        destination: `${supabaseUrl}/rest/v1/:path*`,
      },
      {
        source: '/storage/v1/:path*',
        destination: `${supabaseUrl}/storage/v1/:path*`,
      },
      {
        source: '/realtime/v1/:path*',
        destination: `${supabaseUrl}/realtime/v1/:path*`,
      },

      // PostHog analytics proxying
      {
        source: '/ingest/static/:path*',
        destination: 'https://eu-assets.i.posthog.com/static/:path*',
      },
      {
        source: '/ingest/:path*',
        destination: 'https://eu.i.posthog.com/:path*',
      },
      {
        source: '/ingest/flags',
        destination: 'https://eu.i.posthog.com/flags',
      },
    ]
  },
  skipTrailingSlashRedirect: true,
}

export default nextConfig
