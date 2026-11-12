// =============================================
// Claude に送る画像の準備(きけんハンター・危険さがしゲームで共通)
// キーが無い・形式が違う・大きさが読めない・API の上限を超える画像は null を返し、
// 呼び出し側は Gemini で解析する。返す pixelSize は Claude が実際に見る大きさ
// (返ってくるピクセル座標の基準で、プロンプトにもこの値を書く)。
// =============================================

import { claudeVisionModel, hasClaudeApiKey } from "@/lib/claude-vision"
import {
  claudeImageLimits,
  claudeProcessedSize,
  parseImageDataUrl,
  readImageSize,
  type ImageMediaType,
  type ImageSize,
} from "@/lib/vision/image-size"

/**
 * 1 枚の画像の上限(Claude API は base64 のまま 10 MB)。
 * 1 MB = 1,000,000 として小さめに取る(超えると 400 になり、往復が 1 回むだになる)。
 */
export const CLAUDE_MAX_IMAGE_BASE64_CHARS = 10_000_000

export interface ClaudeImage {
  readonly base64: string
  readonly mediaType: ImageMediaType
  /** Claude が見る画像の大きさ(返ってくるピクセル座標の基準)。 */
  readonly pixelSize: ImageSize
  readonly model: string
}

/** Claude で解析できる画像なら、送る形と Claude が見る大きさを返す。できなければ null。 */
export function prepareClaudeImage(imageDataUrl: string): ClaudeImage | null {
  if (!hasClaudeApiKey()) return null
  const parsed = parseImageDataUrl(imageDataUrl)
  if (!parsed || parsed.base64.length > CLAUDE_MAX_IMAGE_BASE64_CHARS) return null
  const size = readImageSize(parsed)
  if (!size) return null
  const model = claudeVisionModel()
  return { ...parsed, pixelSize: claudeProcessedSize(size, claudeImageLimits(model)), model }
}
