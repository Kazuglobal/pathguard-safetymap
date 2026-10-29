/**
 * 画面に出す呼び名を決める(ヘッダー・マイページ・ダッシュボードで共通)。
 *
 * 表示名(display_name)だけを使う。メールアドレスの「@」より前や氏名から呼び名を作らない
 * (メールアドレスには本名が入っていることが多く、個人情報を画面に出さないため)。
 * 表示名が未設定なら null を返し、呼び出し側は名前なしの中立な表示にする。
 */
export function getDisplayName(
  profile: { display_name?: string | null } | null | undefined,
): string | null {
  const name = profile?.display_name?.trim()
  return name ? name : null
}
