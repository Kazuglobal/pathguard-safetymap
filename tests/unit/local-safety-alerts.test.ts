import { describe, it, expect } from 'vitest'
import {
  formatRelativeTime,
  isBreakingAlert,
} from '@/hooks/use-local-safety-alerts'
import { shouldNotifyAlert } from '@/lib/push-notifications/notify-local-alert'
import {
  buildLocalAlertPushPayload,
  LOCAL_ALERT_CATEGORY_LABELS,
} from '@/lib/notifications/builders'

// --- formatRelativeTime ---

describe('formatRelativeTime', () => {
  it('30分前を正しくフォーマットする', () => {
    const t = new Date(Date.now() - 30 * 60_000).toISOString()
    expect(formatRelativeTime(t)).toBe('30分前')
  })

  it('1分前を正しくフォーマットする', () => {
    const t = new Date(Date.now() - 60_000).toISOString()
    expect(formatRelativeTime(t)).toBe('1分前')
  })

  it('2時間前を正しくフォーマットする', () => {
    const t = new Date(Date.now() - 2 * 60 * 60_000).toISOString()
    expect(formatRelativeTime(t)).toBe('2時間前')
  })

  it('25時間前を正しくフォーマットする', () => {
    const t = new Date(Date.now() - 25 * 60 * 60_000).toISOString()
    expect(formatRelativeTime(t)).toBe('1日前')
  })
})

// --- isBreakingAlert ---

describe('isBreakingAlert', () => {
  it('1時間前のアラートは速報', () => {
    const t = new Date(Date.now() - 60 * 60_000).toISOString()
    expect(isBreakingAlert(t)).toBe(true)
  })

  it('23時間前のアラートは速報', () => {
    const t = new Date(Date.now() - 23 * 60 * 60_000).toISOString()
    expect(isBreakingAlert(t)).toBe(true)
  })

  it('25時間前のアラートは速報ではない', () => {
    const t = new Date(Date.now() - 25 * 60 * 60_000).toISOString()
    expect(isBreakingAlert(t)).toBe(false)
  })
})

// --- shouldNotifyAlert ---

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

// --- LOCAL_ALERT_CATEGORY_LABELS ---

describe('LOCAL_ALERT_CATEGORY_LABELS', () => {
  it('全カテゴリのラベルが定義されている', () => {
    expect(LOCAL_ALERT_CATEGORY_LABELS.suspicious).toBe('不審者情報')
    expect(LOCAL_ALERT_CATEGORY_LABELS.voice_call).toBe('声かけ事案')
    expect(LOCAL_ALERT_CATEGORY_LABELS.following).toBe('つきまとい')
    expect(LOCAL_ALERT_CATEGORY_LABELS.other).toBe('その他')
  })
})

// --- buildLocalAlertPushPayload ---

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
