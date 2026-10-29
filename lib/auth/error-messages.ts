/**
 * 認証系(登録・ログイン・パスワード再設定・設定の変更)のエラー文言解決を一元化する。
 * 各フォームに判定ロジックと日本語文言をコピペしない(画面ごとの表現ズレを防ぐ)。
 *
 * 変換できないエラーは、呼び出し側が渡す日本語の文(fallback)に落とす。
 * 英語のメッセージ・認証サービスの名前・設定の話(環境変数など)は、利用者の画面に出さない(UIUX改装 項目42)。
 */

import { EMAIL_FORMAT_MESSAGE } from "./form-copy"

export const OFFLINE_MESSAGE = "インターネットにつながりませんでした。通信の状態を確かめて、もう一度お試しください。"
export const RATE_LIMIT_MESSAGE = "短い時間に送信が続きました。少し待ってから、もう一度お試しください。"
export const DUPLICATE_EMAIL_MESSAGE = "このメールアドレスは登録済みです"
/** 認証の準備ができていないとき(運営側の設定の不備)。利用者には待ってもらう案内だけを出す */
export const SERVICE_UNAVAILABLE_MESSAGE = "ただいまログインの機能を使えません。時間をおいて、もう一度お試しください。"
export const INVALID_CREDENTIALS_MESSAGE = "メールアドレスまたはパスワードが正しくありません。"
export const EMAIL_NOT_CONFIRMED_MESSAGE =
  "メールアドレスの確認がまだ終わっていません。登録のときに届いた確認メールのリンクを開いてください。"
// 画面の条件(lib/auth/password-rules.ts)は送る前に確かめるので、ここに来るのは認証サービスのより厳しい決まりに当たったとき
export const WEAK_PASSWORD_MESSAGE =
  "このパスワードは使えません。よく使われているパスワードや、ほかで漏れたことのあるパスワードは使えないことがあります。別のパスワードにしてください。"
export const SAME_PASSWORD_MESSAGE = "いまと同じパスワードは使えません。別のパスワードにしてください。"
/** 画面が見つけたときと同じ文にする */
export const INVALID_EMAIL_MESSAGE = EMAIL_FORMAT_MESSAGE
export const SIGNUP_CLOSED_MESSAGE = "いまは新しい登録を受け付けていません。時間をおいて、もう一度お試しください。"
export const SESSION_EXPIRED_MESSAGE = "ログインの有効期限が切れました。もう一度ログインしてください。"
// 別のブラウザやアプリでリンクを開いたときも同じエラーになるので、開き方も添える
export const LINK_EXPIRED_MESSAGE =
  "メールのリンクの有効期限が切れたか、すでに使われています。もう一度メールを送り、届いたリンクは、送ったときと同じブラウザで開いてください。"
export const REAUTH_NEEDED_MESSAGE = "安全のため、いったんログアウトして、ログインし直してからお試しください。"

function extractMessage(error: unknown): string {
  return typeof error === "object" && error !== null && "message" in error
    ? String((error as { message: unknown }).message)
    : ""
}

/** Supabase の認証エラーのコード(新しい版は code を持つ。古い版は文だけ) */
function extractCode(error: unknown): string {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code ?? "")
    : ""
}

/** HTTP の状態の番号(429 はレート制限) */
function extractStatus(error: unknown): number | null {
  const status = typeof error === "object" && error !== null && "status" in error ? (error as { status: unknown }).status : null
  return typeof status === "number" ? status : null
}

interface Rule {
  codes: readonly string[]
  /** code が無いときに、英語のメッセージ(小文字にしたもの)で見分ける */
  matches: (message: string) => boolean
  text: string
}

const RULES: readonly Rule[] = [
  {
    codes: [],
    matches: (m) => m.includes("network_error") || m.includes("failed to fetch") || m.includes("fetch failed") || m.includes("load failed") || m.includes("networkerror"),
    text: OFFLINE_MESSAGE,
  },
  {
    codes: ["over_email_send_rate_limit", "over_request_rate_limit", "over_sms_send_rate_limit"],
    // 「429」の文字だけでは決めない(入力したメールアドレスが文に入るエラーがあるため)。状態の番号は findRule が見る
    matches: (m) => m.includes("rate limit") || m.includes("too many requests"),
    text: RATE_LIMIT_MESSAGE,
  },
  {
    codes: ["invalid_credentials"],
    matches: (m) => m.includes("invalid login credentials"),
    text: INVALID_CREDENTIALS_MESSAGE,
  },
  {
    codes: ["email_not_confirmed"],
    matches: (m) => m.includes("email not confirmed"),
    text: EMAIL_NOT_CONFIRMED_MESSAGE,
  },
  {
    codes: ["user_already_exists", "email_exists"],
    matches: (m) => m.includes("already registered") || m.includes("already been registered") || m.includes("already exists"),
    text: DUPLICATE_EMAIL_MESSAGE,
  },
  {
    codes: ["same_password"],
    matches: (m) => m.includes("should be different from the old password"),
    text: SAME_PASSWORD_MESSAGE,
  },
  {
    codes: ["weak_password"],
    matches: (m) => m.includes("password should be") || m.includes("weak password") || m.includes("password is known to be weak"),
    text: WEAK_PASSWORD_MESSAGE,
  },
  {
    // validation_failed は形の違反ぜんぶに使われるので、コードだけでは決めない(文で見分ける)
    codes: ["email_address_invalid"],
    matches: (m) => m.includes("invalid format") || m.includes("unable to validate email address") || m.includes("email address is invalid"),
    text: INVALID_EMAIL_MESSAGE,
  },
  {
    codes: ["signup_disabled", "email_provider_disabled"],
    matches: (m) => m.includes("signups not allowed") || m.includes("signup is disabled"),
    text: SIGNUP_CLOSED_MESSAGE,
  },
  {
    codes: ["otp_expired", "flow_state_expired", "flow_state_not_found"],
    matches: (m) => m.includes("token has expired") || m.includes("otp has expired") || m.includes("link is invalid or has expired"),
    text: LINK_EXPIRED_MESSAGE,
  },
  {
    codes: ["reauthentication_needed", "reauthentication_not_valid"],
    matches: (m) => m.includes("reauthentication"),
    text: REAUTH_NEEDED_MESSAGE,
  },
  {
    codes: ["session_expired", "session_not_found", "refresh_token_not_found", "refresh_token_already_used", "bad_jwt"],
    matches: (m) => m.includes("auth session missing") || m.includes("session expired") || m.includes("invalid refresh token") || m.includes("jwt expired"),
    text: SESSION_EXPIRED_MESSAGE,
  },
  {
    codes: [],
    matches: (m) => m.includes("invalid api") || m.includes("invalid url") || m.includes("example.supabase.co") || m.includes("no api key"),
    text: SERVICE_UNAVAILABLE_MESSAGE,
  },
]

const RATE_LIMIT_RULE = RULES.find((rule) => rule.text === RATE_LIMIT_MESSAGE)

/** コードが合う規則を先に探し、無ければ状態の番号、それも無ければ文で見分ける(前の規則の文が、後ろの規則のコードに勝たないように) */
function findRule(error: unknown): Rule | undefined {
  const code = extractCode(error)
  const byCode = code !== "" ? RULES.find((rule) => rule.codes.includes(code)) : undefined
  if (byCode) return byCode
  if (extractStatus(error) === 429) return RATE_LIMIT_RULE
  const message = extractMessage(error).toLowerCase()
  return RULES.find((rule) => rule.matches(message))
}

/** Supabase auth のレート制限(429)エラーか */
export function isRateLimitAuthError(error: unknown): boolean {
  return findRule(error)?.text === RATE_LIMIT_MESSAGE
}

/** ログインの状態が無い・切れたエラーか(パスワードの再設定で、リンクの期限切れを見分ける) */
export function isSessionMissingAuthError(error: unknown): boolean {
  return findRule(error)?.text === SESSION_EXPIRED_MESSAGE
}

/**
 * 認証エラーをユーザー向けの日本語文言へ変換する。
 * 変換できないものは fallback(呼び出し側の日本語の文)を返す。もとの英語のメッセージは返さない。
 */
export function resolveAuthErrorMessage(error: unknown, fallback: string): string {
  return findRule(error)?.text ?? fallback
}
