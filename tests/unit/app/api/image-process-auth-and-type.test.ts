import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getActor: vi.fn(),
  getReport: vi.fn(),
  setImages: vi.fn(),
  imageInfo: vi.fn(),
  imageOutput: vi.fn(),
  r2Put: vi.fn(),
  r2Delete: vi.fn(),
}))

vi.mock('@/lib/auth/actor', () => ({ getActor: mocks.getActor }))
vi.mock('@/lib/db/repos/danger-reports.repo', () => ({
  getDangerReportForImageUpdate: mocks.getReport,
  setDangerReportImages: mocks.setImages,
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

import { POST } from '@/app/api/image/process/route'
import { AuthzError } from '@/lib/db/authz'

const owner = { kind: 'user' as const, id: 'owner-1', email: null, isAdmin: false }

function report(overrides: Record<string, unknown> = {}) {
  return {
    id: 'report-1',
    userId: 'owner-1',
    imageKey: null,
    processedImageKeys: [],
    ...overrides,
  }
}

function requestWith(fields: Record<string, FormDataEntryValue | null>): Request {
  return {
    headers: new Headers(),
    formData: vi.fn(async () => ({ get: (key: string) => fields[key] ?? null })),
  } as unknown as Request
}

function imageFile(name = 'sample.png', type = 'image/png') {
  const file = new File([new Uint8Array([1, 2, 3])], name, { type })
  Object.defineProperty(file, 'stream', {
    configurable: true,
    value: () => new Response(new Uint8Array([1, 2, 3])).body,
  })
  return file
}

describe('app/api/image/process D1 + R2 upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getActor.mockResolvedValue(owner)
    mocks.getReport.mockResolvedValue(report())
    mocks.setImages.mockResolvedValue(report())
    mocks.imageInfo.mockResolvedValue({ format: 'image/png' })
    mocks.imageOutput.mockResolvedValue({
      image: () => new Response(new Uint8Array([4, 5, 6])).body,
    })
    mocks.r2Put.mockResolvedValue({})
    mocks.r2Delete.mockResolvedValue(undefined)
  })

  it('requires authentication', async () => {
    mocks.getActor.mockResolvedValue({ kind: 'anon' })
    const response = await POST(requestWith({ file: imageFile(), reportId: 'report-1' }))
    expect(response.status).toBe(401)
    expect(mocks.r2Put).not.toHaveBeenCalled()
  })

  it('prevents cross-user image updates before touching R2', async () => {
    mocks.getReport.mockRejectedValue(new AuthzError('update', 'danger_reports'))
    const response = await POST(requestWith({ file: imageFile(), reportId: 'report-1' }))
    expect(response.status).toBe(403)
    expect(mocks.r2Put).not.toHaveBeenCalled()
  })

  it('rejects mismatched extensions and MIME types', async () => {
    const response = await POST(requestWith({ file: imageFile('sample.txt', 'image/png'), reportId: 'report-1' }))
    expect(response.status).toBe(400)
    expect(mocks.getReport).not.toHaveBeenCalled()
  })

  it('re-encodes originals with Images, stores a private key, and updates D1', async () => {
    const response = await POST(requestWith({
      file: imageFile(), reportId: 'report-1', imageType: 'original',
    }))
    expect(response.status).toBe(200)
    expect(mocks.imageInfo).toHaveBeenCalledTimes(1)
    expect(mocks.r2Put).toHaveBeenCalledWith(
      expect.stringMatching(/^danger-reports\/owner-1\/report-1\/[\w-]+\.webp$/),
      expect.anything(),
      expect.objectContaining({ httpMetadata: expect.objectContaining({ contentType: 'image/webp' }) }),
    )
    expect(mocks.setImages).toHaveBeenCalledWith(
      owner,
      'report-1',
      { imageKey: expect.stringMatching(/^danger-reports\/owner-1\/report-1\//) },
    )
    await expect(response.json()).resolves.toMatchObject({
      imageUrl: expect.stringMatching(/^\/api\/media\/private\/danger-reports\/owner-1\/report-1\//),
    })
  })

  it('removes the newly uploaded object when replaceIndex is out of range', async () => {
    mocks.getReport.mockResolvedValue(report({ processedImageKeys: [] }))
    const response = await POST(requestWith({
      file: imageFile(), reportId: 'report-1', imageType: 'processed', replaceIndex: '0',
    }))
    expect(response.status).toBe(400)
    expect(mocks.r2Delete).toHaveBeenCalledWith(expect.stringContaining('danger-reports/owner-1/report-1/'))
    expect(mocks.setImages).not.toHaveBeenCalled()
  })

  it('rejects bytes that Cloudflare Images cannot decode', async () => {
    mocks.imageInfo.mockRejectedValue(new Error('invalid image'))
    const response = await POST(requestWith({ file: imageFile(), reportId: 'report-1' }))
    expect(response.status).toBe(400)
    expect(mocks.r2Put).not.toHaveBeenCalled()
  })
})
