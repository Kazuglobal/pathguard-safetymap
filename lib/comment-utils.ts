/**
 * コメント関連のユーティリティ関数
 */

interface ProfileInfo {
  display_name?: string | null
  email?: string | null
}

/**
 * 日付文字列を相対的なタイムスタンプ表示に変換する
 * @param dateString - ISO形式の日付文字列
 * @returns 相対的な時間表示（例: "たった今", "5分前", "3日前"）
 */
export function formatRelativeTimestamp(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return "たった今"
  if (diffMins < 60) return `${diffMins}分前`
  if (diffHours < 24) return `${diffHours}時間前`
  if (diffDays < 7) return `${diffDays}日前`
  return date.toLocaleDateString("ja-JP")
}

/**
 * プロフィール情報から表示名を取得する
 * @param profiles - プロフィール情報（display_name, emailを含む可能性がある）
 * @returns 表示名（display_name > email prefix > 匿名ユーザー の優先順）
 */
export function getAuthorDisplayName(profiles: ProfileInfo | null | undefined): string {
  if (profiles?.display_name) {
    return profiles.display_name
  }
  if (profiles?.email) {
    return profiles.email.split("@")[0]
  }
  return "匿名ユーザー"
}
