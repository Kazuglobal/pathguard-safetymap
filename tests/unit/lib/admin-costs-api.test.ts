import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getActor: vi.fn(), listApiUsage: vi.fn(), listApiBudgets: vi.fn(), updateApiBudget: vi.fn(),
}))
vi.mock('@/lib/auth/actor', () => ({ getActor: mocks.getActor }))
vi.mock('@/lib/db/repos/ops.repo', () => ({
  listApiUsage: mocks.listApiUsage,
  listApiBudgets: mocks.listApiBudgets,
  updateApiBudget: mocks.updateApiBudget,
}))

import { getBudgetSettings, getCostSummary, getDailyBreakdown, getEndpointBreakdown, updateBudgetSettings } from '@/lib/admin-costs-service'

describe('admin-costs-service on D1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getActor.mockResolvedValue({ kind: 'user', id: 'admin', email: 'admin@example.com', isAdmin: true })
    mocks.listApiBudgets.mockResolvedValue([
      { apiProvider: 'gemini', monthlyBudgetUsd: 10, alertThresholdPercent: 80 },
      { apiProvider: 'openai', monthlyBudgetUsd: 20, alertThresholdPercent: 80 },
      { apiProvider: 'mapbox', monthlyBudgetUsd: 5, alertThresholdPercent: 80 },
    ])
    mocks.listApiUsage.mockResolvedValue([
      { apiProvider: 'gemini', apiEndpoint: 'generate-image', estimatedCostUsd: 9, requestCount: 2, createdAt: '2026-02-01T01:00:00Z' },
      { apiProvider: 'openai', apiEndpoint: 'analyze', estimatedCostUsd: 2, requestCount: 1, createdAt: '2026-02-02T01:00:00Z' },
    ])
  })

  it('aggregates provider, daily, endpoint, and budget views', async () => {
    const summary = await getCostSummary('2026-02')
    expect(summary.gemini).toEqual({ total_cost: 9, request_count: 2, budget: 10, alert: true })
    expect(await getDailyBreakdown('2026-02')).toEqual([
      { date: '2026-02-01', gemini: 9, openai: 0, mapbox: 0 },
      { date: '2026-02-02', gemini: 0, openai: 2, mapbox: 0 },
    ])
    expect(await getEndpointBreakdown('2026-02')).toEqual(expect.arrayContaining([
      { endpoint: 'generate-image', total_cost: 9, request_count: 2, api_provider: 'gemini' },
    ]))
    expect(await getBudgetSettings()).toHaveLength(3)
    expect(mocks.listApiUsage).toHaveBeenCalledWith(expect.objectContaining({ isAdmin: true }), '2026-02-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z')
  })

  it('updates an allowed provider and rejects invalid providers', async () => {
    mocks.updateApiBudget.mockResolvedValue({ apiProvider: 'gemini', monthlyBudgetUsd: 100, alertThresholdPercent: 70 })
    await expect(updateBudgetSettings('gemini', { monthly_budget_usd: 100, alert_threshold_percent: 70 }))
      .resolves.toEqual({ api_provider: 'gemini', monthly_budget_usd: 100, alert_threshold_percent: 70 })
    await expect(updateBudgetSettings('invalid' as never, {})).rejects.toThrow('Invalid provider')
  })

  it('rejects non-admin actors before reading operational data', async () => {
    mocks.getActor.mockResolvedValue({ kind: 'user', id: 'user', email: null, isAdmin: false })
    await expect(getCostSummary('2026-02')).rejects.toThrow('管理者権限が必要です')
    expect(mocks.listApiUsage).not.toHaveBeenCalled()
  })
})
