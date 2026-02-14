import { describe, it, expect, vi, beforeEach } from 'vitest'

// Supabase admin モック (vi.hoisted でホイスティング対応)
const { mockSelect, mockGte, mockLte, mockEq, mockSingle, mockUpdate, chainMock } = vi.hoisted(() => {
  const mockSelect = vi.fn()
  const mockGte = vi.fn()
  const mockLte = vi.fn()
  const mockEq = vi.fn()
  const mockSingle = vi.fn()
  const mockUpdate = vi.fn()

  const chainMock = {
    select: mockSelect,
    gte: mockGte,
    lte: mockLte,
    eq: mockEq,
    single: mockSingle,
    update: mockUpdate,
  }

  // チェーンをセットアップ
  mockSelect.mockReturnValue(chainMock)
  mockGte.mockReturnValue(chainMock)
  mockLte.mockReturnValue(chainMock)
  mockEq.mockReturnValue(chainMock)
  mockUpdate.mockReturnValue(chainMock)

  return { mockSelect, mockGte, mockLte, mockEq, mockSingle, mockUpdate, chainMock }
})

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue(chainMock),
  },
}))

import {
  getCostSummary,
  getDailyBreakdown,
  getEndpointBreakdown,
  getBudgetSettings,
  updateBudgetSettings,
} from '@/lib/admin-costs-service'

describe('admin-costs-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // デフォルトのチェーン再設定
    mockSelect.mockReturnValue(chainMock)
    mockGte.mockReturnValue(chainMock)
    mockLte.mockReturnValue(chainMock)
    mockEq.mockReturnValue(chainMock)
    mockUpdate.mockReturnValue(chainMock)
  })

  describe('getCostSummary', () => {
    it('月次のAPI別コストサマリーを返すこと', async () => {
      // ログデータのモック
      mockLte.mockResolvedValueOnce({
        data: [
          { api_provider: 'gemini', estimated_cost_usd: 5.0, request_count: 1 },
          { api_provider: 'gemini', estimated_cost_usd: 3.0, request_count: 1 },
          { api_provider: 'openai', estimated_cost_usd: 2.0, request_count: 1 },
          { api_provider: 'mapbox', estimated_cost_usd: 0, request_count: 1 },
        ],
        error: null,
      })

      // 予算データのモック
      mockSelect.mockResolvedValueOnce({
        data: [
          { api_provider: 'gemini', monthly_budget_usd: 50, alert_threshold_percent: 80 },
          { api_provider: 'openai', monthly_budget_usd: 30, alert_threshold_percent: 80 },
          { api_provider: 'mapbox', monthly_budget_usd: 20, alert_threshold_percent: 80 },
        ],
        error: null,
      })

      const result = await getCostSummary('2026-02')

      expect(result).toBeDefined()
      expect(result.gemini).toBeDefined()
      expect(result.gemini.total_cost).toBeCloseTo(8.0)
      expect(result.gemini.request_count).toBe(2)
      expect(result.openai).toBeDefined()
      expect(result.openai.total_cost).toBeCloseTo(2.0)
      expect(result.mapbox).toBeDefined()
    })

    it('各プロバイダーにbudgetとalertフラグが含まれること', async () => {
      mockLte.mockResolvedValueOnce({
        data: [
          { api_provider: 'gemini', estimated_cost_usd: 45.0, request_count: 1 },
        ],
        error: null,
      })
      mockSelect.mockResolvedValueOnce({
        data: [
          { api_provider: 'gemini', monthly_budget_usd: 50, alert_threshold_percent: 80 },
        ],
        error: null,
      })

      const result = await getCostSummary('2026-02')

      expect(result.gemini.budget).toBe(50)
      expect(result.gemini.alert).toBe(true) // 45/50 = 90% > 80%
    })

    it('データがない場合でもエラーにならないこと', async () => {
      mockLte.mockResolvedValueOnce({ data: [], error: null })
      mockSelect.mockResolvedValueOnce({ data: [], error: null })

      const result = await getCostSummary('2026-02')

      expect(result).toBeDefined()
      expect(result.gemini.total_cost).toBe(0)
      expect(result.openai.total_cost).toBe(0)
      expect(result.mapbox.total_cost).toBe(0)
    })
  })

  describe('getDailyBreakdown', () => {
    it('日別のコスト内訳を返すこと', async () => {
      mockLte.mockResolvedValueOnce({
        data: [
          { created_at: '2026-02-01T10:00:00Z', api_provider: 'gemini', estimated_cost_usd: 2.0, request_count: 1 },
          { created_at: '2026-02-01T14:00:00Z', api_provider: 'gemini', estimated_cost_usd: 1.0, request_count: 1 },
          { created_at: '2026-02-02T10:00:00Z', api_provider: 'openai', estimated_cost_usd: 3.0, request_count: 1 },
        ],
        error: null,
      })

      const result = await getDailyBreakdown('2026-02')

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
      // 日付ごとにグループされていること
      const day1 = result.find((d: { date: string }) => d.date === '2026-02-01')
      expect(day1).toBeDefined()
      expect(day1!.gemini).toBeCloseTo(3.0)
    })
  })

  describe('getEndpointBreakdown', () => {
    it('エンドポイント別の内訳を返すこと', async () => {
      mockLte.mockResolvedValueOnce({
        data: [
          { api_endpoint: 'generate-image', api_provider: 'gemini', estimated_cost_usd: 5.0, request_count: 1 },
          { api_endpoint: 'generate-prompts', api_provider: 'gemini', estimated_cost_usd: 2.0, request_count: 1 },
          { api_endpoint: 'directions', api_provider: 'mapbox', estimated_cost_usd: 0, request_count: 10 },
        ],
        error: null,
      })

      const result = await getEndpointBreakdown('2026-02')

      expect(Array.isArray(result)).toBe(true)
      const imageGen = result.find((e: { endpoint: string }) => e.endpoint === 'generate-image')
      expect(imageGen).toBeDefined()
      expect(imageGen!.total_cost).toBeCloseTo(5.0)
    })
  })

  describe('getBudgetSettings', () => {
    it('全プロバイダーの予算設定を返すこと', async () => {
      mockSelect.mockResolvedValueOnce({
        data: [
          { api_provider: 'gemini', monthly_budget_usd: 50, alert_threshold_percent: 80 },
          { api_provider: 'openai', monthly_budget_usd: 30, alert_threshold_percent: 80 },
          { api_provider: 'mapbox', monthly_budget_usd: 20, alert_threshold_percent: 80 },
        ],
        error: null,
      })

      const result = await getBudgetSettings()

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(3)
      expect(result[0].api_provider).toBeDefined()
      expect(result[0].monthly_budget_usd).toBeDefined()
      expect(result[0].alert_threshold_percent).toBeDefined()
    })
  })

  describe('updateBudgetSettings', () => {
    it('予算設定を更新できること', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { api_provider: 'gemini', monthly_budget_usd: 100, alert_threshold_percent: 70 },
        error: null,
      })

      const result = await updateBudgetSettings('gemini', {
        monthly_budget_usd: 100,
        alert_threshold_percent: 70,
      })

      expect(result).toBeDefined()
      expect(result.monthly_budget_usd).toBe(100)
      expect(result.alert_threshold_percent).toBe(70)
    })

    it('無効なプロバイダー名の場合はエラーを投げること', async () => {
      await expect(
        updateBudgetSettings('invalid' as any, { monthly_budget_usd: 100 })
      ).rejects.toThrow()
    })
  })
})
