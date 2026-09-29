import 'server-only'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { RepositoryError } from './repository'

interface BucketObject { body: ReadableStream<Uint8Array>; arrayBuffer(): Promise<ArrayBuffer>; size: number }
interface Bucket { put(key: string, value: Uint8Array, options?: unknown): Promise<unknown>; get(key: string): Promise<BucketObject | null>; delete(key: string): Promise<void> }
export function routeBucket(): Bucket { return (getCloudflareContext().env as unknown as { MEDIA_PRIVATE: Bucket }).MEDIA_PRIVATE }

/** Keep only image-bearing WebP chunks. EXIF/XMP/ICC never leave the server. */
export function stripWebpMetadata(dataUrl: string): Uint8Array {
  if (!/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(dataUrl) || dataUrl.length > 2_000_000) throw new RepositoryError(400, 'image', 'ぼかし確認済みのWebP画像を指定してください。')
  const source = Buffer.from(dataUrl.split(',')[1], 'base64')
  if (source.length < 20 || source.toString('ascii', 0, 4) !== 'RIFF' || source.toString('ascii', 8, 12) !== 'WEBP' || source.readUInt32LE(4) + 8 !== source.length) throw new RepositoryError(400, 'image', '画像を読み取れません。')
  const chunks: Buffer[] = []; let hasPixels = false
  for (let offset = 12; offset < source.length;) {
    if (offset + 8 > source.length) throw new RepositoryError(400, 'image', '画像が壊れています。')
    const size = source.readUInt32LE(offset + 4); const end = offset + 8 + size + (size % 2)
    if (end > source.length) throw new RepositoryError(400, 'image', '画像が壊れています。')
    const tag = source.toString('ascii', offset, offset + 4)
    if (['VP8 ', 'VP8L', 'VP8X', 'ALPH'].includes(tag)) {
      const chunk = Buffer.from(source.subarray(offset, end))
      if (tag === 'VP8X') { if (size !== 10) throw new RepositoryError(400, 'image', '画像が壊れています。'); chunk[8] &= ~0x2e }
      if (tag === 'VP8 ' || tag === 'VP8L') hasPixels = true
      chunks.push(chunk)
    }
    offset = end
  }
  if (!hasPixels) throw new RepositoryError(400, 'image', '静止画を選んでください。')
  const header = Buffer.from(source.subarray(0, 12)); header.writeUInt32LE(chunks.reduce((sum, chunk) => sum + chunk.length, 4), 4)
  return Buffer.concat([header, ...chunks])
}

export async function putRoutePhoto(key: string, dataUrl: string) {
  const data = stripWebpMetadata(dataUrl)
  await routeBucket().put(key, data, { httpMetadata: { contentType: 'image/webp' } })
}

export function allowedWorldAsset(value: string) {
  const url = new URL(value)
  return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
    (url.hostname === 'storage.googleapis.com' || url.hostname.endsWith('.storage.googleapis.com') || url.hostname.endsWith('.worldlabs.ai'))
}

export async function cacheWorldSplat(url: string, key: string) {
  if (!allowedWorldAsset(url)) throw new RepositoryError(502, 'asset_host', '3D素材の配信元を確認できません。')
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(60_000) })
  if (!response.ok || !response.body) throw new RepositoryError(502, 'asset_download', '3D素材を取得できませんでした。')
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break
      total += value.length
      if (total > 60_000_000) { await reader.cancel(); throw new RepositoryError(502, 'asset_large', '3D素材が端末向けの上限を超えています。') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  if (!total) throw new RepositoryError(502, 'asset_empty', '3D素材が空です。')
  const bytes = new Uint8Array(total); let offset = 0
  chunks.forEach(chunk => { bytes.set(chunk, offset); offset += chunk.length })
  await routeBucket().put(key, bytes, { httpMetadata: { contentType: 'application/octet-stream' } })
}
