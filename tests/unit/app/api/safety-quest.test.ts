import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getActor: vi.fn(),
  listReports: vi.fn(),
  getReport: vi.fn(),
  recordAttempt: vi.fn(),
  analyze: vi.fn(),
  rateLimit: vi.fn(),
}))

vi.mock('@/lib/auth/actor', () => ({ getActor: mocks.getActor }))
vi.mock('@/lib/auth/service-actor', () => ({
  getServiceActor: () => ({ kind: 'service', name: 'safety-quest' }),
}))
vi.mock('@/lib/db/repos/danger-reports.repo', () => ({
  listDangerReports: mocks.listReports,
  getDangerReportById: mocks.getReport,
}))
vi.mock('@/lib/db/repos/gamification.repo', () => ({
  recordSafetyQuestAttemptAndAward: mocks.recordAttempt,
}))
vi.mock('@/lib/gemini-hazard', () => ({ analyzeImagePipeline: mocks.analyze }))
vi.mock('@/lib/upstash-rate-limiter', () => ({
  checkApiRateLimit: mocks.rateLimit,
  checkPaidApiRateLimit: mocks.rateLimit,
  rateLimitedResponse: () => new Response(null, { status: 429 }),
}))

const actor = { kind: 'user' as const, id: 'user-1', email: 'test@example.com', isAdmin: false }

function makeJsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function reportRow() {
  return {
    id: 'report-1',
    userId: 'owner-1',
    title: '交差点',
    description: '見通しの悪い交差点',
    latitude: 33.59,
    longitude: 130.4,
    dangerType: 'intersection',
    dangerLevel: 4,
    status: 'approved',
    imageKey: 'danger-reports/owner-1/report-1/original.webp',
    processedImageKey: null,
    processedImageKeys: [],
    prefecture: '福岡県',
    prefectureCode: null,
    city: '福岡市',
    municipalityCode: null,
    town: '中央区',
    postalCode: null,
    geocodeSource: null,
    geocodedAt: null,
    geocodeConfidence: null,
    addressHash: null,
    alertRadiusM: null,
    aiModerationStatus: null,
    aiModerationReason: null,
    aiModerationCheckedAt: null,
    aiModerationScore: null,
    createdAt: '2026-05-07T00:00:00.000Z',
    updatedAt: '2026-05-07T00:00:00.000Z',
  }
}

describe('safety quest D1 API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getActor.mockResolvedValue(actor)
    mocks.listReports.mockResolvedValue([])
    mocks.getReport.mockResolvedValue(null)
    mocks.rateLimit.mockResolvedValue({ success: true })
    mocks.recordAttempt.mockImplementation(async (_actor, _service, input) => ({
      pointsAwarded: input.pointsAwarded,
    }))
  })

  it('requires auth for challenges', async () => {
    mocks.getActor.mockResolvedValue({ kind: 'anon' })
    const { GET } = await import('@/app/api/safety-quest/challenges/route')
    const response = await GET(new NextRequest('http://localhost/api/safety-quest/challenges'))
    expect(response.status).toBe(401)
  })

  it('builds approved report challenges without exposing coordinates or R2 keys', async () => {
    mocks.listReports.mockResolvedValue([reportRow()])
    const { GET } = await import('@/app/api/safety-quest/challenges/route')
    const response = await GET(new NextRequest('http://localhost/api/safety-quest/challenges'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.listReports).toHaveBeenCalledWith(actor, {
      statuses: ['approved', 'published', 'resolved'],
      limit: 50,
    })
    expect(body.challenges[0]).toMatchObject({
      id: 'report-report-1',
      sourceType: 'report',
      areaLabel: '福岡市 中央区',
      imageUrl: '/api/media/private/danger-reports/owner-1/report-1/original.webp',
    })
    expect(JSON.stringify(body.challenges[0])).not.toContain('latitude')
    expect(JSON.stringify(body.challenges[0])).not.toContain('longitude')
    expect(JSON.stringify(body.challenges[0])).not.toContain('imageKey')
  })

  it('validates marker payloads', async () => {
    const { POST } = await import('@/app/api/safety-quest/attempts/route')
    const response = await POST(makeJsonRequest('http://localhost/api/safety-quest/attempts', {
      challengeId: 'sample-crossing-1',
      mode: 'hazard',
      userMarkers: [{ x: 'bad' }],
    }))
    expect(response.status).toBe(400)
    expect(mocks.recordAttempt).not.toHaveBeenCalled()
  })

  it('persists an awarded attempt through the atomic D1 operation', async () => {
    const { POST } = await import('@/app/api/safety-quest/attempts/route')
    const response = await POST(makeJsonRequest('http://localhost/api/safety-quest/attempts', {
      challengeId: 'sample-crossing-1',
      mode: 'hazard',
      durationMs: 30_000,
      userMarkers: [
        { id: 'm1', x: 0.23, y: 0.27, width: 0.16, height: 0.16, label: 'hazard', category: 'hazard', timestamp: 1 },
        { id: 'm2', x: 0.64, y: 0.36, width: 0.16, height: 0.16, label: 'hazard', category: 'hazard', timestamp: 2 },
      ],
    }))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.result.matches).toBeGreaterThan(0)
    expect(body.result.pointsAwarded).toBeGreaterThan(0)
    expect(mocks.recordAttempt).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ kind: 'service' }),
      expect.objectContaining({ challengeId: 'sample-crossing-1', pointsAwarded: expect.any(Number) }),
    )
  })

  it('clears points and reward keys when D1 identifies a replay', async () => {
    mocks.recordAttempt.mockResolvedValue({ pointsAwarded: 0 })
    const { POST } = await import('@/app/api/safety-quest/attempts/route')
    const response = await POST(makeJsonRequest('http://localhost/api/safety-quest/attempts', {
      challengeId: 'sample-crossing-1',
      mode: 'hazard',
      userMarkers: [
        { id: 'm1', x: 0.23, y: 0.27, width: 0.16, height: 0.16, label: 'hazard', category: 'hazard', timestamp: 1 },
      ],
    }))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.result.pointsAwarded).toBe(0)
    expect(body.result.rewardKeys).toEqual([])
    expect(body.next.rewardsUnlocked).toEqual([])
  })

  it('fails closed when attempt persistence fails', async () => {
    mocks.recordAttempt.mockRejectedValue(new Error('D1 unavailable'))
    const { POST } = await import('@/app/api/safety-quest/attempts/route')
    const response = await POST(makeJsonRequest('http://localhost/api/safety-quest/attempts', {
      challengeId: 'sample-crossing-1', mode: 'hazard', userMarkers: [],
    }))
    expect(response.status).toBe(500)
  })

  it('analyzes private practice without publishing it', async () => {
    mocks.analyze.mockResolvedValue({
      vision: { safetyEquipment: [], hazards: [], traffic: [], obstructions: [], inferenceTimeMs: 100 },
      think: { contextualRisks: [], priorityImprovements: [], latentRisks: [], childPerspectiveRisks: [] },
      score: {
        score: 95,
        level: 'safe',
        breakdown: [],
        detectionSummary: { safetyEquipmentCount: 0, hazardCount: 0, trafficCount: 0, obstructionCount: 0 },
        thinkSummary: { contextualRiskCount: 0, highSeverityCount: 0, mediumSeverityCount: 0, lowSeverityCount: 0 },
      },
      educationalTips: ['顔や住所が写る写真は使わないようにしましょう'],
      analysisTimestamp: '2026-05-07T00:00:00.000Z',
    })
    const { POST } = await import('@/app/api/safety-quest/private-practice/route')
    const response = await POST(makeJsonRequest('http://localhost/api/safety-quest/private-practice', {
      imageBase64: 'data:image/png;base64,abc', userMarkers: [],
    }))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.private).toBe(true)
    expect(body.pointsAwarded).toBeLessThanOrEqual(120)
    expect(JSON.stringify(body)).not.toContain('published')
  })
})
