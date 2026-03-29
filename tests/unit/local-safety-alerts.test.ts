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
import { shouldNotifyAlert } from '@/lib/push-notifications/notify-local-alert'
import {
  buildLocalAlertPushPayload,
  LOCAL_ALERT_CATEGORY_LABELS,
} from '@/lib/notifications/builders'

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

  it('1分前を正しく表示する', () => {
    const iso = new Date(Date.now() - 60_000).toISOString()
    expect(formatRelativeTime(iso)).toBe('1分前')
  })

  it('2時間前を正しく表示する', () => {
    const iso = new Date(Date.now() - 2 * 60 * 60_000).toISOString()
    expect(formatRelativeTime(iso)).toBe('2時間前')
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
// isBreakingAlert（3時間以内が新着）
// ---------------------------------------------------------------------------
describe('isBreakingAlert', () => {
  it('1時間前は新着と判定する', () => {
    const iso = new Date(Date.now() - 60 * 60_000).toISOString()
    expect(isBreakingAlert(iso)).toBe(true)
  })

  it('2時間前は新着と判定する', () => {
    const iso = new Date(Date.now() - 2 * 60 * 60_000).toISOString()
    expect(isBreakingAlert(iso)).toBe(true)
  })

  it('4時間前は新着ではないと判定する', () => {
    const iso = new Date(Date.now() - 4 * 60 * 60_000).toISOString()
    expect(isBreakingAlert(iso)).toBe(false)
  })

  it('25時間前は新着ではないと判定する', () => {
    const iso = new Date(Date.now() - 25 * 60 * 60_000).toISOString()
    expect(isBreakingAlert(iso)).toBe(false)
  })

  it('未来時刻は新着扱いしない', () => {
    const iso = new Date(Date.now() + 60 * 60_000).toISOString()
    expect(isBreakingAlert(iso)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// shouldNotifyAlert
// ---------------------------------------------------------------------------
describe('shouldNotifyAlert', () => {
  it('suspicious はプッシュ通知対象', () => {
    expect(shouldNotifyAlert('suspicious')).toBe(true)
  })

  it('voice_call はプッシュ通知対象', () => {
    expect(shouldNotifyAlert('voice_call')).toBe(true)
  })

  it('following はプッシュ通知対象外', () => {
    expect(shouldNotifyAlert('following')).toBe(false)
  })

  it('other はプッシュ通知対象外', () => {
    expect(shouldNotifyAlert('other')).toBe(false)
  })

  it('不明な値はプッシュ通知対象外', () => {
    expect(shouldNotifyAlert('unknown')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// LOCAL_ALERT_CATEGORY_LABELS
// ---------------------------------------------------------------------------
describe('LOCAL_ALERT_CATEGORY_LABELS', () => {
  it('全カテゴリのラベルが定義されている', () => {
    expect(LOCAL_ALERT_CATEGORY_LABELS.suspicious).toBe('不審者情報')
    expect(LOCAL_ALERT_CATEGORY_LABELS.voice_call).toBe('声かけ事案')
    expect(LOCAL_ALERT_CATEGORY_LABELS.following).toBe('つきまとい')
    expect(LOCAL_ALERT_CATEGORY_LABELS.other).toBe('その他')
  })
})

// ---------------------------------------------------------------------------
// buildLocalAlertPushPayload
// ---------------------------------------------------------------------------
describe('buildLocalAlertPushPayload', () => {
  it('タイトルに都道府県・市区町村・カテゴリラベルを含む', () => {
    const payload = buildLocalAlertPushPayload({
      alertId: 'test-id',
      category: 'suspicious',
      prefecture: '東京都',
      city: '世田谷区',
      description: 'テスト不審者情報です',
    })
    expect(payload.title).toContain('東京都')
    expect(payload.title).toContain('世田谷区')
    expect(payload.title).toContain('不審者情報')
  })

  it('city が null の場合は都道府県のみ', () => {
    const payload = buildLocalAlertPushPayload({
      alertId: 'test-id-2',
      category: 'voice_call',
      prefecture: '大阪府',
      city: null,
      description: '声かけ事案です',
    })
    expect(payload.title).toContain('大阪府')
    expect(payload.title).not.toContain('null')
    expect(payload.title).toContain('声かけ事案')
  })

  it('tag に alertId が含まれる', () => {
    const payload = buildLocalAlertPushPayload({
      alertId: 'abc-123',
      category: 'following',
      prefecture: '福岡県',
      city: null,
      description: 'つきまとい事案です',
    })
    expect(payload.tag).toBe('local-alert-abc-123')
  })

  it('data.type が local_alerts', () => {
    const payload = buildLocalAlertPushPayload({
      alertId: 'xyz',
      category: 'other',
      prefecture: '神奈川県',
      city: '横浜市',
      description: 'その他の事案です',
    })
    expect(payload.data.type).toBe('local_alerts')
  })

  it('80文字を超える説明は省略される', () => {
    const longDesc = 'あ'.repeat(100)
    const payload = buildLocalAlertPushPayload({
      alertId: 'long',
      category: 'suspicious',
      prefecture: '愛知県',
      city: null,
      description: longDesc,
    })
    expect(payload.body.endsWith('…')).toBe(true)
    expect(payload.body.length).toBeLessThanOrEqual(82) // 80文字 + "…"
  })

  it('80文字以下の説明はそのまま', () => {
    const shortDesc = 'テスト説明文です'
    const payload = buildLocalAlertPushPayload({
      alertId: 'short',
      category: 'voice_call',
      prefecture: '北海道',
      city: '札幌市',
      description: shortDesc,
    })
    expect(payload.body).toBe(shortDesc)
  })
})
