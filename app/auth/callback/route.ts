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

  // open redirect 防止: アプリ内パスのみ許可
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/map"

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
