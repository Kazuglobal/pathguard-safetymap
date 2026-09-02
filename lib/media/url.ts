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
