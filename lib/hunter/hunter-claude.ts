// =============================================
// きけんハンター 画像解析: Claude(Haiku 5.5)への依頼
// 解析は Claude を先に使い、キーが無い・画像を読めない・失敗したときは Gemini に切り替える
// (切り替えは hunter-ai.ts)。位置は Claude が得意なピクセル座標で受け、正規化座標へ直す。
// 失敗は throw せず null を返す。ログには失敗の種類だけを出す(画像・文面・鍵は出さない)。
// =============================================

import { callClaudeVision, claudeVisionModel, hasClaudeApiKey } from "@/lib/claude-vision"
import { extractHunterJson } from "@/lib/hunter/ai-json"
import { validateHunterResponse, type ValidatedHunterResponse } from "@/lib/hunter/ai-schema"
import {
  claudeImageLimits,
  claudeProcessedSize,
  parseImageDataUrl,
  readImageSize,
  type ImageMediaType,
  type ImageSize,
} from "@/lib/vision/image-size"

/** Claude 1 コールの上限。失敗したら Gemini を 1 回(20 秒)試しても、ルートの 60 秒に収まるように。 */
export const CLAUDE_HUNTER_TIMEOUT_MS = 30_000
/** 危険 4 つ + クイズ + 安全の工夫の JSON が収まる量。 */
export const CLAUDE_HUNTER_MAX_TOKENS = 8000

export interface ClaudeHunterImage {
  readonly base64: string
  readonly mediaType: ImageMediaType
  /** Claude が見る画像の大きさ(返ってくるピクセル座標の基準)。 */
  readonly pixelSize: ImageSize
  readonly model: string
}

/** Claude で解析できる画像なら、送る形と Claude が見る大きさを返す。できなければ null。 */
export function prepareClaudeHunterImage(imageDataUrl: string): ClaudeHunterImage | null {
  if (!hasClaudeApiKey()) return null
  const parsed = parseImageDataUrl(imageDataUrl)
  if (!parsed) return null
  const size = readImageSize(parsed)
  if (!size) return null
  const model = claudeVisionModel()
  return { ...parsed, pixelSize: claudeProcessedSize(size, claudeImageLimits(model)), model }
}

function failureKind(err: unknown): string {
  const status = (err as { status?: unknown })?.status
  if (typeof status === "number") return `status ${status}`
  return err instanceof Error ? err.name : "unknown"
}

/**
 * Claude に解析させ、検証済みの応答を返す。読めない応答・失敗は null(呼び出し側が Gemini へ)。
 * prompt は image.pixelSize を書いたピクセル座標版(buildHunterPrompt(..., { pixels }))を渡す。
 */
export async function analyzeHunterWithClaude(
  image: ClaudeHunterImage,
  prompt: string,
): Promise<ValidatedHunterResponse | null> {
  let text: string
  try {
    text = await callClaudeVision({
      base64: image.base64,
      mediaType: image.mediaType,
      prompt,
      maxTokens: CLAUDE_HUNTER_MAX_TOKENS,
      timeoutMs: CLAUDE_HUNTER_TIMEOUT_MS,
    })
  } catch (err) {
    console.warn(`[hunter] Claude analysis failed (${failureKind(err)}); falling back to Gemini`)
    return null
  }
  const extracted = extractHunterJson(text)
  if (!extracted.ok) {
    console.warn("[hunter] Claude returned unreadable JSON; falling back to Gemini")
    return null
  }
  return validateHunterResponse(extracted.value, { pixelSize: image.pixelSize })
}
