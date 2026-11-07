// =============================================
// きけんハンター 画像解析: Claude(Haiku 5.5)への依頼
// 解析は Claude を先に使い、キーが無い・画像を読めない・失敗したときは Gemini に切り替える
// (切り替えは hunter-ai.ts)。位置は Claude が得意なピクセル座標で受け、正規化座標へ直す。
// 失敗は throw せず null を返す。ログには失敗の種類だけを出す(画像・文面・鍵は出さない)。
// =============================================

import { callClaudeVision, type ClaudeUsage } from "@/lib/claude-vision"
import { extractHunterJson } from "@/lib/hunter/ai-json"
import { validateHunterResponse, type ValidatedHunterResponse } from "@/lib/hunter/ai-schema"
import { prepareClaudeImage, type ClaudeImage } from "@/lib/vision/claude-image"

/**
 * Claude 1 コールの上限。時間切れのあとの Gemini(35 秒 + 一時的失敗の再試行 20 秒)と合わせても
 * 約 85 秒で、画面が待つ 95 秒(hunter-game.tsx の ANALYZE_TIMEOUT_MS)に収まる。
 */
export const CLAUDE_HUNTER_TIMEOUT_MS = 30_000
/** 危険 4 つ + クイズ + 安全の工夫の JSON が収まる量。 */
export const CLAUDE_HUNTER_MAX_TOKENS = 8000

export type ClaudeHunterImage = ClaudeImage

/** Claude で解析できる画像なら、送る形と Claude が見る大きさを返す。できなければ null。 */
export function prepareClaudeHunterImage(imageDataUrl: string): ClaudeHunterImage | null {
  return prepareClaudeImage(imageDataUrl)
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
  /**
   * 試すたびに 1 回呼ぶ。ok は答えが読めたか。断り・打ち切り・読めない答えは届いたトークン数で、
   * 応答が届く前の失敗(時間切れ・401/429/529・通信)はトークン 0 で渡す(Gemini の失敗と同じく件数を残す)。
   */
  onUsage?: (usage: ClaudeUsage & { readonly ok: boolean }) => void,
): Promise<ValidatedHunterResponse | null> {
  let usage: ClaudeUsage = { inputTokens: 0, outputTokens: 0 }
  const report = (ok: boolean) => {
    onUsage?.({ ...usage, ok })
  }
  let text: string
  try {
    text = await callClaudeVision({
      base64: image.base64,
      mediaType: image.mediaType,
      prompt,
      maxTokens: CLAUDE_HUNTER_MAX_TOKENS,
      timeoutMs: CLAUDE_HUNTER_TIMEOUT_MS,
      onUsage: (u) => {
        usage = u
      },
    })
  } catch (err) {
    console.warn(`[hunter] Claude analysis failed (${failureKind(err)}); falling back to Gemini`)
    report(false)
    return null
  }
  const extracted = extractHunterJson(text)
  if (!extracted.ok) {
    console.warn("[hunter] Claude returned unreadable JSON; falling back to Gemini")
    report(false)
    return null
  }
  report(true)
  return validateHunterResponse(extracted.value, { pixelSize: image.pixelSize })
}
