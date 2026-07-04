import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-server"

/**
 * Supabase OAuth (Google等) のコールバック。
 * PKCEの認可コードをセッションに交換し、Cookieへ保存してアプリに戻す。
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const next = url.searchParams.get("next") ?? "/map"

  // open redirect 防止: 解決後のURLが同一オリジンのときだけ許可する
  // (先頭の "//" や "/\" はURL解決で外部オリジンになり得るため、文字列判定に頼らない)
  const resolved = new URL(next, url.origin)
  const safeNext =
    resolved.origin === url.origin ? `${resolved.pathname}${resolved.search}` : "/map"

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
