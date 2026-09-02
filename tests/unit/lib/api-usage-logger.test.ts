import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ insertApiUsage: vi.fn(), waitUntil: vi.fn() }))
vi.mock('@/lib/db/repos/ops.repo', () => ({ insertApiUsage: mocks.insertApiUsage }))
vi.mock('@opennextjs/cloudflare', () => ({ getCloudflareContext: () => ({ ctx: { waitUntil: mocks.waitUntil } }) }))
vi.mock('@/lib/api-cost-calculator', () => ({ calculateCost: () => 0.005, calculateMapboxCost: () => 0 }))

import { logApiUsage } from '@/lib/api-usage-logger'

describe('api-usage-logger on D1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.insertApiUsage.mockResolvedValue(undefined)
  })

  it('normalizes fields, calculates cost, and attaches the write to waitUntil', () => {
    logApiUsage({
      api_provider: 'gemini', api_endpoint: 'generate-image', model_name: 'gemini',
      input_tokens: 500, output_tokens: 200, success: true,
    })
    expect(mocks.insertApiUsage).toHaveBeenCalledWith({ kind: 'service' }, {
      apiProvider: 'gemini', apiEndpoint: 'generate-image', modelName: 'gemini',
      inputTokens: 500, outputTokens: 200, requestCount: 1,
      estimatedCostUsd: 0.005, success: true, errorMessage: undefined,
    })
    expect(mocks.waitUntil).toHaveBeenCalledWith(expect.any(Promise))
  })

  it('uses explicit cost/defaults and never throws synchronously on an insert failure', () => {
    mocks.insertApiUsage.mockRejectedValue(new Error('db down'))
    expect(() => logApiUsage({
      api_provider: 'mapbox', api_endpoint: 'geocode', estimated_cost_usd: 1.25,
      success: false, error_message: 'quota',
    })).not.toThrow()
    expect(mocks.insertApiUsage).toHaveBeenCalledWith({ kind: 'service' }, expect.objectContaining({
      requestCount: 1, estimatedCostUsd: 1.25, success: false, errorMessage: 'quota',
    }))
  })
})
