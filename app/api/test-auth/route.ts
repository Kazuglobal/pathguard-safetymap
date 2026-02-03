import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-server"

// セキュリティ上の理由により、このエンドポイントは本番環境では無効化されています
// ユーザー情報の漏洩を防ぐため

export async function GET(request: NextRequest) {
  // 本番環境では常に403を返す
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "This endpoint is disabled in production" },
      { status: 403 }
    )
  }

  try {
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    // ユーザーメールなどの個人情報は返さない
    return NextResponse.json({
      authenticated: !!user,
      hasUserId: !!user?.id,
      authError: authError?.message || null,
      timestamp: new Date().toISOString(),
      warning: "Debug endpoint - user details hidden for security"
    })
  } catch (error) {
    console.error('Auth test failed:', error)

    return NextResponse.json({
      error: 'Failed to test authentication',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}