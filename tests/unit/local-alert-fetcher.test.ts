import { describe, it, expect } from 'vitest'
import {
  parseGeminiAlertResponse,
  inferCategory,
  LocalAlertInputSchema,
} from '@/lib/local-alert-fetcher'

// --- parseGeminiAlertResponse ---

describe('parseGeminiAlertResponse', () => {
  it('正常なJSON配列を正しくパースできる', () => {
    const input = JSON.stringify([
      {
        prefecture: '東京都',
        city: '世田谷区',
        category: 'suspicious',
        description: '不審な男性が小学生に声をかけた事案が発生しました。',
        source_url: 'https://example.com/news/1',
        occurred_at: '2026-03-29T12:00:00+09:00',
      },
    ])
    const result = parseGeminiAlertResponse(input)
    expect(result).toHaveLength(1)
    expect(result[0].prefecture).toBe('東京都')
    expect(result[0].category).toBe('suspicious')
  })

  it('```json フェンスで囲まれた形式もパースできる', () => {
    const input = `\`\`\`json
[
  {
    "prefecture": "大阪府",
    "city": "堺市",
    "category": "voice_call",
    "description": "下校中の児童に声をかけた不審者が目撃されました。",
    "source_url": null,
    "occurred_at": "2026-03-29T15:00:00+09:00"
  }
]
\`\`\``
    const result = parseGeminiAlertResponse(input)
    expect(result).toHaveLength(1)
    expect(result[0].prefecture).toBe('大阪府')
    expect(result[0].city).toBe('堺市')
  })

  it('不正なエントリはスキップされ、他のエントリは返る', () => {
    const input = JSON.stringify([
      {
        prefecture: '東京都',
        city: '渋谷区',
        category: 'suspicious',
        description: '短い', // 10文字未満 → スキップ
        source_url: null,
        occurred_at: '2026-03-29T12:00:00+09:00',
      },
      {
        prefecture: '神奈川県',
        city: '横浜市',
        category: 'following',
        description: '下校中の女子小学生がつきまとわれた事案が報告されています。',
        source_url: null,
        occurred_at: '2026-03-29T14:00:00+09:00',
      },
    ])
    const result = parseGeminiAlertResponse(input)
    expect(result).toHaveLength(1)
    expect(result[0].prefecture).toBe('神奈川県')
  })

  it('空文字列は空配列を返す', () => {
    const result = parseGeminiAlertResponse('')
    expect(result).toEqual([])
  })

  it('occurred_at が不正な形式のエントリはスキップされる', () => {
    const input = JSON.stringify([
      {
        prefecture: '福岡県',
        city: '福岡市',
        category: 'suspicious',
        description: '不審者が公園付近で目撃された情報が寄せられました。',
        source_url: null,
        occurred_at: '2026年3月29日', // ISO8601 ではない → スキップ
      },
      {
        prefecture: '愛知県',
        city: '名古屋市',
        category: 'voice_call',
        description: '登校中の児童が知らない男性から声をかけられる事案が発生しました。',
        source_url: 'https://example.com/news/2',
        occurred_at: '2026-03-29T09:00:00+09:00',
      },
    ])
    const result = parseGeminiAlertResponse(input)
    expect(result).toHaveLength(1)
    expect(result[0].prefecture).toBe('愛知県')
  })
})

// --- inferCategory ---

describe('inferCategory', () => {
  it('"声かけ事案" は voice_call を返す', () => {
    expect(inferCategory('声かけ事案が発生しました')).toBe('voice_call')
  })

  it('"不審者情報" は suspicious を返す', () => {
    expect(inferCategory('不審者が目撃されました')).toBe('suspicious')
  })

  it('"つきまとい" は following を返す', () => {
    expect(inferCategory('つきまとい行為が報告されました')).toBe('following')
  })

  it('"その他" は other を返す', () => {
    expect(inferCategory('その他の事案です')).toBe('other')
  })

  it('不明なテキストは other を返す', () => {
    expect(inferCategory('全く関係のない文章です')).toBe('other')
  })
})

// --- LocalAlertInputSchema ---

describe('LocalAlertInputSchema', () => {
  const validData = {
    prefecture: '東京都',
    city: '港区',
    category: 'suspicious' as const,
    description: '不審な人物が公園付近で目撃されました。',
    source_url: 'https://example.com/news/123',
    occurred_at: '2026-03-29T12:00:00+09:00',
  }

  it('正常なデータはパースできる', () => {
    const result = LocalAlertInputSchema.safeParse(validData)
    expect(result.success).toBe(true)
  })

  it('city が null でも許容される', () => {
    const result = LocalAlertInputSchema.safeParse({ ...validData, city: null })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.city).toBeNull()
    }
  })

  it('source_url が null でも許容される', () => {
    const result = LocalAlertInputSchema.safeParse({ ...validData, source_url: null })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.source_url).toBeNull()
    }
  })

  it('description が10文字未満はエラー', () => {
    const result = LocalAlertInputSchema.safeParse({ ...validData, description: '短すぎる' })
    expect(result.success).toBe(false)
  })

  it('prefecture が1文字はエラー', () => {
    const result = LocalAlertInputSchema.safeParse({ ...validData, prefecture: '東' })
    expect(result.success).toBe(false)
  })
})
