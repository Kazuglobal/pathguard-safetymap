import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-server"
import { getSafeNextPath } from "@/lib/auth/safe-next"

/**
 * Supabase OAuth (Google等) のコールバック。
 * PKCEの認可コードをセッションに交換し、Cookieへ保存してアプリに戻す。
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const safeNext = getSafeNextPath(url.searchParams.get("next"))

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=oauth_missing_code", url.origin))
  }

  try {
    const supabase = await createServerClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) throw error
  } catch (error) {
    console.error("OAuth code exchange failed:", error)
    return NextResponse.redirect(new URL("/login?error=oauth_failed", url.origin))
  }

  return NextResponse.redirect(new URL(safeNext, url.origin))
}
