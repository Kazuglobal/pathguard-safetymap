import { createHmac } from "node:crypto"
import { z } from "zod"

/**
 * LINEログイン(OIDC v2.1)のサーバー専用ヘルパー。
 *
 * Supabase Auth に LINE プロバイダは存在しないため、認可コードフローを
 * 自前で実装し、検証済みIDトークンをもとに Supabase ユーザーへ橋渡しする。
 * チャネルシークレットを扱うので、このモジュールはサーバー専用。
 */

const LINE_AUTHORIZE_URL = "https://access.line.me/oauth2/v2.1/authorize"
const LINE_TOKEN_URL = "https://api.line.me/oauth2/v2.1/token"
const LINE_VERIFY_URL = "https://api.line.me/oauth2/v2.1/verify"

/** LINEユーザー用の合成メールドメイン(メール未許諾のチャネルでも一意なIDを保てる) */
export const LINE_SYNTHETIC_EMAIL_DOMAIN = "line.auth.local"

export function getLineCredentials(): { channelId: string; channelSecret: string } | null {
  const channelId = process.env.LINE_CHANNEL_ID
  const channelSecret = process.env.LINE_CHANNEL_SECRET
  if (!channelId || !channelSecret) return null
  return { channelId, channelSecret }
}

export function buildLineAuthorizeUrl(params: {
  channelId: string
  redirectUri: string
  state: string
  nonce: string
}): string {
  const url = new URL(LINE_AUTHORIZE_URL)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("client_id", params.channelId)
  url.searchParams.set("redirect_uri", params.redirectUri)
  url.searchParams.set("state", params.state)
  url.searchParams.set("nonce", params.nonce)
  // email はチャネルに許諾がある場合のみ返る(無くても動く)
  url.searchParams.set("scope", "openid profile email")
  return url.toString()
}

const tokenResponseSchema = z.object({
  id_token: z.string().min(1),
})

const idTokenPayloadSchema = z.object({
  iss: z.literal("https://access.line.me"),
  sub: z.string().min(1),
  aud: z.string().min(1),
  nonce: z.string().optional(),
  name: z.string().optional(),
  picture: z.string().url().optional(),
  email: z.string().email().optional(),
})

export interface LineProfile {
  /** LINEユーザーID(U...) */
  userId: string
  displayName?: string
  avatarUrl?: string
  email?: string
}

/**
 * 認可コードをIDトークンに交換し、LINEの検証エンドポイントで
 * 署名・aud・nonce を検証した上でプロフィールを返す。
 */
export async function exchangeAndVerifyLineCode(params: {
  code: string
  redirectUri: string
  channelId: string
  channelSecret: string
  nonce: string
}): Promise<LineProfile> {
  const tokenResponse = await fetch(LINE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: params.redirectUri,
      client_id: params.channelId,
      client_secret: params.channelSecret,
    }),
  })

  if (!tokenResponse.ok) {
    const detail = await tokenResponse.text().catch(() => "")
    throw new Error(`LINE token exchange failed (${tokenResponse.status}): ${detail.slice(0, 200)}`)
  }

  const { id_token } = tokenResponseSchema.parse(await tokenResponse.json())

  // IDトークンの検証はLINEの公式verifyエンドポイントに委ねる
  // (署名・有効期限・issを検証し、nonce不一致はエラーになる)
  const verifyResponse = await fetch(LINE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      id_token,
      client_id: params.channelId,
      nonce: params.nonce,
    }),
  })

  if (!verifyResponse.ok) {
    const detail = await verifyResponse.text().catch(() => "")
    throw new Error(`LINE id_token verify failed (${verifyResponse.status}): ${detail.slice(0, 200)}`)
  }

  const payload = idTokenPayloadSchema.parse(await verifyResponse.json())

  if (payload.aud !== params.channelId) {
    throw new Error("LINE id_token audience mismatch")
  }

  return {
    userId: payload.sub,
    displayName: payload.name,
    avatarUrl: payload.picture,
    email: payload.email,
  }
}

/**
 * メール未許諾のLINEユーザーに割り当てる、決定的な合成メールアドレス。
 * 生のLINEユーザーIDではなくチャネルシークレットによるHMACから導出することで、
 * ユーザーIDを知る第三者が通常サインアップでこのアドレスを先取り
 * (アカウント事前乗っ取り)できないようにする。
 */
export function syntheticLineEmail(lineUserId: string, channelSecret: string): string {
  const digest = createHmac("sha256", channelSecret)
    .update(`line:${lineUserId}`)
    .digest("hex")
    .slice(0, 32)
  return `line-${digest}@${LINE_SYNTHETIC_EMAIL_DOMAIN}`
}
