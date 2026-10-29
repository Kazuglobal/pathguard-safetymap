/**
 * LINE ログインのアカウントに割り当てる合成メールの決まり(画面からも読めるよう、node:crypto を使う lib/auth/line.ts と分けた)。
 * LINE ログインはこのメールでアカウントを探すので、このアカウントのメールアドレスは変えない
 */
export const LINE_SYNTHETIC_EMAIL_DOMAIN = "line.auth.local"

export function isLineSyntheticEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.toLowerCase().endsWith(`@${LINE_SYNTHETIC_EMAIL_DOMAIN}`))
}
