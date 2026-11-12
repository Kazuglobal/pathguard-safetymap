import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  imageInfo: vi.fn(),
  imageOutput: vi.fn(),
  r2Put: vi.fn(),
  r2Delete: vi.fn(),
}))

vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => ({
    env: {
      IMAGES: {
        info: mocks.imageInfo,
        input: () => ({ output: mocks.imageOutput }),
      },
      MEDIA_PRIVATE: { put: mocks.r2Put, delete: mocks.r2Delete },
    },
  }),
}))

import {
  HUNTER_PHOTO_BUCKET,
  createPhotoSignedUrl,
  deletePhotoObjects,
  photoStoragePath,
  uploadMaskedPhoto,
} from '@/lib/hunter/storage'
import { parsePhotoId } from '@/lib/hunter/validation'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const PHOTO_ID = '22222222-2222-4222-8222-222222222222'
const MASKED_DATA_URL = 'data:image/webp;base64,UklGRg=='

const be16 = (n: number) => [(n >> 8) & 0xff, n & 0xff]
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0))
/** Safari の canvas が書き出す JPEG の形(JFIF だけ。位置情報なし)。 */
const APP0 = [0xff, 0xe0, ...be16(16), ...ascii('JFIF'), 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]
const SOS = [0xff, 0xda, ...be16(8), 1, 1, 0, 0, 0x3f, 0, 0x12, 0xff, 0xd9]
/** カメラの写真: Exif の IFD0 に GPS の場所(0x8825)がある。 */
const GPS_APP1 = (() => {
  const tiff = [...ascii('II'), 42, 0, 8, 0, 0, 0, 1, 0, 0x25, 0x88, 4, 0, 1, 0, 0, 0, 26, 0, 0, 0, 0, 0, 0, 0]
  return [0xff, 0xe1, ...be16(2 + 6 + tiff.length), ...ascii('Exif'), 0, 0, ...tiff]
})()
const jpegDataUrl = (...segments: number[][]) =>
  `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, ...segments.flat(), ...SOS]).toString('base64')}`

describe('hunter R2 storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.imageInfo.mockResolvedValue({ format: 'image/webp' })
    mocks.imageOutput.mockResolvedValue({
      image: () => new Response(new Uint8Array([1, 2, 3])).body,
    })
    mocks.r2Put.mockResolvedValue({})
    mocks.r2Delete.mockResolvedValue(undefined)
  })

  it('uses an owner-scoped, private R2 key', () => {
    expect(HUNTER_PHOTO_BUCKET).toBe('hunter-photos')
    expect(photoStoragePath(USER_ID, PHOTO_ID)).toBe(
      `hunter-photos/${USER_ID}/${PHOTO_ID}/masked.webp`,
    )
    expect(() => photoStoragePath('../escape', PHOTO_ID)).toThrow(/Invalid/)
  })

  it('validates and re-encodes WebP before storing it privately', async () => {
    const result = await uploadMaskedPhoto(USER_ID, PHOTO_ID, MASKED_DATA_URL)

    expect(result.path).toBe(`hunter-photos/${USER_ID}/${PHOTO_ID}/masked.webp`)
    expect(mocks.imageInfo).toHaveBeenCalledTimes(1)
    expect(mocks.imageOutput).toHaveBeenCalledWith({ format: 'image/webp', quality: 85 })
    expect(mocks.r2Put).toHaveBeenCalledWith(
      result.path,
      expect.anything(),
      expect.objectContaining({
        httpMetadata: {
          contentType: 'image/webp',
          cacheControl: 'private, max-age=31536000, immutable',
        },
      }),
    )
  })

  it('accepts the JPEG Safari writes (no location data) and still stores it re-encoded as WebP', async () => {
    mocks.imageInfo.mockResolvedValueOnce({ format: 'image/jpeg' })
    const result = await uploadMaskedPhoto(USER_ID, PHOTO_ID, jpegDataUrl(APP0))

    expect(result.path).toBe(`hunter-photos/${USER_ID}/${PHOTO_ID}/masked.webp`)
    expect(mocks.imageOutput).toHaveBeenCalledWith({ format: 'image/webp', quality: 85 })
    expect(mocks.r2Put).toHaveBeenCalledWith(
      result.path,
      expect.anything(),
      expect.objectContaining({ httpMetadata: expect.objectContaining({ contentType: 'image/webp' }) }),
    )
  })

  it('checks the label against the format read from the bytes (a camera JPEG labelled WebP is refused)', async () => {
    mocks.imageInfo.mockResolvedValueOnce({ format: 'image/jpeg' })
    await expect(uploadMaskedPhoto(USER_ID, PHOTO_ID, MASKED_DATA_URL)).rejects.toThrow('形式')
    expect(mocks.r2Put).not.toHaveBeenCalled()

    // 表記の揺れ(jpg / 見出しなし)では止めない
    mocks.imageInfo.mockResolvedValueOnce({ format: 'jpg' })
    await expect(uploadMaskedPhoto(USER_ID, PHOTO_ID, jpegDataUrl(APP0))).resolves.toMatchObject({ path: expect.any(String) })
  })

  it.each([
    ['JPEG with GPS (a camera photo that skipped masking)', jpegDataUrl(APP0, GPS_APP1)],
    ['JPEG that is not a JPEG', 'data:image/jpeg;base64,UklGRg=='],
    ['PNG', 'data:image/png;base64,UklGRg=='],
    ['plain text', 'not-a-data-url'],
    ['empty payload', 'data:image/webp;base64,'],
  ])('rejects %s input before writing R2', async (_label, value) => {
    await expect(uploadMaskedPhoto(USER_ID, PHOTO_ID, value)).rejects.toThrow()
    expect(mocks.r2Put).not.toHaveBeenCalled()
  })

  it('propagates Images validation and R2 write failures', async () => {
    mocks.imageInfo.mockRejectedValueOnce(new Error('invalid image'))
    await expect(uploadMaskedPhoto(USER_ID, PHOTO_ID, MASKED_DATA_URL)).rejects.toThrow('invalid image')

    mocks.imageInfo.mockResolvedValueOnce({ format: 'image/webp' })
    mocks.r2Put.mockRejectedValueOnce(new Error('storage unavailable'))
    await expect(uploadMaskedPhoto(USER_ID, PHOTO_ID, MASKED_DATA_URL)).rejects.toThrow('storage unavailable')
  })

  it('returns only the authenticated private-media route and deletes the exact key', async () => {
    const key = photoStoragePath(USER_ID, PHOTO_ID)
    expect(createPhotoSignedUrl(key)).toBe(`/api/media/private/${key}`)
    expect(createPhotoSignedUrl('../escape')).toBeNull()

    await deletePhotoObjects(USER_ID, PHOTO_ID)
    expect(mocks.r2Delete).toHaveBeenCalledWith(key)
  })
})

describe('parsePhotoId', () => {
  it('accepts UUIDs and rejects malformed values', () => {
    expect(parsePhotoId(PHOTO_ID)).toEqual({ ok: true, id: PHOTO_ID })
    expect(parsePhotoId('not-a-uuid').ok).toBe(false)
    expect(parsePhotoId(123).ok).toBe(false)
    expect(parsePhotoId(null).ok).toBe(false)
  })
})
