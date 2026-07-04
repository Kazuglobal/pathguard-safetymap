import type { ErrorEvent } from '@sentry/nextjs'

const PII_KEY_PATTERN = /lat|lon|lng|latitude|longitude|email/i

/**
 * Sentryへ送信するイベントから簡易的にPII（個人を特定しうる情報）を除去する。
 * - event.user.id は先頭8文字+マスクに変換し、email/ip_addressは削除する
 * - event.extra / event.contexts に含まれる緯度経度・メールらしきキーは削除する
 */
export function scrubPII(event: ErrorEvent): ErrorEvent {
  if (event.user) {
    const { id, email: _email, ip_address: _ipAddress, ...rest } = event.user
    event.user = {
      ...rest,
      ...(id ? { id: `${String(id).slice(0, 8)}***` } : {}),
    }
  }

  if (event.extra) {
    for (const key of Object.keys(event.extra)) {
      if (PII_KEY_PATTERN.test(key)) {
        delete event.extra[key]
      }
    }
  }

  if (event.contexts) {
    for (const contextValue of Object.values(event.contexts)) {
      if (!contextValue || typeof contextValue !== 'object') continue
      for (const key of Object.keys(contextValue)) {
        if (PII_KEY_PATTERN.test(key)) {
          delete (contextValue as Record<string, unknown>)[key]
        }
      }
    }
  }

  return event
}
