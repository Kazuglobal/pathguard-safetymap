import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  inferCategory,
  parseGeminiAlertResponse,
  normalizeAlertForStorage,
} from '@/lib/local-alert-fetcher'
import {
  formatRelativeTime,
  isBreakingAlert,
} from '@/hooks/use-local-safety-alerts'

afterEach(() => {
  vi.useRealTimers()
})

// ---------------------------------------------------------------------------
// inferCategory
// ---------------------------------------------------------------------------
describe('inferCategory', () => {
  it('「声かけ」を voice_call に分類する', () => {
    expect(inferCategory('声かけ事案が発生しました')).toBe('voice_call')
  })

  it('「声掛け」を voice_call に分類する', () => {
    expect(inferCategory('声掛けがありました')).toBe('voice_call')
  })

  it('「不審者」を suspicious に分類する', () => {
    expect(inferCategory('不審者が目撃されました')).toBe('suspicious')
  })

  it('「つきまとい」を following に分類する', () => {
    expect(inferCategory('つきまとい被害の報告')).toBe('following')
  })

  it('該当キーワードがない場合は other を返す', () => {
    expect(inferCategory('交通事故が発生しました')).toBe('other')
  })
})

// ---------------------------------------------------------------------------
// parseGeminiAlertResponse
// ---------------------------------------------------------------------------
describe('parseGeminiAlertResponse', () => {
  const validItem = {
    prefecture: '東京都',
    city: '新宿区',
    category: 'suspicious',
    description: '公園付近で不審者が目撃されました。',
    source_url: 'https://example.com/news/1',
    occurred_at: '2026-03-29T10:00:00+09:00',
  }

  it('正常なJSON配列をパースできる', () => {
    const result = parseGeminiAlertResponse(JSON.stringify([validItem]))
    expect(result).toHaveLength(1)
    expect(result[0].prefecture).toBe('東京都')
    expect(result[0].category).toBe('suspicious')
  })

  it('```json ... ``` ブロックをパースできる', () => {
    const text = '```json\n' + JSON.stringify([validItem]) + '\n```'
    const result = parseGeminiAlertResponse(text)
    expect(result).toHaveLength(1)
  })

  it('source_url が null でも許容する', () => {
    const item = { ...validItem, source_url: null }
    const result = parseGeminiAlertResponse(JSON.stringify([item]))
    expect(result[0].source_url).toBeNull()
  })

  it('city が null でも許容する', () => {
    const item = { ...validItem, city: null }
    const result = parseGeminiAlertResponse(JSON.stringify([item]))
    expect(result[0].city).toBeNull()
  })

  it('スキーマ不正なアイテムはスキップする', () => {
    const invalid = { prefecture: '東京都' } // 必須フィールド欠如
    const result = parseGeminiAlertResponse(JSON.stringify([invalid, validItem]))
    expect(result).toHaveLength(1)
    expect(result[0].prefecture).toBe('東京都')
  })

  it('空文字列は空配列を返す', () => {
    expect(parseGeminiAlertResponse('')).toEqual([])
  })

  it('不正なJSONは空配列を返す', () => {
    expect(parseGeminiAlertResponse('not json')).toEqual([])
  })

  it('配列でないJSONは空配列を返す', () => {
    expect(parseGeminiAlertResponse('{"foo":"bar"}')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// normalizeAlertForStorage
// ---------------------------------------------------------------------------
describe('normalizeAlertForStorage', () => {
  const baseAlert = {
    prefecture: '東京都',
    city: null,
    category: 'suspicious' as const,
    description: '公園付近で不審者が目撃されました。',
    source_url: 'https://example.com/news/1',
    occurred_at: '2026-03-29T10:00:00+09:00',
  }

  it('city が null の場合は空文字に正規化する', () => {
    expect(normalizeAlertForStorage(baseAlert).city).toBe('')
  })

  it('未来時刻は現在時刻まで丸める', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-29T09:00:00+09:00'))

    const normalized = normalizeAlertForStorage({
      ...baseAlert,
      occurred_at: '2026-03-29T12:00:00+09:00',
    })

    expect(normalized.occurred_at).toBe('2026-03-29T00:00:00.000Z')
  })
})

// ---------------------------------------------------------------------------
// formatRelativeTime
// ---------------------------------------------------------------------------
describe('formatRelativeTime', () => {
  it('30分前を正しく表示する', () => {
    const iso = new Date(Date.now() - 30 * 60_000).toISOString()
    expect(formatRelativeTime(iso)).toBe('30分前')
  })

  it('3時間前を正しく表示する', () => {
    const iso = new Date(Date.now() - 3 * 60 * 60_000).toISOString()
    expect(formatRelativeTime(iso)).toBe('3時間前')
  })

  it('2日前を正しく表示する', () => {
    const iso = new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString()
    expect(formatRelativeTime(iso)).toBe('2日前')
  })

  it('未来時刻は「たった今」として扱う', () => {
    const iso = new Date(Date.now() + 30 * 60_000).toISOString()
    expect(formatRelativeTime(iso)).toBe('たった今')
  })
})

// ---------------------------------------------------------------------------
// isBreakingAlert
// ---------------------------------------------------------------------------
describe('isBreakingAlert', () => {
  it('1時間前は速報と判定する', () => {
    const iso = new Date(Date.now() - 60 * 60_000).toISOString()
    expect(isBreakingAlert(iso)).toBe(true)
  })

  it('25時間前は速報ではないと判定する', () => {
    const iso = new Date(Date.now() - 25 * 60 * 60_000).toISOString()
    expect(isBreakingAlert(iso)).toBe(false)
  })

  it('未来時刻は速報扱いしない', () => {
    const iso = new Date(Date.now() + 60 * 60_000).toISOString()
    expect(isBreakingAlert(iso)).toBe(false)
  })
})
