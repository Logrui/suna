import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_ROUTES = [
  '/auth',
  '/legal',
  '/shared',
  '/api/auth',
  '/api/webhooks',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') ||
    pathname.startsWith('/api/')
  ) {
    return NextResponse.next();
  }

  // Allow all public routes without any checks
  if (PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    return NextResponse.next();
  }

  // Everything else requires authentication
  let supabaseResponse = NextResponse.next({
    request,
  });

  // Use the request host to determine Supabase URL
  const host = request.headers.get('host') || 'localhost:9990'
  const protocol = request.headers.get('x-forwarded-proto') || 'http'
  const supabaseUrl = `${protocol}://${host}`

  const supabase = createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    // Redirect to auth if not authenticated
    if (authError || !user) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth';
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }

    // BILLING DISABLED - Skip all billing/subscription checks for internal use
    // All authenticated users have full access
    return supabaseResponse;

  } catch (error) {
    console.error('Middleware error:', error);
    return supabaseResponse;
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
