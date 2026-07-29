import { describe, it, expect } from 'vitest'
import {
  calculateCost,
  getModelPricing,
  calculateMapboxCost,
  estimateImageGenerationCost,
  calculateOpenAIImageGenerationCost,
  estimateMonthlyProjection,
  API_PRICING,
} from '@/lib/api-cost-calculator'

describe('api-cost-calculator', () => {
  describe('API_PRICING', () => {
    it('Gemini画像生成モデルの料金が定義されていること', () => {
      const pricing = getModelPricing('gemini', 'gemini-3-pro-image-preview')
      expect(pricing).toBeDefined()
      expect(pricing.inputPer1kTokens).toBeGreaterThan(0)
      expect(pricing.outputPer1kTokens).toBeGreaterThan(0)
    })

    it('Gemini Flashモデルの料金が定義されていること', () => {
      const pricing = getModelPricing('gemini', 'gemini-2.5-flash')
      expect(pricing).toBeDefined()
      expect(pricing.inputPer1kTokens).toBeGreaterThan(0)
      expect(pricing.outputPer1kTokens).toBeGreaterThan(0)
    })

    it('リアルタイム解析用 Gemini 3.5/3.6 Flash の料金が公表単価で定義されていること', () => {
      // Gemini 3.5 Flash: $1.50/M in, $9.00/M out / 3.6 Flash: $1.50/M in, $7.50/M out
      const flash35 = getModelPricing('gemini', 'gemini-3.5-flash')
      expect(flash35.inputPer1kTokens).toBeCloseTo(0.0015, 6)
      expect(flash35.outputPer1kTokens).toBeCloseTo(0.009, 6)

      const flash36 = getModelPricing('gemini', 'gemini-3.6-flash')
      expect(flash36.inputPer1kTokens).toBeCloseTo(0.0015, 6)
      expect(flash36.outputPer1kTokens).toBeCloseTo(0.0075, 6)
    })

    it('OpenAI gpt-4oモデルの料金が定義されていること', () => {
      const pricing = getModelPricing('openai', 'gpt-4o')
      expect(pricing).toBeDefined()
      expect(pricing.inputPer1kTokens).toBeGreaterThan(0)
      expect(pricing.outputPer1kTokens).toBeGreaterThan(0)
    })

    it('未知のモデルにはデフォルト料金を返すこと', () => {
      const pricing = getModelPricing('gemini', 'unknown-model')
      expect(pricing).toBeDefined()
      expect(pricing.inputPer1kTokens).toBeGreaterThan(0)
    })
  })

  describe('calculateCost', () => {
    it('入力・出力トークンからコストを正しく計算すること', () => {
      const cost = calculateCost({
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        inputTokens: 1000,
        outputTokens: 500,
      })
      expect(cost).toBeGreaterThan(0)
      expect(typeof cost).toBe('number')
      expect(Number.isFinite(cost)).toBe(true)
    })

    it('トークン数0の場合はコスト0を返すこと', () => {
      const cost = calculateCost({
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        inputTokens: 0,
        outputTokens: 0,
      })
      expect(cost).toBe(0)
    })

    it('入力のみのコスト計算が正しいこと', () => {
      const cost = calculateCost({
        provider: 'openai',
        model: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 0,
      })
      const pricing = getModelPricing('openai', 'gpt-4o')
      expect(cost).toBeCloseTo(pricing.inputPer1kTokens, 6)
    })

    it('出力のみのコスト計算が正しいこと', () => {
      const cost = calculateCost({
        provider: 'openai',
        model: 'gpt-4o',
        inputTokens: 0,
        outputTokens: 1000,
      })
      const pricing = getModelPricing('openai', 'gpt-4o')
      expect(cost).toBeCloseTo(pricing.outputPer1kTokens, 6)
    })

    it('大量のトークン数でも正確に計算できること', () => {
      const cost = calculateCost({
        provider: 'gemini',
        model: 'gemini-3-pro-image-preview',
        inputTokens: 100000,
        outputTokens: 50000,
      })
      expect(cost).toBeGreaterThan(0)
      expect(Number.isFinite(cost)).toBe(true)
    })
  })

  describe('estimateImageGenerationCost', () => {
    it('returns per-request price for known models', () => {
      const cost = estimateImageGenerationCost('gemini-2.5-flash-image')
      expect(cost).toBeCloseTo(0.04, 6)
    })

    it('falls back to default price for unknown models', () => {
      const cost = estimateImageGenerationCost('unknown-image-model')
      expect(cost).toBeCloseTo(0.04, 6)
    })

    it('scales linearly with requestCount', () => {
      const cost = estimateImageGenerationCost('gemini-3-pro-image-preview', 3)
      expect(cost).toBeCloseTo(0.12, 6)
    })

    it('returns 0 when requestCount is zero or negative', () => {
      expect(estimateImageGenerationCost('gemini-2.5-flash-image', 0)).toBe(0)
      expect(estimateImageGenerationCost('gemini-2.5-flash-image', -2)).toBe(0)
    })

    it('returns the Nano Banana 2 Lite per-image price', () => {
      const cost = estimateImageGenerationCost('gemini-3.1-flash-lite-image')
      expect(cost).toBeCloseTo(0.0336, 6)
    })
  })

  describe('calculateOpenAIImageGenerationCost', () => {
    it('calculates GPT Image 2 cost from image, text, and output tokens', () => {
      const cost = calculateOpenAIImageGenerationCost('gpt-image-2', {
        inputTokens: 1100,
        inputImageTokens: 1000,
        inputTextTokens: 100,
        outputTokens: 2000,
      })

      expect(cost).toBeCloseTo(0.0685, 8)
    })

    it('uses the request estimate when usage is unavailable', () => {
      expect(calculateOpenAIImageGenerationCost('gpt-image-2')).toBeCloseTo(0.053, 6)
    })

    it('uses token pricing for dated GPT Image 2 model aliases', () => {
      const cost = calculateOpenAIImageGenerationCost('gpt-image-2-2026-04-21', {
        inputTokens: 0,
        inputImageTokens: 0,
        inputTextTokens: 0,
        outputTokens: 1000,
      })

      expect(cost).toBeCloseTo(0.03, 8)
    })

    it('calculates GPT Image 1 overrides using their own token rates', () => {
      const cost = calculateOpenAIImageGenerationCost('gpt-image-1', {
        inputTokens: 1100,
        inputImageTokens: 1000,
        inputTextTokens: 100,
        outputTokens: 2000,
      })

      expect(cost).toBeCloseTo(0.0905, 8)
    })
  })

  describe('calculateMapboxCost', () => {
    it('無料枠内のリクエストはコスト0であること', () => {
      const cost = calculateMapboxCost('directions', 50000)
      expect(cost).toBe(0)
    })

    it('無料枠超過分のコストを正しく計算すること', () => {
      const cost = calculateMapboxCost('directions', 150000)
      expect(cost).toBeGreaterThan(0)
    })

    it('geocodeのコスト計算が正しいこと', () => {
      const cost = calculateMapboxCost('geocode', 200000)
      expect(cost).toBeGreaterThan(0)
    })

    it('リクエスト数0の場合はコスト0であること', () => {
      const cost = calculateMapboxCost('directions', 0)
      expect(cost).toBe(0)
    })
  })

  describe('estimateMonthlyProjection', () => {
    it('月途中の使用量から月末予測を算出すること', () => {
      const projection = estimateMonthlyProjection(10.0, 15)
      // 15日で$10 → 30日で約$20
      expect(projection).toBeGreaterThan(10)
      expect(projection).toBeLessThan(30)
    })

    it('月初日の場合は月全体に比例した予測を返すこと', () => {
      const projection = estimateMonthlyProjection(1.0, 1)
      expect(projection).toBeGreaterThan(1)
    })

    it('使用量0の場合は予測も0であること', () => {
      const projection = estimateMonthlyProjection(0, 15)
      expect(projection).toBe(0)
    })
  })
})
