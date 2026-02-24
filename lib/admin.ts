/**
 * 管理者メールアドレスの定義と判定ユーティリティ
 */

const ADMIN_EMAILS: ReadonlyArray<string> = [
  "globalbunny77@gmail.com",
  "japanprofessionals@gmail.com",
] as const

/**
 * 指定されたメールアドレスが管理者かどうかを判定する
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.toLowerCase())
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
