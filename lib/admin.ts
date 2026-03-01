/**
 * 管理者メールアドレスの定義と判定ユーティリティ
 */

function getAdminEmails(): ReadonlyArray<string> {
  const envAdmins = process.env.ADMIN_EMAILS
  if (!envAdmins) return []
  return envAdmins.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
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
 * - profiles.role による判定
 */
export function isAdminUser(user: {
  email?: string | null
  role?: string | null
} | null | undefined): boolean {
  if (!user) return false
  return isAdminEmail(user.email) || user.role === "admin"
}
