/**
 * 認証系(登録・ログイン・パスワード再設定)のエラー文言解決を一元化する。
 * 各フォームに判定ロジックと日本語文言をコピペしない(画面ごとの表現ズレを防ぐ)。
 */

export const OFFLINE_MESSAGE = "Supabaseに接続できません。ネットワーク接続を確認してから再試行してください。"
export const RATE_LIMIT_MESSAGE = "短い時間に送信が続きました。少し待ってから、もう一度お試しください。"
export const DUPLICATE_EMAIL_MESSAGE = "このメールは登録ずみです"
export const API_CONFIG_MESSAGE = "API設定エラーが発生しました。環境変数が正しく設定されているか確認してください。"

function extractMessage(error: unknown): string {
  return typeof error === "object" && error !== null && "message" in error
    ? String((error as { message: unknown }).message)
    : ""
}

/** Supabase auth のレート制限(429)エラーか */
export function isRateLimitAuthError(error: unknown): boolean {
  const message = extractMessage(error)
  return message.toLowerCase().includes("rate") || message.includes("429")
}

/** 認証エラーをユーザー向けの日本語文言へ変換する */
export function resolveAuthErrorMessage(error: unknown, fallback: string): string {
  const message = extractMessage(error)
  if (message.includes("network_error") || message.includes("Failed to fetch") || message.includes("fetch failed")) {
    return OFFLINE_MESSAGE
  }
  if (isRateLimitAuthError(error)) {
    return RATE_LIMIT_MESSAGE
  }
  if (message.includes("Invalid login credentials")) {
    return "メールアドレスまたはパスワードが正しくありません。"
  }
  if (message.toLowerCase().includes("already") || message.toLowerCase().includes("registered")) {
    return DUPLICATE_EMAIL_MESSAGE
  }
  if (message.includes("Invalid API") || message.includes("invalid api") || message.includes("Invalid URL") || message.includes("example.supabase.co")) {
    return API_CONFIG_MESSAGE
  }
  return message || fallback
}
