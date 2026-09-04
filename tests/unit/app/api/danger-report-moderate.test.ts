import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  actor: vi.fn(),
  mode: vi.fn(() => 'live'),
  report: vi.fn(),
  fallbackCount: vi.fn(),
  markFailed: vi.fn(),
  moderate: vi.fn(),
  queueNotification: vi.fn(),
  paidRate: vi.fn(),
}))

vi.mock('@/lib/auth/actor', () => ({ getActor: mocks.actor }))
vi.mock('@/lib/upstash-rate-limiter', async () => {
  const actual = await vi.importActual<typeof import('@/lib/upstash-rate-limiter')>('@/lib/upstash-rate-limiter')
  return { ...actual, checkApiRateLimit: vi.fn().mockResolvedValue({ success: true }), checkPaidApiRateLimit: mocks.paidRate }
})
vi.mock('@/lib/danger-report-moderation-d1', () => ({
  MAX_DANGER_MODERATION_FALLBACKS: 3,
  getDangerModerationMode: mocks.mode,
  getModerationReport: mocks.report,
  getDangerModerationFallbackCount: mocks.fallbackCount,
  markDangerReportModerationFailed: mocks.markFailed,
  moderateDangerReportRecord: mocks.moderate,
}))
vi.mock('@/lib/push-notifications/notify-danger-report', () => ({
  queueDangerReportNotification: mocks.queueNotification,
}))

import { POST as postDanger } from '@/app/api/danger-report/moderate/route'
import { POST as postSuspicious } from '@/app/api/suspicious-alert/moderate/route'

const owner = { kind: 'user' as const, id: 'user-1', email: null, isAdmin: false }
const ownReport = {
  id: 'report-1', userId: 'user-1', title: 'test', description: null,
  dangerType: 'traffic', dangerLevel: 2, latitude: 35, longitude: 139,
  status: 'pending', imageKey: null, processedImageKey: null, processedImageKeys: [],
  accidentStats: null, accidentRiskScore: null, geocodeSource: null,
  geocodeConfidence: null, geocodedAt: null, addressHash: null,
  prefecture: null, prefectureCode: null, city: null, municipalityCode: null,
  town: null, postalCode: null, alertRadiusM: null, pushNotifiedAt: null,
  aiModerationStatus: 'pending', aiModerationReason: null, aiModerationScore: null,
  aiModerationCheckedAt: null, createdAt: '2026-08-23T00:00:00.000Z',
  updatedAt: '2026-08-23T00:00:00.000Z',
}

function request(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
}

describe('POST /api/danger-report/moderate (D1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.actor.mockResolvedValue(owner)
    mocks.paidRate.mockResolvedValue({ success: true })
    mocks.mode.mockReturnValue('live')
    mocks.report.mockResolvedValue(ownReport)
    mocks.fallbackCount.mockResolvedValue(0)
    mocks.markFailed.mockResolvedValue(null)
    mocks.moderate.mockResolvedValue({
      outcome: 'updated', verdict: { status: 'approved' },
      report: { ...ownReport, status: 'approved', aiModerationStatus: 'approved' },
    })
  })

  it('requires authentication', async () => {
    mocks.actor.mockResolvedValue({ kind: 'anon' })
    const response = await postDanger(request('/api/danger-report/moderate', { reportId: 'report-1' }))
    expect(response.status).toBe(401)
    expect(mocks.report).not.toHaveBeenCalled()
  })

  it('does not charge off mode', async () => {
    mocks.mode.mockReturnValue('off')
    expect((await postDanger(request('/api/danger-report/moderate', { reportId: 'report-1' }))).status).toBe(200)
    expect(mocks.paidRate).not.toHaveBeenCalled()
    expect(mocks.moderate).not.toHaveBeenCalled()
  })

  it.each(['live', 'shadow'])('blocks %s AI work when the shared quota is exhausted', async (mode) => {
    mocks.mode.mockReturnValue(mode)
    mocks.paidRate.mockResolvedValue({ success: false, reset: Date.now() + 60_000 })
    expect((await postDanger(request('/api/danger-report/moderate', { reportId: 'report-1' }))).status).toBe(429)
    expect(mocks.paidRate).toHaveBeenCalledWith('ai', owner.id, 1)
    expect(mocks.moderate).not.toHaveBeenCalled()
    expect(mocks.queueNotification).not.toHaveBeenCalled()
  })

  it('allows the owner and delegates to the D1 moderation service', async () => {
    const response = await postDanger(request('/api/danger-report/moderate', { reportId: 'report-1' }))
    expect(response.status).toBe(200)
    expect(mocks.moderate).toHaveBeenCalledWith(ownReport, 'live')
    expect((await response.json()).report.status).toBe('approved')
    expect(mocks.queueNotification).toHaveBeenCalledWith({ reportId: 'report-1' })
  })

  it('reserves all text and image calls and blocks the compatibility path too', async () => {
    mocks.report.mockResolvedValue({ ...ownReport, dangerType: 'suspicious', imageKey: 'a',
      processedImageKey: 'b', processedImageKeys: ['c', 'd'] })
    mocks.paidRate.mockResolvedValue({ success: false })
    for (const handler of [postDanger, postSuspicious]) {
      expect((await handler(request('/api/moderate', { reportId: 'report-1' }))).status).toBe(429)
    }
    expect(mocks.paidRate).toHaveBeenNthCalledWith(1, 'ai', owner.id, 4)
    expect(mocks.paidRate).toHaveBeenNthCalledWith(2, 'ai', owner.id, 4)
    expect(mocks.moderate).not.toHaveBeenCalled()
  })

  it('does not expose internal moderation reason or score', async () => {
    mocks.moderate.mockResolvedValue({
      outcome: 'updated', verdict: { status: 'approved' },
      report: { ...ownReport, aiModerationStatus: 'approved', aiModerationReason: 'internal', aiModerationScore: 0.1 },
    })
    const body = await (await postDanger(request('/api/danger-report/moderate', { reportId: 'report-1' }))).json()
    expect(body.report).not.toHaveProperty('ai_moderation_reason')
    expect(body.report).not.toHaveProperty('ai_moderation_score')
    expect(body.report).not.toHaveProperty('ai_moderation_checked_at')
  })

  it('returns 202 while a live fallback waits for bounded retry', async () => {
    mocks.moderate.mockResolvedValue({ outcome: 'retry', verdict: { status: 'needs_review' }, report: ownReport })
    const response = await postDanger(request('/api/danger-report/moderate', { reportId: 'report-1' }))
    expect(response.status).toBe(202)
    expect(await response.json()).toMatchObject({ mode: 'live', pending: true })
    expect(mocks.queueNotification).not.toHaveBeenCalled()
  })

  it('stops retries after the live fallback budget', async () => {
    mocks.fallbackCount.mockResolvedValue(3)
    mocks.markFailed.mockResolvedValue({ ...ownReport, aiModerationStatus: 'needs_review' })
    const response = await postDanger(request('/api/danger-report/moderate', { reportId: 'report-1' }))
    expect(response.status).toBe(202)
    expect(mocks.markFailed).toHaveBeenCalledWith('report-1', expect.any(Date))
    expect(mocks.moderate).not.toHaveBeenCalled()
  })

  it('forbids a different non-admin user and allows an admin', async () => {
    mocks.report.mockResolvedValue({ ...ownReport, userId: 'owner-2' })
    expect((await postDanger(request('/api/danger-report/moderate', { reportId: 'report-1' }))).status).toBe(403)
    mocks.actor.mockResolvedValue({ ...owner, isAdmin: true })
    expect((await postDanger(request('/api/danger-report/moderate', { reportId: 'report-1' }))).status).toBe(200)
  })

  it('returns 409 before running AI for finalized moderation', async () => {
    mocks.report.mockResolvedValue({ ...ownReport, aiModerationStatus: 'approved' })
    const response = await postDanger(request('/api/danger-report/moderate', { reportId: 'report-1' }))
    expect(response.status).toBe(409)
    expect(mocks.moderate).not.toHaveBeenCalled()
  })

  it('keeps the suspicious endpoint but rejects non-suspicious reports', async () => {
    const response = await postSuspicious(request('/api/suspicious-alert/moderate', { reportId: 'report-1' }))
    expect(response.status).toBe(400)
  })

  it('queues the suspicious compatibility path only after persisted approval', async () => {
    const suspicious = { ...ownReport, dangerType: 'suspicious' }
    mocks.report.mockResolvedValue(suspicious)
    mocks.moderate.mockResolvedValue({
      outcome: 'updated', verdict: { status: 'approved' },
      report: { ...suspicious, status: 'approved', aiModerationStatus: 'approved' },
    })

    const response = await postSuspicious(request('/api/suspicious-alert/moderate', { reportId: 'report-1' }))

    expect(response.status).toBe(200)
    expect(mocks.queueNotification).toHaveBeenCalledWith({ reportId: 'report-1' })
  })

  it.each([
    { status: 'rejected', aiModerationStatus: 'rejected' },
    { status: 'pending', aiModerationStatus: 'needs_review' },
  ])('does not queue a $aiModerationStatus result', async (state) => {
    mocks.moderate.mockResolvedValue({
      outcome: 'updated', verdict: { status: state.aiModerationStatus },
      report: { ...ownReport, ...state },
    })

    expect((await postDanger(request('/api/danger-report/moderate', { reportId: 'report-1' }))).status).toBe(200)
    expect(mocks.queueNotification).not.toHaveBeenCalled()
  })
})
