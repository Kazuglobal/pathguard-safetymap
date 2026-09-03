// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  actor: vi.fn(), create: vi.fn(), rate: vi.fn(), notify: vi.fn(), increment: vi.fn(), bucketDelete: vi.fn(), remove: vi.fn(),
}))
vi.mock('@/lib/auth/actor', () => ({ getActor: mocks.actor }))
vi.mock('@/lib/db/repos/danger-reports.repo', () => ({
  createDangerReport: mocks.create, listDangerReports: vi.fn(), deleteDangerReport: mocks.remove, getDangerReportById: vi.fn(),
}))
vi.mock('@/lib/db/repos/notifications.repo', () => ({ createRouteReportNotification: mocks.notify }))
vi.mock('@/lib/db/repos/gamification.repo', () => ({ incrementPoints: mocks.increment }))
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: () => ({ env: { MEDIA_PRIVATE: { delete: mocks.bucketDelete } } }) }))
vi.mock('@/lib/upstash-rate-limiter', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/upstash-rate-limiter')>(), checkApiRateLimit: mocks.rate,
}))

import { POST } from '@/app/api/reports/route'
import { DELETE } from '@/app/api/reports/[id]/route'
import { ReportCreateRateLimitError, ReportCreateUnavailableError } from '@/lib/db/report-create-errors'

const request = (extra = {}) => new Request('http://localhost/api/reports', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Crosswalk', danger_type: 'traffic', danger_level: 3, latitude: 35, longitude: 139, ...extra }),
})

describe('SEC-02 report APIs', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.actor.mockResolvedValue({ kind: 'user', id: 'owner', isAdmin: false, email: null })
    mocks.rate.mockResolvedValue({ success: true })
    mocks.create.mockResolvedValue({ id: 'report', title: 'Crosswalk', status: 'pending', processedImageKeys: [], rewardPoints: 0 })
  })

  it('creates without immediate rewards or accepting forged reward/status fields', async () => {
    const response = await POST(request({ reward_points: 20, status: 'approved', user_id: 'other' }))
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ pointsAwarded: 0, report: { status: 'pending' } })
    expect(mocks.rate).toHaveBeenCalledWith('report-create:owner')
    expect(mocks.create.mock.calls[0][1]).not.toHaveProperty('rewardPoints')
    expect(mocks.create.mock.calls[0][1]).not.toHaveProperty('status')
    expect(mocks.create.mock.calls[0][1]).not.toHaveProperty('userId')
    expect(mocks.increment).not.toHaveBeenCalled()
  })

  it('rejects unauthenticated requests before rate limiting or writes', async () => {
    mocks.actor.mockResolvedValue({ kind: 'anon' })
    expect((await POST(request())).status).toBe(401)
    expect(mocks.rate).not.toHaveBeenCalled()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('stops at the generic rate limit and returns a positive Retry-After', async () => {
    mocks.rate.mockResolvedValue({ success: false, reset: Date.now() - 1000 })
    const response = await POST(request({ route_context_name: 'School route' }))
    expect(response.status).toBe(429)
    expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0)
    expect(mocks.create).not.toHaveBeenCalled()
    expect(mocks.notify).not.toHaveBeenCalled()
  })

  it.each([false, true])('enforces D1 quotas with Redis failure=%s', async (redisFails) => {
    if (redisFails) mocks.rate.mockRejectedValue(new Error('Redis offline'))
    mocks.create.mockRejectedValue(new ReportCreateRateLimitError(Date.now() + 22 * 3600_000))
    const response = await POST(request({ route_context_name: 'School route' }))
    expect(response.status).toBe(429)
    expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(21 * 3600)
    expect(mocks.notify).not.toHaveBeenCalled()
    expect(mocks.increment).not.toHaveBeenCalled()
  })

  it('continues through mandatory D1 checks when Redis fails', async () => {
    mocks.rate.mockRejectedValue(new Error('Redis offline'))
    expect((await POST(request())).status).toBe(201)
    expect(mocks.create).toHaveBeenCalledOnce()
  })

  it('returns 503 without notification or awards when D1 fails', async () => {
    mocks.create.mockRejectedValue(new ReportCreateUnavailableError(new Error('offline')))
    expect((await POST(request({ route_context_name: 'School route' }))).status).toBe(503)
    expect(mocks.notify).not.toHaveBeenCalled()
    expect(mocks.increment).not.toHaveBeenCalled()
  })

  it('reports media cleanup failure after the DB deletion without re-awarding', async () => {
    mocks.remove.mockResolvedValue({ report: { id: 'report' }, imageKeys: ['test.webp'] })
    mocks.bucketDelete.mockRejectedValue(new Error('R2 offline'))
    const response = await DELETE(new Request('http://localhost/api/reports/report', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'report' }),
    })
    expect(await response.json()).toEqual({ deleted: true, mediaDeleteFailed: true })
    expect(mocks.increment).not.toHaveBeenCalled()
    expect(mocks.remove).toHaveBeenCalledOnce()
  })
})
