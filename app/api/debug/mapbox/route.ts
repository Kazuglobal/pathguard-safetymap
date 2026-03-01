import { NextResponse } from 'next/server'
import { validateMapboxTokenAsync, getMapboxToken } from '@/lib/mapbox-config'

// セキュリティ上の理由により、このエンドポイントは本番環境では無効化されています
// トークンの部分的な漏洩を防ぐため

export async function GET() {
  // 本番環境では常に403を返す
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "This endpoint is disabled in production" },
      { status: 403 }
    )
  }

  try {
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

    // トークンの部分情報は返さない
    return NextResponse.json({
      success: validation.isValid,
      available: true,
      isValid: validation.isValid,
      error: validation.error || null,
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      warning: "Debug endpoint - token details hidden for security"
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