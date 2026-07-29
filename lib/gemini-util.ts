export function getSanitizedGeminiApiKey(): string {
  const raw = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || ""
  const trimmed = raw.trim()
  // Strip surrounding quotes if present (common when copy/paste)
  const stripped = (trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ? trimmed.slice(1, -1)
    : trimmed
  if (!stripped) throw new Error("Missing GOOGLE_API_KEY or GEMINI_API_KEY")
  return stripped
}

export function getSanitizedGeminiModel(defaultModel = "gemini-2.5-flash"): string {
  const raw = process.env.GEMINI_IMAGE_MODEL || defaultModel
  return raw.trim()
}

export function getSanitizedGeminiVisionModel(defaultModel = "gemini-2.5-flash"): string {
  const raw = process.env.GEMINI_VISION_MODEL || defaultModel
  return raw.trim()
}

/**
 * リアルタイム写真解析(きけんハンター / ハザードゲーム)専用の既定Visionモデル。
 * GA版のGemini 3世代Flash。preview系ID(gemini-3-flash-preview)は廃止リスクがあるため使わない。
 * モデレーション・生成画像検証は安全側の実績既定(gemini-2.5-flash)を維持する。
 * GEMINI_VISION_MODEL を設定すると従来どおり全Vision呼び出しが一括で上書きされる。
 */
export const REALTIME_VISION_DEFAULT_MODEL = "gemini-3.5-flash"

