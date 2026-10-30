/**
 * ログインの画面の「デモユーザーで試す」のアカウント(見本は scripts/ops/seed-demo-account.ts で入れる)。
 * 登録しなくても試せるように、ID とパスワードは画面のコードに置いている(見る人みんなが同じアカウントを使う)。
 * 共用なので、退会・メールアドレスやパスワードの変更はさせない(1人が変えると、ほかの人がデモを使えなくなる)。
 */
export const DEMO_ACCOUNT_EMAIL = "demo@example.com"
export const DEMO_ACCOUNT_PASSWORD = "demopassword"

export function isDemoAccountEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && email.trim().toLowerCase() === DEMO_ACCOUNT_EMAIL
}

/** 設定の画面で、変えられない理由として出す */
export const DEMO_ACCOUNT_LOCKED_MESSAGE =
  "デモのアカウントは、ほかの人も使うため、メールアドレス・パスワードの変更と、アカウントの削除はできません。"
