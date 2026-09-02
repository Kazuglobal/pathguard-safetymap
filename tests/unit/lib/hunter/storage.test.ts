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

  it.each([
    ['JPEG', 'data:image/jpeg;base64,UklGRg=='],
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
