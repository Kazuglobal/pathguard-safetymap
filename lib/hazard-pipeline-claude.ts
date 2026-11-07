// =============================================
// ハザードゲームの画像解析: Claude(Haiku 5.5)への依頼と座標の変換
// analyzeImagePipeline(lib/gemini-hazard.ts)が preferClaude のときだけ先に使い、
// キーが無い・画像を読めない・失敗・読めない JSON のときは null を返して Gemini に任せる。
// Claude はピクセル座標がいちばん正確なので、positions を {x1,y1,x2,y2}(ピクセル)で受け、
// アプリの正規化 {x,y,width,height}(0..1)へ直す。
// このモジュールは gemini-hazard.ts を import しない(循環を作らない)。
// =============================================

import { callClaudeVision, type ClaudeUsage } from "@/lib/claude-vision"
import { prepareClaudeImage } from "@/lib/vision/claude-image"
import type { ImageSize } from "@/lib/vision/image-size"
import { pixelBoxToRegion } from "@/lib/vision/pixel-coords"

/** Claude を 1 回呼んだ記録(使用量のログ用)。ok=false は応答を使わず Gemini に切り替えたとき。 */
export interface ClaudeAttemptUsage extends ClaudeUsage {
  readonly model: string
  readonly ok: boolean
}

const CATEGORIES = ["safety_equipment", "hazards", "traffic", "obstructions"] as const
const CLAUDE_PIPELINE_TIMEOUT_MS = 30_000
const CLAUDE_PIPELINE_MAX_TOKENS = 8000

/** 正規化 {x,y,width,height} の例を、画像の大きさに合わせたピクセル {x1,y1,x2,y2} の例へ書き換える。 */
export function toPixelPositionsExample(schemaJson: string, size: ImageSize): string {
  const raw = JSON.parse(schemaJson) as Record<string, unknown>
  return JSON.stringify(mapPositions(raw, (p) => normalizedToPixel(p, size)), null, 2)
}

function normalizedToPixel(p: Record<string, unknown>, size: ImageSize): Record<string, number> {
  const x = Number(p.x)
  const y = Number(p.y)
  const w = Number(p.width)
  const h = Number(p.height)
  return {
    x1: Math.round(x * size.width),
    y1: Math.round(y * size.height),
    x2: Math.round((x + w) * size.width),
    y2: Math.round((y + h) * size.height),
  }
}

/** vision の各カテゴリの positions だけを写す(入力は変えない)。 */
function mapPositions(
  raw: Record<string, unknown>,
  fn: (p: Record<string, unknown>) => unknown,
): Record<string, unknown> {
  const vision = raw.vision && typeof raw.vision === "object" ? (raw.vision as Record<string, unknown>) : null
  if (!vision) return raw
  const mapped = Object.fromEntries(
    CATEGORIES.filter((c) => Array.isArray(vision[c])).map((c) => [
      c,
      (vision[c] as unknown[]).map((item) => {
        if (!item || typeof item !== "object") return item
        const it = item as Record<string, unknown>
        if (!Array.isArray(it.positions)) return item
        return { ...it, positions: it.positions.map((p) => (p && typeof p === "object" ? fn(p as Record<string, unknown>) : p)) }
      }),
    ]),
  )
  return { ...raw, vision: { ...vision, ...mapped } }
}

/**
 * Claude が返したピクセルの positions を正規化 {x,y,width,height} へ直す。
 * 読めない枠は落とす(全画面などの推測では埋めない。後段の検証に任せる)。
 */
export function pipelinePixelsToNormalized(raw: unknown, size: ImageSize): unknown {
  if (!raw || typeof raw !== "object") return raw
  const converted = mapPositions(raw as Record<string, unknown>, (p) => {
    const region = pixelBoxToRegion(p, size)
    return region ? { x: region.x, y: region.y, width: region.w, height: region.h } : null
  })
  return dropNullPositions(converted)
}

function firstJsonObject(text: string): unknown | null {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

function dropNullPositions(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw
  const r = raw as Record<string, unknown>
  const vision = r.vision && typeof r.vision === "object" ? (r.vision as Record<string, unknown>) : null
  if (!vision) return raw
  const cleaned = Object.fromEntries(
    CATEGORIES.filter((c) => Array.isArray(vision[c])).map((c) => [
      c,
      (vision[c] as unknown[]).map((item) => {
        const it = item as Record<string, unknown>
        return it && Array.isArray(it.positions) ? { ...it, positions: it.positions.filter((p) => p !== null) } : item
      }),
    ]),
  )
  return { ...r, vision: { ...vision, ...cleaned } }
}

/**
 * Claude で解析し、正規化済みの生 JSON を返す。使えない・失敗したら null(呼び出し側が Gemini へ)。
 * buildPrompt には Claude が見る画像の大きさが渡る(ピクセル座標版のプロンプトを作るため)。
 * onUsage は応答が届いたときだけ 1 回呼ぶ(使えない応答で Gemini に切り替えたときも課金されるため)。
 */
export async function requestPipelineWithClaude(
  imageDataUrl: string,
  buildPrompt: (pixelSize: ImageSize) => string,
  onUsage?: (attempt: ClaudeAttemptUsage) => void,
): Promise<{ readonly raw: unknown; readonly model: string } | null> {
  const image = prepareClaudeImage(imageDataUrl)
  if (!image) return null
  const { model, pixelSize } = image
  let usage: ClaudeUsage | null = null
  const report = (ok: boolean) => {
    if (usage && onUsage) onUsage({ model, ...usage, ok })
  }
  try {
    const text = await callClaudeVision({
      base64: image.base64,
      mediaType: image.mediaType,
      prompt: buildPrompt(pixelSize),
      maxTokens: CLAUDE_PIPELINE_MAX_TOKENS,
      timeoutMs: CLAUDE_PIPELINE_TIMEOUT_MS,
      onUsage: (u) => {
        usage = u
      },
    })
    const json = firstJsonObject(text)
    if (!json) {
      console.warn("[hazard-game] Claude returned unreadable JSON; falling back to Gemini")
      report(false)
      return null
    }
    report(true)
    return { raw: pipelinePixelsToNormalized(json, pixelSize), model }
  } catch (err) {
    const status = (err as { status?: unknown })?.status
    console.warn(`[hazard-game] Claude analysis failed (${typeof status === "number" ? `status ${status}` : "error"}); falling back to Gemini`)
    report(false)
    return null
  }
}
