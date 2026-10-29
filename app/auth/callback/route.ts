import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-server"
import { getSafeNextPath } from "@/lib/auth/safe-next"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { buildPersonalMetadataScrub } from "@/lib/privacy/personal-metadata"

/**
 * Supabase OAuth (Google等) のコールバック。
 * PKCEの認可コードをセッションに交換し、Cookieへ保存してアプリに戻す。
 *
 * Google ログインは Supabase の仕様で、ログインのたびに名前と顔写真の URL を user_metadata に入れ直す。
 * アプリはどれも使わず、預からない設計(UIUX改装 項目55・62)なので、ここで毎回消す。
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
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) throw error
    await removePersonalMetadata(data.user)
  } catch (error) {
    console.error("OAuth code exchange failed:", error)
    return NextResponse.redirect(new URL("/login?error=oauth_failed", url.origin))
  }

  return NextResponse.redirect(new URL(safeNext, url.origin))
}

/** 名前・顔写真を user_metadata から消す。失敗してもログインは止めない(次のログインでまた消す) */
async function removePersonalMetadata(user: { id: string; user_metadata?: Record<string, unknown> } | null | undefined) {
  const scrub = buildPersonalMetadataScrub(user?.user_metadata)
  if (!user || !scrub) return
  try {
    const { error } = await getSupabaseAdmin().auth.admin.updateUserById(user.id, { user_metadata: scrub })
    if (error) throw error
  } catch {
    console.error("OAuth login: failed to remove the provider name/icon from user metadata")
  }
}
