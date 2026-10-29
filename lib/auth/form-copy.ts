/**
 * ログイン・登録・パスワードの再設定・設定の変更で共通の、入力欄の決まり(UIUX改装 項目35)。
 * 例示のメールアドレスは「例: name@example.com」にそろえる(your@email.com などをまぜない)。
 */
export const EMAIL_PLACEHOLDER = "例: name@example.com"
export const EMAIL_REQUIRED_MESSAGE = "メールアドレスを入力してください"
export const EMAIL_FORMAT_MESSAGE = "例: name@example.com の形で入力してください"

/** メールアドレスの形か(送る前のかんたんな確かめ。最後の判定は認証サービスがする) */
export function isEmailShaped(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/** 入力されたメールアドレスを確かめて、問題があれば画面に出す文を返す */
export function emailInputError(value: string): string | null {
  if (!value.trim()) return EMAIL_REQUIRED_MESSAGE
  if (!isEmailShaped(value.trim())) return EMAIL_FORMAT_MESSAGE
  return null
}
