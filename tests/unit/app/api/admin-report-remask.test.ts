// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyAdminRequest: vi.fn(),
  getActor: vi.fn(),
  imageInfo: vi.fn(),
  imageOutput: vi.fn(),
  r2Put: vi.fn(),
  r2Delete: vi.fn(),
  db: null as unknown,
}))

vi.mock('@/lib/admin-auth', () => ({ verifyAdminRequest: mocks.verifyAdminRequest }))
vi.mock('@/lib/auth/actor', () => ({ getActor: mocks.getActor }))
vi.mock('@/lib/db/client', () => ({ getDb: () => mocks.db }))
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => ({
    env: {
      IMAGES: { info: mocks.imageInfo, input: () => ({ output: mocks.imageOutput }) },
      MEDIA_PRIVATE: { put: mocks.r2Put, delete: mocks.r2Delete },
    },
  }),
}))

import { POST } from '@/app/api/admin/reports/remask/route'
import { dangerReports } from '@/lib/db/schema'
import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'

const admin = { kind: 'user' as const, id: 'admin-1', email: null, isAdmin: true }
const OLD_KEY = 'danger-reports/owner-1/report-1/original.webp'

let database: TestDatabase

function maskedFile(type = 'image/webp') {
  const file = new File([new Uint8Array([1, 2, 3])], type === 'image/webp' ? 'masked.webp' : 'masked.jpg', { type })
  Object.defineProperty(file, 'stream', { configurable: true, value: () => new Response(new Uint8Array([1, 2, 3])).body })
  return file
}

function requestWith(fields: Record<string, FormDataEntryValue>): Request {
  return { formData: async () => ({ get: (key: string) => fields[key] ?? null }) } as unknown as Request
}

function row() {
  return database.sqlite.prepare('select image_key, image_masked, status, ai_moderation_status from danger_reports where id = ?').get('report-1') as Record<string, unknown>
}

beforeEach(async () => {
  vi.clearAllMocks()
  database = createTestDatabase()
  mocks.db = database.db
  mocks.verifyAdminRequest.mockResolvedValue({ authorized: true })
  mocks.getActor.mockResolvedValue(admin)
  mocks.imageInfo.mockResolvedValue({})
  mocks.imageOutput.mockResolvedValue({ image: () => new Response(new Uint8Array([4, 5, 6])).body })
  mocks.r2Put.mockResolvedValue({})
  mocks.r2Delete.mockResolvedValue(undefined)
  await database.db.insert(dangerReports).values({
    id: 'report-1', userId: 'owner-1', title: '交差点', dangerType: 'traffic', dangerLevel: 3, latitude: 35, longitude: 139,
    status: 'approved', aiModerationStatus: 'approved', imageKey: OLD_KEY, imageMasked: false,
  })
})

afterEach(() => {
  database.sqlite.close()
})

describe('管理者が既存の写真をぼかし直して公開する(UIUX改装 項目57)', () => {
  it('ぼかした写真を「ぼかし済み」のキーで保存し、元の写真を消す。審査はやり直さない', async () => {
    const response = await POST(requestWith({ file: maskedFile(), reportId: 'report-1', masked: '1' }))

    expect(response.status).toBe(200)
    const newKey = mocks.r2Put.mock.calls[0]![0] as string
    expect(newKey).toMatch(/^danger-reports\/owner-1\/report-1\/m-[\w-]+\.webp$/)
    expect(row()).toEqual({ image_key: newKey, image_masked: 1, status: 'approved', ai_moderation_status: 'approved' })
    expect(mocks.r2Delete).toHaveBeenCalledWith(OLD_KEY)
  })

  it('管理者でなければ置き換えない', async () => {
    mocks.verifyAdminRequest.mockResolvedValue({ authorized: false, status: 403, error: '管理者権限が必要です' })

    const response = await POST(requestWith({ file: maskedFile(), reportId: 'report-1', masked: '1' }))

    expect(response.status).toBe(403)
    expect(mocks.r2Put).not.toHaveBeenCalled()
    expect(row().image_key).toBe(OLD_KEY)
  })

  it('端末でぼかした印の無い写真や PNG は受け付けない', async () => {
    expect((await POST(requestWith({ file: maskedFile(), reportId: 'report-1' }))).status).toBe(400)
    expect((await POST(requestWith({ file: maskedFile('image/png'), reportId: 'report-1', masked: '1' }))).status).toBe(400)
    expect(mocks.r2Put).not.toHaveBeenCalled()
  })

  it('報告が無ければ保存した写真を残さない', async () => {
    const response = await POST(requestWith({ file: maskedFile(), reportId: 'missing', masked: '1' }))

    expect(response.status).toBe(404)
    expect(mocks.r2Put).not.toHaveBeenCalled()
  })
})
