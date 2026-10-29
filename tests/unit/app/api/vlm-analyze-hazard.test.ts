// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ actor: vi.fn(), report: vi.fn(), getImage: vi.fn(), claude: vi.fn(), hasKey: vi.fn(), gemini: vi.fn(), rate: vi.fn() }))
vi.mock('@/lib/auth/actor', () => ({ getActor: mocks.actor }))
vi.mock('@/lib/db/repos/danger-reports.repo', () => ({ getDangerReportById: mocks.report }))
vi.mock('@/lib/claude-vision', () => ({ callClaudeVision: mocks.claude, hasClaudeApiKey: mocks.hasKey }))
vi.mock('@/lib/gemini-hazard', () => ({ callGeminiVision: mocks.gemini }))
vi.mock('@/lib/upstash-rate-limiter', () => ({ checkGeminiRateLimit: mocks.rate, rateLimitedResponse: () => new Response('{}', { status: 429 }) }))
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: () => ({ env: { MEDIA_PRIVATE: { get: mocks.getImage } } }) }))
import { POST } from '@/app/api/vlm/analyze-hazard/route'

const analysis = { hazards: [], overall_safety_score: 70, overall_risk_level: 2, child_perspective_summary: '交差点で立ち止まる', time_weather_risks: {}, improvement_suggestions: {} }
const request = () => new Request('https://example.com/api/vlm/analyze-hazard', { method: 'POST', body: JSON.stringify({ report_id: 'report-1', additional_context: '通学路' }) })

describe('submitted photo AI analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.actor.mockResolvedValue({ kind: 'user', id: 'owner-1' })
    mocks.rate.mockResolvedValue({ success: true })
    // ファイル名の頭の m- は「端末でぼかした写真」の印(lib/media/url.ts)
    mocks.report.mockResolvedValue({ userId: 'owner-1', imageKey: 'danger-reports/owner-1/r/m-original.webp', processedImageKeys: ['danger-reports/owner-1/r/m-processed.webp'] })
    mocks.getImage.mockResolvedValue({ size: 3, httpMetadata: { contentType: 'image/webp' }, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer })
    mocks.hasKey.mockReturnValue(true)
    mocks.claude.mockResolvedValue(JSON.stringify(analysis))
    mocks.gemini.mockResolvedValue(JSON.stringify(analysis))
  })

  it('uses the configured Claude provider and privately stored original', async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(mocks.getImage).toHaveBeenCalledWith('danger-reports/owner-1/r/m-original.webp')
    expect(mocks.claude).toHaveBeenCalledWith(expect.objectContaining({ mediaType: 'image/webp', base64: 'AQID' }))
    expect(mocks.gemini).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toMatchObject({ success: true, analysis })
  })

  it('analyzes a processed-only attachment', async () => {
    mocks.report.mockResolvedValue({ userId: 'owner-1', imageKey: null, processedImageKeys: ['danger-reports/owner-1/r/m-processed.webp'] })
    expect((await POST(request())).status).toBe(200)
    expect(mocks.getImage).toHaveBeenCalledWith('danger-reports/owner-1/r/m-processed.webp')
  })

  it('ぼかしていない写真(以前の写真)は AI に送らない(UIUX改装 項目57)', async () => {
    mocks.report.mockResolvedValue({ userId: 'owner-1', imageKey: 'danger-reports/owner-1/r/original.webp', processedImageKeys: ['danger-reports/owner-1/r/processed.webp'] })

    const response = await POST(request())

    expect(response.status).toBe(409)
    expect(mocks.getImage).not.toHaveBeenCalled()
    expect(mocks.claude).not.toHaveBeenCalled()
    expect(mocks.gemini).not.toHaveBeenCalled()
  })

  it('retains Gemini compatibility when the Claude key is not configured', async () => {
    mocks.hasKey.mockReturnValue(false)
    expect((await POST(request())).status).toBe(200)
    expect(mocks.gemini).toHaveBeenCalledOnce()
    expect(mocks.claude).not.toHaveBeenCalled()
  })

  it('rejects another owner before reading a private image', async () => {
    mocks.report.mockResolvedValue({ userId: 'other-owner' })
    expect((await POST(request())).status).toBe(403)
    expect(mocks.getImage).not.toHaveBeenCalled()
    expect(mocks.claude).not.toHaveBeenCalled()
  })

  it('returns a Japanese retry message without exposing the provider error body', async () => {
    const error = Object.assign(new Error('sensitive upstream response'), { name: 'APIConnectionTimeoutError' })
    mocks.claude.mockRejectedValue(error)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const response = await POST(request())
    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('再試行') })
    expect(log).toHaveBeenCalledWith('[api/vlm/analyze-hazard] failed', { name: 'APIConnectionTimeoutError', status: null })
    log.mockRestore()
  })
})
