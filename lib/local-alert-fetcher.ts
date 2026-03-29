import { z } from 'zod'
import { getSanitizedGeminiApiKey } from './gemini-util'

export type LocalAlertCategory = 'suspicious' | 'voice_call' | 'following' | 'other'

const CATEGORY_MAP: Record<string, LocalAlertCategory> = {
  '声かけ': 'voice_call',
  '声掛け': 'voice_call',
  'つきまとい': 'following',
  '不審者': 'suspicious',
  'その他': 'other',
}

export const LocalAlertInputSchema = z.object({
  prefecture: z.string().min(2).max(10),
  city: z.string().min(1).max(30).nullable(),
  category: z.enum(['suspicious', 'voice_call', 'following', 'other']),
  description: z.string().min(10).max(500),
  source_url: z.string().url().nullable(),
  occurred_at: z.string().datetime({ offset: true }),
})

export type LocalAlertInput = z.infer<typeof LocalAlertInputSchema>
export type LocalAlertStorageInput = Omit<LocalAlertInput, 'city'> & { city: string }

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_MODEL = 'gemini-2.5-flash'

const SEARCH_PROMPT = `過去24時間以内に日本国内で発生した「声かけ事案」「不審者情報」「つきまとい」などの
登下校・子ども安全に関するニュースを最大10件検索して、以下のJSON配列形式で返してください。

[
  {
    "prefecture": "都道府県名（例: 東京都）",
    "city": "市区町村名（不明な場合は null）",
    "category": "suspicious | voice_call | following | other",
    "description": "事案の概要（100字以内）",
    "source_url": "記事URL（不明な場合は null）",
    "occurred_at": "ISO8601形式の発生日時（不明な場合は検索時点のJST時刻。未来時刻は不可）"
  }
]

categoryの選択基準:
- suspicious: 不審者・不審な人物
- voice_call: 声かけ・声掛け事案
- following: つきまとい・ストーキング
- other: その他

JSONのみ返してください。説明文は不要です。`

export function inferCategory(text: string): LocalAlertCategory {
  for (const [keyword, category] of Object.entries(CATEGORY_MAP)) {
    if (text.includes(keyword)) return category
  }
  return 'other'
}

export function parseGeminiAlertResponse(text: string): LocalAlertInput[] {
  if (!text.trim()) return []

  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ?? text.match(/(\[[\s\S]*\])/)
  const rawJson = jsonMatch ? jsonMatch[1] : text.trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(rawJson)
  } catch {
    console.error('[local-alert-fetcher] JSON parse error', rawJson.slice(0, 200))
    return []
  }

  if (!Array.isArray(parsed)) {
    console.error('[local-alert-fetcher] Expected array, got', typeof parsed)
    return []
  }

  return parsed.flatMap((item: unknown) => {
    const result = LocalAlertInputSchema.safeParse(item)
    if (!result.success) {
      console.error('[local-alert-fetcher] Schema validation failed', result.error.issues, item)
      return []
    }
    return [result.data]
  })
}

export function normalizeAlertForStorage(alert: LocalAlertInput): LocalAlertStorageInput {
  return {
    ...alert,
    city: alert.city ?? '',
    occurred_at: clampOccurredAtToNow(alert.occurred_at),
  }
}

export async function fetchLocalAlertsFromGemini(): Promise<LocalAlertStorageInput[]> {
  let apiKey: string
  try {
    apiKey = getSanitizedGeminiApiKey()
  } catch (err) {
    console.error('[local-alert-fetcher] API key error', err)
    return []
  }

  const url = `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`
  const body = {
    contents: [{ parts: [{ text: SEARCH_PROMPT }] }],
    tools: [{ googleSearch: {} }],
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err) {
    console.error('[local-alert-fetcher] Network error', err)
    return []
  }

  if (!response.ok) {
    console.error('[local-alert-fetcher] Gemini API error', response.status, await response.text())
    return []
  }

  let data: unknown
  try {
    data = await response.json()
  } catch (err) {
    console.error('[local-alert-fetcher] Response parse error', err)
    return []
  }

  const text = extractTextFromGeminiResponse(data)
  if (!text) {
    console.error('[local-alert-fetcher] No text in Gemini response', JSON.stringify(data).slice(0, 300))
    return []
  }

  return parseGeminiAlertResponse(text).map(normalizeAlertForStorage)
}

function clampOccurredAtToNow(occurredAt: string): string {
  const timestamp = new Date(occurredAt).getTime()
  if (Number.isNaN(timestamp)) return new Date().toISOString()

  const now = Date.now()
  return new Date(Math.min(timestamp, now)).toISOString()
}

function extractTextFromGeminiResponse(data: unknown): string | null {
  if (
    typeof data !== 'object' ||
    data === null ||
    !('candidates' in data) ||
    !Array.isArray((data as Record<string, unknown>).candidates)
  ) {
    return null
  }

  const candidates = (data as { candidates: unknown[] }).candidates
  const first = candidates[0]
  if (
    typeof first !== 'object' ||
    first === null ||
    !('content' in first)
  ) {
    return null
  }

  const content = (first as { content: unknown }).content
  if (
    typeof content !== 'object' ||
    content === null ||
    !('parts' in content) ||
    !Array.isArray((content as Record<string, unknown>).parts)
  ) {
    return null
  }

  const parts = (content as { parts: unknown[] }).parts
  const textPart = parts.find(
    (p): p is { text: string } =>
      typeof p === 'object' && p !== null && 'text' in p && typeof (p as Record<string, unknown>).text === 'string'
  )

  return textPart?.text ?? null
}
