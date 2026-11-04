/**
 * プレビュー配備で、Cloudflare がアップロード直後の subdomain 設定に対して返す
 * 一時的な失敗だけを見分ける。恒常的な失敗を再試行で覆い隠さないため、
 * 「/subdomain への要求」かつ「既知の一時的なコード」の両方に一致した場合だけ true。
 *
 * 観測した失敗（PR #288）:
 *   /workers/scripts/<name>/subdomain ... An unknown error has occurred. [code: 10013]
 *   /workers/scripts/<name>/subdomain ... This Worker does not exist on your account. [code: 10007]
 *   いずれも直後に同じ Worker の Uploaded が記録されており、反映待ちに当たっている。
 */
export const TRANSIENT_SUBDOMAIN_CODES = [10007, 10013]

export function isTransientSubdomainFailure(output) {
  if (typeof output !== 'string' || output === '') return false
  const pattern = new RegExp(`/subdomain[\\s\\S]{0,400}?code: (${TRANSIENT_SUBDOMAIN_CODES.join('|')})\\b`)
  return pattern.test(output)
}

/** 再試行までの待ち時間。反映を待つだけなので、短く数回に留める。 */
export function transientRetryDelayMs(attempt) {
  return 5000 * (attempt + 1)
}

export const MAX_TRANSIENT_RETRIES = 2
