/**
 * LINE ログインのアカウントに割り当てる合成メールの決まり(画面からも読めるよう、node:crypto を使う lib/auth/line.ts と分けた)。
 * LINE ログインはメールアドレス(LINE から届いたもの、無ければこの合成メール)でアカウントを探すので、
 * LINE のアカウントのメールアドレスは変えない(変えると、次の LINE ログインで別の空のアカウントができる)
 */
export const LINE_SYNTHETIC_EMAIL_DOMAIN = "line.auth.local"

export function isLineSyntheticEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.toLowerCase().endsWith(`@${LINE_SYNTHETIC_EMAIL_DOMAIN}`))
}

/**
 * LINE ログインのアカウントか。LINE から本物のメールが届いた人は、合成メールではないので印(user_metadata)でも見る
 * (app/api/auth/line/callback/route.ts が provider と line_user_id を残す)
 */
export function isLineAccount(user: { email?: string | null; user_metadata?: Record<string, unknown> | null } | null | undefined): boolean {
  if (!user) return false
  const metadata = user.user_metadata ?? {}
  return isLineSyntheticEmail(user.email) || metadata.provider === "line" || typeof metadata.line_user_id === "string"
}
