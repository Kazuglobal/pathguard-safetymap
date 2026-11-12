import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ user: vi.fn(), actor: vi.fn(), rate: vi.fn(), analyze: vi.fn(), points: vi.fn() }))
vi.mock('@/lib/supabase-server', () => ({ createServerClient: async () => ({ auth: { getUser: mocks.user } }) }))
vi.mock('@/lib/auth/actor', () => ({ getActor: mocks.actor }))
vi.mock('@/lib/gemini-hazard', () => ({ analyzeImagePipeline: mocks.analyze }))
vi.mock('@/lib/api-usage-logger', () => ({ logApiUsage: vi.fn() }))
vi.mock('@/lib/db/repos/gamification.repo', () => ({ incrementPoints: mocks.points }))
vi.mock('@/lib/upstash-rate-limiter', async original => ({
  ...await original<typeof import('@/lib/upstash-rate-limiter')>(), checkPaidApiRateLimit: mocks.rate,
}))
import { logApiUsage } from '@/lib/api-usage-logger'
import { POST as hazard } from '@/app/api/hazard-game/analyze/route'
import { POST as practice } from '@/app/api/safety-quest/private-practice/route'
const request = (body: unknown) => new NextRequest('http://localhost/api/analyze', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})
const analysis = {
  vision: { hazards: [], safetyEquipment: [], traffic: [], obstructions: [], inferenceTimeMs: 1 },
  think: { contextualRisks: [] }, score: { score: 100, level: 'safe' },
  educationalTips: [], analysisTimestamp: '2026-09-04T00:00:00Z',
}
describe('paid AI analysis boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.user.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mocks.actor.mockResolvedValue({ kind: 'user', id: 'user-1' })
    mocks.rate.mockResolvedValue({ success: true })
    mocks.analyze.mockResolvedValue(analysis)
  })
  it.each([hazard, practice])('blocks AI on quota rejection', async handler => {
    mocks.rate.mockResolvedValue({ success: false, reset: Date.now() + 60_000 })
    expect((await handler(request({ imageBase64: 'abc', userMarkers: [] }))).status).toBe(429)
    expect(mocks.rate).toHaveBeenCalledWith('ai', 'user-1')
    expect(mocks.analyze).not.toHaveBeenCalled()
    expect(mocks.points).not.toHaveBeenCalled()
  })
  it.each([hazard, practice])('validates before quota reservation', async handler => {
    for (const body of [null, [], {}, { imageBase64: 7 }]) {
      expect((await handler(request(body))).status).toBe(400)
    }
    expect(mocks.rate).not.toHaveBeenCalled()
  })
  it.each([hazard, practice])('authenticates before quota reservation', async handler => {
    mocks.user.mockResolvedValue({ data: { user: null }, error: null })
    mocks.actor.mockResolvedValue({ kind: 'anon' })
    expect((await handler(request({ imageBase64: 'abc' }))).status).toBe(401)
    expect(mocks.rate).not.toHaveBeenCalled()
  })
  it('preserves hazard analysis but never mints points, even on replay', async () => {
    for (let i = 0; i < 2; i++) {
      const response = await hazard(request({ imageBase64: 'abc' }))
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ score: analysis.score, legacyScore: 100, overallSafety: 5 })
    }
    expect(mocks.points).not.toHaveBeenCalled()
  })
  it('logs Claude with its real token counts, and Gemini only when Gemini answered', async () => {
    mocks.analyze.mockImplementation(async (_image: string, options: { onClaudeUsage?: (a: unknown) => void }) => {
      options.onClaudeUsage?.({ model: 'claude-haiku-5-5', inputTokens: 3000, outputTokens: 2000, ok: true })
      return { ...analysis, analysisModel: { provider: 'anthropic', model: 'claude-haiku-5-5' } }
    })
    expect((await hazard(request({ imageBase64: 'abc' }))).status).toBe(200)
    expect(vi.mocked(logApiUsage)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(logApiUsage).mock.calls[0][0]).toMatchObject({
      api_provider: 'anthropic', model_name: 'claude-haiku-5-5', input_tokens: 3000, output_tokens: 2000, success: true,
    })
    // $0.10 / $0.50 per 1M tokens
    expect(vi.mocked(logApiUsage).mock.calls[0][0].estimated_cost_usd).toBeCloseTo(0.0003 + 0.001, 10)

    vi.mocked(logApiUsage).mockClear()
    mocks.analyze.mockImplementation(async (_image: string, options: { onClaudeUsage?: (a: unknown) => void }) => {
      options.onClaudeUsage?.({ model: 'claude-haiku-5-5', inputTokens: 3000, outputTokens: 20, ok: false })
      return analysis
    })
    expect((await hazard(request({ imageBase64: 'abc' }))).status).toBe(200)
    expect(vi.mocked(logApiUsage).mock.calls.map(([entry]) => [entry.api_provider, entry.success])).toEqual([
      ['anthropic', false],
      ['gemini', true],
    ])
  })
  it('does not name an AI company in the quota message shown to users', async () => {
    mocks.analyze.mockRejectedValue(new Error('quota exceeded'))
    const response = await hazard(request({ imageBase64: 'abc' }))
    expect(response.status).toBe(429)
    expect((await response.json()).error).not.toMatch(/Gemini|Google|Claude|Anthropic|OpenAI/)
  })
  it('rejects oversized hazard images without content-length', async () => {
    const response = await hazard(request({ imageBase64: 'a'.repeat(25 * 1024 * 1024 + 1) }))
    expect(response.status).toBe(413)
    expect(mocks.rate).not.toHaveBeenCalled()
    expect(mocks.analyze).not.toHaveBeenCalled()
  })
})
