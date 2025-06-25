import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-server"

export async function GET(request: NextRequest) {
  try {
    console.log('Testing authentication...')
    
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    console.log('Auth check result:', { user: !!user, error: authError })
    
    return NextResponse.json({
      authenticated: !!user,
      userId: user?.id || null,
      userEmail: user?.email || null,
      authError: authError?.message || null,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Auth test failed:', error)
    
    return NextResponse.json({
      error: 'Failed to test authentication',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}