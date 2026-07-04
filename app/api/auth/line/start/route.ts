import { randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import { buildLineAuthorizeUrl, getLineCredentials } from "@/lib/auth/line"

export const dynamic = "force-dynamic"

const STATE_COOKIE = "pg_line_state"
const NONCE_COOKIE = "pg_line_nonce"
const COOKIE_MAX_AGE_SECONDS = 60 * 10

/**
 * LINEログインの開始。CSRF対策のstateとリプレイ対策のnonceを
 * httpOnly Cookieに保存してから、LINEの認可画面へリダイレクトする。
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const credentials = getLineCredentials()

  if (!credentials) {
    return NextResponse.redirect(new URL("/login?error=line_not_configured", url.origin))
  }

  const state = randomBytes(16).toString("hex")
  const nonce = randomBytes(16).toString("hex")
  const redirectUri = new URL("/api/auth/line/callback", url.origin).toString()

  const authorizeUrl = buildLineAuthorizeUrl({
    channelId: credentials.channelId,
    redirectUri,
    state,
    nonce,
  })

  const response = NextResponse.redirect(authorizeUrl)
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: url.protocol === "https:",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  }
  response.cookies.set(STATE_COOKIE, state, cookieOptions)
  response.cookies.set(NONCE_COOKIE, nonce, cookieOptions)
  return response
}
