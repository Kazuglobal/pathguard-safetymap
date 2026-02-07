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

