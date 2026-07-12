/**
 * 管理者メールアドレスの定義と判定ユーティリティ
 */

function getAdminEmails(): ReadonlyArray<string> {
  const envAdmins = process.env.ADMIN_EMAILS
  const configured = envAdmins
    ? envAdmins.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
    : []

  // scripts/create-test-users.ts で作成する既知のローカル管理者。
  // 本番では環境変数の明示的な許可リストだけを使用する。
  if (process.env.NODE_ENV !== 'production') {
    return [...configured, 'admin@test.com']
  }

  return configured
}

/**
 * 指定されたメールアドレスが管理者かどうかを判定する
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return getAdminEmails().includes(email.toLowerCase())
}

/**
 * ユーザーオブジェクトから管理者かどうかを判定する
 * - メールアドレスによる判定
 */
export function isAdminUser(user: {
  email?: string | null
} | null | undefined): boolean {
  if (!user) return false
  return isAdminEmail(user.email)
}
