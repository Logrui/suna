import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    return NextResponse.json({
      success: !error,
      user: user?.email || null,
      error: error?.message || null,
      url: process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_URL,
      fallbackUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    })
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}
