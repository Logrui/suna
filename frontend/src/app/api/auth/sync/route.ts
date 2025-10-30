import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { access_token, refresh_token } = await request.json()

  console.log('[API] Auth sync called with tokens:', {
    hasAccessToken: !!access_token,
    hasRefreshToken: !!refresh_token,
  });

  if (!access_token) {
    return NextResponse.json({ error: 'No access_token provided' }, { status: 400 })
  }

  try {
    console.log('[API] Setting session on server...');
    const supabase = await createClient()
    
    // Set the session on the server using the tokens from the client
    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    })

    if (error) {
      console.log('[API] setSession error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.log('[API] Session set successfully, user:', data.user?.email);
    
    return NextResponse.json({ 
      success: true, 
      user: data.user?.email,
      hasSession: !!data.session
    })
  } catch (err) {
    console.log('[API] Error setting session:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
