import { NextResponse } from 'next/server'
import { validateMapboxTokenAsync, getMapboxToken } from '@/lib/mapbox-config'

export async function GET() {
  try {
    // Check if the token is available in the environment
    const token = getMapboxToken()
    
    if (!token) {
      return NextResponse.json({
        error: 'NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN is not set or invalid format',
        available: false,
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
      }, { status: 500 })
    }

    // Use enhanced token validation
    const validation = await validateMapboxTokenAsync()
    
    if (!validation.isValid) {
      return NextResponse.json({
        error: validation.error,
        available: true,
        tokenPrefix: token.substring(0, 10) + '...',
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
      }, { status: 400 })
    }

    // Test specific API endpoints
    const tests = {
      tokenValidation: { status: 'success', message: 'Token is valid' },
      styleAccess: { status: 'pending', message: 'Testing style access...' },
      httpsCheck: { status: 'pending', message: 'Checking HTTPS requirement...' }
    }

    // Test style access
    try {
      const styleResponse = await fetch(`https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=${token}`)
      if (styleResponse.ok) {
        tests.styleAccess = { status: 'success', message: 'Style access successful' }
      } else {
        tests.styleAccess = { status: 'error', message: `Style access failed: HTTP ${styleResponse.status}` }
      }
    } catch (error) {
      tests.styleAccess = { status: 'error', message: `Style access error: ${error instanceof Error ? error.message : 'Unknown error'}` }
    }

    // HTTPS check
    const headers = NextResponse.next().headers
    const protocol = headers.get('x-forwarded-proto') || 'https'
    tests.httpsCheck = { 
      status: protocol === 'https' ? 'success' : 'warning', 
      message: protocol === 'https' ? 'HTTPS detected' : 'HTTP detected - may cause issues in production' 
    }

    return NextResponse.json({
      success: true,
      available: true,
      tokenPrefix: token.substring(0, 10) + '...',
      tokenData: validation.details,
      tests,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('Mapbox token debug error:', error)
    return NextResponse.json({
      error: 'Internal server error during token validation',
      available: !!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}