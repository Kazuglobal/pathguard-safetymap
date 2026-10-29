// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  order: [] as string[],
  listExpired: vi.fn(),
  deleteReports: vi.fn(),
  deleteSubscriptions: vi.fn(),
  deleteHistory: vi.fn(),
  mediaDelete: vi.fn(),
  backupList: vi.fn(),
  backupDelete: vi.fn(),
}))

vi.mock('@/lib/db/repos/retention.repo', () => ({
  listExpiredReports: mocks.listExpired,
  deleteExpiredReports: mocks.deleteReports,
  deleteStaleSubscriptions: mocks.deleteSubscriptions,
  deleteOldReportCreateHistory: mocks.deleteHistory,
}))
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => ({
    env: { MEDIA_PRIVATE: { delete: mocks.mediaDelete }, BACKUPS: { list: mocks.backupList, delete: mocks.backupDelete } },
  }),
}))

import { GET } from '@/app/api/cron/retention-cleanup/route'

const request = (secret = 'secret') => new NextRequest('http://localhost/api/cron/retention-cleanup', { headers: { authorization: `Bearer ${secret}` } })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.order.length = 0
  process.env.CRON_SECRET = 'secret'
  mocks.listExpired.mockResolvedValue([{ id: 'r1', mediaKeys: ['danger-reports/u/r1/m-a.webp'] }])
  mocks.mediaDelete.mockImplementation(async () => { mocks.order.push('r2') })
  mocks.deleteReports.mockImplementation(async () => { mocks.order.push('d1'); return 1 })
  mocks.deleteSubscriptions.mockResolvedValue(2)
  mocks.deleteHistory.mockResolvedValue(3)
  mocks.backupList.mockResolvedValue({ objects: [{ key: 'd1/2020-01-01.sql.gz' }, { key: 'd1/2999-01-01.sql.gz' }], truncated: false })
  mocks.backupDelete.mockResolvedValue(undefined)
})

describe('/api/cron/retention-cleanup(UIUX改装 項目60)', () => {
  it('cron の秘密が違えば何もしない', async () => {
    expect((await GET(request('wrong'))).status).toBe(401)
    expect(mocks.listExpired).not.toHaveBeenCalled()
  })

  it('写真を先に消してから報告を消し、購読・作成の記録・古いバックアップも消す', async () => {
    const response = await GET(request())

    expect(await response.json()).toEqual({ deletedReports: 1, deletedSubscriptions: 2, deletedHistory: 3, deletedBackups: 1 })
    expect(mocks.order).toEqual(['r2', 'd1'])
    expect(mocks.mediaDelete).toHaveBeenCalledWith(['danger-reports/u/r1/m-a.webp'])
    expect(mocks.backupDelete).toHaveBeenCalledWith(['d1/2020-01-01.sql.gz'])
  })

  it('写真を消せなかったら報告を消さない(次の日に同じ報告から続ける)', async () => {
    mocks.mediaDelete.mockRejectedValue(new Error('r2 down'))
    await expect(GET(request())).rejects.toThrow('r2 down')
    expect(mocks.deleteReports).not.toHaveBeenCalled()
  })
})
