import { describe, it, expect, vi, beforeEach } from 'vitest'

// Supabase adminクライアントをモック
const mockInsert = vi.fn().mockResolvedValue({ error: null })
const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert })

vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

// コスト計算をモック
vi.mock('@/lib/api-cost-calculator', () => ({
  calculateCost: vi.fn().mockReturnValue(0.005),
  calculateMapboxCost: vi.fn().mockReturnValue(0),
}))

import { logApiUsage, type ApiUsageEntry } from '@/lib/api-usage-logger'

describe('api-usage-logger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('logApiUsage', () => {
    it('Gemini APIの使用ログを正しく記録すること', () => {
      const entry: ApiUsageEntry = {
        api_provider: 'gemini',
        api_endpoint: 'generate-image',
        model_name: 'gemini-3-pro-image-preview',
        input_tokens: 500,
        output_tokens: 200,
        success: true,
      }

      logApiUsage(entry)

      expect(mockFrom).toHaveBeenCalledWith('api_usage_logs')
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          api_provider: 'gemini',
          api_endpoint: 'generate-image',
          model_name: 'gemini-3-pro-image-preview',
          input_tokens: 500,
          output_tokens: 200,
          success: true,
        })
      )
    })

    it('OpenAI APIの使用ログを正しく記録すること', () => {
      const entry: ApiUsageEntry = {
        api_provider: 'openai',
        api_endpoint: 'hazard-analyze',
        model_name: 'gpt-4o',
        input_tokens: 1000,
        output_tokens: 300,
        success: true,
      }

      logApiUsage(entry)

      expect(mockFrom).toHaveBeenCalledWith('api_usage_logs')
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          api_provider: 'openai',
          api_endpoint: 'hazard-analyze',
        })
      )
    })

    it('Mapbox APIの使用ログをリクエスト数で記録すること', () => {
      const entry: ApiUsageEntry = {
        api_provider: 'mapbox',
        api_endpoint: 'directions',
        request_count: 1,
        success: true,
      }

      logApiUsage(entry)

      expect(mockFrom).toHaveBeenCalledWith('api_usage_logs')
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          api_provider: 'mapbox',
          api_endpoint: 'directions',
          request_count: 1,
        })
      )
    })

    it('エラー発生時のログを記録できること', () => {
      const entry: ApiUsageEntry = {
        api_provider: 'gemini',
        api_endpoint: 'generate-image',
        success: false,
        error_message: 'API quota exceeded',
      }

      logApiUsage(entry)

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error_message: 'API quota exceeded',
        })
      )
    })

    it('estimated_cost_usdが自動計算されること', () => {
      const entry: ApiUsageEntry = {
        api_provider: 'gemini',
        api_endpoint: 'generate-prompts',
        model_name: 'gemini-2.5-flash',
        input_tokens: 2000,
        output_tokens: 1000,
        success: true,
      }

      logApiUsage(entry)

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          estimated_cost_usd: expect.any(Number),
        })
      )
    })

    it('DB挿入エラーが発生してもクラッシュしないこと', () => {
      mockInsert.mockResolvedValueOnce({ error: { message: 'DB error' } })

      const entry: ApiUsageEntry = {
        api_provider: 'gemini',
        api_endpoint: 'generate-image',
        success: true,
      }

      // fire-and-forget なのでエラーを投げない
      expect(() => logApiUsage(entry)).not.toThrow()
    })

    it('デフォルト値が正しく設定されること', () => {
      const entry: ApiUsageEntry = {
        api_provider: 'mapbox',
        api_endpoint: 'geocode',
      }

      logApiUsage(entry)

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          api_provider: 'mapbox',
          api_endpoint: 'geocode',
          request_count: expect.any(Number),
          success: true,
        })
      )
    })
  })
})
