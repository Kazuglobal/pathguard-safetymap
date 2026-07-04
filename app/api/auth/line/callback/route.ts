import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase-admin"
import { createServerClient } from "@/lib/supabase-server"
import {
  exchangeAndVerifyLineCode,
  getLineCredentials,
  syntheticLineEmail,
} from "@/lib/auth/line"

export const dynamic = "force-dynamic"

const STATE_COOKIE = "pg_line_state"
const NONCE_COOKIE = "pg_line_nonce"

function redirectWithError(origin: string, code: string) {
  return NextResponse.redirect(new URL(`/login?error=${code}`, origin))
}

/**
 * LINEログインのコールバック。
 * state検証 → コード交換 → IDトークン検証 → Supabaseユーザーの作成/取得 →
 * magiclinkトークンでセッションCookieを発行、の順で処理する。
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")

  const cookieStore = await cookies()
  const expectedState = cookieStore.get(STATE_COOKIE)?.value
  const nonce = cookieStore.get(NONCE_COOKIE)?.value

  // state/nonceは一度きり。検証前に必ず破棄してリプレイを防ぐ。
  cookieStore.delete(STATE_COOKIE)
  cookieStore.delete(NONCE_COOKIE)

  if (url.searchParams.get("error")) {
    // ユーザーがLINE側でキャンセルした場合など
    return NextResponse.redirect(new URL("/login", url.origin))
  }

  if (!code || !state || !expectedState || !nonce || state !== expectedState) {
    return redirectWithError(url.origin, "line_state_mismatch")
  }

  const credentials = getLineCredentials()
  if (!credentials) {
    return redirectWithError(url.origin, "line_not_configured")
  }

  try {
    const profile = await exchangeAndVerifyLineCode({
      code,
      redirectUri: new URL("/api/auth/line/callback", url.origin).toString(),
      channelId: credentials.channelId,
      channelSecret: credentials.channelSecret,
      nonce,
    })

    const email = profile.email ?? syntheticLineEmail(profile.userId)
    const admin = getSupabaseAdmin()

    const metadata = {
      provider: "line",
      line_user_id: profile.userId,
      ...(profile.displayName ? { name: profile.displayName, full_name: profile.displayName } : {}),
      ...(profile.avatarUrl ? { avatar_url: profile.avatarUrl } : {}),
    }

    // 既存ユーザーなら email_exists で失敗するだけなので、そのまま続行してよい
    const { error: createError } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: metadata,
    })
    if (createError) {
      const isExisting =
        createError.code === "email_exists" ||
        /already.*registered/i.test(createError.message)
      if (!isExisting) throw createError
    }

    // magiclinkのtoken_hashを使い、このレスポンスのCookieにセッションを発行する
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    })
    if (linkError) throw linkError

    const tokenHash = linkData.properties?.hashed_token
    if (!tokenHash) throw new Error("magiclink token_hash was not returned")

    const supabase = await createServerClient()
    const { data: sessionData, error: verifyError } = await supabase.auth.verifyOtp({
      type: "email",
      token_hash: tokenHash,
    })
    if (verifyError) throw verifyError

    // 最新のLINEプロフィールをメタデータへ反映(失敗してもログインは成立させる)
    if (sessionData.user) {
      await admin.auth.admin
        .updateUserById(sessionData.user.id, { user_metadata: metadata })
        .catch(() => {})
    }

    return NextResponse.redirect(new URL("/map", url.origin))
  } catch (error) {
    console.error("LINE login failed:", error)
    return redirectWithError(url.origin, "line_login_failed")
  }
}
