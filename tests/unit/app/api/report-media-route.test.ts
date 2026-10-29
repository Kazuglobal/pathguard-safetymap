// @vitest-environment node
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getActor: vi.fn(), get: vi.fn(), db: null as unknown }))

vi.mock('@/lib/auth/actor', () => ({ getActor: mocks.getActor }))
vi.mock('@/lib/db/client', () => ({ getDb: () => mocks.db }))
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: () => ({ env: { MEDIA_PRIVATE: { get: mocks.get } } }) }))

import { GET } from '@/app/api/media/report/[id]/[slot]/route'
import { dangerReports } from '@/lib/db/schema'
import { createTestDatabase, type TestDatabase } from '@/lib/db/testing'
import { parseReportMediaSlot } from '@/lib/media/report-media'

const other = { kind: 'user' as const, id: 'other-1', email: null, isAdmin: false }
let database: TestDatabase

async function call(id: string, slot: string) {
  return GET(new NextRequest(`http://localhost/api/media/report/${id}/${slot}`), { params: Promise.resolve({ id, slot }) })
}

beforeEach(async () => {
  vi.clearAllMocks()
  database = createTestDatabase()
  mocks.db = database.db
  mocks.getActor.mockResolvedValue(other)
  mocks.get.mockResolvedValue({ body: 'image-bytes', size: 11, httpMetadata: { contentType: 'image/webp' } })
  await database.db.insert(dangerReports).values({
    id: 'report-1', userId: 'owner-1', title: '交差点', dangerType: 'traffic', dangerLevel: 3, latitude: 35, longitude: 139, status: 'approved',
    imageKey: 'danger-reports/owner-1/report-1/m-a.webp', processedImageKeys: ['danger-reports/owner-1/report-1/b.webp', 'danger-reports/owner-1/report-1/m-c.webp'],
  })
})

afterEach(() => {
  database.sqlite.close()
})

describe('/api/media/report/[id]/[slot](投稿者の id を出さない写真の URL。UIUX改装 項目61)', () => {
  it('写真の場所の書き方を読む', () => {
    expect(parseReportMediaSlot('image')).toEqual({ kind: 'image' })
    expect(parseReportMediaSlot('p12')).toEqual({ kind: 'processed', index: 12 })
    expect(parseReportMediaSlot('../x')).toBeNull()
    expect(parseReportMediaSlot('p1234')).toBeNull()
  })

  it('公開中の報告の、ぼかした写真だけをほかの人に配る', async () => {
    const response = await call('report-1', 'image')
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('image/webp')
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=300')
    expect(mocks.get).toHaveBeenCalledWith('danger-reports/owner-1/report-1/m-a.webp')

    expect((await call('report-1', 'p1')).status).toBe(200)
  })

  it('ぼかしていない写真・無い写真・未ログインは配らない', async () => {
    expect((await call('report-1', 'p0')).status).toBe(403)
    expect((await call('report-1', 'p5')).status).toBe(404)
    expect((await call('missing', 'image')).status).toBe(404)
    expect((await call('report-1', 'bad-slot')).status).toBe(400)
    mocks.getActor.mockResolvedValue({ kind: 'anon' })
    expect((await call('report-1', 'image')).status).toBe(401)
  })
})
