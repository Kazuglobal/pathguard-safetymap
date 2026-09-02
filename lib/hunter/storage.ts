import { getCloudflareContext } from '@opennextjs/cloudflare'

import { privateMediaUrl } from '@/lib/media/url'

export const HUNTER_PHOTO_BUCKET = 'hunter-photos'
const MAX_IMAGE_BYTES = 20 * 1024 * 1024

interface ImagesBinding {
  info(stream: ReadableStream<Uint8Array>): Promise<unknown>
  input(stream: ReadableStream<Uint8Array>): { output(options: { format: 'image/webp'; quality: number }): Promise<{ image(): ReadableStream<Uint8Array> }> }
}
interface Bucket {
  put(key: string, value: ReadableStream<Uint8Array>, options: { httpMetadata: { contentType: string; cacheControl: string } }): Promise<unknown>
  delete(key: string): Promise<void>
}

export function photoStoragePath(userId: string, photoId: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(userId) || !/^[A-Za-z0-9_-]{1,128}$/.test(photoId)) {
    throw new RangeError('Invalid hunter photo key')
  }
  return `hunter-photos/${userId}/${photoId}/masked.webp`
}

function parseWebpDataUrl(dataUrl: string): Uint8Array {
  const match = /^data:image\/webp;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!match) throw new RangeError('保存できるのはマスク済みWebP画像だけです')
  const bytes = new Uint8Array(Buffer.from(match[1], 'base64'))
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new RangeError('画像サイズが大きすぎます')
  return bytes
}

export async function uploadMaskedPhoto(
  userId: string,
  photoId: string,
  dataUrl: string,
): Promise<{ path: string }> {
  const bytes = parseWebpDataUrl(dataUrl)
  const { env } = getCloudflareContext()
  const bindings = env as unknown as { IMAGES: ImagesBinding; MEDIA_PRIVATE: Bucket }
  const sourceBuffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(sourceBuffer).set(bytes)
  const source = () => {
    const stream = new Response(sourceBuffer).body
    if (!stream) throw new Error('画像ストリームを作成できません')
    return stream
  }
  await bindings.IMAGES.info(source())
  const transformed = await bindings.IMAGES.input(source()).output({ format: 'image/webp', quality: 85 })
  const path = photoStoragePath(userId, photoId)
  await bindings.MEDIA_PRIVATE.put(path, transformed.image(), {
    httpMetadata: { contentType: 'image/webp', cacheControl: 'private, max-age=31536000, immutable' },
  })
  return { path }
}

export function createPhotoSignedUrl(path: string): string | null {
  try { return privateMediaUrl(path) } catch { return null }
}

export async function deletePhotoObjects(userId: string, photoId: string): Promise<void> {
  const { env } = getCloudflareContext()
  const bucket = (env as unknown as { MEDIA_PRIVATE: Bucket }).MEDIA_PRIVATE
  await bucket.delete(photoStoragePath(userId, photoId))
}
