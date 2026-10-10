import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextResponse } from 'next/server'

import { getActor } from '@/lib/auth/actor'
import { callClaudeVision, hasClaudeApiKey } from '@/lib/claude-vision'
import { getDangerReportById } from '@/lib/db/repos/danger-reports.repo'
import { callGeminiVision } from '@/lib/gemini-hazard'
import { checkGeminiRateLimit, rateLimitedResponse } from '@/lib/upstash-rate-limiter'
import { isVlmAnalysisResult, normalizeVlmAnalysisResult } from '@/lib/vlm-analysis'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_CONTEXT_LENGTH = 1_200

interface MediaObject {
  size: number
  httpMetadata?: { contentType?: string }
  arrayBuffer(): Promise<ArrayBuffer>
}
interface MediaBucket { get(key: string): Promise<MediaObject | null> }

const PROMPT = (context: string) => `あなたは通学路の安全分析の専門家です。添付写真を、子どもの身長（110〜140cm）、ランドセルや傘、注意力、集団登下校、朝夕・悪天候の観点で評価してください。

追加情報: ${context || 'なし'}

危険要因は重要なものから最大8件に絞り、各説明は簡潔にしてください。
categoryは例に並べた値のうち1つを選び、severityとoverall_risk_levelは1〜5、overall_safety_scoreは0〜100の整数にしてください。次のJSONだけを返してください。
{
  "hazards":[{"category":"traffic|visibility|pedestrian_space|barriers|lighting|terrain|infrastructure|crossings|signage|environmental|social|emergency|behavioral|surveillance|maintenance","severity":1,"description_ja":"","description_en":"","child_specific_risk":"","recommendation":""}],
  "overall_safety_score":0,
  "overall_risk_level":1,
  "child_perspective_summary":"",
  "time_weather_risks":{"morning_commute":"","evening_return":"","rainy_conditions":"","winter_conditions":""},
  "improvement_suggestions":{"immediate_actions":[],"medium_term_improvements":[],"community_involvement":[]}
}`

function parseJson(text: string): unknown {
  const candidate = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('Invalid AI response format')
  return JSON.parse(candidate.slice(start, end + 1))
}

export async function POST(request: Request) {
  const actor = await getActor()
  if (actor.kind !== 'user') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rate = await checkGeminiRateLimit(`vlm-analyze:${actor.id}`)
  if (!rate.success) return rateLimitedResponse(rate.reset)
  try {
    const body = await request.json() as Record<string, unknown>
    const reportId = typeof body.report_id === 'string' ? body.report_id.trim() : ''
    const context = typeof body.additional_context === 'string' ? body.additional_context.trim() : ''
    if (!reportId || reportId.length > 128 || context.length > MAX_CONTEXT_LENGTH) {
      return NextResponse.json({ error: 'Invalid request payload' }, { status: 400 })
    }
    const report = await getDangerReportById(actor, reportId)
    if (!report || report.userId !== actor.id) {
      return NextResponse.json({ error: 'Report not found or not accessible' }, { status: 403 })
    }
    const imageKey = report.imageKey ?? report.processedImageKeys[0] ?? report.processedImageKey
    if (!imageKey) return NextResponse.json({ error: 'Report image not found' }, { status: 404 })
    const { env } = getCloudflareContext()
    const object = await (env as unknown as { MEDIA_PRIVATE: MediaBucket }).MEDIA_PRIVATE.get(imageKey)
    if (!object) return NextResponse.json({ error: 'Report image not found' }, { status: 404 })
    if (object.size <= 0 || object.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: `Image is too large for AI analysis (max ${MAX_IMAGE_BYTES} bytes)` }, { status: 400 })
    }
    const contentType = object.httpMetadata?.contentType ?? 'image/webp'
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(contentType)) {
      return NextResponse.json({ error: 'Unsupported image format' }, { status: 400 })
    }
    const base64 = Buffer.from(await object.arrayBuffer()).toString('base64')
    // ANTHROPIC_API_KEY があれば Claude Haiku、無ければ従来どおり Gemini を使う。
    const responseText = hasClaudeApiKey()
      ? await callClaudeVision({
        base64,
        mediaType: contentType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        prompt: PROMPT(context),
      })
      : await callGeminiVision(
        `data:${contentType};base64,${base64}`,
        PROMPT(context),
        { temperature: 0.1, responseMimeType: 'application/json' },
      )
    const analysis = normalizeVlmAnalysisResult(parseJson(responseText))
    if (!isVlmAnalysisResult(analysis)) {
      console.error('[api/vlm/analyze-hazard] schema mismatch after normalization')
      return NextResponse.json({ error: 'Invalid AI response schema' }, { status: 502 })
    }
    return NextResponse.json({ success: true, analysis, analysis_id: crypto.randomUUID() })
  } catch (error) {
    // APIエラー本文にはリクエスト情報が含まれ得るため、分類のみ記録する。
    const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : null
    const name = error instanceof Error ? error.name : 'UnknownError'
    console.error('[api/vlm/analyze-hazard] failed', { name, status })
    const message = name.includes('Timeout') || name === 'AbortError'
      ? '分析に時間がかかっています。少し時間をおいて再試行してください。'
      : status === 429
        ? '分析が混み合っています。少し時間をおいて再試行してください。'
        : '画像の分析を完了できませんでした。報告は保存されています。再試行してください。'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
