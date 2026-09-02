import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getActor: vi.fn(),
  authorize: vi.fn(),
  r2Get: vi.fn(),
  getCloudflareContext: vi.fn(),
}))

vi.mock('@/lib/auth/actor', () => ({ getActor: mocks.getActor }))
vi.mock('@/lib/media/authorize', () => ({ authorizePrivateMedia: mocks.authorize }))
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: mocks.getCloudflareContext }))

import { GET } from '@/app/api/media/private/[...key]/route'

const context = (key: string[]) => ({ params: Promise.resolve({ key }) })

describe('private R2 media route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getActor.mockResolvedValue({
      kind: 'user', id: 'owner-1', email: null, isAdmin: false,
    })
    mocks.authorize.mockResolvedValue(true)
    mocks.getCloudflareContext.mockReturnValue({
      env: { MEDIA_PRIVATE: { get: mocks.r2Get } },
    })
  })

  it('streams an authorized object with private cache and safe content headers', async () => {
    mocks.r2Get.mockResolvedValue({
      body: new Uint8Array([1, 2, 3]),
      size: 3,
      httpEtag: '"etag-1"',
      httpMetadata: { contentType: 'image/webp' },
    })
    const request = new NextRequest(
      'https://app.example.com/api/media/private/danger-reports/owner-1/report-1/photo.webp',
      { headers: { Origin: 'https://app.example.com' } },
    )

    const response = await GET(request, context([
      'danger-reports', 'owner-1', 'report-1', 'photo.webp',
    ]))

    expect(response.status).toBe(200)
    expect(mocks.r2Get).toHaveBeenCalledWith('danger-reports/owner-1/report-1/photo.webp')
    expect(response.headers.get('Content-Type')).toBe('image/webp')
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=300')
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('fails before R2 access for unauthorized or malformed keys', async () => {
    mocks.authorize.mockResolvedValue(false)
    const request = new NextRequest('https://app.example.com/api/media/private/x')

    const forbidden = await GET(request, context([
      'danger-reports', 'owner-1', 'report-1', 'photo.webp',
    ]))
    const malformed = await GET(request, context(['danger-reports', 'owner-1', '..', 'photo.webp']))

    expect(forbidden.status).toBe(403)
    expect(malformed.status).toBe(400)
    expect(mocks.r2Get).not.toHaveBeenCalled()
  })
})
