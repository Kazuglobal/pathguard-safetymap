const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/

export type PrivateMediaKey =
  | { kind: 'danger-report'; key: string; ownerId: string; resourceId: string }
  | { kind: 'hunter-photo'; key: string; ownerId: string; resourceId: string }

function invalidKey(): never {
  throw new Error('Invalid media key')
}

function validateSegments(key: string): string[] {
  if (!key || key.startsWith('/') || key.includes('\\') || CONTROL_CHARACTERS.test(key)) {
    return invalidKey()
  }
  if (/^https?:\/\//i.test(key) || key.includes('?') || key.includes('#')) return invalidKey()
  const segments = key.split('/')
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) return invalidKey()
  return segments
}

function encodeKey(key: string): string {
  return validateSegments(key).map((segment) => encodeURIComponent(segment)).join('/')
}

export function publicMediaUrl(
  key: string,
  baseUrl = process.env.NEXT_PUBLIC_MEDIA_BASE_URL,
): string {
  if (!baseUrl) throw new Error('NEXT_PUBLIC_MEDIA_BASE_URL is required')
  let base: URL
  try {
    base = new URL(baseUrl)
  } catch {
    throw new Error('NEXT_PUBLIC_MEDIA_BASE_URL must be an absolute URL')
  }
  if (base.protocol !== 'https:' && base.hostname !== 'localhost') {
    throw new Error('NEXT_PUBLIC_MEDIA_BASE_URL must use HTTPS')
  }
  return `${base.origin}/${encodeKey(key)}`
}

/**
 * 端末でぼかした(加工済みの)報告の写真のファイル名の頭(UIUX改装 項目57)。
 * キーはサーバーだけが作るので、利用者はこの印を付けられない。ほかの人に見せてよいかは写真ごとにこの印で決める
 */
export const MASKED_MEDIA_FILE_PREFIX = 'm-'

export function isMaskedMediaKey(key: string | null | undefined): boolean {
  if (!key) return false
  return (key.split('/').pop() ?? '').startsWith(MASKED_MEDIA_FILE_PREFIX)
}

export function privateMediaUrl(key: string): string {
  const parsed = parsePrivateMediaKey(key)
  return `/api/media/private/${encodeKey(parsed.key)}`
}

export function parsePrivateMediaKey(rawKey: string): PrivateMediaKey {
  let key: string
  try {
    key = decodeURIComponent(rawKey)
  } catch {
    return invalidKey()
  }
  const segments = validateSegments(key)
  if (segments.length !== 4) return invalidKey()

  const [prefix, ownerId, resourceId] = segments
  if (prefix === 'danger-reports') {
    return { kind: 'danger-report', key, ownerId, resourceId }
  }
  if (prefix === 'hunter-photos') {
    return { kind: 'hunter-photo', key, ownerId, resourceId }
  }
  return invalidKey()
}
