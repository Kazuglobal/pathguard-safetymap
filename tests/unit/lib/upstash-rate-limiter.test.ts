import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  checkImageGenerationRateLimit,
  checkGeminiRateLimit,
} from '@/lib/upstash-rate-limiter'

const upstashMocks = vi.hoisted(() => ({
  limit: vi.fn(),
  slidingWindow: vi.fn(() => 'sliding-window-config'),
}))

vi.mock('@upstash/ratelimit', () => {
  class Ratelimit {
    static slidingWindow = upstashMocks.slidingWindow
    limit = upstashMocks.limit
  }
  return { Ratelimit }
})

vi.mock('@upstash/redis', () => ({
  Redis: class Redis {},
}))

describe('upstash-rate-limiter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://example.upstash.test')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'test-token')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('Upstash 未設定なら allow-all で成功する(graceful fallback)', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '')

    const result = await checkGeminiRateLimit('user-1')

    expect(result).toEqual({ success: true })
    expect(upstashMocks.limit).not.toHaveBeenCalled()
  })

  it('制限内なら success:true を返す', async () => {
    upstashMocks.limit.mockResolvedValueOnce({ success: true, reset: 0 })

    const result = await checkGeminiRateLimit('user-1')

    expect(result).toEqual({ success: true })
    expect(upstashMocks.limit).toHaveBeenCalledWith('user-1')
  })

  it('超過なら success:false と reset を返す', async () => {
    upstashMocks.limit.mockResolvedValueOnce({ success: false, reset: 1234567890 })

    const result = await checkGeminiRateLimit('user-1')

    expect(result).toEqual({ success: false, reset: 1234567890 })
  })

  it('Upstash 到達不能(limit の reject)でも fail-open で成功する — レート制限障害で本体機能を止めない回帰テスト', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    upstashMocks.limit.mockRejectedValueOnce(new Error('fetch failed'))

    const result = await checkImageGenerationRateLimit('user-1')

    expect(result).toEqual({ success: true })
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[rate-limit]'),
      expect.any(Error)
    )
    errorSpy.mockRestore()
  })

  it('画像生成の制限値は正規フローの最大バースト(手動解析5回+一括生成9回)を許容する', async () => {
    upstashMocks.limit.mockResolvedValueOnce({ success: true, reset: 0 })

    await checkImageGenerationRateLimit('user-1')

    // 1操作で複数リクエストを発行する正規フローが 429 にならないよう、
    // requests >= 14(5+9) かつ短すぎない窓であることを契約として固定する
    expect(upstashMocks.slidingWindow).toHaveBeenCalledWith(15, '300 s')
  })
})
