/**
 * 管理者メールアドレスの定義と判定ユーティリティ
 */

function getAdminEmails(): ReadonlyArray<string> {
  const envAdmins = process.env.ADMIN_EMAILS
  const configured = envAdmins
    ? envAdmins.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
    : []

  // scripts/create-test-users.ts で作成するローカル管理者は、
  // ALLOW_TEST_ADMIN=true の明示的なオプトインがある非本番環境でのみ有効。
  // (NODE_ENV だけを条件にすると、LAN公開の dev サーバや NODE_ENV 未設定の
  //  環境で誰でも既知アドレスの登録だけで管理者になれてしまう)
  if (process.env.NODE_ENV !== 'production' && process.env.ALLOW_TEST_ADMIN === 'true') {
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
