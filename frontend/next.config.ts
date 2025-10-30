import type { NextConfig } from 'next';

const nextConfig = (): NextConfig => ({
  output: (process.env.NEXT_OUTPUT as 'standalone') || undefined,
  
  async rewrites() {
    // Get Supabase URL from environment (localhost for local dev)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:8888';
    
    return [
      // Proxy Supabase auth requests through Next.js
      // This allows OAuth callbacks to work via Cloudflare Tunnel
      // while keeping Supabase unexposed to the internet
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
    ];
  },
  skipTrailingSlashRedirect: true,
});

export default nextConfig;
